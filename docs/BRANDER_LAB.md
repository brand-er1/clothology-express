# BRAND-ER LAB

BRAND-ER 안에서 운영하는 별도 프로젝트(패션 콘텐츠 · 의류 제작 실험실)입니다. 자체 로고 · 톤을 쓰지만 헤더 · 푸터 · 회원 · 관리자 콘솔은 BRAND-ER와 공유합니다.

- **LEARN** — 원단, GSM, 봉제, 프린팅, 샘플 제작 등 의류 지식 공유 (FASHION KNOWLEDGE 카드)
- **CREATE / MAKE** — 신청자의 아이디어를 선정해 무료 샘플로 제작하고, 과정과 완성품을 콘텐츠로 소개

무료 샘플 신청은 일반 제작 문의(`/design-quote`)와 별도 테이블(`lab_applications`)에 저장 · 관리됩니다.

## 페이지 구성 (`/lab`)

| # | 섹션 | 비고 |
| --- | --- | --- |
| 01 | 메인 화면 — 로고(`public/lab/brander-lab-logo-*.webp`), "당신의 상상이 옷이 되는 실험실." | 버튼: 무료 샘플 제작 신청하기 · BRAND-ER LAB 소개 |
| 02 | WHAT IS BRAND-ER LAB? — LEARN · CREATE · MAKE | `#about` |
| 03 | YOUR IDEA, OUR PRODUCTION. | 신청 버튼 → 신청서로 스크롤 |
| 04 | 무료 샘플 제작 신청 폼 | `#apply`, `/lab/apply` 로 바로 진입 |
| 05 | FASHION KNOWLEDGE — 카드 6개, 누르면 상세 창 | 내용: `src/components/lab/labContent.ts` |
| 06 | HOW IT WORKS — 5단계 | 같은 파일의 `LAB_STEPS` |
| 07 | 버건디 배경 마지막 신청 유도 | |
| 모바일 | 하단 고정 신청 버튼 | 신청서가 보이는 동안 숨김 |

### 지식 콘텐츠에 릴스 · 글 연결하기

`labContent.ts` 의 각 항목에 `reelUrl`(인스타그램 릴스 주소)이나 `links`(사이트 내 글)를 넣으면 상세 창에 버튼이 생깁니다. 비워 두면 "관련 릴스 준비 중"으로 보입니다. 현재 연결된 링크는 실제로 있는 가이드(`/guides/printing.html`, `/guides/process.html`)뿐입니다.

### 신청서 항목 (2026-11-22 v2)

| 구분 | 항목 | 필수 |
| --- | --- | --- |
| 기본 정보 | 이름 · 연락처 · 이메일 | 필수 |
| | 인스타그램 아이디 | 선택 |
| 제작 정보 | 의류 종류 · 의류 설명 · 제작 목적(선택지) | 필수 |
| | 참고 이미지(최대 5장) · 제작 목적 상세(목적이 '기타'면 필수) · 향후 추가 생산 의향 | 선택 |
| 동의 | 참여 · 촬영 게시 · 개인정보(필수), 홍보 활용(선택) | |

희망 사이즈는 신청서에서 뺐습니다(선정 후 개별 확인). 이전 신청의 사이즈 값은 관리자 화면에 그대로 보입니다.

## 구성

| 구분 | 위치 | 설명 |
| --- | --- | --- |
| 신청 페이지 | `/lab` (`/brander-lab`, `/free-making` 은 `/lab` 으로 이동) | `src/pages/BranderLab.tsx`, `src/components/lab/*`. 페이지는 누구나 볼 수 있고, **신청은 로그인한 회원만** 가능(비로그인 시 신청서 자리에 로그인 · 회원가입 안내, 로그인 후 `/lab/apply` 로 복귀) |
| 진입점 | 메인 배너, 상단 메뉴 'BRAND-ER LAB', 모바일 전체 메뉴, 푸터 | `LabHomeBanner`, `Header`, `FullMenuSheet`, `Footer` |
| 입력 규칙 · 동의 문구 | `supabase/functions/_shared/labApplication.ts` | 화면 · Edge Function · 테스트가 같이 쓰는 단일 기준 |
| 접수 API | Edge Function `submit-lab-application` | 서버 재검증, 이미지 내용 검사, 중복 · 과다 신청 차단, 저장 실패 시 이미지 정리 |
| DB | `supabase/migrations/20261121000000_brander_lab_applications.sql`, `20261122000000_brander_lab_v2_form.sql`(v2 항목 · 동의 버전) | 신청서 · 동의 이력 · 촬영 세부 동의 · 처리 이력 · 비공개 이미지 버킷 · 관리자 RPC |
| 관리자 | `/admin/lab-applications` (메뉴: BRAND-ER LAB → LAB 샘플 신청 관리) | 목록 · 검색 · 정렬 · 상태 · 메모 · 상세 · CSV · 동의 이력 · 보유 기간 · 삭제. 상세 · CSV 에 검토 상태 / 선정 여부 / 제작 진행 상태, 제작 목적, 추가 생산 의향 표시 |

