import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Heart, RefreshCw, Save, Share2, Sparkles } from "lucide-react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import { CharacterCard } from "@/components/closet/CharacterCard";
import { DressingCanvas } from "@/components/closet/DressingCanvas";
import { DressingLoadingOverlay } from "@/components/closet/DressingLoadingOverlay";
import { WardrobeSlotPicker } from "@/components/closet/WardrobeSlotPicker";
import { ClosetGarmentStudio } from "@/components/closet/ClosetGarmentStudio";
import { MyWardrobeList } from "@/components/closet/MyWardrobeList";
import { GarmentEditPanel } from "@/components/closet/GarmentEditPanel";
import { SaveOutfitDialog } from "@/components/closet/SaveOutfitDialog";
import { characterConfig, closetSlotLabel, closetSlotOrder } from "@/lib/closet-character-config";
import { getRecommendedFabrics } from "@/lib/fabric-recommendations";
import { dressCharacter } from "@/services/closetDressing";
import { generateImage } from "@/services/imageGeneration";
import { logClosetActivity } from "@/services/closetActivityLog";
import {
  addToMyWardrobe,
  loadMyWardrobe,
  removeFromMyWardrobe,
  saveCurrentLook,
  setCharacter,
  setGarment,
  setRenderedCharacterImage,
  useWardrobeState,
  withRestoredGarmentRevision,
  type MyWardrobeGarment,
} from "@/lib/closet-store";
import type { CharacterGender, ClosetGarment, ClosetOutfit, ClosetSlot } from "@/types/closet";
import type { OutfitItem } from "@/types/outfit";

type ClosetView = "select" | "transition" | "dressing" | "look-complete";

interface ReferenceOutfitState {
  characterGender: CharacterGender;
  items: OutfitItem[];
}

interface ClosetLocationState {
  pendingGarment?: ClosetGarment;
  referenceOutfit?: ReferenceOutfitState;
}

const wornDesignGarments = (outfit: ClosetOutfit) =>
  closetSlotOrder
    .map((slot) => outfit[slot])
    .filter((garment): garment is ClosetGarment => Boolean(garment && garment.source !== "preset"));

const wornGarments = (outfit: ClosetOutfit) =>
  closetSlotOrder
    .map((slot) => outfit[slot])
    .filter((garment): garment is ClosetGarment => Boolean(garment));

interface DressingRequestOptions {
  changedSlots?: ClosetSlot[];
}

