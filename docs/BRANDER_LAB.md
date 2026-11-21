# BRAND-ER LAB 무료 의류 제작 신청

일반 고객이 만들고 싶은 옷을 신청하면 브랜더가 참여자를 선정해 의류 샘플을 무료로 제작하고, 과정을 인스타그램 릴스로 소개하는 프로젝트의 신청 · 관리 기능입니다.

## 구성

| 구분 | 위치 | 설명 |
| --- | --- | --- |
| 신청 페이지 | `/lab` (`/free-making` 은 `/lab` 으로 이동) | `src/pages/BranderLab.tsx`, `src/components/lab/*`. 비회원 신청 가능 |
| 진입점 | 메인 배너, 상단 메뉴, 모바일 전체 메뉴, 푸터 | `LabHomeBanner`, `Header`, `FullMenuSheet`, `Footer` |
| 입력 규칙 · 동의 문구 | `supabase/functions/_shared/labApplication.ts` | 화면 · Edge Function · 테스트가 같이 쓰는 단일 기준 |
| 접수 API | Edge Function `submit-lab-application` | 서버 재검증, 이미지 내용 검사, 중복 · 과다 신청 차단, 저장 실패 시 이미지 정리 |
| DB | `supabase/migrations/20261121000000_brander_lab_applications.sql` | 신청서 · 동의 이력 · 촬영 세부 동의 · 처리 이력 · 비공개 이미지 버킷 · 관리자 RPC |
| 관리자 | `/admin/lab-applications` (메뉴: BRAND-ER LAB → 무료 제작 신청) | 목록 · 검색 · 정렬 · 상태 · 메모 · 상세 · CSV · 동의 이력 · 보유 기간 · 삭제 |

### 권한

| 등급 | `lab.view` (목록 · 상세 · 이미지 · CSV) | `lab.manage` (상태 · 메모 · 동의 기록 · 보유 기한 · 삭제) |
| --- | --- | --- |
| Super Admin | ✓ | ✓ |
| Operations Admin | ✓ | ✓ |
| CS Admin | ✓ | – |

- 신청 테이블과 이미지 버킷(`lab-applications`, 비공개)은 일반 사용자 · 비회원이 직접 읽거나 쓸 수 없습니다. 신청자 본인도 다른 사람의 신청을 볼 수 없습니다.
- 관리자 데이터는 모두 `admin_*` RPC 가 서버에서 권한을 다시 확인합니다. 이미지는 권한이 있는 관리자에게만 10분짜리 서명 URL 로 열립니다.
- 상세 열람 · CSV 다운로드 · 변경 · 동의 기록 · 삭제는 Audit Log 에 남습니다(개인정보 접속 기록).

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

- [ ] 비로그인 상태로 `/lab` 에서 이미지 1장과 함께 신청 → 완료 화면과 접수 번호
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
  <a href="https://brand-er1.github.io/clothology-express/lab" style="display:inline-block;margin-top:28px;padding:16px 28px;background:#741b2b;color:#fff;font-size:15px;font-weight:600;text-decoration:none;border-radius:2px;">무료 제작 신청하기 →</a>
</section>
```

상단 메뉴: Cafe24 관리자 → 디자인 → 메뉴(또는 레이아웃 HTML)에 링크를 추가합니다.

```html
<li><a href="https://brand-er1.github.io/clothology-express/lab">무료 의류 제작 신청</a></li>
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
