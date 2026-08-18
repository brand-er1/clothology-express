import { Link } from "react-router-dom";
import { BrandMascot } from "@/components/BrandMascot";

const legalLinks = [
  { href: "https://brand-er.store/member/agreement.html", label: "이용약관", internal: false },
  { href: "https://brand-er.store/member/privacy.html", label: "개인정보처리방침", internal: false },
  { href: "/visit-data-policy", label: "방문정보 수집 안내", internal: true },
  { href: "https://brand-er.store/shopinfo/guide.html", label: "배송·교환·환불 안내", internal: false },
];

export const Footer = () => (
  <footer className="border-t border-white/10 bg-[#21151b] text-gray-300">
    <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col justify-between gap-8 md:flex-row">
        <div>
          <div className="flex items-center gap-2.5">
            <BrandMascot tone="light" size={28} className="shrink-0" />
            <p className="text-sm font-bold tracking-[0.18em] text-white">BRAND-ER</p>
          </div>
          <p className="mt-4 text-sm leading-7">
            상호명 브랜더(BRAND-ER) · 대표자 김하성 · 사업자등록번호 704-04-03387
            <br />
            사업장 주소 경기도 하남시 미사대로 550, 현대지식산업센터1차 10층 C-0001호
            브이15C(덕풍동, 현대지식산업센터 한강미사)
            <br />
            고객센터{" "}
            <a className="underline-offset-4 hover:text-white hover:underline" href="tel:+821059161331">
              010-5916-1331
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

        <nav aria-label="정책 안내" className="flex flex-wrap content-start gap-x-5 gap-y-3 text-sm">
          {legalLinks.map((link) => (
            link.internal ? (
              <Link key={link.href} className="underline-offset-4 hover:text-white hover:underline" to={link.href}>
                {link.label}
              </Link>
            ) : (
              <a key={link.href} className="underline-offset-4 hover:text-white hover:underline" href={link.href} target="_top">
                {link.label}
              </a>
            )
          ))}
        </nav>
      </div>

      <p className="mt-8 border-t border-stone-800 pt-6 text-xs text-stone-500">
        Copyright © BRAND-ER. All rights reserved.
      </p>
    </div>
  </footer>
);
