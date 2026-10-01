# AI 상세페이지 제작

진입: 마이페이지 → 내가 만든 펀딩 → 펀딩 수정 → **✨ AI 상세페이지 제작** (`/fundings/:id/detail-page` → `/detail-pages/:pageId`).
신규 펀딩은 디자인 스튜디오의 **✨ AI 상세페이지 제작** → 같은 스튜디오 → "펀딩 시작하기".

## 흐름

AI 상세페이지 생성 → 생성 결과 확인 → 직접 수정 → 필요 시 AI 재생성 → 미리보기 → 임시저장 → **상세페이지 등록** → 펀딩 상세페이지 반영
(등록 후 수정: 마이페이지 → 내가 만든 펀딩 → 펀딩 관리 → **상세페이지 수정** → **변경사항 저장**)

펀딩/디자인 데이터(가격·MOQ·펀딩 기간·사이즈 포함) + 제작자 브리프(배송 예정 안내 포함) + 참고자료 → `generate-detail-page`(카피, JSON) → 섹션 자동 구성(정보가 없는 섹션은 자동 제외)
→ `generate-detail-image`(이미지 유형별 1회 호출, 동시 2개) → 편집 → 미리보기 → 등록(게시)

- **인라인 편집**: 편집 캔버스의 글자(상품명·라벨·제목·본문·목록·사양)를 눌러 바로 고친다(`InlineText`, `setTextField`).
- **AI 부분 재작성**: 고른 문구 하나만 "이 문구만 다시 작성 / 더 고급스럽게 / 더 짧게 / 패션 브랜드 스타일로 / 더 자세하게 /
  자연스럽게 수정 / 직접 요청하기(최대 300자)" (`generate-detail-page` 의 `mode: "rewrite"`, 알 수 없는 지시는 400).
  요청 중 그 문구를 직접 고쳤으면 결과를 버리고, AI 호출이 실패하면 원문을 그대로 둔다("더 짧게"만 로컬 축약으로 대체).
  섹션 단위는 "이 섹션 전체 재생성".
  전체 재생성은 확인창 후 실행되며 직전 편집본을 버전으로 자동 백업한다.
- **섹션**: 추가·삭제·복제·숨기기, 그립 핸들 드래그(포인터 이벤트라 모바일 터치도 동작, 가장자리 자동 스크롤) 또는 ↑↓ 이동.
- **이미지**: 교체(업로드 / 라이브러리), 삭제, 추가, 순서 변경(←→), 이미지 설명(alt) 수정. 라이브러리 = 이 페이지의 AI 생성 이미지 ·
  업로드 이미지 · 펀딩 컬러별 승인 이미지 · 원본 디자인.
- **자동저장**: 변경 즉시 로컬 백업 + 1.2초 후 `save_product_detail_page`. 편집기를 떠날 때(라우트 이동) 대기 중인 변경도 저장한다.
  상태: 저장 중... / 저장 완료 · 마지막 저장 HH:MM. 서버 저장이 실패하면 "저장 실패 · 서버에 저장되지 않았어요 [다시 시도]"를 표시하고
  5초 → 15초 → 30초 간격과 온라인 복귀 시 자동 재시도한다(로컬 백업은 새로고침 시 복원용일 뿐, 저장 성공으로 표시하지 않음).
- **미리보기**: 편집 UI 없는 구매자 화면. 펀딩에 연결된 경우 실제 펀딩 화면(`/fundings/:id?preview=draft`, 작성자 본인만 초안 표시)을
  Desktop(1280px) / Mobile(390px) 프레임으로 띄운다.
- **등록 검증**(화면 `validateDetailPageForPublish` + 서버 `validate_detail_page_for_publish`/`publish_detail_page`):
  대표 이미지(히어로), 상품명, 상품 설명, 가격, 옵션(컬러), 사이즈, 필수 펀딩 정보(연결된 펀딩 · MOQ · 기간).
  빠진 항목은 목록과 "바로 입력 / 펀딩 정보 수정" 버튼으로 안내하고 등록을 막는다.
- 편집은 자동저장(초안)되며 고객 화면에는 등록 시점의 스냅샷(`published_document`)만 보인다.
- 버전: AI 최초 생성 / 임시저장 / 이미지 재생성 / 카피 재작성 / 등록 / 복구 전 백업 / 전체 재생성 전 백업이 `detail_page_versions` 에 남고 복구할 수 있다.
- 이미지 일부가 실패해도 페이지는 열리고 실패한 이미지에만 "다시 생성"이 표시된다.
- 펀딩 row(가격·목표수량·참여자·주문·결제)는 상세페이지 저장/등록/복구에서 절대 수정하지 않는다(읽기만 한다).

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
