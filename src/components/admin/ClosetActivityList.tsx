import { useMemo, useState } from "react";
import {
  ExternalLink,
  Eye,
  ImageIcon,
  Repeat,
  Save,
  Search,
  Shirt,
  Sparkles,
  Users,
  Wand2,
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
import { closetSlotLabel } from "@/lib/closet-character-config";
import type { AdminClosetActivity, ClosetActivityEventType } from "@/types/closetActivity";

type ActivityFilter = "all" | ClosetActivityEventType;

const eventDisplay: Record<
  ClosetActivityEventType,
  { label: string; className: string; icon: typeof Shirt }
> = {
  garment_created: {
    label: "옷 생성",
    className: "border-violet-200 bg-violet-50 text-violet-800",
    icon: Sparkles,
  },
  garment_edited: {
    label: "옷 수정",
    className: "border-blue-200 bg-blue-50 text-blue-800",
    icon: Wand2,
  },
  garment_regenerated: {
    label: "다시 생성",
    className: "border-amber-200 bg-amber-50 text-amber-800",
    icon: Repeat,
  },
  character_dressed: {
    label: "가상 마네킹 피팅",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    icon: Shirt,
  },
  look_saved: {
    label: "룩 저장",
    className: "border-stone-300 bg-stone-100 text-stone-800",
    icon: Save,
  },
};

const filters: { value: ActivityFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "garment_created", label: "옷 생성" },
  { value: "garment_edited", label: "옷 수정" },
  { value: "garment_regenerated", label: "다시 생성" },
  { value: "character_dressed", label: "가상 마네킹 피팅" },
  { value: "look_saved", label: "룩 저장" },
];

const formatDate = (value: string) =>
  new Date(value).toLocaleString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const getCustomerLabel = (activity: AdminClosetActivity) =>
  activity.brand_name ||
  activity.customer_name ||
  activity.username ||
  activity.email ||
  `고객 ${activity.user_id.slice(0, 8)}`;

const slotLabel = (slot: string | null) =>
  slot && slot in closetSlotLabel ? closetSlotLabel[slot as keyof typeof closetSlotLabel] : slot;

const genderLabel = (gender: string | null) => {
  if (gender === "male") return "남자 브랜더";
  if (gender === "female") return "여자 브랜더";
  return null;
};

interface ClosetActivityListProps {
  activities: AdminClosetActivity[];
  isLoading: boolean;
}

