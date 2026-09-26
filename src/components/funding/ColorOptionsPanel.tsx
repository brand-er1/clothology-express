import { Link } from "react-router-dom";
import { Palette, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { colorHexOf, type FundingColor } from "@/lib/funding-colors";

type Props = {
  fundingId: string;
  colors: FundingColor[];
  readOnly?: boolean;
  hasColorSection: boolean;
  onAddColorSection: () => void;
  returnTo: string;
};

/** AI 상세페이지 편집기 안의 컬러 옵션 요약. 컬러 데이터는 펀딩과 공유되며 COLOR 섹션에 실시간 반영된다. */
export const ColorOptionsPanel = ({ fundingId, colors, readOnly, hasColorSection, onAddColorSection, returnTo }: Props) => {
  const withImages = colors.filter((color) => color.approved.front?.url || color.approved.back?.url).length;
  return (
    <div className="mb-4 rounded-xl border border-stone-200 bg-stone-50 p-3.5">
      <div className="flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-sm font-bold text-stone-900"><Palette className="h-4 w-4 text-brand" />컬러 옵션</p>
        <span className="text-[11px] text-stone-500">이미지 {withImages}/{colors.length}</span>
      </div>
      {colors.length ? (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {colors.map((color) => (
            <span key={color.id} className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-stone-700 ring-1 ring-stone-200">
              <span className="h-3 w-3 rounded-full border border-black/15" style={{ backgroundColor: colorHexOf(color) }} />
              {color.name}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-xs text-stone-500">등록된 컬러가 없습니다.</p>
      )}
      <p className="mt-2.5 text-[11px] leading-4 text-stone-500">
        컬러를 추가·삭제·이름변경·순서변경하거나 컬러 이미지를 승인하면 COLOR 섹션과 펀딩 상단 이미지에 바로 반영됩니다.
      </p>
      {!readOnly && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline" className="h-8 bg-white text-xs">
            <Link to={`/fundings/${fundingId}/colors?returnTo=${encodeURIComponent(returnTo)}`}>컬러 · AI 이미지 관리</Link>
          </Button>
          {!hasColorSection && colors.length > 0 && (
            <Button type="button" size="sm" variant="outline" className="h-8 bg-white text-xs" onClick={onAddColorSection}>
              <Plus className="mr-1 h-3.5 w-3.5" />AVAILABLE COLORS 섹션 추가
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