const Closet = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { character, outfit, renderedCharacterImage } = useWardrobeState();
  const [view, setView] = useState<ClosetView>("select");
  const [pendingCharacter, setPendingCharacter] = useState<CharacterGender>(character);
  const [isDressing, setIsDressing] = useState(false);
  const [showBeforeAfter, setShowBeforeAfter] = useState<"after" | "before">("after");
  const [myWardrobe, setMyWardrobe] = useState<MyWardrobeGarment[]>(() => loadMyWardrobe());
  const [editingGarmentId, setEditingGarmentId] = useState<string | null>(null);
  const [busyGarmentId, setBusyGarmentId] = useState<string | null>(null);
  const [showSaveOutfit, setShowSaveOutfit] = useState(false);
  const [saveDialogInitialPublic, setSaveDialogInitialPublic] = useState(false);
  const latestDressingRequest = useRef(0);
  const editingGarment = myWardrobe.find((item) => item.id === editingGarmentId) || null;

  const pendingGarment = (location.state as ClosetLocationState | null)?.pendingGarment ?? null;
  const referenceOutfit = (location.state as ClosetLocationState | null)?.referenceOutfit ?? null;

  const runDressing = async (
    targetOutfit: ClosetOutfit,
    targetCharacter: CharacterGender,
    options: DressingRequestOptions = {},
  ) => {
    // Always rebuild the complete look from the immutable mascot plus every
    // currently equipped original garment reference. Never feed a generated
    // look back into the next generation (generation-drift prevention).
    const garmentsToRender = wornGarments(targetOutfit);
    const changedSlots = options.changedSlots || garmentsToRender.map((garment) => garment.slot);
    if (garmentsToRender.length === 0 && changedSlots.length === 0) {
      return;
    }
    const requestId = ++latestDressingRequest.current;
    setIsDressing(true);
    setShowBeforeAfter("after");
    const result = await dressCharacter(
      targetCharacter,
      characterConfig[targetCharacter].baseImage,
      garmentsToRender,
      {
        changedSlots,
      },
    );
    if (requestId !== latestDressingRequest.current) return;
    setIsDressing(false);
    if (result) {
      setRenderedCharacterImage(result.renderedImageUrl);
      toast({ title: "✨ 착용 완료!" });
    }
  };

  const handleSelectCharacter = (gender: CharacterGender) => {
    setPendingCharacter(gender);
    setCharacter(gender);
    const nextOutfit: ClosetOutfit = pendingGarment
      ? { ...outfit, [pendingGarment.slot]: pendingGarment }
      : outfit;
    if (pendingGarment) {
      setGarment(pendingGarment.slot, pendingGarment);
      setMyWardrobe(addToMyWardrobe(pendingGarment));
    }
    setView("transition");
    window.setTimeout(() => {
      setView("dressing");
      if (pendingGarment) {
        void runDressing(nextOutfit, gender, {
          changedSlots: wornGarments(nextOutfit).map((garment) => garment.slot),
        });
      }
    }, 900);
  };

  const handleEquip = (slot: (typeof closetSlotOrder)[number], garment: ClosetGarment) => {
    const targetOutfit = { ...outfit, [slot]: garment };
    setGarment(slot, garment);
    if (garment.source !== "preset") {
      setMyWardrobe(addToMyWardrobe(garment));
    }
    void runDressing(targetOutfit, character, {
      changedSlots: [slot],
    });
  };

  const handleGarmentCreated = (garment: ClosetGarment) => {
    const targetOutfit = { ...outfit, [garment.slot]: garment };
    setMyWardrobe(addToMyWardrobe(garment));
    setGarment(garment.slot, garment);
    void runDressing(targetOutfit, character, {
      changedSlots: [garment.slot],
    });
    toast({ title: "새 옷을 만들었어요!", description: "브랜더에게 바로 입혀봤어요." });
  };

  const handleWearFromWardrobe = (garment: MyWardrobeGarment) => {
    const targetOutfit = { ...outfit, [garment.slot]: garment };
    setMyWardrobe(addToMyWardrobe(garment));
    setGarment(garment.slot, garment);
    void runDressing(targetOutfit, character, {
      changedSlots: [garment.slot],
    });
  };

  const handleRegenerate = () => {
    void runDressing(outfit, character, {
      changedSlots: wornGarments(outfit).map((garment) => garment.slot),
    });
  };

  const handleRemove = (slot: ClosetSlot) => {
    const targetOutfit = { ...outfit, [slot]: null };
    setGarment(slot, null);
    if (wornGarments(targetOutfit).length === 0) {
      latestDressingRequest.current += 1;
      setIsDressing(false);
      setRenderedCharacterImage(null);
      return;
    }
    void runDressing(targetOutfit, character, { changedSlots: [slot] });
  };

  const handleOpenEditor = (garment: MyWardrobeGarment) => setEditingGarmentId(garment.id);

  // "이 옷으로 입히기" from the edit panel — the edited image already carries every unmodified
  // design detail forward (see edit-closet-garment), so this is just a normal same-slot replace.
  const handleApplyEditedGarment = (updatedGarment: ClosetGarment) => {
    setMyWardrobe(addToMyWardrobe(updatedGarment));
    setGarment(updatedGarment.slot, updatedGarment);
    const targetOutfit = { ...outfit, [updatedGarment.slot]: updatedGarment };
    void runDressing(targetOutfit, character, { changedSlots: [updatedGarment.slot] });
    toast({ title: "수정한 옷으로 갈아입혔어요!" });
  };

  const handleRestoreRevision = (garment: ClosetGarment, revisionId: string) => {
    const restored = withRestoredGarmentRevision(garment, revisionId);
    setMyWardrobe(addToMyWardrobe(restored));
    if (outfit[restored.slot]?.id === restored.id) {
      setGarment(restored.slot, restored);
      void runDressing({ ...outfit, [restored.slot]: restored }, character, {
        changedSlots: [restored.slot],
      });
    }
  };

  const handleSaveGarment = (garment: MyWardrobeGarment) => {
    setMyWardrobe(addToMyWardrobe(garment));
    toast({ title: "옷장에 저장했어요" });
  };

  const handleDeleteGarment = (garment: MyWardrobeGarment) => {
    setMyWardrobe(removeFromMyWardrobe(garment.id));
    if (editingGarmentId === garment.id) setEditingGarmentId(null);
    if (outfit[garment.slot]?.id === garment.id) {
      handleRemove(garment.slot);
    }
    toast({ title: "옷을 삭제했어요" });
  };

  // "다시 생성" — a fresh CREATE GARMENT roll from the same type/material/prompt (pipeline step
  // A), producing a brand-new garment. Distinct from "수정하기" (EDIT GARMENT, step B), which
  // constrains the result to the existing image plus only the requested change.
  const handleRegenerateGarment = async (garment: MyWardrobeGarment) => {
    if (garment.source !== "ai_design" || busyGarmentId) return;
    const selectedType = garment.designRef?.selectedType;
    if (!selectedType) {
      toast({ title: "다시 생성할 수 없는 옷이에요", variant: "destructive" });
      return;
    }
    setBusyGarmentId(garment.id);
    try {
      const materials = getRecommendedFabrics(selectedType);
      const material = garment.designRef?.selectedMaterial || materials[0]?.id || "";
      const prompt = garment.designRef?.designContext || garment.label;
      const result = await generateImage(selectedType, material, prompt, materials);
      if (!result) return;
      const imageUrl = result.storedImageUrl || result.imageUrls?.[0];
      if (!imageUrl) {
        toast({ title: "이미지를 만들지 못했어요", variant: "destructive" });
        return;
      }
      const regenerated: ClosetGarment = {
        id: `ai-${Date.now()}`,
        slot: garment.slot,
        label: garment.label,
        imageUrl,
        source: "ai_design",
        designRef: {
          imageUrl: result.storedImageUrl || null,
          imagePath: result.imagePath || null,
          selectedType,
          selectedMaterial: material,
          designContext: result.optimizedPrompt || prompt,
        },
      };
      setMyWardrobe(addToMyWardrobe(regenerated));
      if (outfit[garment.slot]?.id === garment.id) {
        setGarment(garment.slot, regenerated);
        void runDressing({ ...outfit, [garment.slot]: regenerated }, character, {
          changedSlots: [garment.slot],
        });
      }
      void logClosetActivity({
        eventType: "garment_regenerated",
        slot: garment.slot,
        garmentId: regenerated.id,
        label: regenerated.label,
        prompt,
        imageUrl: regenerated.designRef?.imageUrl || regenerated.imageUrl,
        imagePath: regenerated.designRef?.imagePath,
        metadata: { previousGarmentId: garment.id, clothType: selectedType, material },
      });
      toast({ title: "새로 생성했어요!" });
    } finally {
      setBusyGarmentId(null);
    }
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
    const look = saveCurrentLook();
    void logClosetActivity({
      eventType: "look_saved",
      characterGender: look.character,
      label: closetSlotOrder
        .filter((slot) => look.outfit[slot])
        .map((slot) => look.outfit[slot]?.label)
        .join(", ") || characterConfig[look.character].label,
      imageUrl: look.renderedCharacterImage,
      metadata: {
        lookId: look.id,
        outfit: closetSlotOrder.reduce<Record<string, unknown>>((acc, slot) => {
          const garment = look.outfit[slot];
          if (garment) acc[slot] = { id: garment.id, label: garment.label, imageUrl: garment.imageUrl };
          return acc;
        }, {}),
      },
    });
    toast({ title: "MY BRAND-ER LOOK 저장 완료", description: "마이페이지에서 다시 볼 수 있어요." });
  };

  const goToQuote = () => {
    const designGarments = wornDesignGarments(outfit);

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

    // Append ?designId= (when the primary worn item has one) purely as a refresh-survival
    // fallback — location.state below still drives the richer multi-item view on first load.
    const primaryDesignId = designGarments[0].designRef?.designId;
    const quotePath = primaryDesignId ? `/design-quote?designId=${primaryDesignId}` : "/design-quote";

    navigate(quotePath, {
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

  // "이 코디 참고하기" from another user's outfit — load its item images as Garment References for
  // the current outfit, exactly like any other garment reference. Never touches the source outfit.
  useEffect(() => {
    if (!referenceOutfit) return;
    const nextOutfit: ClosetOutfit = { top: null, bottom: null, outer: null, shoes: null, accessory: null };
    referenceOutfit.items.forEach((item) => {
      const garment: ClosetGarment = {
        id: `ref-${item.garmentId || item.slot}-${Date.now()}`,
        slot: item.slot,
        label: item.label || closetSlotLabel[item.slot],
        imageUrl: item.imageUrl,
        source: item.source === "upload" ? "upload" : "ai_design",
        designRef: { imageUrl: item.imageUrl, designId: item.designId },
      };
      nextOutfit[item.slot] = garment;
      setGarment(item.slot, garment);
      setMyWardrobe(addToMyWardrobe(garment));
    });
    setCharacter(referenceOutfit.characterGender);
    setView("dressing");
    navigate(location.pathname, { replace: true, state: null });
    void runDressing(nextOutfit, referenceOutfit.characterGender, {
      changedSlots: closetSlotOrder.filter((slot) => nextOutfit[slot]),
    });
    toast({ title: "코디를 불러왔어요", description: "참고한 코디를 자유롭게 바꿔보세요." });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [referenceOutfit]);

  useEffect(() => {
    setPendingCharacter(character);
  }, [character]);

  const displayedImage =
    showBeforeAfter === "before" ? characterConfig[character].baseImage : renderedCharacterImage;

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
                    onClick={() => {
                      setCharacter(gender);
                      void runDressing(outfit, gender, {
                        changedSlots: wornGarments(outfit).map((garment) => garment.slot),
                      });
                    }}
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
              <div>
                <div className="relative">
                  <DressingCanvas character={character} renderedCharacterImage={displayedImage} />
                  <DressingLoadingOverlay active={isDressing} />
                </div>
                {renderedCharacterImage && (
                  <div className="mt-3 flex items-center justify-center gap-2">
                    <div className="inline-flex rounded-full border border-stone-200 bg-white p-1 text-xs">
                      <button
                        type="button"
                        onClick={() => setShowBeforeAfter("before")}
                        className={`rounded-full px-3 py-1.5 font-bold transition ${
                          showBeforeAfter === "before" ? "bg-stone-900 text-white" : "text-stone-500"
                        }`}
                      >
                        Before
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowBeforeAfter("after")}
                        className={`rounded-full px-3 py-1.5 font-bold transition ${
                          showBeforeAfter === "after" ? "bg-stone-900 text-white" : "text-stone-500"
                        }`}
                      >
                        After
                      </button>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-full border-stone-300 text-xs font-bold"
                      onClick={handleRegenerate}
                      disabled={isDressing}
                    >
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                      다시 입혀보기
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-5">
                {view === "dressing" ? (
                  <>
                    <ClosetGarmentStudio onGarmentCreated={handleGarmentCreated} />
                    <MyWardrobeList
                      items={myWardrobe}
                      outfit={outfit}
                      busyGarmentId={busyGarmentId}
                      onWear={handleWearFromWardrobe}
                      onEdit={handleOpenEditor}
                      onRegenerate={(garment) => void handleRegenerateGarment(garment)}
                      onSave={handleSaveGarment}
                      onDelete={handleDeleteGarment}
                    />
                    <GarmentEditPanel
                      garment={editingGarment}
                      open={Boolean(editingGarmentId)}
                      onOpenChange={(open) => {
                        if (!open) setEditingGarmentId(null);
                      }}
                      onApply={handleApplyEditedGarment}
                      onRestoreRevision={handleRestoreRevision}
                    />
                    <Card className="rounded-[1.5rem] border-stone-200 bg-white p-5 shadow-sm">
                      <p className="mb-3 text-sm font-black text-stone-950">코디 아이템</p>
                      <WardrobeSlotPicker
                        outfit={outfit}
                        wardrobe={myWardrobe}
                        onEquip={handleEquip}
                        onRemove={handleRemove}
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
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 rounded-full border-stone-300 bg-white font-bold"
                        onClick={() => {
                          handleSave();
                          setSaveDialogInitialPublic(false);
                          setShowSaveOutfit(true);
                        }}
                      >
                        <Save className="mr-2 h-4 w-4" />
                        코디 저장
                      </Button>
                      <Button
                        type="button"
                        className="h-11 rounded-full bg-brand font-bold hover:bg-brand-dark"
                        onClick={() => {
                          setSaveDialogInitialPublic(true);
                          setShowSaveOutfit(true);
                        }}
                      >
                        <Heart className="mr-2 h-4 w-4" />
                        코디 올리기
                      </Button>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-9 w-full rounded-full text-xs font-bold text-stone-400"
                      onClick={() => void shareLook()}
                    >
                      <Share2 className="mr-1.5 h-3.5 w-3.5" />
                      링크 공유하기
                    </Button>
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
      <SaveOutfitDialog
        open={showSaveOutfit}
        onOpenChange={setShowSaveOutfit}
        outfit={outfit}
        character={character}
        renderedCharacterImage={renderedCharacterImage}
        defaultTitle={`${characterConfig[character].label} 코디`}
        initialPublic={saveDialogInitialPublic}
      />
    </div>
  );
};

export default Closet;
