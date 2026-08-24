import { useEffect, useRef, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/use-toast";
import {
  createPortfolioProject,
  updatePortfolioProject,
  uploadPortfolioProjectImage,
  type PortfolioProjectInput,
} from "@/services/portfolioProjects";
import type { PortfolioProject } from "@/types/portfolio";

const CATEGORY_OPTIONS = ["TOP", "BOTTOM", "OUTER", "HOODIE", "TECHNICAL"];

interface PortfolioProjectEditorProps {
  project: PortfolioProject | null;
  open: boolean;
  nextOrder: number;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

const emptyForm = (nextOrder: number): PortfolioProjectInput => ({
  nameKo: "",
  nameEn: "",
  category: CATEGORY_OPTIONS[0],
  mainImagePath: "",
  additionalImagePaths: [],
  country: "",
  quantity: "",
  services: [],
  description: "",
  visible: true,
  order: nextOrder,
});

export const PortfolioProjectEditor = ({
  project,
  open,
  nextOrder,
  onOpenChange,
  onSaved,
}: PortfolioProjectEditorProps) => {
  const [form, setForm] = useState<PortfolioProjectInput>(() => emptyForm(nextOrder));
  const [servicesText, setServicesText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingMain, setIsUploadingMain] = useState(false);
  const [isUploadingExtra, setIsUploadingExtra] = useState(false);
  // A project not yet saved has no row id — generate one up front so image uploads have a
  // stable storage folder from the very first file, then reuse it as the row's id on create.
  const draftIdRef = useRef(crypto.randomUUID());

  useEffect(() => {
    if (!open) return;
    if (project) {
      setForm({
        nameKo: project.nameKo,
        nameEn: project.nameEn,
        category: project.category,
        mainImagePath: project.images[0] || "",
        additionalImagePaths: project.images.slice(1),
        country: project.country || "",
        quantity: project.quantity || "",
        services: project.services,
        description: project.description || "",
        visible: project.visible,
        order: project.order,
      });
      setServicesText(project.services.join(", "));
    } else {
      draftIdRef.current = crypto.randomUUID();
      setForm(emptyForm(nextOrder));
      setServicesText("");
    }
  }, [project, open, nextOrder]);

  const projectId = project?.id || draftIdRef.current;

  const handleMainImageUpload = async (file: File) => {
    setIsUploadingMain(true);
    try {
      const url = await uploadPortfolioProjectImage(projectId, file);
      setForm((previous) => ({ ...previous, mainImagePath: url }));
    } catch (error) {
      toast({
        title: "대표 이미지 업로드 실패",
        description: error instanceof Error ? error.message : "잠시 후 다시 시도해주세요.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingMain(false);
    }
  };

  const handleExtraImagesUpload = async (files: FileList) => {
    setIsUploadingExtra(true);
    try {
      const urls = await Promise.all(Array.from(files).map((file) => uploadPortfolioProjectImage(projectId, file)));
      setForm((previous) => ({ ...previous, additionalImagePaths: [...previous.additionalImagePaths, ...urls] }));
    } catch (error) {
      toast({
        title: "추가 이미지 업로드 실패",
        description: error instanceof Error ? error.message : "잠시 후 다시 시도해주세요.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingExtra(false);
    }
  };

  const removeExtraImage = (url: string) => {
    setForm((previous) => ({
      ...previous,
      additionalImagePaths: previous.additionalImagePaths.filter((image) => image !== url),
    }));
  };

  const handleSave = async () => {
    if (!form.nameKo.trim() || !form.nameEn.trim()) {
      toast({ title: "프로젝트명을 입력해주세요", variant: "destructive" });
      return;
    }
    if (!form.mainImagePath) {
      toast({ title: "대표 이미지를 업로드해주세요", variant: "destructive" });
      return;
    }

    const input: PortfolioProjectInput = {
      ...form,
      nameKo: form.nameKo.trim(),
      nameEn: form.nameEn.trim(),
      country: form.country?.trim() || null,
      quantity: form.quantity?.trim() || null,
      description: form.description?.trim() || null,
      services: servicesText
        .split(",")
        .map((service) => service.trim())
        .filter(Boolean),
    };

    setIsSaving(true);
    try {
      if (project) {
        await updatePortfolioProject(project.id, input);
        toast({ title: "프로젝트를 수정했습니다" });
      } else {
        await createPortfolioProject(input);
        toast({ title: "프로젝트를 추가했습니다" });
      }
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "저장하지 못했습니다",
        description: error instanceof Error ? error.message : "잠시 후 다시 시도해주세요.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{project ? "프로젝트 수정" : "새 프로젝트 추가"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>프로젝트명 (국문)</Label>
              <Input
                value={form.nameKo}
                onChange={(event) => setForm((previous) => ({ ...previous, nameKo: event.target.value }))}
                placeholder="버건디 레더 재킷"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>프로젝트명 (영문)</Label>
              <Input
                value={form.nameEn}
                onChange={(event) => setForm((previous) => ({ ...previous, nameEn: event.target.value }))}
                placeholder="BURGUNDY LEATHER JACKET"
                className="mt-1.5"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label>카테고리</Label>
              <Input
                list="portfolio-category-options"
                value={form.category}
                onChange={(event) => setForm((previous) => ({ ...previous, category: event.target.value }))}
                className="mt-1.5"
              />
              <datalist id="portfolio-category-options">
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            </div>
            <div>
              <Label>제작 국가</Label>
              <Input
                value={form.country || ""}
                onChange={(event) => setForm((previous) => ({ ...previous, country: event.target.value }))}
                placeholder="국내 / 중국 / 일본"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>제작 수량</Label>
              <Input
                value={form.quantity || ""}
                onChange={(event) => setForm((previous) => ({ ...previous, quantity: event.target.value }))}
                placeholder="예: 100장"
                className="mt-1.5"
              />
            </div>
          </div>

          <div>
            <Label>제작 서비스 (쉼표로 구분)</Label>
            <Input
              value={servicesText}
              onChange={(event) => setServicesText(event.target.value)}
              placeholder="Design, Fabric, Pattern, Sample, Production"
              className="mt-1.5"
            />
            {servicesText.trim() && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {servicesText.split(",").map((service) => service.trim()).filter(Boolean).map((service) => (
                  <span key={service} className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-600">
                    {service}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label>프로젝트 설명</Label>
            <Textarea
              value={form.description || ""}
              onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value }))}
              className="mt-1.5 min-h-20"
              placeholder="프로젝트에 대한 간단한 설명 (선택)"
            />
          </div>

          <div>
            <Label>대표 이미지</Label>
            <div className="mt-1.5 flex items-center gap-3">
              {form.mainImagePath && (
                <img src={form.mainImagePath} alt="대표 이미지" className="h-20 w-20 rounded-lg border border-stone-200 object-contain bg-stone-50" />
              )}
              <label className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-stone-300 px-3 text-sm font-semibold text-stone-600 hover:bg-stone-50">
                {isUploadingMain ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                이미지 업로드
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void handleMainImageUpload(file);
                    event.target.value = "";
                  }}
                />
              </label>
            </div>
          </div>

          <div>
            <Label>추가 이미지 (완성 제품 · 룩북 · 디테일 · 원단 · 프린팅 · 패턴/샘플 등)</Label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {form.additionalImagePaths.map((image) => (
                <div key={image} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-stone-200 bg-stone-50">
                  <img src={image} alt="" className="h-full w-full object-contain" />
                  <button
                    type="button"
                    onClick={() => removeExtraImage(image)}
                    className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white"
                    aria-label="이미지 삭제"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <label className="flex h-20 w-20 shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-stone-300 text-stone-400 hover:bg-stone-50">
                {isUploadingExtra ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                <span className="text-[10px] font-semibold">추가</span>
                <input
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(event) => {
                    if (event.target.files?.length) void handleExtraImagesUpload(event.target.files);
                    event.target.value = "";
                  }}
                />
              </label>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>노출 순서</Label>
              <Input
                type="number"
                value={form.order}
                onChange={(event) => setForm((previous) => ({ ...previous, order: Number(event.target.value) || 0 }))}
                className="mt-1.5"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-stone-200 px-3">
              <Label className="mb-0">사이트에 노출</Label>
              <Switch
                checked={form.visible}
                onCheckedChange={(checked) => setForm((previous) => ({ ...previous, visible: checked }))}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4 gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            취소
          </Button>
          <Button onClick={() => void handleSave()} disabled={isSaving || isUploadingMain || isUploadingExtra}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
