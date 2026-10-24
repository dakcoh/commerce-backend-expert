package validation;

import java.sql.*;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import static org.junit.jupiter.api.Assertions.*;

// Synthetic reference transactions; no application backend or provider SDK.
@Timeout(30)
abstract class DatabaseTest {
    static final String URL = Objects.requireNonNull(System.getenv("COMMERCE_TEST_DB"));
    static final String PASSWORD = Objects.requireNonNull(System.getenv("COMMERCE_TEST_PASSWORD"));
    static final String SCHEMA = "v_" + UUID.randomUUID().toString().replace("-", "");

    static Connection connect() throws SQLException {
        assertTrue(URL.matches("jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/commerce_validation"));
        var connection = DriverManager.getConnection(URL, "commerce", PASSWORD);
        try {
            assertEquals("commerce_rule_validation", value(connection, "select current_setting('cluster_name')"));
            execute(connection, "set search_path to " + SCHEMA);
            execute(connection, "set statement_timeout='5s'");
            return connection;
        } catch (Throwable error) { connection.close(); throw error; }
    }
    @BeforeAll static void createSchema() throws Exception {
        try (var connection = connect()) { execute(connection, "create schema if not exists " + SCHEMA); }
    }
    @AfterAll static void removeSchema() throws Exception {
        try (var connection = connect()) { execute(connection, "drop schema " + SCHEMA + " cascade"); }
    }
    static int execute(Connection connection, String sql, Object... values) throws SQLException {
        try (var statement = connection.prepareStatement(sql)) {
            for (int i=0; i<values.length; i++) statement.setObject(i+1, values[i]);
            return statement.executeUpdate();
        }
    }
    static Object value(Connection connection, String sql) throws SQLException {
        try (var statement = connection.createStatement(); var result = statement.executeQuery(sql)) {
            assertTrue(result.next()); return result.getObject(1);
        }
    }
    static long number(Connection connection, String sql) throws SQLException { return ((Number)value(connection, sql)).longValue(); }
    static <T> List<T> race(Callable<T> first, Callable<T> second) throws Exception {
        try (var pool = Executors.newFixedThreadPool(2)) {
            var ready = new CountDownLatch(2); var start = new CountDownLatch(1);
            List<Future<T>> futures = new ArrayList<>();
            for (var action : List.of(first, second)) futures.add(pool.submit(() -> {
                ready.countDown(); assertTrue(start.await(5, TimeUnit.SECONDS)); return action.call();
            }));
            assertTrue(ready.await(5, TimeUnit.SECONDS)); start.countDown();
            List<T> results = new ArrayList<>();
            for (var future : futures) results.add(future.get(10, TimeUnit.SECONDS));
            return results;
        }
    }
}
