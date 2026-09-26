# AI 상세페이지 제작

진입: 마이페이지 → 내가 만든 펀딩 → 펀딩 수정 → **✨ AI 상세페이지 제작** (`/fundings/:id/detail-page` → `/detail-pages/:pageId`).
신규 펀딩은 디자인 스튜디오의 **✨ AI 상세페이지 제작** → 같은 스튜디오 → "펀딩 시작하기".

## 흐름

펀딩/디자인 데이터 + 제작자 브리프 + 참고자료 → `generate-detail-page`(카피, JSON) → 섹션 자동 구성
→ `generate-detail-image`(이미지 유형별 1회 호출, 동시 2개) → 편집 → PC/모바일 미리보기 → **상세페이지 적용**(게시)

- 편집은 자동저장(초안)되며 고객 화면에는 **상세페이지 적용** 시점의 스냅샷(`published_document`)만 보인다.
- 버전: AI 최초 생성 / 임시저장 / 이미지 재생성 / 카피 재작성 / 적용 / 복구 전 백업이 `detail_page_versions` 에 남고 복구할 수 있다.
- 이미지 일부가 실패해도 페이지는 열리고 실패한 이미지에만 "다시 생성"이 표시된다.
- 펀딩 row(가격·목표수량·참여자·주문·결제)는 상세페이지 저장/적용/복구에서 절대 수정하지 않는다.

## 이미지 생성 서비스 레이어

`supabase/functions/_shared/imageProviders.ts` 의 `ImageProvider` 인터페이스로 분리. 기본 Gemini.
참조 이미지: 원본 디자인(필수, 제품 동일성 기준) + 이미지 유형에 맞는 제작자 참고자료 최대 2장.

## 환경변수 (Supabase Edge Function Secrets)

| 이름 | 필수 | 설명 |
|---|---|---|
| `GEMINI_API_KEY` | ✅ (기존) | 카피/이미지 생성 |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | 자동 | Supabase 기본 제공 |
| `DETAIL_IMAGE_PROVIDER` | 선택 | 기본 `gemini` |
| `DETAIL_IMAGE_MODELS` | 선택 | 쉼표 구분 모델 우선순위 (기본 `gemini-3.1-flash-image,gemini-3-pro-image,gemini-2.5-flash-image`) |

## 비용 통제

`ai_usage_logs` 에 모든 호출(성공/실패/한도초과)을 기록. 한도·단가는 `platform_settings`
(`ai_detail_image_daily_limit`=40, `ai_detail_image_page_limit`=150, `ai_detail_copy_daily_limit`=60,
`ai_image_unit_cost_usd`=0.04, `ai_copy_unit_cost_usd`=0.002). Super Admin: 관리자 콘솔 **AI 사용량**.
