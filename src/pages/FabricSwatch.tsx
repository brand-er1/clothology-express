import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ImagePlus,
  Loader2,
  PackageCheck,
  Palette,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { createFabricSwatchRequest } from "@/services/fabricSwatch";
import { trackSiteEvent } from "@/lib/site-analytics";
import {
  fabricFeelingOptions,
  type FabricFeeling,
} from "@/types/fabricSwatch";

const colorOptions = [
  { name: "화이트", value: "#f8f7f3", border: true },
  { name: "아이보리", value: "#eee5d5" },
  { name: "베이지", value: "#cbb898" },
  { name: "옐로우", value: "#e9c75e" },
  { name: "레드", value: "#a1262d" },
  { name: "핑크", value: "#d49aa7" },
  { name: "그린", value: "#566d50" },
  { name: "블루", value: "#3f6281" },
  { name: "네이비", value: "#263448" },
  { name: "브라운", value: "#715346" },
  { name: "그레이", value: "#868582" },
  { name: "블랙", value: "#242424" },
];

const feelingDescriptions: Record<FabricFeeling, string> = {
  "부드러운 느낌": "피부에 닿았을 때 매끄럽고 편안한 원단",
  "탄탄한 느낌": "형태가 잘 잡히고 안정감 있는 원단",
  "얇고 시원한 느낌": "가볍고 통기성이 좋은 원단",
  "두껍고 따뜻한 느낌": "보온감과 포근함이 느껴지는 원단",
  "신축성 있는 느낌": "움직임이 편하고 잘 늘어나는 원단",
  "잘 모르겠어요": "담당자가 용도에 맞춰 폭넓게 추천",
};

