# 외부 연동 회복성: timeout, retry, circuit breaker를 업무별로 다르게 둔다

- id: spring-resilience-retry-timeout
- domain: spring-commerce
- category: integration
- severity: medium
- status: active
- evidenceLevel: project-guidance
- owner: commerce-context-maintainers
- verifiedBy: not-recorded
- lastReviewedAt: not-recorded
- changeNote: not-recorded
- jurisdiction: KR

## 요약

PG, 택배, 알림, 검색, 외부 채널 API는 같은 재시도 정책을 쓰지 말고 업무 영향에 따라 실패 처리를 분리한다.

## 적용 조건

- spring-commerce 도메인의 integration 기능을 설계하거나 구현한다.

## 적용하지 않는 조건

## 전제

- 실제 사업 정책과 외부 사업자 계약을 함께 확인한다.

## 판단 근거

이커머스는 외부 시스템 장애를 피할 수 없다.
결제 승인은 신중한 대사가 필요하고, 알림 발송은 지연 허용이 크며, 배송 추적은 재처리 가능한 데이터다.

## 업무 맥락

이커머스는 외부 시스템 장애를 피할 수 없다.
결제 승인은 신중한 대사가 필요하고, 알림 발송은 지연 허용이 크며, 배송 추적은 재처리 가능한 데이터다.

## Java Spring 구현 가이드

- WebClient나 RestClient 호출에 connect/read timeout을 명시한다.
- 재시도 가능한 오류와 재시도하면 안 되는 오류를 코드별로 분리한다.
- Resilience4j 같은 circuit breaker, bulkhead, retry를 업무별로 설정한다.
- 외부 호출 결과가 불명확하면 UNCERTAIN 상태와 대사 작업으로 넘긴다.
- 비멱등 POST는 통신 오류가 재시도 가능해도 자동 재실행하지 않는다. 외부 계약의 멱등성 또는 안전한 결과 조회를 확인하고 동일 시도·같은 업무키·요청 지문을 유지한다.
- 미확정 승인·환불·송금은 새 키로 다시 요청하지 않고 기존 결과를 조회한다. 총 재시도 시간·횟수 상한과 backoff·jitter를 정하고 SDK·HTTP client의 숨은 재시도도 포함한다.

## 피해야 할 패턴

- 무제한 재시도로 PG나 채널 API 장애를 증폭시키지 않는다.
- timeout 없는 HTTP client를 운영에 사용하지 않는다.
- 결제 타임아웃을 단순 실패로 확정하지 않는다.

## 검토 체크리스트

- [ ] 외부 API별 timeout과 retry 정책이 정의되어 있는가?
- [ ] 부작용 요청의 멱등성·동일 시도와 미확정 결과 조회·총 재시도 한도를 검증하는가?
- [ ] 불명확 결과를 대사하는 상태와 배치가 있는가?
- [ ] circuit breaker와 bulkhead로 장애 전파를 제한하는가?

## 출처

### 프로젝트 관리 지식 — 외부 근거 미첨부

- source: src/main/resources/knowledge/spring-commerce.yml
- type: project-guidance
- sourceVersion: not-recorded
- publishedAt: not-recorded
- reviewedAt: not-recorded
- accessedAt: not-recorded
- note: 프로젝트가 관리하는 일반 설계 지침이다. 독립적인 외부 근거로 간주하지 말고, 고위험 결정은 최신 공식 자료로 확인한다.

## 태그

- spring
- integration
- resilience4j
- timeout
- retry
- circuit-breaker
- uncertain
