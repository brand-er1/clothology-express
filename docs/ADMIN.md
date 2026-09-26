# BRAND-ER 관리자 콘솔

접속: `https://brand-er1.github.io/clothology-express/admin` (로컬: `http://localhost:8080/admin`)

## 관리자 등급 (RBAC)

| 권한 | Super Admin | Operations Admin | CS Admin |
|---|:-:|:-:|:-:|
| 대시보드 (재무 KPI) | ✅ (✅) | ✅ (❌) | ✅ (❌) |
| 회원 조회 / 정지·제한·제작자 승인 | ✅ / ✅ | ✅ / ✅ | ✅ / ❌ |
| 제작자·브랜드 관리 | ✅ | ✅ | ❌ |
| 펀딩 조회 / 승인·반려·공개·중단 | ✅ / ✅ | ✅ / ✅ | ✅ / ❌ |
| 주문 조회 / 주문 상태 변경 | ✅ / ✅ | ✅ / ✅ | ✅ / ❌ |
| 결제 관리 | ✅ | ❌ | ❌ |
| 환불 조회·요청 / 승인·완료 | ✅ / ✅ | ❌ / ❌ | ✅ / ❌ |
| 정산 관리 | ✅ | ❌ | ❌ |
| 제작·배송 관리 | ✅ | ✅ | 배송 조회만 |
| 콘텐츠 삭제·숨김 / 신고 처리 / CS 문의 | ✅ / ✅ / ✅ | ✅ / ✅ / 조회 | ❌ / ✅ / ✅ |
| 공지·알림 발송, 통계 | ✅ | ✅ | ❌ |
| 관리자 관리, Audit Log, 시스템 설정, AI 프롬프트, AI 사용량 | ✅ | ❌ | ❌ |

권한 매트릭스의 원본은 `public.admin_role_permissions()` (SQL) 이며 `src/lib/admin/permissions.ts` 와 단위 테스트로 동기화를 검증한다.
프런트 메뉴 숨김은 UX 용이고, 모든 `admin_*` RPC 가 서버에서 `_admin_require(권한)` 으로 다시 검증한다.

## 첫 관리자 지정

기존 `user_roles.role = 'admin'` 계정은 마이그레이션 시 자동으로 Super Admin 이 된다.
이후 관리자 추가는 콘솔 **관리자 관리** 에서 가입된 회원 이메일로 등급을 부여한다.

## 운영 원칙

- 회원/펀딩/주문/결제/정산은 삭제하지 않는다. 회원은 `active → restricted/suspended → archived`, 펀딩은 운영 중단(`suspended_at`), 댓글·게시물은 soft delete.
- 결제 이력이 있는 주문·펀딩은 DB 트리거가 삭제를 차단한다.
- 실결제 환불은 PG API 를 자동 호출하지 않는다. PG 관리자 콘솔에서 환불 후 콘솔에서 "PG 환불 완료 확인" 으로 완료 처리한다.
- 이메일·문자·알림톡은 미연동 상태로 기록만 되며 사이트 내 알림만 실제 발송된다.
- 모든 관리자 작업은 `admin_audit_logs` (수정·삭제 불가) 에 기록된다.

## 로컬 검증

```bash
PGHOST=/tmp PGPORT=55432 PGUSER=postgres scripts/admin-db-tests/run.sh   # 임시 Postgres 필요
npm test && npm run build
```
