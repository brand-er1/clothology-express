import { Link } from "react-router-dom";
import { BrandMascot } from "@/components/BrandMascot";

const legalLinks = [
  { href: "https://brand-er.store/member/agreement.html", label: "이용약관", internal: false },
  { href: "https://brand-er.store/member/privacy.html", label: "개인정보처리방침", internal: false },
  { href: "/visit-data-policy", label: "방문정보 수집 안내", internal: true },
  { href: "https://brand-er.store/shopinfo/guide.html", label: "배송·교환·환불 안내", internal: false },
];

const siteLinks = [
  { to: "/fundings", label: "펀딩 둘러보기" },
  { to: "/customize", label: "디자인 시작하기" },
  { to: "/design-quote", label: "제작 견적" },
  { to: "/portfolio", label: "포트폴리오" },
  { to: "/community", label: "매거진" },
];

export const Footer = () => (
  <footer className="bg-[#1d1718] text-stone-400">
    <div className="page-shell pb-10 pt-16 sm:pt-24">
      <div className="grid gap-12 lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-6">
          <p className="font-display text-[clamp(2.75rem,8vw,6.5rem)] font-semibold leading-[0.9] tracking-[-0.05em] text-[#f3eee8]">
            BRAND-ER
          </p>
          <p className="mt-5 max-w-sm text-sm leading-7 text-stone-400">
            아이디어가 옷이 되는 가장 쉬운 방법.
            <br />
            디자인부터 원단, 샘플, 생산까지.
          </p>
        </div>

        <nav aria-label="사이트 메뉴" className="lg:col-span-3 lg:col-start-8">
          <p className="eyebrow text-[#c999a4]">Studio</p>
          <ul className="mt-5 space-y-2.5 text-[15px] text-stone-300">
            {siteLinks.map((link) => (
              <li key={link.to}>
                <Link to={link.to} className="link-draw transition-colors hover:text-white">{link.label}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="정책 안내" className="lg:col-span-2">
          <p className="eyebrow text-[#c999a4]">Policy</p>
          <ul className="mt-5 space-y-2.5 text-sm">
            {legalLinks.map((link) => (
              <li key={link.href}>
                {link.internal ? (
                  <Link className="link-draw transition-colors hover:text-white" to={link.href}>
                    {link.label}
                  </Link>
                ) : (
                  <a className="link-draw transition-colors hover:text-white" href={link.href} target="_top">
                    {link.label}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="mt-16 flex flex-col gap-6 border-t border-white/10 pt-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-start gap-3">
          <BrandMascot size={28} className="mt-0.5 shrink-0 opacity-90" />
          <p className="text-xs leading-6 text-stone-500">
            상호명 브랜더(BRAND-ER) · 대표자 김하성 · 사업자등록번호 704-04-03387
            <br />
            사업장 주소 경기도 하남시 미사대로 550, 현대지식산업센터1차 10층 C-0001호
            브이15C(덕풍동, 현대지식산업센터 한강미사)
            <br />
            고객센터{" "}
            <a className="underline-offset-4 hover:text-white hover:underline" href="tel:+827047083015">
              070-4708-3015
            </a>
            {" "}· 개인정보책임자{" "}
            <a
              className="underline-offset-4 hover:text-white hover:underline"
              href="mailto:hasung03@gmail.com"
            >
              김하성
            </a>
          </p>
        </div>
        <p className="shrink-0 text-xs text-stone-600">Copyright © BRAND-ER. All rights reserved.</p>
      </div>
    </div>
  </footer>
);
