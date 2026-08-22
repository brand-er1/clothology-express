import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { clothTypes } from "@/lib/customize-constants";
import { getRecommendedFabrics } from "@/lib/fabric-recommendations";
import { inferClosetSlotFromCategory } from "@/lib/closet-character-config";
import { generateImage } from "@/services/imageGeneration";
import type { ClosetGarment } from "@/types/closet";

interface ClosetGarmentStudioProps {
  onGarmentCreated: (garment: ClosetGarment) => void;
}

/** In-game "새 옷 만들기" panel — reuses the existing AI image-generation service, never a new pipeline. */
export const ClosetGarmentStudio = ({ onGarmentCreated }: ClosetGarmentStudioProps) => {
  const [category, setCategory] = useState(clothTypes[0]?.id || "");
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast({ title: "어떤 옷인지 설명해주세요", variant: "destructive" });
      return;
    }
    const clothType = clothTypes.find((type) => type.id === category);
    if (!clothType) return;

    setIsGenerating(true);
    try {
      const materials = getRecommendedFabrics(category);
      const material = materials[0]?.id || "";
      const result = await generateImage(category, material, prompt, materials);
      if (!result) return;

      const slot = inferClosetSlotFromCategory(category);
      const imageUrl = result.storedImageUrl || result.imageUrls?.[0];
      if (!imageUrl) {
        toast({ title: "이미지를 만들지 못했어요", variant: "destructive" });
        return;
      }

      const garment: ClosetGarment = {
        id: `ai-${Date.now()}`,
        slot,
        label: prompt.trim(),
        imageUrl,
        source: "ai_design",
        designRef: {
          imageUrl: result.storedImageUrl || null,
          imagePath: result.imagePath || null,
          selectedType: category,
          selectedMaterial: material,
          designContext: result.optimizedPrompt || result.prompt,
        },
      };
      onGarmentCreated(garment);
      setPrompt("");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-3 rounded-[1.5rem] border border-brand/20 bg-brand/5 p-5">
      <p className="flex items-center gap-2 text-sm font-black text-stone-950">
        <Sparkles className="h-4 w-4 text-brand" />✨ 새 옷 만들기
      </p>
      <p className="text-xs leading-5 text-stone-500">
        같은 부위에 이미 입은 옷이 있으면 새로 만든 옷으로 바로 교체됩니다.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {clothTypes.map((type) => (
          <button
            key={type.id}
            type="button"
            onClick={() => setCategory(type.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
              category === type.id
                ? "bg-brand text-white"
                : "bg-white text-stone-500 hover:text-stone-900"
            }`}
          >
            {type.name}
          </button>
        ))}
      </div>
      <Textarea
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder="예: 블랙 오버사이즈 맨투맨, 왼쪽 가슴에 작은 로고"
        className="min-h-[72px] resize-none rounded-2xl border-stone-200 bg-white text-base"
      />
      <Button
        type="button"
        className="h-11 w-full rounded-full bg-brand text-sm font-bold hover:bg-brand-dark"
        onClick={() => void handleGenerate()}
        disabled={isGenerating}
      >
        {isGenerating ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            옷을 만들고 있어요...
          </>
        ) : (
          "✨ 옷 만들고 바로 입히기"
        )}
      </Button>
    </div>
  );
};
