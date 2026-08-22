import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerClose, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { portfolioCategoryLabel, type PortfolioProduct } from "@/data/portfolioProducts";

const UNCONFIRMED = "제작 사양 상담 후 확정";

interface PortfolioProductDetailProps {
  product: PortfolioProduct | null;
  onOpenChange: (open: boolean) => void;
}

const DetailBody = ({ product }: { product: PortfolioProduct }) => {
  const navigate = useNavigate();

  const goToQuote = () => {
    navigate(`/design-quote?ref=${encodeURIComponent(product.nameKo)}`, {
      state: { fromPortfolio: { productName: product.nameKo } },
    });
  };

  const specs: Array<[string, string]> = [
    ["제품 유형", portfolioCategoryLabel[product.category]],
    ["주요 소재", UNCONFIRMED],
    ["핏", UNCONFIRMED],
    ["주요 디테일", UNCONFIRMED],
    ["후가공", UNCONFIRMED],
    ["제작 난이도", UNCONFIRMED],
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex aspect-[4/5] items-center justify-center bg-[#efece6] sm:aspect-[16/10]">
          <img
            src={product.image}
            alt={product.nameKo}
            className="h-full w-full object-contain p-6 sm:p-10"
          />
        </div>
        <div className="px-5 py-6 sm:px-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-brand">
            BRAND-ER · {product.index}
          </p>
          <h2 className="mt-2 font-serif text-3xl font-normal tracking-[-0.03em] text-[#211b1c] sm:text-4xl">
            {product.nameEn}
          </h2>
          <p className="mt-1 text-sm text-stone-500">{product.nameKo}</p>

          <dl className="mt-6 divide-y divide-black/10 border-y border-black/10 text-sm">
            {specs.map(([label, value]) => (
              <div key={label} className="grid grid-cols-[110px_1fr] gap-3 py-3">
                <dt className="font-semibold text-stone-500">{label}</dt>
                <dd className={value === UNCONFIRMED ? "text-stone-400" : "font-semibold text-stone-800"}>
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
      <div
        className="shrink-0 border-t border-black/10 bg-white px-5 py-4 sm:px-8"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <button
          type="button"
          onClick={goToQuote}
          className="flex h-12 w-full items-center justify-center gap-2 bg-brand text-sm font-bold text-white transition hover:bg-brand-dark"
        >
          이 제품과 비슷하게 제작하기 <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export const PortfolioProductDetail = ({ product, onOpenChange }: PortfolioProductDetailProps) => {
  const isMobile = useIsMobile();
  const open = Boolean(product);
  // Keep showing the last selected product while the sheet/dialog is closing so the exit
  // animation doesn't flash empty content.
  const [displayProduct, setDisplayProduct] = useState<PortfolioProduct | null>(product);
  useEffect(() => {
    if (product) setDisplayProduct(product);
  }, [product]);

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="z-[80] flex h-[94dvh] max-h-[94dvh] flex-col">
          <DrawerTitle className="sr-only">{displayProduct?.nameKo || "제품 상세"}</DrawerTitle>
          <div className="flex shrink-0 items-center justify-end px-4 pt-1">
            <DrawerClose asChild>
              <button type="button" aria-label="닫기" className="flex h-9 w-9 items-center justify-center rounded-full text-stone-400">
                <X className="h-5 w-5" />
              </button>
            </DrawerClose>
          </div>
          {displayProduct && <DetailBody product={displayProduct} />}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="z-[80] h-[88vh] w-[95vw] max-w-3xl overflow-hidden rounded-none p-0 [&>button]:z-10 [&>button]:rounded-full [&>button]:bg-white/90 [&>button]:p-1.5 [&>button]:opacity-100">
        <DialogTitle className="sr-only">{displayProduct?.nameKo || "제품 상세"}</DialogTitle>
        {displayProduct && <DetailBody product={displayProduct} />}
      </DialogContent>
    </Dialog>
  );
};
