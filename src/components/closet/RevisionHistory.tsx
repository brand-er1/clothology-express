import { Check } from "lucide-react";
import { ensureGarmentRevisions } from "@/lib/closet-store";
import type { ClosetGarment } from "@/types/closet";

interface RevisionHistoryProps {
  garment: ClosetGarment;
  onRestore: (revisionId: string) => void;
}

/** Original → 수정 1 → 수정 2 ... — pick any past version to make it current again. */
export const RevisionHistory = ({ garment, onRestore }: RevisionHistoryProps) => {
  const revisions = ensureGarmentRevisions(garment);
  if (revisions.length <= 1) return null;

  const activeId = garment.activeRevisionId || revisions[revisions.length - 1].id;

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-bold text-stone-500">수정 히스토리</p>
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ WebkitOverflowScrolling: "touch" }}>
        {revisions.map((revision, index) => {
          const isActive = revision.id === activeId;
          return (
            <button
              key={revision.id}
              type="button"
              onClick={() => onRestore(revision.id)}
              disabled={isActive}
              className={`relative flex w-16 shrink-0 flex-col items-center gap-1 rounded-xl border p-1 text-center transition ${
                isActive ? "border-brand ring-2 ring-brand/15" : "border-stone-200 hover:border-brand/40"
              }`}
              aria-label={`${index === 0 ? "원본" : `수정 ${index}`}${isActive ? ", 현재 버전" : ", 이 버전으로 돌아가기"}`}
            >
              <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg bg-[#f4f0ea]">
                <img
                  src={revision.imageUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-contain"
                />
              </div>
              <p className="truncate text-[9px] font-bold text-stone-600">
                {index === 0 ? "원본" : `수정 ${index}`}
              </p>
              {isActive && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-white">
                  <Check className="h-2.5 w-2.5" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
