import { useState } from "react";
import { Eye, EyeOff, ImageOff, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import { PortfolioProjectEditor } from "@/components/admin/PortfolioProjectEditor";
import { deletePortfolioProject, updatePortfolioProject } from "@/services/portfolioProjects";
import { PORTFOLIO_CATEGORY_LABEL_KO, type PortfolioProject } from "@/types/portfolio";

interface PortfolioProjectListProps {
  projects: PortfolioProject[];
  isLoading: boolean;
  onReload: () => void;
}

export const PortfolioProjectList = ({ projects, isLoading, onReload }: PortfolioProjectListProps) => {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<PortfolioProject | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const openCreate = () => {
    setEditingProject(null);
    setEditorOpen(true);
  };

  const openEdit = (project: PortfolioProject) => {
    setEditingProject(project);
    setEditorOpen(true);
  };

  const toggleVisibility = async (project: PortfolioProject) => {
    setBusyId(project.id);
    try {
      await updatePortfolioProject(project.id, {
        nameKo: project.nameKo,
        nameEn: project.nameEn,
        category: project.category,
        mainImagePath: project.images[0],
        additionalImagePaths: project.images.slice(1),
        country: project.country,
        quantity: project.quantity,
        services: project.services,
        description: project.description,
        visible: !project.visible,
        order: project.order,
      });
      toast({ title: project.visible ? "프로젝트를 숨겼습니다" : "프로젝트를 노출했습니다" });
      onReload();
    } catch (error) {
      toast({
        title: "노출 상태를 변경하지 못했습니다",
        description: error instanceof Error ? error.message : "잠시 후 다시 시도해주세요.",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (project: PortfolioProject) => {
    if (!window.confirm(`"${project.nameKo}" 프로젝트를 삭제할까요? 이미지는 함께 삭제되지 않습니다.`)) return;
    setBusyId(project.id);
    try {
      await deletePortfolioProject(project.id);
      toast({ title: "프로젝트를 삭제했습니다" });
      onReload();
    } catch (error) {
      toast({
        title: "삭제하지 못했습니다",
        description: error instanceof Error ? error.message : "잠시 후 다시 시도해주세요.",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  const nextOrder = projects.reduce((max, project) => Math.max(max, project.order), 0) + 1;

  return (
    <div className="space-y-4">
      <Card className="border-stone-200 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
          <div>
            <CardTitle className="text-xl md:text-2xl">포트폴리오 관리</CardTitle>
            <p className="mt-1 text-sm leading-6 text-stone-500">
              Selected Works에 노출되는 프로젝트를 추가·수정하고 노출 순서를 관리합니다.
            </p>
          </div>
          <Button onClick={openCreate} className="shrink-0">
            <Plus className="mr-1.5 h-4 w-4" />새 프로젝트
          </Button>
        </CardHeader>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-stone-400">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          불러오는 중...
        </div>
      ) : projects.length === 0 ? (
        <Card className="border-stone-200 px-5 py-14 text-center shadow-sm">
          <ImageOff className="mx-auto h-8 w-8 text-stone-300" />
          <p className="mt-4 font-bold text-stone-700">등록된 프로젝트가 없습니다</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <Card key={project.id} className={`overflow-hidden shadow-sm ${!project.visible ? "opacity-60" : ""}`}>
              <div className="aspect-[4/5] bg-stone-100">
                <img src={project.images[0]} alt={project.nameKo} className="h-full w-full object-contain p-4" />
              </div>
              <CardContent className="p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand">
                  {project.order} · {PORTFOLIO_CATEGORY_LABEL_KO[project.category] || project.category}
                </p>
                <h3 className="mt-1 truncate text-sm font-bold text-stone-900">{project.nameEn}</h3>
                <p className="truncate text-xs text-stone-500">{project.nameKo}</p>

                <div className="mt-3 flex items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 flex-1"
                    onClick={() => openEdit(project)}
                    disabled={busyId === project.id}
                  >
                    <Pencil className="mr-1 h-3.5 w-3.5" />
                    수정
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 w-8 p-0"
                    onClick={() => void toggleVisibility(project)}
                    disabled={busyId === project.id}
                    aria-label={project.visible ? "숨기기" : "노출하기"}
                  >
                    {project.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                    onClick={() => void handleDelete(project)}
                    disabled={busyId === project.id}
                    aria-label="삭제"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <PortfolioProjectEditor
        project={editingProject}
        open={editorOpen}
        nextOrder={nextOrder}
        onOpenChange={setEditorOpen}
        onSaved={onReload}
      />
    </div>
  );
};
