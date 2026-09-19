import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import {
  createCommunityPost,
  fetchMyDesignsForCommunity,
  getCommunityErrorMessage,
  uploadCommunityImage,
} from "@/services/community";
import type { CommunityImageSide, MyDesignSummary } from "@/types/community";
import { COMMUNITY_CATEGORIES } from "@/types/community";
import { ImagePlus, Loader2, Sparkles, Upload, X } from "lucide-react";

interface DraftImage {
  side: CommunityImageSide;
  imageUrl: string;
  imagePath: string | null;
}

const DesignPickerDialog = ({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (design: MyDesignSummary) => void;
}) => {
  const [designs, setDesigns] = useState<MyDesignSummary[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchMyDesignsForCommunity()
      .then(setDesigns)
      .catch((error) => toast({ title: "디자인을 불러오지 못했습니다", description: getCommunityErrorMessage(error), variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-lg overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle>내 디자인 불러오기</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-brand" /></div>
        ) : designs.length === 0 ? (
          <p className="py-10 text-center text-sm text-stone-500">BRAND-ER STUDIO에서 만든 디자인이 아직 없습니다.</p>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {designs.map((design) => (
              <button
                key={design.id}
                type="button"
                onClick={() => onSelect(design)}
                className="group overflow-hidden rounded-xl border border-stone-200 transition hover:border-brand"
              >
                <img src={design.frontImageUrl} alt="" className="aspect-square w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

const CommunityCreatePost = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backFileInputRef = useRef<HTMLInputElement>(null);

  const [images, setImages] = useState<DraftImage[]>([]);
  const [designId, setDesignId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(COMMUNITY_CATEGORIES[0]);
  const [hashtagInput, setHashtagInput] = useState("");
  const [allowFeedback, setAllowFeedback] = useState(true);
  const [purchaseIntentEnabled, setPurchaseIntentEnabled] = useState(true);
  const [targetCount, setTargetCount] = useState("30");
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [enablePoll, setEnablePoll] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const frontImage = images.find((image) => image.side === "front");
  const backImage = images.find((image) => image.side === "back");

  const handleDesignSelect = (design: MyDesignSummary) => {
    const next: DraftImage[] = [{ side: "front", imageUrl: design.frontImageUrl, imagePath: null }];
    if (design.backImageUrl) next.push({ side: "back", imageUrl: design.backImageUrl, imagePath: null });
    setImages(next);
    setDesignId(design.id);
    setIsPickerOpen(false);
  };

  const handleFileUpload = async (file: File, side: CommunityImageSide) => {
    setIsUploading(true);
    try {
      const uploaded = await uploadCommunityImage(file);
      setImages((prev) => [...prev.filter((image) => image.side !== side), { side, ...uploaded }]);
      setDesignId(null);
    } catch (error) {
      toast({ title: "이미지 업로드 실패", description: getCommunityErrorMessage(error), variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const removeImage = (side: CommunityImageSide) => {
    setImages((prev) => prev.filter((image) => image.side !== side));
  };

  const updatePollOption = (index: number, value: string) => {
    setPollOptions((prev) => prev.map((option, optionIndex) => (optionIndex === index ? value : option)));
  };

  const handleSubmit = async () => {
    if (!frontImage) {
      toast({ title: "디자인 이미지를 등록해주세요", variant: "destructive" });
      return;
    }
    if (!title.trim()) {
      toast({ title: "제목을 입력해주세요", variant: "destructive" });
      return;
    }

    const hashtags = hashtagInput
      .split(/[\s,#]+/)
      .map((tag) => tag.trim())
      .filter(Boolean);

    const validPollOptions = pollOptions.map((option) => option.trim()).filter(Boolean);

    setIsSubmitting(true);
    try {
      const postId = await createCommunityPost({
        title: title.trim(),
        description: description.trim(),
        category,
        hashtags,
        images,
        designId,
        allowFeedback,
        purchaseIntentEnabled,
        targetPurchaseIntentCount: purchaseIntentEnabled && targetCount ? Number(targetCount) : null,
        pollQuestion: enablePoll ? pollQuestion.trim() : null,
        pollOptions: enablePoll && validPollOptions.length >= 2 ? validPollOptions : null,
      });
      toast({ title: "매거진에 공유했습니다!" });
      navigate(`/community/${postId}`);
    } catch (error) {
      toast({ title: "게시물을 등록하지 못했습니다", description: getCommunityErrorMessage(error), variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f6f4]">
      <Header />
      <main className="mx-auto max-w-2xl px-4 pb-28 pt-20 sm:pt-24">
        <h1 className="text-2xl font-extrabold tracking-[-0.03em] text-stone-950">새 디자인 공유하기</h1>
        <p className="mt-1 text-sm text-stone-500">CREATE한 디자인을 매거진에 SHARE하고 반응을 VALIDATE해보세요.</p>

        <section className="mt-6 space-y-3">
          <Label className="text-sm font-bold text-stone-800">디자인 이미지</Label>
          {!frontImage ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Button type="button" variant="outline" className="h-24 flex-col gap-2 rounded-2xl border-dashed" onClick={() => setIsPickerOpen(true)}>
                <Sparkles className="h-5 w-5 text-brand" /> AI 디자인 불러오기
              </Button>
              <Button type="button" variant="outline" className="h-24 flex-col gap-2 rounded-2xl border-dashed" onClick={() => setIsPickerOpen(true)}>
                <ImagePlus className="h-5 w-5 text-brand" /> 내가 만든 디자인
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-24 flex-col gap-2 rounded-2xl border-dashed"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? <Loader2 className="h-5 w-5 animate-spin text-brand" /> : <Upload className="h-5 w-5 text-brand" />}
                직접 업로드
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleFileUpload(file, "front");
                  event.target.value = "";
                }}
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-stone-200">
                <img src={frontImage.imageUrl} alt="앞면" className="h-full w-full object-cover" />
                <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white">앞면</span>
                <button type="button" onClick={() => removeImage("front")} className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              {backImage ? (
                <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-stone-200">
                  <img src={backImage.imageUrl} alt="뒷면" className="h-full w-full object-cover" />
                  <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white">뒷면</span>
                  <button type="button" onClick={() => removeImage("back")} className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => backFileInputRef.current?.click()}
                  className="flex aspect-[4/5] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-stone-300 text-stone-400 hover:border-brand hover:text-brand"
                >
                  <ImagePlus className="h-6 w-6" />
                  <span className="text-xs font-semibold">뒷면 이미지 추가 (선택)</span>
                </button>
              )}
              <input
                ref={backFileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleFileUpload(file, "back");
                  event.target.value = "";
                }}
              />
            </div>
          )}
        </section>

        <section className="mt-6 space-y-4">
          <div>
            <Label htmlFor="post-title" className="text-sm font-bold text-stone-800">제목</Label>
            <Input id="post-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="예) Vintage Racing Hoodie" className="mt-1.5 h-11 rounded-xl" maxLength={80} />
          </div>
          <div>
            <Label htmlFor="post-description" className="text-sm font-bold text-stone-800">설명</Label>
            <Textarea id="post-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="디자인에 대한 설명을 자유롭게 적어주세요." className="mt-1.5 min-h-24 rounded-xl" maxLength={2000} />
          </div>
          <div>
            <Label className="text-sm font-bold text-stone-800">카테고리</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="mt-1.5 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {COMMUNITY_CATEGORIES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="post-hashtags" className="text-sm font-bold text-stone-800">해시태그</Label>
            <Input id="post-hashtags" value={hashtagInput} onChange={(event) => setHashtagInput(event.target.value)} placeholder="후드티 스트릿 빈티지 (공백으로 구분)" className="mt-1.5 h-11 rounded-xl" />
          </div>
        </section>

        <section className="mt-6 space-y-4 rounded-2xl border border-stone-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-stone-800">피드백 요청</p>
              <p className="text-xs text-stone-500">댓글로 디자인 피드백을 받고 싶어요.</p>
            </div>
            <Switch checked={allowFeedback} onCheckedChange={setAllowFeedback} />
          </div>
          <div className="h-px bg-stone-100" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-stone-800">구매의향 조사</p>
              <p className="text-xs text-stone-500">"나오면 살래요" 버튼으로 수요를 검증해요.</p>
            </div>
            <Switch checked={purchaseIntentEnabled} onCheckedChange={setPurchaseIntentEnabled} />
          </div>
          {purchaseIntentEnabled && (
            <div className="flex items-center gap-2 pl-1">
              <Label htmlFor="target-count" className="whitespace-nowrap text-xs text-stone-500">목표 인원</Label>
              <Input id="target-count" type="number" min={1} value={targetCount} onChange={(event) => setTargetCount(event.target.value)} className="h-9 w-24 rounded-lg" />
              <span className="text-xs text-stone-500">명 달성 시 펀딩 전환 버튼이 열려요.</span>
            </div>
          )}
        </section>

        <section className="mt-6 rounded-2xl border border-stone-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-stone-800">디자인 투표 만들기</p>
              <p className="text-xs text-stone-500">컬러/로고 위치 등 선택지를 투표로 물어보세요. (선택)</p>
            </div>
            <Switch checked={enablePoll} onCheckedChange={setEnablePoll} />
          </div>
          {enablePoll && (
            <div className="mt-4 space-y-2.5">
              <Input value={pollQuestion} onChange={(event) => setPollQuestion(event.target.value)} placeholder="예) 어떤 컬러로 제작할까요?" className="h-10 rounded-xl" />
              {pollOptions.map((option, index) => (
                <Input
                  key={index}
                  value={option}
                  onChange={(event) => updatePollOption(index, event.target.value)}
                  placeholder={`옵션 ${index + 1}`}
                  className="h-10 rounded-xl"
                />
              ))}
              <div className="flex gap-2">
                {pollOptions.length < 6 && (
                  <Button type="button" size="sm" variant="ghost" onClick={() => setPollOptions((prev) => [...prev, ""])}>
                    + 옵션 추가
                  </Button>
                )}
                {pollOptions.length > 2 && (
                  <Button type="button" size="sm" variant="ghost" onClick={() => setPollOptions((prev) => prev.slice(0, -1))}>
                    옵션 제거
                  </Button>
                )}
              </div>
            </div>
          )}
        </section>

        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || isUploading}
          className="mt-8 h-13 w-full rounded-full bg-brand py-3.5 text-base font-bold hover:bg-brand-dark"
        >
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          매거진에 공유하기
        </Button>
      </main>

      <DesignPickerDialog open={isPickerOpen} onOpenChange={setIsPickerOpen} onSelect={handleDesignSelect} />
    </div>
  );
};

export default CommunityCreatePost;
