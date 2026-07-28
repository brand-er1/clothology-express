import { useMemo, useState } from "react";
import {
  ExternalLink,
  Eye,
  ImageIcon,
  Search,
  ShoppingBag,
  Sparkles,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type {
  AdminGeneratedImage,
  AdminGeneratedImageStatus,
} from "@/types/generatedImage";

type GeneratedImageFilter = "all" | AdminGeneratedImageStatus;

const statusDisplay: Record<
  AdminGeneratedImageStatus,
  { label: string; className: string }
> = {
  image_only: {
    label: "이미지만 생성",
    className: "border-amber-200 bg-amber-50 text-amber-800",
  },
  funding: {
    label: "펀딩 등록",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  direct: {
    label: "제작 의뢰",
    className: "border-blue-200 bg-blue-50 text-blue-800",
  },
};

const filters: { value: GeneratedImageFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "image_only", label: "이미지만 생성" },
  { value: "funding", label: "펀딩 등록" },
  { value: "direct", label: "제작 의뢰" },
];

const formatDate = (value: string) =>
  new Date(value).toLocaleString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const getCustomerLabel = (image: AdminGeneratedImage) =>
  image.brand_name ||
  image.customer_name ||
  image.username ||
  `고객 ${image.user_id.slice(0, 8)}`;

interface GeneratedImageListProps {
  images: AdminGeneratedImage[];
  isLoading: boolean;
}

export const GeneratedImageList = ({
  images,
  isLoading,
}: GeneratedImageListProps) => {
  const [filter, setFilter] = useState<GeneratedImageFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedImage, setSelectedImage] =
    useState<AdminGeneratedImage | null>(null);

  const filteredImages = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase("ko-KR");

    return images.filter((image) => {
      if (filter !== "all" && image.conversion_status !== filter) return false;
      if (!normalizedQuery) return true;

      return [
        image.brand_name,
        image.customer_name,
        image.username,
        image.phone_number,
        image.cloth_type,
        image.material,
        image.detail,
        image.prompt,
      ].some((value) => value?.toLocaleLowerCase("ko-KR").includes(normalizedQuery));
    });
  }, [filter, images, searchQuery]);

  const imageOnlyCount = images.filter(
    (image) => image.conversion_status === "image_only",
  ).length;

  return (
    <>
      <Card className="border-stone-200 p-4 shadow-sm md:p-6">
        <CardHeader className="px-0 pt-0">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl md:text-2xl">
                <Sparkles className="h-5 w-5 text-brand md:h-6 md:w-6" />
                AI 생성 이미지 관리
              </CardTitle>
              <p className="mt-2 text-sm leading-6 text-stone-500">
                펀딩이나 제작 의뢰로 이어지지 않은 이미지까지 고객별로 확인합니다.
              </p>
            </div>
            <Badge
              variant="outline"
              className="border-amber-200 bg-amber-50 px-3 py-1 text-amber-800"
            >
              이미지만 생성 {imageOnlyCount}건
            </Badge>
          </div>

          <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {filters.map((item) => (
                <Button
                  key={item.value}
                  type="button"
                  size="sm"
                  variant={filter === item.value ? "default" : "outline"}
                  onClick={() => setFilter(item.value)}
                  className={filter === item.value ? "bg-stone-950 hover:bg-stone-800" : ""}
                >
                  {item.label}
                </Button>
              ))}
            </div>
            <div className="relative w-full lg:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="고객명, 연락처, 의류 종류 검색"
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-0 pb-0">
          {isLoading ? (
            <div className="rounded-2xl bg-stone-50 px-5 py-16 text-center text-sm text-stone-500">
              생성 이미지 내역을 불러오는 중입니다.
            </div>
          ) : !images.length ? (
            <div className="rounded-2xl bg-stone-50 px-5 py-16 text-center">
              <ImageIcon className="mx-auto h-9 w-9 text-stone-300" />
              <p className="mt-3 font-semibold text-stone-700">
                아직 생성된 이미지가 없습니다.
              </p>
            </div>
          ) : !filteredImages.length ? (
            <div className="rounded-2xl bg-stone-50 px-5 py-12 text-center text-sm text-stone-500">
              조건에 맞는 이미지가 없습니다.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredImages.map((image) => {
                const status = statusDisplay[image.conversion_status];

                return (
                  <article
                    key={image.id}
                    className="group overflow-hidden rounded-2xl border border-stone-200 bg-white transition hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-lg"
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedImage(image)}
                      className="relative block aspect-[4/3] w-full overflow-hidden bg-stone-100"
                      aria-label={`${getCustomerLabel(image)} 생성 이미지 크게 보기`}
                    >
                      {image.image_url ? (
                        <img
                          src={image.image_url}
                          alt={`${getCustomerLabel(image)} 생성 디자인`}
                          className="h-full w-full object-contain p-2 transition duration-300 group-hover:scale-[1.02]"
                          loading="lazy"
                        />
                      ) : (
                        <ImageIcon className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 text-stone-300" />
                      )}
                      <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-stone-950/85 px-3 py-1.5 text-xs font-bold text-white opacity-100 backdrop-blur md:opacity-0 md:transition md:group-hover:opacity-100">
                        <Eye className="h-3.5 w-3.5" />
                        크게 보기
                      </span>
                    </button>

                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-bold text-stone-950">
                            {getCustomerLabel(image)}
                          </p>
                          <p className="mt-1 text-xs text-stone-500">
                            {image.phone_number || "연락처 미등록"}
                          </p>
                        </div>
                        <Badge variant="outline" className={status.className}>
                          {status.label}
                        </Badge>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-stone-600">
                        {image.cloth_type && (
                          <span className="rounded-full bg-stone-100 px-2.5 py-1">
                            {image.cloth_type}
                          </span>
                        )}
                        {image.material && (
                          <span className="rounded-full bg-stone-100 px-2.5 py-1">
                            {image.material}
                          </span>
                        )}
                      </div>

                      <p className="mt-4 line-clamp-2 min-h-10 text-sm leading-5 text-stone-600">
                        {image.detail || image.prompt || "상세 요청 없음"}
                      </p>
                      <p className="mt-4 text-xs text-stone-400">
                        {formatDate(image.created_at)}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(selectedImage)}
        onOpenChange={(open) => {
          if (!open) setSelectedImage(null);
        }}
      >
        <DialogContent className="max-h-[94vh] w-[95vw] max-w-6xl overflow-y-auto rounded-2xl p-4 sm:p-6">
          {selectedImage && (
            <>
              <DialogHeader>
                <DialogTitle className="pr-8 text-xl md:text-2xl">
                  {getCustomerLabel(selectedImage)}님의 생성 이미지
                </DialogTitle>
                <DialogDescription>
                  {formatDate(selectedImage.created_at)} 생성 ·{" "}
                  {statusDisplay[selectedImage.conversion_status].label}
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.75fr)]">
                <div className="flex min-h-[48vh] items-center justify-center overflow-hidden rounded-2xl bg-stone-100 lg:min-h-[68vh]">
                  {selectedImage.image_url ? (
                    <img
                      src={selectedImage.image_url}
                      alt={`${getCustomerLabel(selectedImage)} 생성 디자인`}
                      className="max-h-[72vh] w-full object-contain p-3"
                    />
                  ) : (
                    <ImageIcon className="h-14 w-14 text-stone-300" />
                  )}
                </div>

                <div className="space-y-5">
                  <div className="rounded-2xl border border-stone-200 p-4">
                    <div className="flex items-center gap-2 font-bold text-stone-950">
                      <Users className="h-4 w-4 text-brand" />
                      고객 정보
                    </div>
                    <dl className="mt-4 space-y-3 text-sm">
                      <div>
                        <dt className="text-stone-400">브랜드 / 고객명</dt>
                        <dd className="mt-1 font-semibold text-stone-800">
                          {getCustomerLabel(selectedImage)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-stone-400">연락처</dt>
                        <dd className="mt-1 font-semibold text-stone-800">
                          {selectedImage.phone_number || "미등록"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-stone-400">사용자 ID</dt>
                        <dd className="mt-1 break-all text-xs text-stone-500">
                          {selectedImage.user_id}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div className="rounded-2xl border border-stone-200 p-4">
                    <div className="flex items-center gap-2 font-bold text-stone-950">
                      <ShoppingBag className="h-4 w-4 text-brand" />
                      디자인 요청
                    </div>
                    <dl className="mt-4 space-y-3 text-sm">
                      <div>
                        <dt className="text-stone-400">종류 / 소재</dt>
                        <dd className="mt-1 font-semibold text-stone-800">
                          {[selectedImage.cloth_type, selectedImage.material]
                            .filter(Boolean)
                            .join(" · ") || "미입력"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-stone-400">상세 요청</dt>
                        <dd className="mt-1 whitespace-pre-wrap leading-6 text-stone-700">
                          {selectedImage.detail || "상세 요청 없음"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-stone-400">입력 프롬프트</dt>
                        <dd className="mt-1 whitespace-pre-wrap break-words leading-6 text-stone-700">
                          {selectedImage.prompt || "프롬프트 없음"}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  {selectedImage.image_url && (
                    <Button asChild variant="outline" className="w-full">
                      <a
                        href={selectedImage.image_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        원본 이미지 새 창에서 보기
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
