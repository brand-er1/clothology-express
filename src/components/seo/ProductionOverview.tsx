import faq from "@/data/production-faq.json";
import { getAppPath } from "@/utils/appUrl";

export const ProductionOverview = () => (
  <section aria-labelledby="production-overview" className="page-shell border-t border-black/10 py-16 sm:py-24">
    <p className="eyebrow">Production guide</p>
    <h2 id="production-overview" className="mt-4 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">소량 의류 제작대행 · 디자인부터 샘플·생산까지</h2>
    <p className="mt-5 max-w-3xl text-sm leading-7 text-stone-600">{faq[0].answer}</p>
    <div className="mt-8 max-w-3xl divide-y divide-black/10 border-y border-black/10">
      {[faq[2], faq[3], faq[5], faq[10]].map((item) => (
        <details key={item.question} className="py-4">
          <summary className="cursor-pointer text-sm font-medium leading-6">{item.question}</summary>
          <p className="mt-3 text-sm leading-7 text-stone-600">{item.answer}</p>
        </details>
      ))}
    </div>
    <nav aria-label="의류 제작 안내" className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-sm text-brand underline underline-offset-4">
      <a href={getAppPath("/guides/small-batch.html")}>소량 의류 제작 상담</a>
      <a href={getAppPath("/guides/services.html")}>서비스 소개</a>
      <a href={getAppPath("/guides/faq.html")}>자주 묻는 질문</a>
      <a href={getAppPath("/guides/cost.html")}>제작 비용 안내</a>
      <a href={getAppPath("/guides/process.html")}>제작 과정과 기간</a>
      <a href={getAppPath("/guides/printing.html")}>프린팅 방식 비교</a>
    </nav>
  </section>
);
