# 격리 런타임 검증

#18의 지침을 합성 거래로 확인하는 선택적 검증이다. PostgreSQL·Redis·Spring/JPA를 실제 실행하지만, 특정 상용 백엔드의 구현·운영 계약을 검증한 결과는 아니다. 플러그인은 계속 Markdown 스킬과 Node.js 세션 훅이며 이 테스트의 Java·Gradle·DB를 실행 의존성으로 사용하지 않는다.

## 실행 환경과 준비

2026-10-24에 Windows x64·WSL Ubuntu 24.04·Python 3.12.3·JDK 21.0.2·Gradle 8.14.5에서 실행했다. PostgreSQL 16.15와 Redis 7.0.15는 아래 시험 프로세스에서만 사용한다. 문서의 PostgreSQL 18 설명 전체나 다른 제품 버전의 동작까지 검증했다고 간주하지 않는다.

WSL 안에서 사용 가능한 `redis-server`·`redis-cli`와 PostgreSQL의 `postgres`·`initdb`·`pg_ctl`·`createdb`가 필요하다. 이번 실행은 Ubuntu 공식 패키지를 다운로드·압축 해제했으며 시스템 패키지·서비스 설정을 변경하지 않았다. 아래는 **WSL 셸**에서 실행한 준비 방법이다. 기존 전역 설치가 아닌 시험용 접두 경로를 만든다.

```bash
mkdir -p output/runtime-tools/pg16
cd output/runtime-tools/pg16
apt-get download postgresql-16=16.15-0ubuntu0.24.04.1 postgresql-client-16=16.15-0ubuntu0.24.04.1 libpq5=16.15-0ubuntu0.24.04.1 libllvm18
for package in *.deb; do dpkg-deb -x "$package" root; done
```

패키지 가용성·추가 공유 라이브러리는 배포판에 따라 다르다. 실행 파일은 저장소에 커밋하지 않는다. 준비된 경로·JDK·Gradle을 전달해 **PowerShell**에서 실행한다.

```powershell
./scripts/smoke-runtime.ps1 `
  -PostgresBin /mnt/c/project/commerce-context-mcp/output/runtime-tools/pg16/root/usr/lib/postgresql/16/bin `
  -GradlePath /absolute/path/to/gradle-8.14.5/bin/gradle.bat `
  -JavaHome /absolute/path/to/jdk-21
