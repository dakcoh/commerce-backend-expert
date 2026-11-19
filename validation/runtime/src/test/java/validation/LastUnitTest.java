package validation;

import java.sql.Connection;
import java.util.List;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class LastUnitTest extends DatabaseTest {
    @Test void onlyWinningOrderCommitsTheLastUnitAndItsDeduction() throws Exception {
        try (var setup = connect()) {
            execute(setup, "create table stock_balance(sku text primary key, quantity int not null check(quantity >= 0))");
            execute(setup, "create table confirmed_order(id text primary key)");
            execute(setup, "create table stock_deduction(order_id text references confirmed_order, sku text references stock_balance, units int not null)");
            execute(setup, "insert into stock_balance values ('sku-1', 1)");
        }

        var bothSawOne = new CyclicBarrier(2);
        var orderIds = List.of("order-A", "order-B");
        var accepted = race(() -> placeOrder(orderIds.get(0), bothSawOne),
                            () -> placeOrder(orderIds.get(1), bothSawOne));
        assertEquals(1, accepted.stream().filter(Boolean::booleanValue).count(), "exactly one successful request");
        var winner = orderIds.get(accepted.indexOf(true));
        try (var observer = connect()) {
            assertEquals(0, number(observer, "select quantity from stock_balance where sku='sku-1'"));
            assertEquals(1, number(observer, "select count(*) from confirmed_order"));
            assertEquals(winner, value(observer, "select id from confirmed_order"));
            assertEquals(1, number(observer, "select count(*) from stock_deduction"));
            assertEquals(winner, value(observer, "select order_id from stock_deduction where sku='sku-1' and units=1"));
        }
    }

    private boolean placeOrder(String orderId, CyclicBarrier bothSawOne) throws Exception {
        try (Connection db = connect()) {
            db.setAutoCommit(false);
            assertEquals(1, number(db, "select quantity from stock_balance where sku='sku-1'"));
            bothSawOne.await(5, TimeUnit.SECONDS);
            int changed = execute(db, "update stock_balance set quantity=quantity-1 where sku='sku-1' and quantity>=1");
            if (changed == 0) {
                db.rollback();
                return false;
            }
            execute(db, "insert into confirmed_order values (?)", orderId);
            execute(db, "insert into stock_deduction values (?, 'sku-1', 1)", orderId);
            db.commit();
            return true;
        }
    }
}
