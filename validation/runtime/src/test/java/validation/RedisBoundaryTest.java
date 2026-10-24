package validation;

import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import redis.clients.jedis.*;
import redis.clients.jedis.params.*;
import redis.clients.jedis.exceptions.JedisDataException;
import static org.junit.jupiter.api.Assertions.*;

class RedisBoundaryTest extends DatabaseTest {
    static final int PORT=Integer.parseInt(System.getenv("COMMERCE_TEST_REDIS_PORT"));
    static final String PREFIX="validation:"+UUID.randomUUID()+":";
    static Jedis redis(){var client=new Jedis("127.0.0.1",PORT);client.auth(PASSWORD);return client;}
    @BeforeEach void tables() throws Exception {
        try(var c=connect()){
            execute(c,"create table if not exists campaign(id int primary key,remaining int check(remaining>=0))");
            execute(c,"create table if not exists issuance(key text primary key)");
            execute(c,"create table if not exists fenced(id int primary key,token bigint,value text)");
            execute(c,"truncate campaign,issuance,fenced");execute(c,"insert into campaign values(1,1)");
        }
    }
    int issue(String key) throws Exception {
        try(var c=connect()){
            c.setAutoCommit(false);
            if(execute(c,"insert into issuance values(?) on conflict do nothing",key)==0){c.rollback();return 0;}
            if(execute(c,"update campaign set remaining=remaining-1 where id=1 and remaining>=1")==0){c.rollback();return 0;}
            c.commit();return 1;
        }
    }
    @Test void streamRedeliveryAfterDbCommitBeforeAckIsIdempotent() throws Exception {
        String stream=PREFIX+"stream";
        StreamEntryID id;
        try(var consumer=redis()){
            consumer.xgroupCreate(stream,"workers",new StreamEntryID("0-0"),true);
            id=consumer.xadd(stream,StreamEntryID.NEW_ENTRY,Map.of("request","coupon-a"));
            var delivered=consumer.xreadGroup("workers","A",XReadGroupParams.xReadGroupParams().count(1),Map.of(stream,StreamEntryID.UNRECEIVED_ENTRY));
            assertEquals(id,delivered.getFirst().getValue().getFirst().getID());
            assertEquals(1,issue("coupon-a"));
            // Consumer disconnects after durable commit and before XACK.
        }
        try(var replacement=redis()){
            assertEquals(1,replacement.xpending(stream,"workers").getTotal());
            var redelivered=replacement.xclaim(stream,"workers","B",0,XClaimParams.xClaimParams(),id);
            assertEquals(id,redelivered.getFirst().getID());assertEquals(0,issue("coupon-a"));
            assertEquals(1,replacement.xack(stream,"workers",id));
            assertEquals(0,replacement.xpending(stream,"workers").getTotal());replacement.del(stream);
        }
        try(var c=connect()){assertEquals(1,number(c,"select count(*) from issuance"));assertEquals(0,number(c,"select remaining from campaign"));}
    }
    @Test void redisReservationLossStillCannotExceedDbCap() throws Exception {
        try(var redis=redis()){
            String reservation=PREFIX+"reservation";
            redis.set(reservation,"attempt-a");assertEquals(1,issue("attempt-a"));
            redis.del(reservation); // Controlled reservation loss, not a failover test.
            redis.set(reservation,"attempt-b");assertEquals(0,issue("attempt-b"));redis.del(reservation);
        }
        try(var c=connect()){assertEquals(1,number(c,"select count(*) from issuance"));assertEquals(0,number(c,"select remaining from campaign"));}
    }
    @Test void luaRuntimeErrorDoesNotRollBackEarlierWrites() {
        try(var redis=redis()){
            String stock=PREFIX+"error-stock",claims=PREFIX+"error-claims";
            redis.set(stock,"2");redis.set(claims,"wrong-type");
            assertThrows(JedisDataException.class,()->redis.eval("redis.call('DECR',KEYS[1]);redis.call('HSET',KEYS[2],'attempt','a');return 1",List.of(stock,claims),List.of()));
            assertEquals("1",redis.get(stock)); // The decrement survived the WRONGTYPE error.
            redis.set(stock,"2");
            String guarded="local t=redis.call('TYPE',KEYS[2]).ok;if t~='none' and t~='hash' then return redis.error_reply('unexpected claim type') end;redis.call('DECR',KEYS[1]);redis.call('HSET',KEYS[2],'attempt','a');return 1";
            assertThrows(JedisDataException.class,()->redis.eval(guarded,List.of(stock,claims),List.of()));
            assertEquals("2",redis.get(stock));redis.del(stock,claims);
        }
    }
    @Test void expiredOwnerNeedsResourceFencingAndCompensationNeedsAttemptToken() throws Exception {
        try(var redis=redis();var c=connect()){
            String lock=PREFIX+"lock",sequence=PREFIX+"sequence",stock=PREFIX+"stock",reservation=PREFIX+"claim";
            long oldToken=redis.incr(sequence);assertEquals("OK",redis.set(lock,"old",SetParams.setParams().nx().px(100)));
            var deadline=Instant.now().plusSeconds(3);
            while(redis.exists(lock)&&Instant.now().isBefore(deadline))Thread.sleep(10);
            assertFalse(redis.exists(lock));long currentToken=redis.incr(sequence);
            assertEquals("OK",redis.set(lock,"new",SetParams.setParams().nx().px(1000)));
            execute(c,"insert into fenced values(1,0,'initial')");
            assertEquals(1,execute(c,"update fenced set token=?,value='new' where id=1 and token<?",currentToken,currentToken));
            assertEquals(0,execute(c,"update fenced set token=?,value='stale' where id=1 and token<?",oldToken,oldToken));
            assertEquals("new",value(c,"select value from fenced"));
            redis.set(stock,"0");redis.set(reservation,"new-attempt");
            String compensate="if redis.call('GET',KEYS[1])==ARGV[1] then redis.call('DEL',KEYS[1]);redis.call('INCR',KEYS[2]);return 1 else return 0 end";
            assertEquals(0L,redis.eval(compensate,List.of(reservation,stock),List.of("old-attempt")));
            assertEquals("0",redis.get(stock));assertEquals("new-attempt",redis.get(reservation));
            assertEquals(1L,redis.eval(compensate,List.of(reservation,stock),List.of("new-attempt")));
            assertEquals(0L,redis.eval(compensate,List.of(reservation,stock),List.of("new-attempt")));assertEquals("1",redis.get(stock));
            redis.del(lock,sequence,stock,reservation);
        }
    }
}
