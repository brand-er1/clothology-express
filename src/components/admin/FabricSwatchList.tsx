import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  Eye,
  ImageOff,
  Loader2,
  PackageSearch,
  SearchCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { getFabricSwatchReferenceUrl } from "@/services/fabricSwatch";
import type {
  FabricSwatchRequest,
  FabricSwatchStatus,
} from "@/types/fabricSwatch";

const statusDisplay: Record<
  FabricSwatchStatus,
  { label: string; className: string; icon: typeof Clock3 }
> = {
  pending: {
    label: "신규 신청",
    className: "border-amber-200 bg-amber-50 text-amber-800",
    icon: Clock3,
  },
  in_review: {
    label: "원단 선별 중",
    className: "border-blue-200 bg-blue-50 text-blue-800",
    icon: SearchCheck,
  },
  recommended: {
    label: "추천 완료",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    icon: PackageSearch,
  },
  completed: {
    label: "처리 완료",
    className: "border-stone-200 bg-stone-100 text-stone-700",
    icon: CheckCircle2,
  },
};

interface FabricSwatchListProps {
  requests: FabricSwatchRequest[];
  isSaving: boolean;
  onUpdate: (
    request: FabricSwatchRequest,
    status: FabricSwatchStatus,
    adminNote: string,
  ) => Promise<void>;
}

