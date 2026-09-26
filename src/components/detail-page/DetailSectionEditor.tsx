import { useRef, useState } from "react";
import { ImagePlus, Loader2, Plus, RefreshCw, Sparkles, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/use-toast";
import { DetailImageView } from "@/components/detail-page/DetailImageView";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SECTION_META, createDetailId, defaultSlotForSection, getDesignImages } from "@/lib/detail-page/document";
import { getDetailImageSpec } from "@/lib/detail-page/imagePipeline";
import { getDetailPageErrorMessage, uploadDetailPageImage } from "@/services/detailPage";
import type {
  DetailImage,
  DetailImageCrop,
  DetailImageJobStatus,
  DetailImageType,
  DetailPageSource,
  DetailSection,
  DetailCopyTone,
  DetailSectionBackground,
} from "@/types/detailPage";
import { cn } from "@/lib/utils";

type DetailSectionEditorProps = {
  section: DetailSection;
  source: DetailPageSource;
  onChange: (next: DetailSection) => void;
  /** Rewrites this section's copy with the same facts; `tone` only changes the voice. */
  onRegenerate?: (tone?: DetailCopyTone) => void;
  regenerating?: boolean;
  /** Regenerates one image with the AI image API; resolves when done (the page updates itself). */
  onRegenerateImage?: (imageId: string, slot: DetailImageType, instruction: string) => Promise<void>;
  regeneratingImageIds?: string[];
  imageStatus?: Partial<Record<DetailImageType, DetailImageJobStatus>>;
};

const INSTRUCTION_EXAMPLES = [
  "배경을 어두운 콘크리트 바닥으로 변경",
  "모델 없이 제품만 보여줘",
  "좀 더 고급스럽게",
  "제품을 바닥에 자연스럽게 놓은 느낌",
];

const TONE_OPTIONS: Array<{ value: DetailCopyTone | ""; label: string }> = [
  { value: "", label: "스타일 기본 톤" },
  { value: "concise", label: "간결하게" },
  { value: "emotional", label: "감성적으로" },
  { value: "professional", label: "전문적으로" },
  { value: "street", label: "스트릿하게" },
  { value: "luxury", label: "고급스럽게" },
];

const BACKGROUND_OPTIONS: Array<{ value: DetailSectionBackground; label: string; swatch: string }> = [
  { value: "default", label: "기본", swatch: "linear-gradient(135deg,#fff 50%,#e7e5e4 50%)" },
  { value: "white", label: "화이트", swatch: "#ffffff" },
  { value: "light", label: "라이트", swatch: "#f4f2ee" },
  { value: "dark", label: "다크", swatch: "#141414" },
  { value: "brand", label: "브랜드", swatch: "#741b2b" },
];

const CROP_LABEL: Record<DetailImageCrop, string> = { full: "전체", left: "앞면", right: "뒷면" };

