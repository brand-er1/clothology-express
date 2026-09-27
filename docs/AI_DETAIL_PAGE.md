# AI 상세페이지 제작

진입: 마이페이지 → 내가 만든 펀딩 → 펀딩 수정 → **✨ AI 상세페이지 제작** (`/fundings/:id/detail-page` → `/detail-pages/:pageId`).
신규 펀딩은 디자인 스튜디오의 **✨ AI 상세페이지 제작** → 같은 스튜디오 → "펀딩 시작하기".

## 흐름 (에디토리얼 엔진)

```
01 상품 정보 확인 (필수: 상품명·카테고리·판매가·대표 이미지 / 나머지는 선택, 기존 데이터는 "자동 불러옴")
02 AI 상품 분석 → 콘셉트 3개 추천 (실제 렌더러로 그린 미리보기) → 제작자가 선택
   └ [AI에게 맡기기]: 분석 → 1순위 콘셉트 → 바로 생성 (한 번의 탭)
03 레이아웃(원본 디자인이 들어간 상태)을 먼저 저장·표시
   → 촬영 컷(최대 10장, 동시 2개)과 카피를 병렬 생성, 끝나는 대로 미리보기에 채워짐
   → 섹션별 수정 · 이미지 재생성 · AI 다시 작성 · 레이아웃/배경 변경 · 섹션 추가
04 상세페이지 적용(게시) → [이 상세페이지로 펀딩 등록하기]
```

진행 단계 표시: 상품 분석 → 디자인 콘셉트 구성 → 상세페이지 이미지 제작 → 상품 설명 작성 → 레이아웃 구성 → 최종 디자인 정리.

### 코드 지도

| 역할 | 파일 |
|---|---|
| 상품 분석(검증 · 대체 분석) | `src/lib/detail-page/analysis.ts` |
| 콘셉트 카탈로그 · 추천 · 팔레트/타이포 · 촬영 계획 | `src/lib/detail-page/artDirection.ts` |
| 분석+카피+디렉션 → 섹션 구성, 콘셉트 전환 | `src/lib/detail-page/editorialCompose.ts` |
| 에디토리얼 렌더러(섹션별 레이아웃 변형) | `src/components/detail-page/editorial/*` |
| 설정 단계 · 콘셉트 선택 · 분석 패널 | `DetailSetupFlow.tsx`, `ConceptPicker.tsx`, `ProductAnalysisPanel.tsx` |
| 편집 도구 · AI 이미지 탭 · 진행 표시 | `SectionToolbar.tsx`, `AiImagePanel.tsx`, `DetailGenerationProgress.tsx` |
| 분석 / 카피 (Edge) | `generate-detail-page` (`mode: "analyze"` 추가) |
| 촬영 프롬프트 (Edge) | `_shared/detailImagePrompt.ts` (실사 규칙 + 존재하는 디테일만) |

### 고정 템플릿처럼 보이지 않게

콘셉트(11종: MINIMAL · STREET · EDITORIAL · LUXURY · VINTAGE · SPORTS · OUTDOOR · CASUAL · Y2K · EMOTIONAL · LOOKBOOK)는
스킨이 아니라 **섹션 순서, 섹션별 레이아웃 변형(variant), 팔레트, 서체, 여백, 촬영 컷 구성과 비율**을 정한다.
제품별 seed(디자인 ID 해시)가 콘셉트가 선호하는 변형 중 하나를 고르므로 같은 콘셉트라도 제품마다 구성이 달라진다.
이미지 비율은 컷마다 다르게 촬영한다(히어로 16:9/3:2/4:5 – 히어로 레이아웃에 맞춤, 룩북 2:3, 디테일 1:1, 제품 4:5,
텍스처 21:9). 생성된 사진은 원래 비율 그대로(잘림 없이) 표시한다. 페이지 색은 BRAND-ER 색이 아니라
콘셉트 팔레트 + 제품 메인 컬러(대비가 충분할 때)에서 가져온다.

### 정확성 원칙 (우선순위: 원본 디자인 보존 > 실사 품질 > 아트 디렉션 > 모바일 > 편집 용이성)

- 모든 촬영은 원본 디자인을 Reference 1 로 사용하고, 확인된 디테일 목록 외의 지퍼·포켓·봉제·자수를 만들지 않도록 프롬프트에 고정.
- 분석의 "예상 소재"는 추정으로만 표시하고 페이지 사양에 쓰지 않는다. 혼용률·원단명·중량·기능성은 제작자 입력만 사용.
- 디테일 클로즈업·콜아웃은 분석에서 확인되고 제작자가 끄지 않은 부위만. 핏 문구는 제작자가 핏을 입력했을 때만.
- 스토리는 제작자가 입력한 제작 의도/설명 범위 안에서만. "최고의 품질", "완벽한 핏" 등 과장 문장은 서버 프롬프트와 클라이언트 필터(`stripHype`) 양쪽에서 제거.

### 저장 구조 (추가 테이블 없음)

- `product_detail_pages.generation` jsonb: `analysis`, `concepts`, `conceptId`, `direction`(팔레트·타이포·여백·seed)
- `detail_page_sections.content` jsonb: 기존 `eyebrow/title/description/items/facts` + `layout.variant/background/align` + `videoUrl`
- `detail_page_sections.images` jsonb: 이미지별 `slot`(촬영 유형), `ratio`, `caption`, `assetId`(→ `generated_assets` 의 프롬프트·참조 이미지)
- 섹션 행은 그대로 독립 저장되고 `sort_order`/`created_at`/`updated_at` 를 가진다. 버전·게시·복구 RPC 변경 없음.
- `direction` 이 없는 기존 상세페이지는 기존 템플릿 렌더러로 그대로 표시된다(다시 생성하면 에디토리얼로 전환).

### 이전 흐름 (v2)

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

## 배포 순서

1. 마이그레이션 `20261001000000_ai_detail_page_editorial_engine.sql` 적용 (CHECK 제약 확장만, 데이터 변경 없음)
2. Edge Function 재배포: `generate-detail-page`, `generate-detail-image`
3. 프론트엔드 배포. (함수가 구버전이어도 분석은 제작자 데이터 기반 분석으로, 카피는 기본 문구로 대체되어 동작한다.
   단 새 촬영 유형은 1·2 적용 후에만 생성된다.)

## 비용 통제

`ai_usage_logs` 에 모든 호출(성공/실패/한도초과)을 기록. 상품 분석 호출은 문구 한도(`detail_copy`, metadata.mode=analyze)로 집계되고,
촬영 계획은 오늘 남은 이미지 한도 안에서 중요한 컷부터 잘라 요청한다. 한도·단가는 `platform_settings`
(`ai_detail_image_daily_limit`=40, `ai_detail_image_page_limit`=150, `ai_detail_copy_daily_limit`=60,
`ai_image_unit_cost_usd`=0.04, `ai_copy_unit_cost_usd`=0.002). Super Admin: 관리자 콘솔 **AI 사용량**.