export const FabricSwatchList = ({
  requests,
  isSaving,
  onUpdate,
}: FabricSwatchListProps) => {
  const [selectedRequest, setSelectedRequest] =
    useState<FabricSwatchRequest | null>(null);
  const [selectedStatus, setSelectedStatus] =
    useState<FabricSwatchStatus>("pending");
  const [adminNote, setAdminNote] = useState("");
  const [referenceUrl, setReferenceUrl] = useState<string | null>(null);
  const [isLoadingImage, setIsLoadingImage] = useState(false);

  useEffect(() => {
    if (!selectedRequest) {
      setReferenceUrl(null);
      return;
    }

    setSelectedStatus(selectedRequest.status);
    setAdminNote(selectedRequest.admin_note || "");
    setReferenceUrl(null);
    setIsLoadingImage(false);

    if (!selectedRequest.reference_image_path) return;

    let active = true;
    setIsLoadingImage(true);
    getFabricSwatchReferenceUrl(selectedRequest.reference_image_path)
      .then((url) => {
        if (active) setReferenceUrl(url);
      })
      .catch((error) => {
        console.error("Failed to load fabric reference image:", error);
      })
      .finally(() => {
        if (active) setIsLoadingImage(false);
      });

    return () => {
      active = false;
    };
  }, [selectedRequest]);

  const openRequest = (request: FabricSwatchRequest) => {
    setSelectedRequest(request);
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <>
      <Card className="border-stone-200 p-4 shadow-sm md:p-6">
        <CardHeader className="px-0 pt-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-xl md:text-2xl">
                원단 스와치 신청 관리
              </CardTitle>
              <p className="mt-1 text-sm text-stone-500">
                고객이 선택한 느낌과 색상을 확인하고 추천 진행 상태를 관리합니다.
              </p>
            </div>
            <Badge
              variant="outline"
              className="border-brand/20 bg-brand/[0.04] px-3 py-1 text-brand"
            >
              신규 {requests.filter((request) => request.status === "pending").length}건
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {!requests.length ? (
            <div className="rounded-2xl bg-stone-50 px-5 py-12 text-center">
              <PackageSearch className="mx-auto h-8 w-8 text-stone-300" />
              <p className="mt-3 font-semibold text-stone-700">
                접수된 원단 스와치 신청이 없습니다.
              </p>
              <p className="mt-2 text-sm text-stone-500">
                새 신청이 들어오면 이곳에 표시됩니다.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {requests.map((request) => {
                  const status = statusDisplay[request.status];
                  const StatusIcon = status.icon;
                  return (
                    <button
                      key={request.id}
                      type="button"
                      onClick={() => openRequest(request)}
                      className="w-full rounded-2xl border border-stone-200 p-4 text-left transition hover:border-brand/30 hover:bg-stone-50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-bold text-stone-900">
                            {request.requester_name || request.requester_email}
                          </p>
                          <p className="mt-1 text-xs text-stone-400">
                            {formatDate(request.created_at)}
                          </p>
                        </div>
                        <Badge variant="outline" className={status.className}>
                          <StatusIcon className="mr-1 h-3 w-3" />
                          {status.label}
                        </Badge>
                      </div>
                      <p className="mt-3 text-sm font-semibold text-stone-700">
                        {request.fabric_feeling}
                      </p>
                      <p className="mt-1 line-clamp-1 text-sm text-stone-500">
                        {request.color_names.join(", ")}
                      </p>
                    </button>
                  );
                })}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>신청일시</TableHead>
                      <TableHead>신청자</TableHead>
                      <TableHead>원단 느낌</TableHead>
                      <TableHead>희망 색상</TableHead>
                      <TableHead>상태</TableHead>
                      <TableHead className="text-right">관리</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.map((request) => {
                      const status = statusDisplay[request.status];
                      const StatusIcon = status.icon;
                      return (
                        <TableRow key={request.id}>
                          <TableCell className="whitespace-nowrap text-sm text-stone-500">
                            {formatDate(request.created_at)}
                          </TableCell>
                          <TableCell>
                            <p className="max-w-40 truncate font-semibold">
                              {request.requester_name || request.requester_email}
                            </p>
                            {request.requester_name && (
                              <p className="max-w-40 truncate text-xs text-stone-400">
                                {request.requester_email}
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="font-semibold">
                            {request.fabric_feeling}
                          </TableCell>
                          <TableCell>
                            <p className="max-w-52 truncate text-stone-600">
                              {request.color_names.join(", ")}
                            </p>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={status.className}>
                              <StatusIcon className="mr-1 h-3 w-3" />
                              {status.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => openRequest(request)}
                            >
                              <Eye className="mr-1.5 h-3.5 w-3.5" />
                              상세보기
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(selectedRequest)}
        onOpenChange={(open) => {
          if (!open) setSelectedRequest(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle className="text-2xl">원단 스와치 신청 상세</DialogTitle>
            <DialogDescription>
              신청 조건을 확인하고 원단 선별 진행 상태를 저장하세요.
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-5">
              <div className="grid gap-3 rounded-2xl bg-stone-50 p-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold text-stone-400">신청자</p>
                  <p className="mt-1 font-bold text-stone-900">
                    {selectedRequest.requester_name ||
                      selectedRequest.requester_email}
                  </p>
                  {selectedRequest.requester_name && (
                    <p className="mt-0.5 text-xs text-stone-500">
                      {selectedRequest.requester_email}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold text-stone-400">신청일시</p>
                  <p className="mt-1 font-semibold text-stone-700">
                    {formatDate(selectedRequest.created_at)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-stone-400">원단 느낌</p>
                  <p className="mt-1 font-bold text-stone-900">
                    {selectedRequest.fabric_feeling}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-stone-400">선별 기준</p>
                  <p className="mt-1 font-bold text-stone-900">
                    스와치 {selectedRequest.requested_minimum_count}개 이상
                  </p>
                </div>
              </div>

              <div>
                <p className="text-sm font-bold text-stone-800">희망 색상</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedRequest.color_names.map((color) => (
                    <span
                      key={color}
                      className="rounded-full bg-stone-900 px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      {color}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-bold text-stone-800">참고 이미지</p>
                <div className="mt-2 flex min-h-48 items-center justify-center overflow-hidden rounded-2xl border border-stone-200 bg-stone-50">
                  {isLoadingImage ? (
                    <Loader2 className="h-6 w-6 animate-spin text-brand" />
                  ) : referenceUrl ? (
                    <img
                      src={referenceUrl}
                      alt="고객 참고 이미지"
                      className="max-h-80 w-full object-contain"
                    />
                  ) : (
                    <div className="py-10 text-center text-stone-400">
                      <ImageOff className="mx-auto h-7 w-7" />
                      <p className="mt-2 text-sm">업로드한 이미지가 없습니다.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-2 text-sm font-bold text-stone-800">진행 상태</p>
                  <Select
                    value={selectedStatus}
                    onValueChange={(value) =>
                      setSelectedStatus(value as FabricSwatchStatus)
                    }
                  >
                    <SelectTrigger className="h-11 bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">신규 신청</SelectItem>
                      <SelectItem value="in_review">원단 선별 중</SelectItem>
                      <SelectItem value="recommended">추천 완료</SelectItem>
                      <SelectItem value="completed">처리 완료</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <p className="mb-2 text-sm font-bold text-stone-800">
                    관리자 메모
                  </p>
                  <Textarea
                    value={adminNote}
                    onChange={(event) => setAdminNote(event.target.value)}
                    placeholder="추천 원단, 거래처 확인 내용 등을 기록하세요."
                    className="min-h-24 resize-none bg-white"
                    maxLength={1000}
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSelectedRequest(null)}
              disabled={isSaving}
            >
              닫기
            </Button>
            <Button
              type="button"
              className="bg-brand hover:bg-brand-dark"
              disabled={isSaving || !selectedRequest}
              onClick={async () => {
                if (!selectedRequest) return;
                await onUpdate(selectedRequest, selectedStatus, adminNote);
                setSelectedRequest(null);
              }}
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              상태 저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