### 권한

| 등급 | `lab.view` (목록 · 상세 · 이미지 · CSV) | `lab.manage` (상태 · 메모 · 동의 기록 · 보유 기한 · 삭제) |
| --- | --- | --- |
| Super Admin | ✓ | ✓ |
| Operations Admin | ✓ | ✓ |
| CS Admin | ✓ | – |

- 신청 테이블과 이미지 버킷(`lab-applications`, 비공개)은 일반 사용자 · 비회원이 직접 읽거나 쓸 수 없습니다. 신청자 본인도 다른 사람의 신청을 볼 수 없습니다.
- 관리자 데이터는 모두 `admin_*` RPC 가 서버에서 권한을 다시 확인합니다. 이미지는 권한이 있는 관리자에게만 10분짜리 서명 URL 로 열립니다.
- 상세 열람 · CSV 다운로드 · 변경 · 동의 기록 · 삭제는 Audit Log 에 남습니다(개인정보 접속 기록).

### 로그인 필수

- 화면: 비로그인 방문자에게는 신청서 대신 로그인 안내(`LoginGate`)를 보여줍니다.
- Edge Function: 요청의 로그인 토큰으로 회원을 확인하고, 없으면 401(`LOGIN_REQUIRED`)로 거절합니다.
- DB: `lab_create_application` 이 `p_user_id` 없이 호출되면 `LAB_LOGIN_REQUIRED` 로 거절합니다. 신청은 회원 계정(`user_id`)에 연결됩니다. (2026-11-22 이전 비회원 신청은 `user_id` 가 비어 있는 채로 남습니다)

### 회원 전화번호 필수 (사이트 공통)

- 이메일 회원가입: 휴대폰 번호 필수 · 형식 검사(010 등 한국 휴대폰), `010-1234-5678` 형태로 저장
- 카카오 · 구글 가입 회원과 전화번호 없이 가입한 기존 회원: 로그인하면 닫을 수 없는 **전화번호 등록 창**(`PhoneRequiredGate`)이 뜹니다. 등록하거나 로그아웃할 수 있습니다.
- 프로필 수정에서도 전화번호를 비우거나 형식이 틀리면 저장되지 않습니다.

### 중복 제출 · 오류 처리

- 신청서마다 브라우저가 만든 `submissionKey` 를 보냅니다. 응답을 못 받고 다시 눌러도 같은 접수 번호를 돌려줍니다.
- 같은 휴대폰 번호는 24시간 안에 한 번만 접수됩니다(409). 같은 IP 에서는 1시간에 5건까지 받습니다(429). IP 는 해시값만 저장합니다.
- 서버 검증 실패 시 항목별 오류를, 저장 실패 · 네트워크 오류 시 다시 시도 안내를 보여줍니다. 실패하면 올라간 이미지를 지웁니다.

### 동의 · 개인정보

- 동의 4개(필수 3, 선택 1)는 각각 독립 체크박스이고, 전체 동의 후에도 개별 해제가 가능합니다. 선택 동의 없이 신청할 수 있습니다.
- 신청마다 어떤 **문구 버전**에 언제 동의했는지 `lab_consent_records` 에 추가 전용으로 남습니다. 문구는 `lab_consent_documents` 에 버전별로 보관되며 수정할 수 없습니다.
- 동의 철회 요청(전화 · 이메일 등)은 관리자 상세 화면의 **철회 기록**으로 새 이력을 남깁니다.
- 실제 촬영 전 별도 동의(촬영 범위 · 게시 매체 · 이용 기간 · 편집/재사용 범위 · 동의 방법 · 증빙 위치)는 상세 화면 **촬영 세부 동의 기록**에 남깁니다. 동의서 원본은 별도 보관하세요.
- 보유 기간: 접수일로부터 1년. **콘텐츠 게시 완료**로 바꾸면 그날부터 1년으로 자동 연장. 기한이 지난 신청은 목록 상단에 표시되고 `보유 기한 만료` 필터에서 골라 삭제합니다(이미지 → 신청서 · 이력 순서로 영구 삭제, Audit Log 에는 접수번호와 사유만).
- 업로드 전 브라우저에서 JPG · WEBP 사진을 다시 저장해 위치(GPS) 등 메타데이터를 지웁니다.

### 동의 문구를 바꿀 때

1. `labApplication.ts` 의 문구와 `LAB_CONSENT_VERSION` 을 새 값으로 바꿉니다.
2. 새 마이그레이션에서 이전 버전 행의 `is_current` 를 `false` 로 바꾸고 새 버전 행을 `insert` 합니다(기존 행은 수정 불가).
3. `npm test` — `src/lib/lab-application.test.ts` 가 화면 문구와 마이그레이션 문구가 같은지 확인합니다.

## 배포

