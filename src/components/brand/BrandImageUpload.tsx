import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SafeBrandImage } from "@/components/brand/SafeBrandImage";
import { uploadBrandAsset } from "@/services/brand";

type Props = {
  label: string;
  kind: "profile" | "logo";
  value: string | null;
  onChange: (url: string) => void;
};

export const BrandImageUpload = ({ label, kind, value, onChange }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handleFile = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      onChange(await uploadBrandAsset(file, kind));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "업로드하지 못했습니다.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="min-w-0 space-y-3 rounded-lg border border-stone-200 bg-white p-4">
      <Label>{label}</Label>
      <div className="flex min-w-0 items-center gap-4">
        <SafeBrandImage src={value} alt={label} kind={kind} className="h-20 w-20" />
        <div className="min-w-0 flex-1">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />
          <Button
            type="button"
            variant="outline"
            className="w-full max-w-48 rounded-full"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
            {uploading ? "업로드 중" : "이미지 선택"}
          </Button>
          <p className="mt-2 text-xs leading-5 text-stone-500">JPG, PNG, WEBP · 자동 리사이징</p>
        </div>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
};