const FabricSwatch = () => {
  const [fabricFeeling, setFabricFeeling] = useState<FabricFeeling | null>(null);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [customColor, setCustomColor] = useState("");
  const [referenceImage, setReferenceImage] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!referenceImage) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(referenceImage);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [referenceImage]);

  const toggleColor = (color: string) => {
    setSelectedColors((current) =>
      current.includes(color)
        ? current.filter((item) => item !== color)
        : [...current, color],
    );
  };

  const addCustomColor = () => {
    const normalized = customColor.trim().replace(/\s+/g, " ");
    if (!normalized) return;
    if (!selectedColors.includes(normalized)) {
      setSelectedColors((current) => [...current, normalized].slice(0, 12));
    }
    setCustomColor("");
  };

  const acceptReferenceImage = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({
        title: "이미지 파일만 올릴 수 있습니다",
        variant: "destructive",
      });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "이미지 용량을 확인해주세요",
        description: "10MB 이하의 이미지를 올려주세요.",
        variant: "destructive",
      });
      return;
    }
    setReferenceImage(file);
  };

  const handleSubmit = async () => {
    if (!fabricFeeling) {
      toast({
        title: "원하는 원단 느낌을 선택해주세요",
        variant: "destructive",
      });
      return;
    }
    if (!selectedColors.length) {
      toast({
        title: "원하는 색상을 한 가지 이상 선택해주세요",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await createFabricSwatchRequest({
        fabricFeeling,
        colorNames: selectedColors,
        referenceImage,
      });
      void trackSiteEvent("fabric_swatch_submitted", {
        color_count: selectedColors.length,
      });
      setIsSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      toast({
        title: "신청을 완료하지 못했습니다",
        description:
          error instanceof Error
            ? error.message
            : "잠시 후 다시 시도해주세요.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-[#f5f1eb]">
        <Header />
        <main className="mx-auto flex min-h-screen max-w-3xl items-center px-4 pb-16 pt-28">
          <section className="w-full rounded-[32px] border border-stone-200 bg-white px-6 py-14 text-center shadow-[0_24px_70px_rgba(65,43,30,0.08)] md:px-14">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand text-white">
              <Check className="h-8 w-8" />
            </span>
            <p className="mt-7 text-xs font-bold uppercase tracking-[0.22em] text-brand">
              Request received
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-stone-950 md:text-4xl">
              원단 스와치 신청이 완료되었습니다
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-stone-600 md:text-base">
              담당자가 신청 내용을 확인해 조건에 맞는 원단 스와치를 최소 5개 이상
              선별합니다. 추천 준비가 완료되면 등록된 계정으로 안내드리겠습니다.
            </p>
            <div className="mt-8 rounded-2xl bg-[#f6f2ec] px-5 py-4 text-sm font-semibold text-stone-700">
              {fabricFeeling} · {selectedColors.join(", ")}
            </div>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button
                asChild
                className="h-12 rounded-full bg-brand px-7 hover:bg-brand-dark"
              >
                <Link to="/">
                  홈으로 이동 <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                variant="outline"
                className="h-12 rounded-full border-stone-300 px-7"
                onClick={() => {
                  setFabricFeeling(null);
                  setSelectedColors([]);
                  setReferenceImage(null);
                  setIsSubmitted(false);
                }}
              >
                새로 신청하기
              </Button>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f1eb]">
      <Header />
      <main className="pb-20 pt-[72px]">
        <section className="overflow-hidden border-b border-black/5 bg-[#241c1b] text-white">
          <div className="container relative mx-auto px-4 py-14 md:py-20">
            <div className="absolute -right-20 -top-32 h-80 w-80 rounded-full bg-brand/45 blur-3xl" />
            <div className="relative max-w-3xl">
              <div className="flex items-center gap-2 text-sm font-semibold text-white/65">
                <Sparkles className="h-4 w-4" />
                FABRIC CURATION
              </div>
              <h1 className="mt-5 text-4xl font-black tracking-[-0.045em] md:text-6xl">
                원단 스와치 신청
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/65 md:text-lg">
                전문 용어를 몰라도 괜찮습니다. 원하는 느낌과 색상만 알려주시면
                브랜더가 어울리는 원단을 골라드립니다.
              </p>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 py-10 md:py-14">
          <div className="mb-8 grid overflow-hidden rounded-2xl border border-stone-200 bg-white sm:grid-cols-3">
            {[
              ["01", "느낌·색상 선택"],
              ["02", "담당자 원단 선별"],
              ["03", "스와치 안내"],
            ].map(([number, label], index) => (
              <div
                key={number}
                className={`flex items-center gap-3 px-5 py-4 ${
                  index < 2 ? "border-b border-stone-200 sm:border-b-0 sm:border-r" : ""
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                    index === 0
                      ? "bg-brand text-white"
                      : "bg-stone-100 text-stone-400"
                  }`}
                >
                  {number}
                </span>
                <span className="text-sm font-bold text-stone-700">{label}</span>
              </div>
            ))}
          </div>

          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-6">
              <section className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm md:p-8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">
                      01 · Touch
                    </p>
                    <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-stone-950">
                      원하는 원단 느낌 <span className="text-brand">*</span>
                    </h2>
                    <p className="mt-2 text-sm text-stone-500">
                      가장 가까운 느낌 한 가지를 선택해주세요.
                    </p>
                  </div>
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {fabricFeelingOptions.map((option) => {
                    const selected = fabricFeeling === option;
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setFabricFeeling(option)}
                        className={`rounded-2xl border p-4 text-left transition ${
                          selected
                            ? "border-brand bg-brand/[0.045] shadow-[0_0_0_1px_rgba(113,16,17,0.12)]"
                            : "border-stone-200 hover:border-stone-400 hover:bg-stone-50"
                        }`}
                        aria-pressed={selected}
                      >
                        <span className="flex items-center justify-between gap-3">
                          <span className="font-bold text-stone-900">{option}</span>
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                              selected
                                ? "border-brand bg-brand text-white"
                                : "border-stone-300"
                            }`}
                          >
                            {selected && <Check className="h-3.5 w-3.5" />}
                          </span>
                        </span>
                        <span className="mt-1.5 block text-xs leading-5 text-stone-500">
                          {feelingDescriptions[option]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm md:p-8">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">
                  02 · Color
                </p>
                <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <h2 className="text-2xl font-black tracking-[-0.03em] text-stone-950">
                      원하는 색상 <span className="text-brand">*</span>
                    </h2>
                    <p className="mt-2 text-sm text-stone-500">
                      여러 색상을 선택할 수 있습니다.
                    </p>
                  </div>
                  <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-bold text-stone-600">
                    {selectedColors.length}개 선택
                  </span>
                </div>

                <div className="mt-6 grid grid-cols-4 gap-3 sm:grid-cols-6">
                  {colorOptions.map((color) => {
                    const selected = selectedColors.includes(color.name);
                    return (
                      <button
                        key={color.name}
                        type="button"
                        onClick={() => toggleColor(color.name)}
                        className={`group rounded-2xl border px-2 py-3 text-center transition ${
                          selected
                            ? "border-brand bg-brand/[0.045]"
                            : "border-stone-200 hover:border-stone-400"
                        }`}
                        aria-pressed={selected}
                      >
                        <span
                          className={`relative mx-auto flex h-9 w-9 items-center justify-center rounded-full shadow-sm ${
                            color.border ? "border border-stone-200" : ""
                          }`}
                          style={{ backgroundColor: color.value }}
                        >
                          {selected && (
                            <Check
                              className={`h-4 w-4 ${
                                color.name === "화이트" || color.name === "아이보리"
                                  ? "text-stone-900"
                                  : "text-white"
                              }`}
                            />
                          )}
                        </span>
                        <span className="mt-2 block text-xs font-semibold text-stone-700">
                          {color.name}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-6 rounded-2xl bg-[#f7f4ef] p-4">
                  <Label htmlFor="custom-color" className="font-bold text-stone-800">
                    색상명 직접 입력
                  </Label>
                  <div className="mt-2 flex gap-2">
                    <Input
                      id="custom-color"
                      value={customColor}
                      onChange={(event) => setCustomColor(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addCustomColor();
                        }
                      }}
                      placeholder="예: 버건디, 멜란지 그레이"
                      maxLength={30}
                      className="h-11 border-stone-300 bg-white"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 shrink-0 border-stone-300 bg-white"
                      onClick={addCustomColor}
                    >
                      추가
                    </Button>
                  </div>
                </div>

                {selectedColors.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {selectedColors.map((color) => (
                      <button
                        type="button"
                        key={color}
                        onClick={() => toggleColor(color)}
                        className="flex items-center gap-1.5 rounded-full bg-stone-900 px-3 py-1.5 text-xs font-semibold text-white"
                        aria-label={`${color} 선택 해제`}
                      >
                        {color} <X className="h-3 w-3" />
                      </button>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm md:p-8">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">
                  03 · Reference
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-stone-950">
                  참고 이미지 업로드 <span className="text-stone-400">(선택)</span>
                </h2>
                <p className="mt-2 text-sm text-stone-500">
                  원하는 옷이나 원단 사진이 있다면 올려주세요.
                </p>

                {previewUrl ? (
                  <div className="mt-6 overflow-hidden rounded-2xl border border-stone-200 bg-stone-50">
                    <div className="relative aspect-[16/9]">
                      <img
                        src={previewUrl}
                        alt="참고 이미지 미리보기"
                        className="h-full w-full object-contain"
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="secondary"
                        className="absolute right-3 top-3 rounded-full bg-white shadow"
                        onClick={() => setReferenceImage(null)}
                        aria-label="참고 이미지 삭제"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-3 border-t border-stone-200 bg-white px-4 py-3">
                      <ImagePlus className="h-4 w-4 shrink-0 text-brand" />
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-stone-700">
                        {referenceImage?.name}
                      </span>
                      <span className="text-xs text-stone-400">
                        {referenceImage
                          ? `${(referenceImage.size / 1024 / 1024).toFixed(1)}MB`
                          : ""}
                      </span>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(event) => {
                      event.preventDefault();
                      setIsDragging(false);
                      acceptReferenceImage(event.dataTransfer.files[0]);
                    }}
                    className={`mt-6 flex w-full flex-col items-center justify-center rounded-2xl border border-dashed px-5 py-12 text-center transition ${
                      isDragging
                        ? "border-brand bg-brand/[0.04]"
                        : "border-stone-300 bg-stone-50 hover:border-brand/60 hover:bg-brand/[0.025]"
                    }`}
                  >
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-brand shadow-sm">
                      <UploadCloud className="h-5 w-5" />
                    </span>
                    <span className="mt-4 font-bold text-stone-800">
                      이미지를 선택하거나 이곳에 끌어놓으세요
                    </span>
                    <span className="mt-1 text-xs text-stone-400">
                      JPG, PNG, WEBP · 최대 10MB
                    </span>
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(event) => acceptReferenceImage(event.target.files?.[0])}
                />
              </section>
            </div>

            <aside className="space-y-5 lg:sticky lg:top-24">
              <section className="rounded-[28px] bg-[#241c1b] p-6 text-white shadow-xl">
                <div className="flex items-center gap-2 text-sm font-bold">
                  <PackageCheck className="h-5 w-5 text-[#e1b4a9]" />
                  신청 안내
                </div>
                <div className="mt-5 space-y-4">
                  {[
                    "신청 1건당 최소 5개의 원단 스와치를 선별합니다.",
                    "담당자가 신청 내용을 확인한 후 적합한 원단을 추천합니다.",
                    "정확한 의류 종류나 제작 수량은 스와치 선택 후 샘플 제작 단계에서 입력합니다.",
                  ].map((notice) => (
                    <div key={notice} className="flex gap-3 text-sm leading-6 text-white/70">
                      <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-[#e1b4a9]" />
                      <span>{notice}</span>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="mt-7 h-14 w-full rounded-full bg-white px-5 font-black text-brand hover:bg-stone-100"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      신청 내용을 저장하는 중
                    </>
                  ) : (
                    <>
                      원단 스와치 5개 이상 신청하기
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </section>

              <section className="rounded-2xl border border-stone-200 bg-white p-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f3ece5] text-brand">
                    <Palette className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="font-bold text-stone-800">선택 현황</p>
                    <p className="mt-1 text-xs leading-5 text-stone-500">
                      느낌 {fabricFeeling ? "선택 완료" : "미선택"} · 색상{" "}
                      {selectedColors.length}개
                    </p>
                  </div>
                </div>
              </section>
            </aside>
          </div>
        </section>
      </main>
    </div>
  );
};

export default FabricSwatch;