`main` 에 병합하면 기존 GitHub Actions(`Deploy Brand-er`)가 순서대로 처리합니다. 별도 시크릿은 필요 없습니다.

1. `supabase db push` — 새 마이그레이션 적용(테이블, 버킷, 권한 매트릭스, RPC)
2. `supabase functions deploy submit-lab-application` — 워크플로에 추가됨
3. 프런트엔드 빌드 · GitHub Pages 배포

선택 설정: Supabase Edge Function 시크릿 `LAB_IP_HASH_SALT` 를 넣으면 IP 해시 솔트로 씁니다(없으면 서비스 키 일부를 씁니다).

배포 후 확인

- [ ] 비로그인 상태로 `/lab/apply` → 로그인 안내가 보이고 신청서는 보이지 않는지
- [ ] 로그인 후 `/lab/apply` 에서 이미지 1장과 함께 신청 → 완료 화면과 접수 번호
- [ ] 전화번호가 없는 계정(카카오 · 구글 가입)으로 로그인 → 전화번호 등록 창이 뜨고, 등록 후 닫히는지
- [ ] `/admin/lab-applications` 에서 신청 · 이미지 · 동의 시각 확인, 상태 · 메모 변경, CSV 다운로드
- [ ] CS 관리자 계정은 조회만 되는지, 일반 회원은 `/admin` 에서 막히는지

## 기존 웹사이트(brand-er.store, Cafe24) 연결

신청 페이지 주소: `https://brand-er1.github.io/clothology-express/lab`
신청서 바로가기: `https://brand-er1.github.io/clothology-express/lab/apply` — 소개를 건너뛰고 신청서 첫 칸에서 시작합니다. 인스타그램 프로필 링크 · 릴스 캡션 · DM 안내에 쓰세요. (`/lab#apply` 도 같습니다)
(커스텀 도메인을 연결했다면 그 도메인 + `/lab`, `/lab/apply`)

Cafe24 관리자 → 디자인 → 메인 화면 HTML 편집에서 원하는 위치에 아래 배너를 넣습니다.

```html
<!-- BRAND-ER LAB 무료 의류 제작 신청 배너 -->
<section style="background:#1d1718;color:#f3eee8;padding:56px 20px;text-align:center;font-family:Pretendard,'Apple SD Gothic Neo',sans-serif;">
  <p style="margin:0;font-size:11px;letter-spacing:.22em;color:#c999a4;font-weight:600;">BRAND-ER LAB</p>
  <h2 style="margin:14px 0 0;font-size:clamp(26px,5vw,40px);line-height:1.2;font-weight:600;letter-spacing:-.03em;">상상하던 옷, 브랜더가 만들어드립니다.</h2>
  <p style="max-width:520px;margin:16px auto 0;font-size:15px;line-height:1.75;color:#d6d3d1;">평소 만들고 싶었던 옷이 있으신가요? 원하는 디자인을 알려주세요. 선정된 분께 브랜더가 무료로 의류 샘플을 제작해드립니다.</p>
  <a href="https://brand-er1.github.io/clothology-express/lab" style="display:inline-block;margin-top:28px;padding:16px 28px;background:#741b2b;color:#fff;font-size:15px;font-weight:600;text-decoration:none;border-radius:2px;">BRAND-ER LAB 바로가기 →</a>
</section>
```

상단 메뉴: Cafe24 관리자 → 디자인 → 메뉴(또는 레이아웃 HTML)에 링크를 추가합니다.

```html
<li><a href="https://brand-er1.github.io/clothology-express/lab">BRAND-ER LAB</a></li>
```

## 운영 전 법적 검토 항목

아래 문구는 실제 운영 전 법률 검토를 받아야 합니다. 모두 `labApplication.ts`(화면)와 마이그레이션(동의 버전) 한 곳씩에서 관리됩니다.

- [ ] 개인정보 수집 · 이용 안내(`LAB_PRIVACY_NOTICE`): 수집 항목, 이용 목적, 보유 기간(1년), 동의 거부 권리와 불이익
- [ ] 필수 동의 3개 · 선택 동의 1개 문구(`LAB_CONSENT_DOCUMENTS`)
- [ ] 초상 · 음성이 포함된 촬영물의 별도 동의서 양식(촬영 범위, 게시 매체, 이용 기간, 편집 · 재사용, 철회 절차) — 서면/전자 동의서는 시스템 밖에서 작성 · 보관하고 관리자 화면에 기록
- [ ] 디자인 · 참고 이미지 권리 안내, 제3자 저작권 · 상표권 침해 시 제작 제한 문구
- [ ] brand-er.store 개인정보처리방침에 본 프로젝트 수집 항목 · 보유 기간 반영
- [ ] 만 14세 미만 신청 처리 방침(현재 연령 확인 항목 없음)
- [ ] 문의처: 개인정보책임자 및 고객센터 연락처(현재 푸터와 동일한 값 사용)
