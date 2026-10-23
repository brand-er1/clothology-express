# 플리트소프트 PG(KSNET) 연동 PR 검토 — brand-er1/clothology-express#160

- 대상: `feature/pg-integration` → `main`, 작성자 hyeonsu-Ji, 2026-10-20 `main` 에 병합됨(커밋 af0843d)
- 검토일: 2026-10-23 · 검토 방법: 코드 정독 + 로컬 임시 Postgres 에서 전체 마이그레이션과 `scripts/payment-db-tests/checks.sql`(25개) 실행 + Deno 결제 테스트(35개)
- 결론: **결제 로직 자체는 병합 가능한 품질**. 단 **배포 파이프라인 결합 문제 1건이 운영 배포 전체를 막고 있어** 이 PR(판매자 센터 PR)에서 수정했다. 실결제 · 환불 · 모바일 실기기 검증은 아직 미완료.

| # | 항목 | 판정 | 내용 |
|---|---|:-:|---|
| 1 | 기존 코드 충돌 | ⚠️ → 수정 | 코드 충돌은 없음. 그러나 `deploy.yml` 에 추가된 "KSNET 시크릿 확인" 단계가 시크릿 미설정 시 **백엔드 · 프론트 배포를 모두 중단**시킨다. #160 · #162 병합 후 `main` 배포 2회 연속 실패(`Set the Supabase secret KSNET_MID`) — 매거진 수정 등 결제와 무관한 기능도 운영에 반영되지 않는 상태. → `PAYMENT_MODE`(기본 `disabled`)일 때는 검사를 건너뛰도록 수정 |
| 2 | 결제 API 구조 | ✅ | 결제창은 카드 인증만, 승인은 `ksnet-return` 이 **DB 금액**으로 KSNET 에 서버 간 요청. 브라우저 값으로 확정하지 않음. `PaymentProvider` 인터페이스 유지 |
| 3 | 환경변수 · 비밀키 노출 | ✅ | `KSNET_AUTH_HEADER`(환불 키)는 Edge 시크릿으로만 사용, 저장소 · 이력에 실제 키 없음(테스트용 가짜 값과 KSNET 공개 샘플 MID `2999199999` 만 존재). MID 는 결제창 form 에 실려 공개되는 값이라 비밀 아님 |
| 4 | Supabase 주문 연동 | ✅ | `create_ksnet_funding_order` 가 판매가 × 수량으로 금액 계산, 확정 · 취소 · 모의결제 RPC 는 `anon`/`authenticated` 실행 불가(검증 통과) |
| 5 | 성공 · 실패 처리 | ✅ | `paid / failed / cancelled / ready`, 응답 유실 시 실패로 단정하지 않고 `review_required` 로 남김. 결과 화면은 DB 상태 표시 |
| 6 | 중복 결제 방지 | ✅ | 주문별 durable claim(`ksnet_payment_operations`) 1건, 동시 세션 2개에서 승인 권한 1회만 획득(검증 통과), 거래번호 별도 기록, 미확정 결제가 있으면 같은 펀딩 새 주문 차단 |
| 7 | 웹훅 서명 · 금액 검증 | ✅ (구조상 웹훅 없음) | KSPay 는 서명 웹훅이 아니라 브라우저 POST 복귀. 신뢰 근거는 추측 불가 참여 키 + 서버가 직접 건 승인 응답. 승인 응답의 **주문번호 · 금액을 DB 와 대조**하고 불일치 시 자동 취소(보상) |
| 8 | 취소 · 환불 | ⚠️ 제한 | 구매자 · 판매자 취소는 KSNET 취소 API 로 전액 환불. **부분취소 없음**, KSNET 거래조회 API 가 없어 `P10Q` 는 사람이 KStA 에서 확인. 관리자 환불 화면은 PG 를 호출하지 않음(기존 정책) |
| 9 | 배포 환경 호환성 | ⚠️ | `ksnet-return` 은 `--no-verify-jwt` 필수(워크플로 반영됨), 복귀 URL 100자 제한 검사 있음. **`APP_URL` 은 앱이 실제로 실행되는 출처**여야 결제 후 돌아왔을 때 브라우저에 저장된 로그인 세션이 유지된다. brand-er.store 는 GitHub Pages 앱을 iframe 으로 표시하므로(docs/seo/CAFE24.md) 앱 출처는 `https://brand-er1.github.io/clothology-express` 이다. iframe 안 결제(PC 팝업 / 모바일 이동)는 실기기 검증 전이다 |

## 이 PR 에서 함께 반영한 보완

- 결제 모드 분리: `VITE_PAYMENT_MODE` / 서버 `PAYMENT_MODE` (`mock | test | live | disabled`). 운영 빌드에서 mock 은 강제로 disabled.
- `ksnet-ready` 서버 가드(`_shared/payment-mode.ts`): disabled 이면 결제창 생성 거부, `live` 명시 시 샘플 MID · 시험 API 거부. 값이 없으면 기존 동작 그대로(플리트소프트 로컬 시험 구성 유지). 기존 `ksnet.ts` · `ksnet-payment.ts` 는 수정하지 않음.
- 정산(`_settlement_figures`)이 모의결제를 총 거래액 · 지급액에 포함하던 문제 수정(미지급 정산만 재계산).

## 운영 결제 활성화 전 (사전 승인 필요 — 이 PR 에서 실행하지 않음)

1. Supabase 시크릿: `KSNET_MID`(인증결제 MID) · `KSNET_AUTH_HEADER` · `APP_URL=https://brand-er1.github.io/clothology-express`(앱 출처 — 위 9번) · `PAYMENT_MODE=live`
2. GitHub 저장소 Variables: `PAYMENT_MODE=live`
3. `docs/KSNET_PAYMENT.md` 운영 전환 체크리스트: 1,000원 실결제 → 취소 · 환불 → 모바일 결제 → 결제창 취소/닫기 → iframe 임베드
4. 결과 확인 필요(`review_required`) 작업 복구 절차 숙지
