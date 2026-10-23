# 판매자 센터 · 리뷰 · 매거진 · 결제 모드 운영 가이드

## 접속

| 화면 | 주소 | 권한 |
|---|---|---|
| 판매자 센터 | `/seller` (대시보드), `/seller/products` · `fundings` · `orders` · `reviews` · `inquiries` · `settlements` · `brand` | 판매자(seller) 계정. 기존 제작자 프로필 · 브랜드를 그대로 쓴다(별도 계정 없음). 브랜드가 없으면 등록 화면으로 안내 |
| 진입점 | 상단 전체 메뉴 → MY → **판매자 센터**, `/my-fundings` 개설 탭 하단 링크 | |
| 관리자 리뷰 신고 처리 | `/admin/reviews` → **판매자 신고 처리** 탭 | 조회 `content.view`, 처리 `reports.manage` (Super · Operations · CS) |
| 관리자 매거진 | `/admin/magazine` | 조회 `content.view`, 등록 · 수정 `content.manage` |
| 매거진 목록 | `/magazine` (`?category=brand_news` 등) — 기존 `/community` 의 BRAND-ER NEWS 섹션도 유지 | 공개 |

## 권한 · 데이터 보호 (서버에서 검증)

- `seller_*` RPC 는 `auth.uid()` 의 펀딩(`fundings.creator_id`)만 다룬다. 다른 판매자 ID 를 인자로 받지 않고, 남의 펀딩 ID 를 넣으면 오류로 거부한다.
- 주문 목록은 이름 · 연락처를 마스킹하고 주소 · 이메일을 보내지 않는다. 배송용 전체 정보는 **엑셀 다운로드(동의 확인 후)** 로만 받으며 `buyer_export_logs` 에 기록된다(본인 기록만 조회 가능, 위조 불가). 취소 · 환불 주문은 엑셀에도 연락처 · 주소를 넣지 않는다.
- 리뷰: 판매자는 **답변 작성/수정과 신고만** 할 수 있다. 삭제 · 숨김 · 별점 변경 RPC 가 없고, `funding_reviews` UPDATE 가드 트리거가 컬럼 그룹별(작성자 수정 / 판매자 답변 / 관리자 노출 상태)로 허용 경로를 다시 확인한다. 테이블은 브라우저에서 직접 읽기 · 쓰기 불가.
- 리뷰 작성은 기존 조건 유지: 본인 주문 · 결제 완료 · 미취소 · 배송 완료 · 주문당 1개. 사진은 본인 폴더 파일만 최대 5장.
- 모의결제(`payment_provider = 'mock'`) 주문은 매출 · 결제 완료 금액 · 정산(지급액)에 넣지 않는다. 리뷰는 `구매 인증` 대신 `모의결제 주문` 으로 표시한다.
- 제작 단계: 판매자는 관리자가 펀딩 성공을 확정한 뒤 `원단 컨택 → 패턴/샘플 → 샘플 확인 → 본생산 → 검수/포장` 다음 단계로만 진행(기존 `creator_update_production_stage`). 배송 준비 · 배송 · 배송 완료는 관리자 전용.
- 조기 마감은 기존 `creator_early_close_funding` 규칙 그대로(결제 확인 중 주문이 있으면 서버가 보류).

## 결제 모드 (PG 와 다른 기능 분리)

| 값 | 화면 | 서버 |
|---|---|---|
| `disabled` (운영 기본) | 결제 버튼 → "결제 오픈 준비 중", 구매 예약은 유지. 판매자 · 리뷰 · 매거진 · 회원 기능 정상 | `ksnet-ready` 가 503 으로 거절 (Edge 시크릿 `PAYMENT_MODE=disabled` 일 때) |
| `test` | 결제 단계에 "테스트 결제" 표시 | `KSNET_API_BASE` 가 운영 주소면 거절. **운영 DB 에 쓰지 말 것** — 시험 결제도 `ksnet` 실결제로 저장된다 |
| `live` | 실제 결제 | 명시하면 샘플 MID(`2999199999`) · 시험 API 주소를 거절 |
| `mock` | 로컬 개발 기본값. 운영 빌드에서는 항상 `disabled` 로 바뀐다 | DB 가 브라우저의 모의결제 RPC 실행을 막는다(20261019) |

- 프론트: GitHub 저장소 **Settings → Variables → `PAYMENT_MODE`** (없으면 `disabled`). 빌드 시 `VITE_PAYMENT_MODE` 로 들어간다.
- 서버: `supabase secrets set PAYMENT_MODE=<값>` (선택, 같은 값 권장). 미설정이면 기존 KSNET 동작 그대로.
- 배포 워크플로는 `PAYMENT_MODE` 가 `live`/`test` 일 때만 `KSNET_MID` · `KSNET_AUTH_HEADER` · `APP_URL` 시크릿을 요구한다. 2026-10-20 이후 이 검사 때문에 `main` 배포가 매번 실패하던 문제를 해소한다.
- 결제 창은 ErrorBoundary 로 격리되고, 모든 화면은 경로 단위 ErrorBoundary 로 감싸 한 화면의 오류가 사이트 전체 장애가 되지 않는다.

## 매거진

- 카테고리: BRAND-ER NEWS(`brand_news`) · 언론 보도(`press`) · 브랜드 스토리(`brand_story`) · 제작자 인터뷰(`creator_interview`) · 패션 및 제조 인사이트(`insight`).
- 관리자 편집기: 제목 · 본문 · 요약 · 주요 내용 · 대표 이미지(업로드/URL, 출처 표기) · 카테고리 · 공개/비공개 · 발행일 · 작성자 · SEO 제목/설명 · 삭제(Audit Log).
- **URL 로 기사 정보 불러오기**: 원문 URL 을 넣고 "불러오기" → `fetch-article-meta` 가 원문의 공개 메타데이터(제목 · 발행일 · 출처 · 소개 문구)로 **빈 칸만** 채운다. 본문은 가져오지 않고, 언론사 대표 이미지는 자동 적용하지 않는다(사용 허락 확인 전에는 BRAND-ER 자체 이미지 업로드). 관리자가 원문과 대조 후 저장한다.
- 언론 보도는 원문 URL 필수, 요약은 BRAND-ER 문장으로 작성(원문 복제 금지).

### 요청된 기사 (유튜버월드 No=4253327) 등록 방법

작업 환경에서 `youtuberworld.co.kr` 접속이 네트워크 정책으로 차단되어 제목 · 발행일을 확인하지 못했다. 추정 값으로 등록하지 않았다.
배포 후 `/admin/magazine` → 기사 등록 → 분류 "언론 보도" → 원문 URL `https://youtuberworld.co.kr/View.aspx?No=4253327` → **불러오기** → 제목 · 발행일 · 언론사를 원문과 대조 → 요약을 BRAND-ER 문장으로 다듬기 → 대표 이미지는 BRAND-ER 이미지 업로드 → 저장.

## 로컬 검증

```bash
# DB (임시 Postgres, 운영 DB 미접속): 전체 마이그레이션 + 재실행 + 79개 시나리오
PGHOST=/tmp PGPORT=55432 PGUSER=postgres scripts/seller-db-tests/run.sh
npm test                 # 프론트 단위 테스트
npm run test:payments    # 결제 어댑터 · 승인/환불 · 결제 모드 가드
npm run test:functions   # 매거진 메타데이터 파서 · SSRF 차단
npx tsc --noEmit -p tsconfig.app.json && npm run build
```