const FieldLabel = ({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) => (
  <Label htmlFor={htmlFor} className="text-xs font-semibold text-stone-700">
    {children}
  </Label>
);

const inputClass = "h-11 rounded-md text-base sm:text-sm";
const textareaClass = "rounded-md text-base leading-6 sm:text-sm";

export const DetailSectionEditor = ({
  section,
  source,
  onChange,
  onRegenerate,
  regenerating,
  onRegenerateImage,
  regeneratingImageIds = [],
  imageStatus,
}: DetailSectionEditorProps) => {
  const [regenTarget, setRegenTarget] = useState<DetailImage | null>(null);
  const [instruction, setInstruction] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const replaceTarget = useRef<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [tone, setTone] = useState<DetailCopyTone | "">("");
  const meta = SECTION_META[section.type];
  const set = (patch: Partial<DetailSection>) => onChange({ ...section, ...patch });
  const designImages = getDesignImages(source);
  const designChoices: DetailImage[] = source.isFrontBackComposite ? [...designImages.pair, ...designImages.full] : designImages.full;
  const maxImages = section.type === "hero" ? 1 : 6;
  const showsImages = !["funding", "production", "notice", "brand", "size"].includes(section.type);
  const canRegenerate = !["custom_text", "custom_image", "brand"].includes(section.type) && onRegenerate;

  const addOrReplaceImage = (image: DetailImage, replaceId: string | null) => {
    if (replaceId) {
      set({ images: section.images.map((current) => (current.id === replaceId ? { ...image, id: current.id } : current)) });
      return;
    }
    set({ images: [...section.images, image].slice(-maxImages) });
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadDetailPageImage(file);
      addOrReplaceImage(
        { id: createDetailId(), url, crop: "full", alt: section.title || meta.label, source: "upload" },
        replaceTarget.current,
      );
    } catch (error) {
      toast({ title: "이미지를 업로드하지 못했습니다", description: getDetailPageErrorMessage(error), variant: "destructive" });
    } finally {
      setUploading(false);
      replaceTarget.current = null;
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const openUpload = (replaceId: string | null) => {
    replaceTarget.current = replaceId;
    fileInput.current?.click();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold tracking-[0.14em] text-stone-400">{meta.eyebrow}</p>
          <h3 className="text-base font-bold">{meta.label}</h3>
          <p className="mt-0.5 text-xs text-stone-500">{meta.hint}</p>
        </div>
        {canRegenerate && (
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <Button type="button" variant="outline" size="sm" onClick={() => onRegenerate?.(tone || undefined)} disabled={regenerating} className="h-9 rounded-md">
              {regenerating ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
              AI 다시 작성
            </Button>
            <select
              aria-label="AI 다시 작성 톤"
              value={tone}
              onChange={(event) => setTone(event.target.value as DetailCopyTone | "")}
              className="h-8 rounded-md border border-stone-300 bg-white px-2 text-xs"
            >
              {TONE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
        )}
      </div>
      {canRegenerate && <p className="-mt-3 text-[11px] leading-4 text-stone-400">톤을 바꿔도 제품 사실(소재·사이즈·가격 등)은 그대로 유지하고 표현만 바뀝니다.</p>}

      {section.type !== "hero" && (
        <div className="grid gap-3 rounded-md border border-stone-200 p-3 sm:grid-cols-[1fr_auto]">
          <div>
            <p className="text-xs font-semibold text-stone-700">배경</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5" role="radiogroup" aria-label="섹션 배경">
              {BACKGROUND_OPTIONS.map((option) => {
                const active = (section.layout?.background ?? "default") === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => set({ layout: { ...section.layout, background: option.value } })}
                    className={cn("flex h-8 items-center gap-1.5 rounded-md border px-2 text-[11px] font-semibold", active ? "border-brand text-brand" : "border-stone-300 text-stone-600")}
                  >
                    <span className="h-3.5 w-3.5 rounded-sm border border-black/10" style={{ background: option.swatch }} />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-stone-700">정렬</p>
            <div className="mt-1.5 flex gap-1.5" role="radiogroup" aria-label="섹션 정렬">
              {([["default", "기본"], ["left", "왼쪽"], ["center", "가운데"]] as const).map(([value, label]) => {
                const active = (section.layout?.align ?? "default") === value;
                return (
                  <button key={value} type="button" role="radio" aria-checked={active}
                    onClick={() => set({ layout: { ...section.layout, align: value } })}
                    className={cn("h-8 rounded-md border px-2.5 text-[11px] font-semibold", active ? "border-brand text-brand" : "border-stone-300 text-stone-600")}>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {section.type !== "hero" && (
        <div className="grid gap-3 sm:grid-cols-[0.8fr_1.2fr]">
          <div className="space-y-1.5">
            <FieldLabel htmlFor={`eyebrow-${section.id}`}>라벨</FieldLabel>
            <Input id={`eyebrow-${section.id}`} value={section.eyebrow} maxLength={40} onChange={(event) => set({ eyebrow: event.target.value })} className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <FieldLabel htmlFor={`title-${section.id}`}>제목</FieldLabel>
            <Input id={`title-${section.id}`} value={section.title} maxLength={80} onChange={(event) => set({ title: event.target.value })} className={inputClass} />
          </div>
        </div>
      )}
      {section.type === "hero" && (
        <div className="space-y-1.5">
          <FieldLabel htmlFor={`eyebrow-${section.id}`}>상단 라벨 (브랜드명 등)</FieldLabel>
          <Input id={`eyebrow-${section.id}`} value={section.eyebrow} maxLength={40} onChange={(event) => set({ eyebrow: event.target.value })} className={inputClass} />
          <p className="text-[11px] text-stone-500">상품명과 한 줄 카피는 ‘상품 정보’ 탭에서 수정합니다.</p>
        </div>
      )}

      {section.type !== "hero" && (
        <div className="space-y-1.5">
          <FieldLabel htmlFor={`description-${section.id}`}>
            {section.type === "funding" ? "펀딩 안내 문구" : section.type === "production" ? "제작 일정 안내" : section.type === "notice" ? "배송 안내" : "본문"}
          </FieldLabel>
          <Textarea
            id={`description-${section.id}`}
            value={section.description}
            maxLength={3000}
            onChange={(event) => set({ description: event.target.value })}
            className={cn(textareaClass, "min-h-[120px]")}
          />
          {section.type === "funding" && (
            <p className="text-[11px] leading-4 text-stone-500">목표·참여 수량, 진행률, 가격, 종료일은 실제 펀딩 데이터로 자동 표시됩니다.</p>
          )}
        </div>
      )}

      {(section.items.length > 0 || ["detail", "fit", "size", "production", "notice", "story", "custom_text"].includes(section.type)) && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-stone-700">
            {section.type === "detail" ? "디자인 포인트 (3~5개 권장)" : section.type === "fit" ? "추천 스타일링" : section.type === "size" ? "세탁 / 관리" : section.type === "production" ? "제작 단계" : section.type === "notice" ? "주의사항" : "목록"}
          </p>
          {section.items.map((item, index) => (
            <div key={item.id} className="border border-stone-200 bg-white p-2.5">
              <div className="flex items-center gap-2">
                <span className="w-5 shrink-0 text-center text-xs font-bold text-stone-400">{index + 1}</span>
                <Input
                  value={item.title}
                  placeholder="제목 (선택)"
                  maxLength={60}
                  onChange={(event) => set({ items: section.items.map((current) => (current.id === item.id ? { ...current, title: event.target.value } : current)) })}
                  className="h-10 rounded-md text-base sm:text-sm"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 shrink-0 text-stone-400 hover:text-red-600"
                  onClick={() => set({ items: section.items.filter((current) => current.id !== item.id) })}
                  aria-label="항목 삭제"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <Textarea
                value={item.text}
                placeholder="내용"
                maxLength={400}
                onChange={(event) => set({ items: section.items.map((current) => (current.id === item.id ? { ...current, text: event.target.value } : current)) })}
                className={cn(textareaClass, "mt-2 min-h-[64px]")}
              />
            </div>
          ))}
          {section.items.length < 8 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-10 rounded-md"
              onClick={() => set({ items: [...section.items, { id: createDetailId(), title: "", text: "" }] })}
            >
              <Plus className="mr-1 h-4 w-4" /> 항목 추가
            </Button>
          )}
        </div>
      )}

      {section.facts.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-stone-700">제품 정보 (입력한 데이터 기준)</p>
          {section.facts.map((fact, index) => (
            <div key={`${fact.label}-${index}`} className="grid grid-cols-[6rem_minmax(0,1fr)_auto] items-center gap-2">
              <Input
                value={fact.label}
                maxLength={20}
                onChange={(event) => set({ facts: section.facts.map((current, i) => (i === index ? { ...current, label: event.target.value } : current)) })}
                className="h-10 rounded-md text-base sm:text-sm"
                aria-label="항목명"
              />
              <Input
                value={fact.value}
                maxLength={120}
                onChange={(event) => set({ facts: section.facts.map((current, i) => (i === index ? { ...current, value: event.target.value } : current)) })}
                className="h-10 rounded-md text-base sm:text-sm"
                aria-label="값"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-10 w-10 text-stone-400 hover:text-red-600"
                onClick={() => set({ facts: section.facts.filter((_, i) => i !== index) })}
                aria-label="정보 삭제"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {showsImages && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-stone-700">이미지 {section.type === "hero" && "(1장)"}</p>
          <div className="grid grid-cols-2 gap-2">
            {section.images.map((image) => (
              <div key={image.id} className="border border-stone-200 bg-white">
                <DetailImageView image={image} className="aspect-square w-full bg-stone-100" fit={image.source === "design" ? "contain" : "cover"} />
                <div className="space-y-1.5 p-2">
                  {image.source === "design" && source.isFrontBackComposite && (
                    <div className="grid grid-cols-3 gap-1" role="radiogroup" aria-label="이미지 영역">
                      {(Object.keys(CROP_LABEL) as DetailImageCrop[]).map((crop) => (
                        <button
                          key={crop}
                          type="button"
                          role="radio"
                          aria-checked={image.crop === crop}
                          onClick={() => set({ images: section.images.map((current) => (current.id === image.id ? { ...current, crop } : current)) })}
                          className={cn(
                            "h-8 border text-[11px] font-semibold",
                            image.crop === crop ? "border-brand bg-brand/5 text-brand" : "border-stone-200 text-stone-500",
                          )}
                        >
                          {CROP_LABEL[crop]}
                        </button>
                      ))}
                    </div>
                  )}
                  {(() => {
                    const slot = image.slot ?? defaultSlotForSection(section.type, image.crop);
                    const busy = regeneratingImageIds.includes(image.id) || (image.source === "design" && image.slot && ["pending", "generating"].includes(imageStatus?.[image.slot] ?? ""));
                    return (
                      <p className="truncate text-[10px] font-semibold text-stone-500">
                        {image.source === "generated"
                          ? `AI · ${getDetailImageSpec(slot).label}`
                          : image.source === "upload"
                            ? "직접 업로드"
                            : busy
                              ? "AI 이미지 생성 중..."
                              : image.slot && imageStatus?.[image.slot] === "failed"
                                ? "원본 디자인 · AI 생성 실패"
                                : "원본 디자인 이미지"}
                      </p>
                    );
                  })()}
                  {onRegenerateImage && (
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 w-full rounded-md bg-stone-900 px-1 text-[11px] text-white hover:bg-stone-800"
                      disabled={regeneratingImageIds.includes(image.id)}
                      onClick={() => {
                        setInstruction("");
                        setRegenTarget(image);
                      }}
                    >
                      {regeneratingImageIds.includes(image.id) ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Sparkles className="mr-1 h-3 w-3" />}
                      AI 다시 생성
                    </Button>
                  )}
                  <div className="grid grid-cols-2 gap-1">
                    <Button type="button" variant="outline" size="sm" className="h-8 rounded-md px-1 text-[11px]" onClick={() => openUpload(image.id)} disabled={uploading}>
                      <RefreshCw className="mr-1 h-3 w-3" /> 교체
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-md px-1 text-[11px] text-red-600 hover:text-red-700"
                      onClick={() => set({ images: section.images.filter((current) => current.id !== image.id) })}
                    >
                      <Trash2 className="mr-1 h-3 w-3" /> 삭제
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {section.images.length < maxImages && (
            <div className="grid grid-cols-2 gap-2">
              {designChoices.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="outline" className="h-11 rounded-md">
                      <ImagePlus className="mr-1.5 h-4 w-4" /> 디자인 이미지
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {designChoices.map((choice) => (
                      <DropdownMenuItem key={choice.crop} onSelect={() => addOrReplaceImage({ ...choice, id: createDetailId() }, null)}>
                        {CROP_LABEL[choice.crop]} 이미지
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <Button type="button" variant="outline" className="h-11 rounded-md" onClick={() => openUpload(null)} disabled={uploading}>
                {uploading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}
                사진 업로드
              </Button>
            </div>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />
        </div>
      )}

      <Dialog open={regenTarget !== null} onOpenChange={(open) => !open && setRegenTarget(null)}>
        <DialogContent className="max-w-md rounded-md">
          <DialogHeader>
            <DialogTitle>어떻게 변경할까요?</DialogTitle>
            <DialogDescription>
              원본 디자인을 기준으로 이 이미지만 다시 생성합니다. 옷의 디자인·색상·그래픽은 그대로 유지돼요.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={instruction}
            maxLength={300}
            placeholder="비워두면 같은 스타일로 새로 생성합니다."
            onChange={(event) => setInstruction(event.target.value)}
            className={cn(textareaClass, "min-h-[96px]")}
          />
          <div className="flex flex-wrap gap-1.5">
            {INSTRUCTION_EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setInstruction(example)}
                className="border border-stone-200 px-2.5 py-1.5 text-xs text-stone-600 hover:border-stone-400"
              >
                {example}
              </button>
            ))}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" className="h-11 rounded-md" onClick={() => setRegenTarget(null)}>
              취소
            </Button>
            <Button
              type="button"
              className="h-11 rounded-md bg-brand hover:bg-brand-dark"
              onClick={() => {
                if (!regenTarget || !onRegenerateImage) return;
                const target = regenTarget;
                setRegenTarget(null);
                void onRegenerateImage(target.id, target.slot ?? defaultSlotForSection(section.type, target.crop), instruction);
              }}
            >
              <Sparkles className="mr-1.5 h-4 w-4" /> 이 이미지 다시 생성
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
