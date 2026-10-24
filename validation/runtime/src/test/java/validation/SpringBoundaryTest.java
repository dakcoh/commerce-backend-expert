package validation;

import java.security.*;
import java.security.interfaces.*;
import java.time.*;
import java.util.*;
import jakarta.persistence.*;
import javax.sql.DataSource;
import com.nimbusds.jose.*;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jwt.*;
import org.junit.jupiter.api.*;
import org.springframework.aop.support.AopUtils;
import org.springframework.context.annotation.*;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.orm.jpa.*;
import org.springframework.orm.jpa.vendor.HibernateJpaVendorAdapter;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.core.*;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.transaction.*;
import org.springframework.transaction.annotation.*;
import org.springframework.transaction.interceptor.TransactionAspectSupport;
import static org.junit.jupiter.api.Assertions.*;

class SpringBoundaryTest extends DatabaseTest {
    static AnnotationConfigApplicationContext context;
    @Configuration
    @EnableTransactionManagement(proxyTargetClass=true)
    @EnableMethodSecurity(proxyTargetClass=true)
    static class Config {
        @Bean DataSource dataSource(){return new DriverManagerDataSource(URL+"?currentSchema="+SCHEMA,"commerce",PASSWORD);}
        @Bean LocalContainerEntityManagerFactoryBean entityManagerFactory(DataSource dataSource){
            var factory=new LocalContainerEntityManagerFactoryBean();
            factory.setDataSource(dataSource);factory.setPackagesToScan("validation");
            factory.setJpaVendorAdapter(new HibernateJpaVendorAdapter());
            factory.setJpaPropertyMap(Map.of("hibernate.hbm2ddl.auto","create-drop","hibernate.default_schema",SCHEMA));return factory;
        }
        @Bean PlatformTransactionManager transactionManager(EntityManagerFactory factory){return new JpaTransactionManager(factory);}
        @Bean Worker worker(EntityManagerFactory factory){return new Worker(SharedEntityManagerCreator.createSharedEntityManager(factory));}
        @Bean Ownership ownership(){return new Ownership();}
    }
    public static class Worker {
        private final EntityManager em;
        private boolean rollbackOnly;
        Worker(EntityManager em){this.em=em;}
        @Transactional public void seed(){em.persist(new Stock(1,100));}
        @Transactional public void conflict() throws Exception {
            var stock=em.find(Stock.class,1L);
            try(var external=connect()){execute(external,"update jpa_stock set quantity=99,version=version+1 where id=1");}
            em.persist(new Stock(2,50)); stock.quantity--;
            try {em.flush();fail("Expected version conflict");}
            catch(OptimisticLockException expected){rollbackOnly=TransactionAspectSupport.currentTransactionStatus().isRollbackOnly();}
        }
        public boolean sawRollbackOnly(){return rollbackOnly;}
        @Transactional public void freshAttempt(){var stock=em.find(Stock.class,1L);stock.quantity--;}
    }
    public static class Ownership {
        @PreAuthorize("#tenant == authentication.token.claims['tenant'] and #owner == authentication.name")
        public String read(String tenant,String owner){return "permitted";}
    }
    @BeforeAll static void startSpring(){context=new AnnotationConfigApplicationContext(Config.class);}
    @AfterAll static void stopSpring(){if(context!=null)context.close();}
    @AfterEach void clearAuthentication(){SecurityContextHolder.clearContext();}
    @Test void actualJpaFlushMarksRollbackOnlyAndProxyRetryUsesAFreshTransaction() throws Exception {
        var worker=context.getBean(Worker.class);assertTrue(AopUtils.isAopProxy(worker));worker.seed();
        assertThrows(UnexpectedRollbackException.class,worker::conflict);
        assertTrue(worker.sawRollbackOnly());
        try(var c=connect()){
            assertEquals(99,number(c,"select quantity from jpa_stock where id=1"));
            assertEquals(0,number(c,"select count(*) from jpa_stock where id=2"));
        }
        worker.freshAttempt();
        try(var c=connect()){assertEquals(98,number(c,"select quantity from jpa_stock where id=1"));}
    }
    @Test void signedJwtStillNeedsIssuerTimeAudienceAndResourceAuthorization() throws Exception {
        var generator=KeyPairGenerator.getInstance("RSA");generator.initialize(2048);
        var keys=generator.generateKeyPair();var other=generator.generateKeyPair();
        var decoder=NimbusJwtDecoder.withPublicKey((RSAPublicKey)keys.getPublic()).build();
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(JwtValidators.createDefaultWithIssuer("https://fixture.invalid/issuer"),
            new JwtClaimValidator<List<String>>(JwtClaimNames.AUD,audience->audience!=null&&audience.contains("commerce"))));
        var now=Instant.now();
        var valid=decoder.decode(token(keys,"https://fixture.invalid/issuer","commerce",now.minusSeconds(10),now.plusSeconds(300)));
        assertThrows(JwtException.class,()->decoder.decode(token(other,"https://fixture.invalid/issuer","commerce",now.minusSeconds(10),now.plusSeconds(300))));
        assertThrows(JwtException.class,()->decoder.decode(token(keys,"https://wrong.invalid","commerce",now.minusSeconds(10),now.plusSeconds(300))));
        assertThrows(JwtException.class,()->decoder.decode(token(keys,"https://fixture.invalid/issuer","other",now.minusSeconds(10),now.plusSeconds(300))));
        assertThrows(JwtException.class,()->decoder.decode(token(keys,"https://fixture.invalid/issuer","commerce",now.minusSeconds(600),now.minusSeconds(300))));
        assertThrows(JwtException.class,()->decoder.decode(token(keys,"https://fixture.invalid/issuer","commerce",now.plusSeconds(300),now.plusSeconds(600))));
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(valid,List.of(),valid.getSubject()));
        var service=context.getBean(Ownership.class);assertTrue(AopUtils.isAopProxy(service));
        assertEquals("permitted",service.read("tenant-A","owner-A"));
        assertThrows(AccessDeniedException.class,()->service.read("tenant-B","owner-A"));
        assertThrows(AccessDeniedException.class,()->service.read("tenant-A","owner-B"));
    }
    String token(KeyPair pair,String issuer,String audience,Instant notBefore,Instant expires) throws Exception {
        var claims=new JWTClaimsSet.Builder().subject("owner-A").issuer(issuer).audience(audience).claim("tenant","tenant-A")
            .notBeforeTime(Date.from(notBefore)).expirationTime(Date.from(expires)).build();
        var jwt=new SignedJWT(new JWSHeader(JWSAlgorithm.RS256),claims);
        jwt.sign(new RSASSASigner((RSAPrivateKey)pair.getPrivate()));return jwt.serialize();
    }
}