export const ClosetActivityList = ({ activities, isLoading }: ClosetActivityListProps) => {
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selected, setSelected] = useState<AdminClosetActivity | null>(null);

  const filteredActivities = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase("ko-KR");

    return activities.filter((activity) => {
      if (filter !== "all" && activity.event_type !== filter) return false;
      if (!normalizedQuery) return true;

      return [
        activity.brand_name,
        activity.customer_name,
        activity.username,
        activity.email,
        activity.phone_number,
        activity.label,
        activity.prompt,
        activity.slot,
      ].some((value) => value?.toLocaleLowerCase("ko-KR").includes(normalizedQuery));
    });
  }, [activities, filter, searchQuery]);

  const activeCustomerCount = useMemo(
    () => new Set(activities.map((activity) => activity.user_id)).size,
    [activities],
  );

  return (
    <>
      <Card className="border-stone-200 p-4 shadow-sm md:p-6">
        <CardHeader className="px-0 pt-0">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl md:text-2xl">
                <Shirt className="h-5 w-5 text-brand md:h-6 md:w-6" />
                브랜더 옷장 활동
              </CardTitle>
              <p className="mt-2 text-sm leading-6 text-stone-500">
                고객이 만들고, 수정하고, 가상 마네킹에 입혀보고, 저장한 모든 AI 피팅 활동을
                확인합니다. 로그인한 고객의 활동만 기록됩니다.
              </p>
            </div>
            <Badge variant="outline" className="border-stone-300 bg-stone-100 px-3 py-1 text-stone-700">
              활동 고객 {activeCustomerCount}명 · 기록 {activities.length}건
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
                placeholder="고객명, 연락처, 옷 이름, 수정 요청 검색"
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-0 pb-0">
          {isLoading ? (
            <div className="rounded-2xl bg-stone-50 px-5 py-16 text-center text-sm text-stone-500">
              브랜더 옷장 활동을 불러오는 중입니다.
            </div>
          ) : !activities.length ? (
            <div className="rounded-2xl bg-stone-50 px-5 py-16 text-center">
              <ImageIcon className="mx-auto h-9 w-9 text-stone-300" />
              <p className="mt-3 font-semibold text-stone-700">
                아직 브랜더 옷장 활동 기록이 없습니다.
              </p>
            </div>
          ) : !filteredActivities.length ? (
            <div className="rounded-2xl bg-stone-50 px-5 py-12 text-center text-sm text-stone-500">
              조건에 맞는 활동이 없습니다.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredActivities.map((activity) => {
                const display = eventDisplay[activity.event_type];
                const Icon = display.icon;

                return (
                  <article
                    key={activity.id}
                    className="group overflow-hidden rounded-2xl border border-stone-200 bg-white transition hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-lg"
                  >
                    <button
                      type="button"
                      onClick={() => setSelected(activity)}
                      className="relative block aspect-[4/3] w-full overflow-hidden bg-stone-100"
                      aria-label={`${getCustomerLabel(activity)} 활동 크게 보기`}
                    >
                      {activity.image_url ? (
                        <img
                          src={activity.image_url}
                          alt={activity.label || display.label}
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
                            {getCustomerLabel(activity)}
                          </p>
                          <p className="mt-1 text-xs text-stone-500">
                            {activity.phone_number || "연락처 미등록"}
                          </p>
                        </div>
                        <Badge variant="outline" className={display.className}>
                          <Icon className="mr-1 h-3 w-3" />
                          {display.label}
                        </Badge>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-stone-600">
                        {genderLabel(activity.character_gender) && (
                          <span className="rounded-full bg-stone-100 px-2.5 py-1">
                            {genderLabel(activity.character_gender)}
                          </span>
                        )}
                        {slotLabel(activity.slot) && (
                          <span className="rounded-full bg-stone-100 px-2.5 py-1">
                            {slotLabel(activity.slot)}
                          </span>
                        )}
                      </div>

                      <p className="mt-4 line-clamp-2 min-h-10 text-sm leading-5 text-stone-600">
                        {activity.prompt || activity.label || "상세 정보 없음"}
                      </p>
                      <p className="mt-4 text-xs text-stone-400">{formatDate(activity.created_at)}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="max-h-[94vh] w-[95vw] max-w-6xl overflow-y-auto rounded-2xl p-4 sm:p-6">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="pr-8 text-xl md:text-2xl">
                  {getCustomerLabel(selected)}님의 {eventDisplay[selected.event_type].label}
                </DialogTitle>
                <DialogDescription>{formatDate(selected.created_at)}</DialogDescription>
              </DialogHeader>

              <div className="grid gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.75fr)]">
                <div className="flex min-h-[48vh] items-center justify-center overflow-hidden rounded-2xl bg-stone-100 lg:min-h-[68vh]">
                  {selected.image_url ? (
                    <img
                      src={selected.image_url}
                      alt={selected.label || eventDisplay[selected.event_type].label}
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
                        <dd className="mt-1 font-semibold text-stone-800">{getCustomerLabel(selected)}</dd>
                      </div>
                      <div>
                        <dt className="text-stone-400">이메일 / 연락처</dt>
                        <dd className="mt-1 font-semibold text-stone-800">
                          {[selected.email, selected.phone_number].filter(Boolean).join(" · ") || "미등록"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-stone-400">사용자 ID</dt>
                        <dd className="mt-1 break-all text-xs text-stone-500">{selected.user_id}</dd>
                      </div>
                    </dl>
                  </div>

                  <div className="rounded-2xl border border-stone-200 p-4">
                    <div className="flex items-center gap-2 font-bold text-stone-950">
                      <Shirt className="h-4 w-4 text-brand" />
                      활동 상세
                    </div>
                    <dl className="mt-4 space-y-3 text-sm">
                      <div>
                        <dt className="text-stone-400">마네킹 / 부위</dt>
                        <dd className="mt-1 font-semibold text-stone-800">
                          {[genderLabel(selected.character_gender), slotLabel(selected.slot)]
                            .filter(Boolean)
                            .join(" · ") || "미입력"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-stone-400">옷/룩 이름</dt>
                        <dd className="mt-1 whitespace-pre-wrap leading-6 text-stone-700">
                          {selected.label || "미입력"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-stone-400">
                          {selected.event_type === "garment_edited" ? "수정 요청" : "프롬프트"}
                        </dt>
                        <dd className="mt-1 whitespace-pre-wrap break-words leading-6 text-stone-700">
                          {selected.prompt || "없음"}
                        </dd>
                      </div>
                      {selected.garment_id && (
                        <div>
                          <dt className="text-stone-400">의류 ID</dt>
                          <dd className="mt-1 break-all text-xs text-stone-500">{selected.garment_id}</dd>
                        </div>
                      )}
                      {selected.metadata && Object.keys(selected.metadata).length > 0 && (
                        <div>
                          <dt className="text-stone-400">추가 정보</dt>
                          <dd className="mt-1 overflow-x-auto rounded-lg bg-stone-50 p-2 text-xs text-stone-600">
                            <pre className="whitespace-pre-wrap break-words">
                              {JSON.stringify(selected.metadata, null, 2)}
                            </pre>
                          </dd>
                        </div>
                      )}
                    </dl>
                  </div>

                  {selected.image_url && (
                    <Button asChild variant="outline" className="w-full">
                      <a href={selected.image_url} target="_blank" rel="noreferrer">
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
