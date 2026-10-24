package validation;

import java.sql.*;
import java.net.*;
import java.net.http.*;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.*;
import static org.junit.jupiter.api.Assertions.*;

class TransactionTest extends DatabaseTest {
    @BeforeEach void tables() throws Exception {
        try (var c = connect()) {
            execute(c, "create table if not exists balance(id int primary key, available int not null check(available>=0))");
            execute(c, "create table if not exists operation(key text primary key, fingerprint text not null, state text not null)");
            execute(c, "create table if not exists refund_unit(unit int primary key, amount int not null)");
            execute(c, "create table if not exists restored(event text primary key, amount int not null)");
            execute(c, "create table if not exists restoration(id int primary key, remaining int not null check(remaining>=0))");
            execute(c, "create table if not exists payout(key text primary key, amount int not null, state text not null)");
            execute(c, "create table if not exists checkpoint(id int primary key, cursor int not null)");
            execute(c, "create table if not exists entry(id int primary key, occurred timestamptz not null)");
            execute(c, "truncate balance,operation,refund_unit,restored,restoration,payout,checkpoint,entry");
        }
    }
    @Test void concurrentAttemptClaimIsDurableAndDifferentFingerprintIsRejected() throws Exception {
        Callable<String> claim = () -> claimPayment("order-A:10000:KRW");
        assertEquals(Set.of("CLAIMED","REPLAY"),new HashSet<>(race(claim,claim)));
        assertEquals("CONFLICT",claimPayment("order-B:20000:KRW"));
        try (var observer=connect()) {
            assertEquals("PENDING",value(observer,"select state from operation where key='pay-1'"));
            assertNotEquals("order-B:20000:KRW",value(observer,"select fingerprint from operation where key='pay-1'"));
            assertEquals(1,number(observer,"select count(*) from operation"));
        }
    }
    String claimPayment(String fingerprint) throws Exception {
        try(var c=connect()) {
            c.setAutoCommit(false);
            int inserted=execute(c,"insert into operation values('pay-1',?,'PENDING') on conflict do nothing",fingerprint);
            String result=inserted==1?"CLAIMED":fingerprint.equals(value(c,"select fingerprint from operation where key='pay-1'"))?"REPLAY":"CONFLICT";
            c.commit();return result;
        }
    }
    @Test void lostApprovalResponseKeepsDurableAttemptAndReconcilesWithoutNewApproval() throws Exception {
        var approvals=new AtomicInteger();var durableBeforeCall=new AtomicBoolean();
        var providerApproved=new AtomicBoolean();
        var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        server.createContext("/approve",exchange->{
            approvals.incrementAndGet();
            try(var observer=connect()){
                durableBeforeCall.set(number(observer,"select count(*) from operation where key='attempt-1' and state='PENDING'")==1);
            } catch(Exception error){throw new IOException(error);}
            assertEquals("attempt-1",exchange.getRequestHeaders().getFirst("Idempotency-Key"));
            exchange.getRequestBody().readAllBytes();providerApproved.set(true);
            exchange.sendResponseHeaders(200,100);exchange.getResponseBody().write('{');exchange.close(); // Truncated response after approval.
        });
        server.createContext("/status",exchange->{
            byte[] result=(providerApproved.get()?"APPROVED:attempt-1":"NOT_FOUND").getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200,result.length);exchange.getResponseBody().write(result);exchange.close();
        });
        server.start();
        try(var c=connect();var client=HttpClient.newHttpClient()) {
            c.setAutoCommit(false);execute(c,"insert into operation values('attempt-1','order-A:10000:KRW','PENDING')");
            try(var observer=connect()){assertEquals(0,number(observer,"select count(*) from operation"));}
            c.commit();
            String endpoint="http://127.0.0.1:"+server.getAddress().getPort();
            var approval=HttpRequest.newBuilder(URI.create(endpoint+"/approve")).timeout(java.time.Duration.ofSeconds(3))
                .header("Idempotency-Key","attempt-1").POST(HttpRequest.BodyPublishers.ofString("order-A:10000:KRW")).build();
            assertThrows(IOException.class,()->client.send(approval,HttpResponse.BodyHandlers.ofString()));
            assertTrue(durableBeforeCall.get());assertEquals(1,approvals.get());
            execute(c,"update operation set state='UNCERTAIN' where key='attempt-1' and state='PENDING'");c.commit();
            assertEquals("UNCERTAIN",value(c,"select state from operation"));
            var status=client.send(HttpRequest.newBuilder(URI.create(endpoint+"/status")).build(),HttpResponse.BodyHandlers.ofString());
            assertEquals("APPROVED:attempt-1",status.body());
            assertEquals(1,execute(c,"update operation set state='SUCCEEDED' where key='attempt-1' and state='UNCERTAIN'"));c.commit();
            assertEquals(0,execute(c,"update operation set state='FAILED' where key='attempt-1' and state in ('PENDING','UNCERTAIN')"));c.commit();
            assertEquals(1,approvals.get()); // Neither a late failure nor elapsed key retention creates another approval.
        } finally {server.stop(0);}
    }
    @Test void refundUnitConflictRollsBackTheWholeReservationEvenBelowOrderCap() throws Exception {
        try(var c=connect()) {
            execute(c,"insert into balance values(1,13340)"); // 20,009 minus uncertain 6,669.
            execute(c,"insert into refund_unit values(1,6669)");
            c.setAutoCommit(false);
            assertEquals(1,execute(c,"update balance set available=available-13339 where id=1 and available>=13339"));
            execute(c,"insert into refund_unit values(2,6670)");
            var error=assertThrows(SQLException.class,()->execute(c,"insert into refund_unit values(1,6669)"));
            assertEquals("23505",error.getSQLState()); c.rollback();
            assertEquals(13340,number(c,"select available from balance where id=1"));
            assertEquals(1,number(c,"select count(*) from refund_unit"));
        }
    }
    @Test void concurrentRefundsCannotBothReserveTheLastAmount() throws Exception {
        try(var c=connect()){execute(c,"insert into balance values(1,6670)");}
        Callable<Integer> reserve=()->{try(var c=connect()){return execute(c,"update balance set available=available-6670 where id=1 and available>=6670");}};
        assertEquals(1,race(reserve,reserve).stream().mapToInt(Integer::intValue).sum());
        try(var c=connect()){assertEquals(0,number(c,"select available from balance"));}
    }
    @Test void lockTimeoutAndAbortedTransactionRequireRollback() throws Exception {
        try(var owner=connect();var contender=connect()) {
            execute(owner,"insert into balance values(1,2)"); owner.setAutoCommit(false); contender.setAutoCommit(false);
            execute(owner,"update balance set available=available-1 where id=1");
            execute(contender,"set local lock_timeout='100ms'");
            assertEquals("55P03",assertThrows(SQLException.class,()->execute(contender,"update balance set available=available-1 where id=1")).getSQLState());
            assertEquals("25P02",assertThrows(SQLException.class,()->value(contender,"select 1")).getSQLState());
            contender.rollback(); owner.commit();
            assertEquals(1,execute(contender,"update balance set available=available-1 where id=1 and available>=1")); contender.commit();
        }
    }
    @Test void deadlockVictimCanRetryOnlyAfterEndingItsTransaction() throws Exception {
        try(var c=connect()){execute(c,"insert into balance values(1,0),(2,0)");}
        var locked=new CountDownLatch(2);
        var results=race(()->deadlock(1,2,locked),()->deadlock(2,1,locked));
        assertEquals(1,results.stream().filter("40P01"::equals).count());
        assertEquals(1,results.stream().filter("committed"::equals).count());
        try(var c=connect()) {
            c.setAutoCommit(false); execute(c,"update balance set available=available+1 where id in (1,2)"); c.commit();
            assertEquals(4,number(c,"select sum(available) from balance"));
        }
    }
    String deadlock(int first,int second,CountDownLatch locked) throws Exception {
        try(var c=connect()) {
            c.setAutoCommit(false); execute(c,"update balance set available=available+1 where id=?",first);
            locked.countDown(); assertTrue(locked.await(5,TimeUnit.SECONDS));
            try {execute(c,"update balance set available=available+1 where id=?",second); c.commit();return "committed";}
            catch(SQLException error){c.rollback();return error.getSQLState();}
        }
    }
    @Test void restorationBusinessKeyAndOriginalLimitAreAtomic() throws Exception {
        try(var c=connect()){execute(c,"insert into restoration values(1,100)");}
        assertEquals(1,race(()->restore("event-a",80),()->restore("event-a",80)).stream().mapToInt(Integer::intValue).sum());
        assertEquals(0,restore("event-b",30));
        try(var c=connect()) {
            assertEquals(20,number(c,"select remaining from restoration"));
            assertEquals(80,number(c,"select sum(amount) from restored"));
        }
    }
    int restore(String key,int amount) throws Exception {
        try(var c=connect()) {
            c.setAutoCommit(false);
            if(execute(c,"insert into restored values(?,?) on conflict do nothing",key,amount)==0){c.rollback();return 0;}
            if(execute(c,"update restoration set remaining=remaining-? where id=1 and remaining>=?",amount,amount)==0){c.rollback();return 0;}
            c.commit(); return 1;
        }
    }
    @Test void payoutUncertaintyKeepsFundsReservedUntilTerminalReconciliation() throws Exception {
        try(var c=connect()) {
            execute(c,"insert into balance values(1,100)"); c.setAutoCommit(false);
            execute(c,"update balance set available=available-70 where id=1 and available>=70");
            execute(c,"insert into payout values('transfer-1',70,'UNCERTAIN')"); c.commit();
            assertEquals(0,execute(c,"update balance set available=available-70 where id=1 and available>=70"));
            assertEquals(1,execute(c,"update payout set state='SUCCEEDED' where key='transfer-1' and state='UNCERTAIN'"));
            assertEquals(0,execute(c,"update payout set state='FAILED' where key='transfer-1' and state='UNCERTAIN'"));
            assertEquals(100,number(c,"select (select available from balance)+sum(amount) from payout where state='SUCCEEDED'"));
        }
    }
    @Test void checkpointAndBusinessEffectRollBackTogetherAndSeoulDayIsHalfOpen() throws Exception {
        try(var c=connect()) {
            execute(c,"insert into checkpoint values(1,0)"); c.setAutoCommit(false);
            execute(c,"insert into restored values('settlement-1',100)");
            execute(c,"update checkpoint set cursor=1 where id=1"); c.rollback();
            assertEquals(0,number(c,"select cursor from checkpoint"));
            assertEquals(0,number(c,"select count(*) from restored"));
            execute(c,"insert into restored values('settlement-1',100) on conflict do nothing");
            execute(c,"update checkpoint set cursor=1 where id=1"); c.commit();
            assertEquals(0,execute(c,"insert into restored values('settlement-1',100) on conflict do nothing"));
            execute(c,"insert into entry values(1,'2026-10-23T15:00:00Z'),(2,'2026-10-24T15:00:00Z')");
            assertEquals(1,number(c,"select count(*) from entry where occurred >= timestamp '2026-10-24 00:00:00' at time zone 'Asia/Seoul' and occurred < timestamp '2026-10-25 00:00:00' at time zone 'Asia/Seoul'"));
        }
    }
}
