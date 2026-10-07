import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Header } from "@/components/Header";
import { fetchFunding } from "@/services/funding";
import { buildFundingSuccessStories, buildSuccessTimeline } from "@/lib/funding-success-stories";
import type { FundingSuccessStory } from "@/types/funding";
import { FundingSuccessBadge, SuccessRate } from "@/components/funding/FundingSuccessShowcase";
import { Reveal } from "@/components/portfolio/ScrollReveal";

const formatDate = (value: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
};

// 한글 이름은 받침에 따라 은/는, 영문 브랜드명은 '는'으로 읽는다.
const topicParticle = (name: string) => {
  const code = name.trim().charCodeAt(name.trim().length - 1);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 === 0 ? "는" : "은";
  return "는";
};

const SuccessStory = () => {
  const { fundingId } = useParams<{ fundingId: string }>();
  const [story, setStory] = useState<FundingSuccessStory | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");

  useEffect(() => {
    if (!fundingId) return;
    let active = true;
    setState("loading");
    fetchFunding(fundingId)
      .then((funding) => {
        if (!active) return;
        const next = buildFundingSuccessStories([funding])[0] ?? null;
        setStory(next);
        setState(next ? "ready" : "missing");
      })
      .catch(() => {
        if (active) setState("missing");
      });
    return () => {
      active = false;
    };
  }, [fundingId]);

  return (
    <div className="min-h-screen bg-[#f6f3ee] text-[#211b1c]">
      <Header />
      <main className="pt-16 sm:pt-[72px]">
        <div className="page-shell pt-8 sm:pt-10">
          <Link to="/#success-teams" className="cta-text">
            <ArrowLeft className="h-4 w-4" /> <span className="link-draw">펀딩 성공팀</span>
          </Link>
        </div>

        {state === "loading" && (
          <div className="page-shell grid gap-8 py-12 lg:grid-cols-12">
            <div className="aspect-[4/5] animate-pulse bg-[#ebe7e1] lg:col-span-6" />
            <div className="space-y-4 lg:col-span-5 lg:col-start-8">
              <div className="h-6 w-40 animate-pulse bg-[#ebe7e1]" />
              <div className="h-24 w-64 animate-pulse bg-[#ebe7e1]" />
            </div>
          </div>
        )}

        {state === "missing" && (
          <div className="page-shell py-28 text-center">
            <p className="eyebrow">Funding success</p>
            <h1 className="display-section mt-4">성공 스토리를 찾을 수 없어요</h1>
            <p className="mt-4 text-sm text-stone-600">공개가 종료되었거나 아직 준비 중인 성공 스토리입니다.</p>
            <Link to="/" className="cta-primary mt-10">
              메인으로 <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        {state === "ready" && story && (
          <>
            {/* HERO — 브랜드 이미지 + 달성률 */}
            <section className="page-shell grid gap-10 py-10 sm:py-14 lg:grid-cols-12 lg:items-end lg:gap-8 lg:py-16">
              <div className="relative aspect-[4/5] overflow-hidden bg-[#ebe7e1] lg:col-span-6">
                <img
                  src={story.thumbnail}
                  alt={`${story.brandName} ${story.productName}`}
                  className="h-full w-full object-contain p-[6%] mix-blend-multiply animate-in fade-in-0 duration-700"
                />
                <FundingSuccessBadge className="absolute left-3 top-3 sm:left-4 sm:top-4" />
              </div>

              <div className="lg:col-span-5 lg:col-start-8">
                <div className="flex items-center gap-3">
                  {story.brandLogo && (
                    <img src={story.brandLogo} alt="" className="h-10 w-10 rounded-full border border-black/10 object-cover" />
                  )}
                  <span className="bg-[#211b1c] px-2 py-1 text-[10px] font-semibold tracking-[0.04em] text-white">펀딩 성공</span>
                  <span className="text-xs text-stone-500">{story.category}</span>
                </div>
                <h1 className="mt-5 font-display text-[clamp(2.6rem,6vw,4.75rem)] font-semibold uppercase leading-[0.95] tracking-[-0.05em]">
                  {story.brandName}
                </h1>
                <p className="mt-2 text-sm text-stone-500">{story.productName}</p>

                <div className="mt-8 border-t border-black/10 pt-6">
                  <p className="text-xs font-semibold tracking-[0.04em] text-stone-500">펀딩 달성률</p>
                  <div className="mt-3">
                    <SuccessRate rate={story.fundingRate} size="lg" />
                  </div>
                </div>

                <blockquote className="mt-8 text-lg font-semibold leading-8 tracking-[-0.02em] sm:text-xl sm:leading-9">
                  “아이디어가 실제 제품이 되기까지,
                  <br />
                  {story.brandName}
                  {topicParticle(story.brandName)} BRAND-ER와 함께했습니다.”
                </blockquote>
                {story.description && <p className="mt-4 whitespace-pre-line text-sm leading-7 text-stone-600">{story.description}</p>}

                <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-black/10 pt-6 text-sm">
                  {story.participantCount != null && (
                    <div>
                      <dt className="text-xs text-stone-500">참여자</dt>
                      <dd className="mt-1 font-semibold">{story.participantCount.toLocaleString("ko-KR")}명</dd>
                    </div>
                  )}
                  {story.fundingAmount != null && (
                    <div>
                      <dt className="text-xs text-stone-500">펀딩 금액</dt>
                      <dd className="mt-1 font-semibold">{story.fundingAmount.toLocaleString("ko-KR")}원</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-xs text-stone-500">목표 달성일</dt>
                    <dd className="mt-1 font-semibold">{formatDate(story.completedAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-stone-500">카테고리</dt>
                    <dd className="mt-1 font-semibold">{story.category}</dd>
                  </div>
                </dl>

                <Link to={`/fundings/${story.fundingId}`} className="cta-primary mt-10 w-full sm:w-auto">
                  펀딩 상세 보기 <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </section>

            {/* TIMELINE — 아이디어 등록부터 펀딩 성공까지 */}
            <section className="page-shell pb-24 pt-6 sm:pb-32">
              <div className="border-t border-black/10 pt-10 lg:pt-14">
                <Reveal>
                  <p className="eyebrow">Success story</p>
                  <h2 className="display-section mt-4">아이디어에서 제품이 되기까지</h2>
                </Reveal>

                <ol className="mt-12 grid gap-0 sm:mt-16 lg:grid-cols-6 lg:gap-6">
                  {buildSuccessTimeline(story.funding).map((step, index, steps) => (
                    <li key={step.key} className="relative grid grid-cols-[2.25rem_1fr] gap-4 pb-10 lg:block lg:pb-0">
                      {index < steps.length - 1 && (
                        <span
                          aria-hidden
                          className="absolute left-[1.0625rem] top-9 h-[calc(100%-2.25rem)] w-px bg-black/15 lg:left-9 lg:top-[1.0625rem] lg:h-px lg:w-[calc(100%-1.5rem)]"
                        />
                      )}
                      <span
                        className={`relative z-10 flex h-9 w-9 items-center justify-center rounded-full border text-xs font-semibold ${
                          step.state === "done"
                            ? "border-brand bg-brand text-white"
                            : step.state === "current"
                              ? "border-brand bg-[#f6f3ee] text-brand"
                              : "border-black/20 bg-[#f6f3ee] text-stone-400"
                        }`}
                      >
                        {step.state === "done" ? <Check className="h-4 w-4" strokeWidth={2.5} /> : String(index + 1).padStart(2, "0")}
                      </span>
                      <Reveal delayMs={index * 80} className="lg:mt-6">
                        <p className="font-display text-[11px] font-semibold tracking-[0.18em] text-brand">STEP {String(index + 1).padStart(2, "0")}</p>
                        <h3 className="mt-1.5 text-base font-semibold tracking-[-0.02em]">
                          {step.title}
                          {step.state === "current" && <span className="ml-2 text-xs font-medium text-brand">진행 중</span>}
                        </h3>
                        {formatDate(step.date) && <p className="mt-1 font-display text-xs text-stone-500">{formatDate(step.date)}</p>}
                        <p className="mt-2 text-sm leading-6 text-stone-600">{step.description}</p>
                      </Reveal>
                    </li>
                  ))}
                </ol>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
};

export default SuccessStory;