```

실행기는 매번 새 데이터 클러스터·인증값·포트와 `output/runtime-*` 폴더를 만든다. 서버는 loopback에만 바인딩한다. PostgreSQL의 POSIX 데이터 권한을 위해 WSL 임시 디렉터리에 클러스터를 두며, 정상·실패 종료 시 직접 만든 클러스터와 서비스만 정리하고 포트가 닫혔는지 검사한다. 환경변수는 복원한다. 기존 DB 주소를 인자로 받지 않으며 테스트도 전용 DB명·클러스터 표식을 확인한다.

첫 실행에서 Maven Central의 고정 버전 개발 의존성을 `output/runtime-gradle`에 받는다. 기본 `npm ci`, `npm test`, 배포 스킬에는 추가하지 않는다. 코드·SQL은 재현용 최소 거래이며 복사해서 운영 구현으로 쓰는 예제가 아니다.

## 확인한 사례 15개

| 테스트 | 실행·판정 |
|---|---|
| concurrentAttemptClaimIsDurableAndDifferentFingerprintIsRejected | 두 연결이 같은 업무키를 선점해 하나만 생성하고, 다른 요청 지문은 거부한다. 커밋 후 새 연결에서 PENDING이 보인다. |
| lostApprovalResponseKeepsDurableAttemptAndReconcilesWithoutNewApproval | localhost 승인 대역이 승인 후 응답 body를 절단한다. 영속 시도를 UNCERTAIN으로 남기고 조회로 확정하며 늦은 실패로 되돌리거나 재승인하지 않는다. |
| refundUnitConflictRollsBackTheWholeReservationEvenBelowOrderCap | 주문 한도 안의 중복 단위 삽입을 UNIQUE가 거부하고 같은 트랜잭션의 확보액·다른 단위 삽입도 롤백한다. |
| concurrentRefundsCannotBothReserveTheLastAmount | 두 DB 연결의 조건부 UPDATE 중 하나만 마지막 환불 가능액을 확보한다. |
| lockTimeoutAndAbortedTransactionRequireRollback | 실제 행 잠금에 55P03, 실패한 트랜잭션의 후속 쿼리에 25P02가 발생한다. 롤백 후 재시도한다. |
| deadlockVictimCanRetryOnlyAfterEndingItsTransaction | 두 연결의 역순 잠금에서 한 트랜잭션이 40P01로 중단된다. 종료 뒤 새 거래로 재시도하고 결과를 대사한다. |
| restorationBusinessKeyAndOriginalLimitAreAtomic | 중복 이벤트와 원 사용량 초과 복원을 트랜잭션·업무키·조건부 갱신으로 거부한다. |
| payoutUncertaintyKeepsFundsReservedUntilTerminalReconciliation | 미확정 지급이 확보한 금액으로 다른 지급을 허용하지 않고, 성공 확정 후 늦은 실패를 무시해 잔액을 대사한다. |
| checkpointAndBusinessEffectRollBackTogetherAndSeoulDayIsHalfOpen | 중간 롤백에서 결과와 체크포인트가 함께 취소되고 업무키로 재실행을 중복 방어한다. 서울 업무일의 시작은 포함하고 다음 시작은 제외한다. |
| streamRedeliveryAfterDbCommitBeforeAckIsIdempotent | Redis Streams 소비자 A가 DB 커밋 뒤 ack 없이 연결을 닫는다. B가 pending을 인수해 중복 효과 없이 ack한다. |
| redisReservationLossStillCannotExceedDbCap | Redis 선점 키를 삭제해 새 선점이 가능해져도 DB의 최종 발급 한도와 원장이 초과 발급을 막는다. |
| expiredOwnerNeedsResourceFencingAndCompensationNeedsAttemptToken | 실제 Redis lease 만료 후 새 토큰을 얻고 보호 DB가 오래된 쓰기를 거부한다. 이전·중복 보상은 수량을 늘리지 않는다. |
| luaRuntimeErrorDoesNotRollBackEarlierWrites | DECR 뒤 WRONGTYPE이면 앞선 감소가 남는다. 같은 타입 오류를 첫 쓰기 전에 검사하면 수량이 유지된다. |
| actualJpaFlushMarksRollbackOnlyAndProxyRetryUsesAFreshTransaction | 실제 Hibernate flush 충돌을 잡아도 rollback-only가 유지되고 프록시 종료 시 UnexpectedRollbackException이 난다. 새 트랜잭션 재시도는 성공한다. |
| signedJwtStillNeedsIssuerTimeAudienceAndResourceAuthorization | 로컬 RSA JWT의 서명·issuer·audience·exp·nbf 실패를 실제 decoder가 거부한다. 활성화된 메서드 프록시가 다른 테넌트·소유자를 거부한다. |

JUnit XML과 HTML은 `output/runtime-*/build`에, 서비스 버전과 정리 확인은 같은 폴더의 `versions.json`·`cleanup.json`에 남는다. [공개 실행 요약](results/2026-10-24.json)은 성공한 최종 실행의 테스트 이름·버전·소스 해시를 보관한다. 기본 오프라인 테스트 37개와 별도이며 모델 평가 통과 수에 합산하지 않는다.

## 확인하지 않은 범위

- 실제 PG의 승인·망취소·키 보존 기간·지급 API는 호출하지 않았다. localhost 대역은 전송 실패 복구 사례이며 토스 API 호환성을 인증하지 않는다.
- Redis 선점 키 삭제는 실제 재시작·복제·네트워크 분할·클러스터 failover가 아니다. Redisson 래퍼·전체 큐 제품군의 동작도 검증하지 않았다.
- 합성 포인트·정산 정책은 특정 회사의 만료·세금·보존 기간·장부를 승인하지 않는다. 실제 Spring Batch 재시작·대규모 데이터 변경이나 HTTP 보안 필터 전체를 실행하지 않았다.
- Cursor·OpenClaw의 모델 선택·문서 적용은 실행하지 않았다. [Cursor 인증 경계 probe](../../scripts/probe-cursor.js)는 세 설치 조합 모두의 `Authentication required`를 기록하며 발견 성공으로 집계하지 않는다.

English: Optional synthetic integration checks run real PostgreSQL, Redis, Spring/JPA, and JWT/method authorization in isolated local services. Fifteen cases pass in the recorded environment. They do not certify a production backend, payment provider, Redis failover, business policy, legal decision, or model selection. Normal plugin installation and offline CI require none of these Java/database dependencies.
