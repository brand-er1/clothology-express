import { Header } from "@/components/Header";

const collectedItems = [
  "브라우저에 생성되는 무작위 방문자 번호와 세션 번호",
  "방문·마지막 활동 시각, 방문 페이지, 페이지 조회 수와 주요 서비스 행동",
  "유입 도메인, UTM 캠페인 정보, 기기 유형과 브라우저 종류",
  "개인별 영업 링크로 방문한 경우 해당 링크의 고객·브랜드 식별 코드",
  "로그인한 경우 회원 번호와 기존 회원정보의 연결",
];

export default function VisitDataPolicy() {
  return (
    <div className="min-h-screen bg-[#f4f0ea]">
      <Header />
      <main className="mx-auto max-w-4xl px-4 pb-24 pt-28 sm:px-6 sm:pt-32">
        <section className="rounded-[32px] border border-stone-200 bg-white p-6 shadow-sm sm:p-10">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">Visit data notice</p>
          <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-stone-950 sm:text-4xl">방문정보 수집 안내</h1>
          <p className="mt-4 text-sm leading-7 text-stone-600">
            브랜더는 웹사이트 운영, 이용 흐름 개선, 고객 문의와 영업 상담 연결을 위해 필요한 범위의 방문정보를 자동 수집합니다.
          </p>

          <div className="mt-10 grid gap-5 md:grid-cols-2">
            <article className="rounded-2xl bg-[#f7f4ef] p-5">
              <h2 className="font-black text-stone-950">수집 항목</h2>
              <ul className="mt-4 space-y-2 text-sm leading-6 text-stone-600">
                {collectedItems.map((item) => <li key={item}>• {item}</li>)}
              </ul>
            </article>
            <article className="rounded-2xl bg-[#f7f4ef] p-5">
              <h2 className="font-black text-stone-950">수집하지 않는 항목</h2>
              <p className="mt-4 text-sm leading-7 text-stone-600">
                방문 분석을 위해 raw IP주소, 정확한 GPS 위치, 입력 중인 비밀번호나 결제정보를 별도로 저장하지 않습니다.
              </p>
            </article>
            <article className="rounded-2xl bg-[#f7f4ef] p-5">
              <h2 className="font-black text-stone-950">신원 확인 수준</h2>
              <p className="mt-4 text-sm leading-7 text-stone-600">
                로그인 회원은 회원정보로 확인됩니다. 개인별 영업 링크 방문자는 링크 수신자로 추정될 뿐 확정 신원으로 처리하지 않습니다. 그 외 방문자는 무작위 익명 번호로만 구분합니다.
              </p>
            </article>
            <article className="rounded-2xl bg-[#f7f4ef] p-5">
              <h2 className="font-black text-stone-950">보유 기간과 문의</h2>
              <p className="mt-4 text-sm leading-7 text-stone-600">
                방문 세션과 행동 기록은 수집일로부터 최대 180일 보유 후 삭제합니다. 문의: 개인정보책임자 김하성 · hasung03@gmail.com
              </p>
            </article>
          </div>

          <p className="mt-8 rounded-2xl border border-brand/15 bg-brand/5 px-5 py-4 text-xs leading-6 text-stone-600">
            본 안내는 방문 분석 항목에 대한 추가 설명입니다. 회원가입·주문·결제 등에 관한 전체 내용은 개인정보처리방침을 함께 확인해주세요.
          </p>
        </section>
      </main>
    </div>
  );
}

