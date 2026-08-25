import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Heart, Loader2, Pencil, Shirt, Trash2 } from "lucide-react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { deleteOutfit, getOutfitErrorMessage, listMyOutfits, updateOutfit } from "@/services/outfits";
import type { MyOutfitData } from "@/types/outfit";

const parseTags = (raw: string) =>
  Array.from(new Set(raw.split(/[\s,#]+/).map((tag) => tag.trim()).filter(Boolean))).slice(0, 8);

const MyOutfits = () => {
  const [outfits, setOutfits] = useState<MyOutfitData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingOutfit, setEditingOutfit] = useState<MyOutfitData | null>(null);
  const [deletingOutfitId, setDeletingOutfitId] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const rows = await listMyOutfits();
      setOutfits(rows);
    } catch (error) {
      toast({ title: "내 코디를 불러오지 못했어요", description: getOutfitErrorMessage(error), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const handleDelete = async (id: string) => {
    try {
      await deleteOutfit(id);
      setOutfits((prev) => prev.filter((outfit) => outfit.id !== id));
      toast({ title: "코디를 삭제했어요" });
    } catch (error) {
      toast({ title: "삭제하지 못했어요", description: getOutfitErrorMessage(error), variant: "destructive" });
    } finally {
      setDeletingOutfitId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f0ea]">
      <Header />
      <main className="mx-auto max-w-[1000px] px-4 pb-24 pt-24 sm:px-6 sm:pt-28">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">My page</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-stone-950 sm:text-4xl">내 코디</h1>
            <p className="mt-2 text-sm leading-6 text-stone-500">
              저장한 코디를 다시 확인하고, 공개 여부를 바꾸거나 수정·삭제할 수 있어요.
            </p>
          </div>
          <Button asChild variant="outline" className="h-10 rounded-full border-stone-300 font-bold">
            <Link to="/closet">
              <Shirt className="mr-2 h-4 w-4" />
              옷 입혀보러 가기
            </Link>
          </Button>
        </div>

        {isLoading ? (
          <div className="flex min-h-[40vh] items-center justify-center text-stone-400">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : outfits.length === 0 ? (
          <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 rounded-[1.5rem] border border-dashed border-stone-300 bg-white/60 text-center">
            <p className="text-stone-500">아직 저장한 코디가 없어요.</p>
            <Button asChild className="rounded-full bg-brand font-bold hover:bg-brand-dark">
              <Link to="/closet">코디 만들러 가기</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {outfits.map((outfit) => (
              <div key={outfit.id} className="overflow-hidden rounded-[1.25rem] border border-stone-200 bg-white shadow-sm">
                <div className="relative flex aspect-[3/4] items-center justify-center overflow-hidden bg-[#f4f0ea]">
                  <img src={outfit.imageUrl} alt={outfit.title} className="h-full w-full object-contain" />
                  <Badge
                    className={`absolute left-2 top-2 rounded-full border-none text-[10px] font-bold ${
                      outfit.isPublic ? "bg-brand text-white" : "bg-stone-900/80 text-white"
                    }`}
                  >
                    {outfit.isPublic ? "공개" : "비공개"}
                  </Badge>
                </div>
                <div className="space-y-2 p-3">
                  <p className="truncate text-sm font-black text-stone-950">{outfit.title}</p>
                  <div className="flex items-center gap-1 text-xs font-bold text-stone-400">
                    <Heart className="h-3.5 w-3.5" /> {outfit.likeCount}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-full border-stone-300 text-[11px] font-bold"
                      onClick={() => setEditingOutfit(outfit)}
                    >
                      <Pencil className="mr-1 h-3 w-3" /> 수정
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-full border-stone-300 text-[11px] font-bold text-rose-500 hover:text-rose-600"
                      onClick={() => setDeletingOutfitId(outfit.id)}
                    >
                      <Trash2 className="mr-1 h-3 w-3" /> 삭제
                    </Button>
                  </div>
                  {outfit.isPublic && (
                    <Button asChild variant="ghost" size="sm" className="h-7 w-full rounded-full text-[11px] font-bold text-brand">
                      <Link to={`/outfits/${outfit.id}`}>피드에서 보기</Link>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <EditOutfitDialog
        outfit={editingOutfit}
        onOpenChange={(open) => !open && setEditingOutfit(null)}
        onSaved={(updated) => {
          setOutfits((prev) => prev.map((outfit) => (outfit.id === updated.id ? updated : outfit)));
          setEditingOutfit(null);
        }}
      />

      <AlertDialog open={Boolean(deletingOutfitId)} onOpenChange={(open) => !open && setDeletingOutfitId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>코디를 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>삭제하면 되돌릴 수 없고, 공개 중이었다면 피드에서도 사라져요.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-500 hover:bg-rose-600"
              onClick={() => deletingOutfitId && void handleDelete(deletingOutfitId)}
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const EditOutfitDialog = ({
  outfit,
  onOpenChange,
  onSaved,
}: {
  outfit: MyOutfitData | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (outfit: MyOutfitData) => void;
}) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!outfit) return;
    setTitle(outfit.title);
    setDescription(outfit.description || "");
    setTagsInput(outfit.tags.join(" "));
    setIsPublic(outfit.isPublic);
  }, [outfit]);

  if (!outfit) return null;

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast({ title: "코디 제목을 입력해주세요", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      const tags = parseTags(tagsInput);
      await updateOutfit({ id: outfit.id, title: title.trim(), description: description.trim(), isPublic, tags });
      onSaved({ ...outfit, title: title.trim(), description: description.trim() || null, isPublic, tags });
      toast({ title: "코디를 수정했어요" });
    } catch (error) {
      toast({ title: "수정하지 못했어요", description: getOutfitErrorMessage(error), variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={Boolean(outfit)} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-[1.5rem] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>코디 수정</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-outfit-title" className="text-xs font-bold text-stone-500">코디 제목</Label>
            <Input
              id="edit-outfit-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={80}
              className="h-11 rounded-2xl border-stone-200 bg-white text-base"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-outfit-description" className="text-xs font-bold text-stone-500">한 줄 설명</Label>
            <Textarea
              id="edit-outfit-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={300}
              className="min-h-[64px] resize-none rounded-2xl border-stone-200 bg-white text-base"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-outfit-tags" className="text-xs font-bold text-stone-500">태그</Label>
            <Input
              id="edit-outfit-tags"
              value={tagsInput}
              onChange={(event) => setTagsInput(event.target.value)}
              placeholder="예: #스트릿 #후드"
              className="h-11 rounded-2xl border-stone-200 bg-white text-base"
            />
          </div>
          <div className="flex items-center justify-between rounded-2xl border border-stone-200 bg-white px-4 py-3">
            <div>
              <p className="text-sm font-black text-stone-950">코디 피드에 공개</p>
              <p className="mt-0.5 text-xs text-stone-500">{isPublic ? "다른 사용자들이 볼 수 있어요." : "나만 볼 수 있어요."}</p>
            </div>
            <Switch checked={isPublic} onCheckedChange={setIsPublic} />
          </div>
          <Button
            type="button"
            className="h-12 w-full rounded-full bg-brand text-base font-bold hover:bg-brand-dark"
            onClick={() => void handleSubmit()}
            disabled={isSaving}
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "저장하기"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MyOutfits;
