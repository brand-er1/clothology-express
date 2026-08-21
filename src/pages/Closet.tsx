import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Save, Share2, Sparkles } from "lucide-react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import { CharacterCard } from "@/components/closet/CharacterCard";
import { DressingCanvas } from "@/components/closet/DressingCanvas";
import { WardrobeSlotPicker } from "@/components/closet/WardrobeSlotPicker";
import { characterConfig, closetSlotLabel, closetSlotOrder } from "@/lib/closet-character-config";
import {
  saveCurrentLook,
  setCharacter,
  setGarment,
  useWardrobeState,
} from "@/lib/closet-store";
import type { CharacterGender, ClosetGarment } from "@/types/closet";

type ClosetView = "select" | "transition" | "dressing" | "look-complete";

interface ClosetLocationState {
  pendingGarment?: ClosetGarment;
}

const Closet = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { character, outfit } = useWardrobeState();
  const [view, setView] = useState<ClosetView>("select");
  const [pendingCharacter, setPendingCharacter] = useState<CharacterGender>(character);

  const pendingGarment = (location.state as ClosetLocationState | null)?.pendingGarment ?? null;

  const handleSelectCharacter = (gender: CharacterGender) => {
    setPendingCharacter(gender);
    setCharacter(gender);
    if (pendingGarment) {
      setGarment(pendingGarment.slot, pendingGarment);
    }
    setView("transition");
    window.setTimeout(() => setView("dressing"), 900);
  };

  const wornSlotCount = closetSlotOrder.filter((slot) => outfit[slot]).length;

  const shareLook = async () => {
    const config = characterConfig[character];
    const summary = `${config.label} · ${closetSlotOrder
      .filter((slot) => outfit[slot])
      .map((slot) => outfit[slot]?.label)
      .join(", ")}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "MY BRAND-ER LOOK", text: summary, url: window.location.href });
        return;
      } catch {
        // Cancelled or unsupported mid-flow — fall through to clipboard.
      }
    }
    try {
      await navigator.clipboard.writeText(summary);
      toast({ title: "링크 대신 코디 요약을 복사했어요", description: summary });
    } catch {
      toast({ title: "공유하기를 지원하지 않는 브라우저입니다", variant: "destructive" });
    }
  };

  const handleSave = () => {
    saveCurrentLook();
    toast({ title: "MY BRAND-ER LOOK 저장 완료", description: "마이페이지에서 다시 볼 수 있어요." });
  };

  const goToQuote = () => {
    const designGarments = closetSlotOrder
      .map((slot) => outfit[slot])
      .filter((garment): garment is ClosetGarment => Boolean(garment && garment.source !== "preset"));

    if (designGarments.length === 0) {
      toast({
        title: "견적을 낼 디자인이 없어요",
        description: "AI로 만들거나 직접 업로드한 옷을 먼저 입혀주세요.",
        variant: "destructive",
      });
      return;
    }

    const presetImages = designGarments.map((garment) => ({
      url: garment.designRef?.imageUrl || undefined,
      base64: garment.designRef?.imageBase64 || undefined,
      mimeType: garment.designRef?.imageMimeType || "image/png",
    }));

    navigate("/design-quote", {
      state: {
        presetImages,
        fromCloset: {
          character,
          garmentLabel: designGarments[0].label,
          imageUrl: designGarments[0].designRef?.imageUrl || null,
          imagePath: designGarments[0].designRef?.imagePath || null,
          selectedType: designGarments[0].designRef?.selectedType || null,
          selectedMaterial: designGarments[0].designRef?.selectedMaterial || null,
        },
      },
    });
  };

  useEffect(() => {
    setPendingCharacter(character);
  }, [character]);

  return (
    <div className="min-h-screen bg-[#f4f0ea]">
      <Header />
      <main className="mx-auto max-w-[1000px] px-4 pb-24 pt-24 sm:px-6 sm:pt-28">
        {view === "select" && (
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">Brand-er closet</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.045em] text-stone-950 sm:text-5xl">
              어떤 브랜더를 꾸며볼까요?
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-7 text-stone-500">
              캐릭터를 선택해주세요. 남자 브랜더와 여자 브랜더 모두 같은 BRAND-ER 세계관의
              마스코트예요 — 검은 얼굴과 큰 흰 눈은 그대로, 여자 브랜더는 속눈썹이 포인트입니다.
            </p>
            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              <CharacterCard
                gender="male"
                selected={pendingCharacter === "male"}
                onSelect={handleSelectCharacter}
              />
              <CharacterCard
                gender="female"
                selected={pendingCharacter === "female"}
                onSelect={handleSelectCharacter}
              />
            </div>
          </div>
        )}

        {view === "transition" && (
          <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand/10 text-brand">
              <Sparkles className="h-7 w-7" />
            </span>
            <h2 className="mt-5 text-2xl font-black text-stone-950">선택 완료!</h2>
            <p className="mt-2 text-stone-500">이제 옷을 입혀볼까요?</p>
          </div>
        )}

        {(view === "dressing" || view === "look-complete") && (
          <div>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">
                  Dressing room
                </p>
                <h1 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-stone-950 sm:text-3xl">
                  {view === "look-complete" ? "MY BRAND-ER LOOK" : "브랜더를 코디해보세요"}
                </h1>
              </div>
              <div className="inline-flex rounded-full border border-stone-200 bg-white p-1">
                {(["male", "female"] as CharacterGender[]).map((gender) => (
                  <button
                    key={gender}
                    type="button"
                    onClick={() => setCharacter(gender)}
                    className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                      character === gender
                        ? "bg-brand text-white"
                        : "text-stone-500 hover:text-stone-900"
                    }`}
                  >
                    {gender === "male" ? "♂ 남자" : "♀ 여자"}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              <DressingCanvas character={character} outfit={outfit} />

              <div className="space-y-5">
                {view === "dressing" ? (
                  <>
                    <Card className="rounded-[1.5rem] border-stone-200 bg-white p-5 shadow-sm">
                      <p className="mb-3 text-sm font-black text-stone-950">코디 아이템</p>
                      <WardrobeSlotPicker
                        outfit={outfit}
                        onEquip={(slot, garment) => setGarment(slot, garment)}
                        onRemove={(slot) => setGarment(slot, null)}
                      />
                    </Card>
                    <Button
                      type="button"
                      className="h-12 w-full rounded-full bg-brand text-base font-bold hover:bg-brand-dark"
                      disabled={wornSlotCount === 0}
                      onClick={() => setView("look-complete")}
                    >
                      <Sparkles className="mr-2 h-4 w-4" />
                      ✨ LOOK COMPLETE
                    </Button>
                  </>
                ) : (
                  <>
                    <Card className="rounded-[1.5rem] border-stone-200 bg-white p-5 shadow-sm">
                      <p className="text-sm font-black text-stone-950">캐릭터</p>
                      <p className="mt-1 text-sm text-stone-600">{characterConfig[character].label}</p>
                      <div className="mt-4 space-y-2 border-t border-stone-100 pt-4">
                        {closetSlotOrder
                          .filter((slot) => outfit[slot])
                          .map((slot) => (
                            <div key={slot} className="flex items-center justify-between text-sm">
                              <span className="font-bold text-stone-500">{closetSlotLabel[slot]}</span>
                              <span className="font-semibold text-stone-950">{outfit[slot]?.label}</span>
                            </div>
                          ))}
                      </div>
                    </Card>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 rounded-full border-stone-300 bg-white font-bold"
                        onClick={handleSave}
                      >
                        <Save className="mr-2 h-4 w-4" />
                        LOOK 저장하기
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 rounded-full border-stone-300 bg-white font-bold"
                        onClick={() => void shareLook()}
                      >
                        <Share2 className="mr-2 h-4 w-4" />
                        공유하기
                      </Button>
                    </div>
                    <Card className="rounded-[1.5rem] border-brand/20 bg-brand/5 p-5 text-center">
                      <p className="font-black text-stone-950">이 디자인, 실제로 만들어볼까요?</p>
                      <Button
                        type="button"
                        className="mt-3 h-12 w-full rounded-full bg-brand text-base font-bold hover:bg-brand-dark"
                        onClick={goToQuote}
                      >
                        💰 예상견적 보기
                      </Button>
                    </Card>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-10 w-full rounded-full text-sm font-bold text-stone-500"
                      onClick={() => setView("dressing")}
                    >
                      코디 다시 바꾸기
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Closet;
