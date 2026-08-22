import { portfolioCategoryLabel, type PortfolioProduct } from "@/data/portfolioProducts";

interface PortfolioProductCardProps {
  product: PortfolioProduct;
  onSelect: (product: PortfolioProduct) => void;
}

export const PortfolioProductCard = ({ product, onSelect }: PortfolioProductCardProps) => (
  <button
    type="button"
    onClick={() => onSelect(product)}
    className="group block w-full min-w-0 text-left"
    aria-label={`${product.nameKo} 상세보기`}
  >
    <div className="relative aspect-[4/5] overflow-hidden bg-[#efece6]">
      <span className="absolute left-3 top-3 z-10 text-[9px] font-bold uppercase tracking-[0.18em] text-stone-500 sm:left-4 sm:top-4 sm:text-[11px]">
        {product.index}
      </span>
      <img
        src={product.image}
        alt={product.nameKo}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-contain p-5 transition duration-700 ease-out group-hover:scale-[1.04] sm:p-7"
      />
    </div>
    <div className="pt-3 sm:pt-4">
      <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-brand sm:text-[11px]">
        {portfolioCategoryLabel[product.category]}
      </p>
      <h3 className="mt-1 truncate text-sm font-semibold text-[#211b1c] sm:text-base">{product.nameKo}</h3>
      <p className="mt-0.5 truncate text-[11px] text-stone-400">{product.nameEn}</p>
    </div>
  </button>
);
