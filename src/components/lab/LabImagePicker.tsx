import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { prepareLabImage } from "@/services/labApplications";
import { checkLabImageFile, LAB_LIMITS } from "../../../supabase/functions/_shared/labApplication";

export type LabPickedImage = { id: string; file: File; previewUrl: string };

type Props = {
  images: LabPickedImage[];
  onChange: (images: LabPickedImage[]) => void;
  disabled?: boolean;
};

const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

/** 참고 이미지 선택(최대 5장, JPG · PNG · WEBP, 각 10MB). 휴대폰에서는 사진 보관함 · 카메라 선택 창이 열린다. */
export const LabImagePicker = ({ images, onChange, disabled }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const latest = useRef(images);
  latest.current = images;

  // 화면을 떠날 때 미리보기 주소를 정리한다.
  useEffect(() => () => latest.current.forEach((image) => URL.revokeObjectURL(image.previewUrl)), []);

  const remaining = LAB_LIMITS.maxImages - images.length;

  const handleFiles = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const files = Array.from(list);
    const problems: string[] = [];
    if (files.length > remaining) problems.push(`참고 이미지는 최대 ${LAB_LIMITS.maxImages}장까지 올릴 수 있어 ${files.length - Math.max(remaining, 0)}장은 제외했습니다.`);
    const accepted = files.slice(0, Math.max(remaining, 0)).filter((file) => {
      const problem = checkLabImageFile(file);
      if (problem) problems.push(problem);
      return !problem;
    });

    setProcessing(true);
    const prepared: LabPickedImage[] = [];
    for (const file of accepted) {
      const ready = await prepareLabImage(file);
      if (ready.size > LAB_LIMITS.maxImageBytes) { problems.push(`${file.name}: 이미지당 10MB 이하만 올릴 수 있습니다.`); continue; }
      prepared.push({ id: newId(), file: ready, previewUrl: URL.createObjectURL(ready) });
    }
    setProcessing(false);
    setMessages(problems);
    if (prepared.length) onChange([...latest.current, ...prepared].slice(0, LAB_LIMITS.maxImages));
    if (inputRef.current) inputRef.current.value = "";
  };

  const remove = (id: string) => {
    const target = images.find((image) => image.id === id);
    if (target) URL.revokeObjectURL(target.previewUrl);
    onChange(images.filter((image) => image.id !== id));
  };

  return (
    <div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 sm:gap-3">
        {images.map((image, index) => (
          <figure key={image.id} className="group relative aspect-square overflow-hidden rounded-[2px] border border-black/10 bg-white">
            <img src={image.previewUrl} alt={`참고 이미지 ${index + 1}`} className="h-full w-full object-cover" />
            <figcaption className="absolute left-1.5 top-1.5 bg-[#211b1c]/75 px-1.5 py-0.5 font-display text-[10px] font-semibold text-white">{String(index + 1).padStart(2, "0")}</figcaption>
            <button
              type="button"
              onClick={() => remove(image.id)}
              disabled={disabled}
              className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-[#211b1c] shadow-sm transition hover:bg-white disabled:opacity-50"
              aria-label={`참고 이미지 ${index + 1} 삭제`}
            >
              <X className="h-4 w-4" />
            </button>
          </figure>
        ))}
        {remaining > 0 && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || processing}
            className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-[2px] border border-dashed border-black/25 bg-white/60 text-stone-500 transition hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-60"
          >
            {processing ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" strokeWidth={1.6} />}
            <span className="text-[12px] font-medium">{processing ? "준비 중" : "사진 추가"}</span>
            <span className="font-display text-[10px] tabular-nums text-stone-400">{images.length}/{LAB_LIMITS.maxImages}</span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-label="참고 이미지 선택"
        onChange={(event) => void handleFiles(event.target.files)}
      />
      {messages.length > 0 && (
        <ul className="mt-3 space-y-1 text-[13px] text-rose-700" role="alert">
          {messages.map((message) => <li key={message}>{message}</li>)}
        </ul>
      )}
    </div>
  );
};
