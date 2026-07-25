import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Header } from "@/components/Header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";
import {
  fetchFunding,
  resolveDefaultFabricUnitCost,
  updateFunding,
} from "@/services/funding";
import { analyzeProductionEstimate } from "@/services/productionEstimate";
import type { Funding } from "@/types/funding";
import {
  ArrowLeft,
  Calculator,
  Check,
  Eye,
  Loader2,
  LockKeyhole,
  Plus,
  Sparkles,
  TrendingUp,
  Users,
  X,
} from "lucide-react";

const formatWon = (amount: number) =>
  `${Math.round(amount).toLocaleString("ko-KR")}원`;

const FundingEditor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [funding, setFunding] = useState<Funding | null>(null);
  const [loading, setLoading] = useState(true);
  const [estimating, setEstimating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newColor, setNewColor] = useState("");
  const [newSize, setNewSize] = useState("");

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      try {
        const [{ data: sessionData }, fundingData] = await Promise.all([
          supabase.auth.getSession(),
          fetchFunding(id),
        ]);
        if (!sessionData.session?.user || sessionData.session.user.id !== fundingData.creator_id) {
          throw new Error("펀딩을 수정할 권한이 없습니다.");
        }
        setFunding(fundingData);

        if (
          fundingData.estimate_direct_unit_min == null ||
          fundingData.estimate_direct_unit_max == null ||
          fundingData.estimate_development_total == null
        ) {
          setEstimating(true);
          void analyzeProductionEstimate({
            imageUrl: fundingData.image_url,
            selectedType: fundingData.cloth_type,
            selectedMaterial: fundingData.material,
            designContext: fundingData.description || "",
          })
            .then((estimate) => {
              setFunding((current) =>
                current?.id === fundingData.id
                  ? {
                      ...current,
                      estimate_direct_unit_min:
                        estimate.totals.directUnitMin,
                      estimate_direct_unit_max:
                        estimate.totals.directUnitMax,
                      estimate_development_total:
                        estimate.totals.developmentTotal,
                    }
                  : current,
              );
            })
            .catch((estimateError) => {
              console.error("Funding estimate analysis error:", estimateError);
            })
            .finally(() => setEstimating(false));
        }
      } catch (error) {
        console.error(error);
        toast({
          title: "펀딩 수정 페이지를 열 수 없습니다",
          description: error instanceof Error ? error.message : "펀딩 제작자만 수정할 수 있습니다.",
          variant: "destructive",
        });
        navigate("/fundings");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id, navigate]);

  const handleSave = async () => {
    if (!funding || !id) return;
    if (!funding.product_name.trim()) {
      toast({ title: "상품명을 입력해주세요", variant: "destructive" });
      return;
    }
    if (funding.moq < 20) {
      toast({ title: "최소 제작 수량은 20장입니다", variant: "destructive" });
      return;
    }
    if (!funding.color_options?.length) {
      toast({ title: "컬러를 한 개 이상 추가해주세요", variant: "destructive" });
      return;
    }
    if (!funding.size_options?.length) {
      toast({ title: "사이즈를 한 개 이상 추가해주세요", variant: "destructive" });
      return;
    }
    if (funding.fabric_unit_cost < 0) {
      toast({ title: "원단비는 0원 이상이어야 합니다", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const wasApproved = funding.status === "approved" || funding.status === "closed";
      const updated = await updateFunding(id, {
        product_name: funding.product_name.trim(),
        description: funding.description,
        moq: funding.moq,
        price: funding.price,
        estimate_direct_unit_min: funding.estimate_direct_unit_min,
        estimate_direct_unit_max: funding.estimate_direct_unit_max,
        estimate_development_total: funding.estimate_development_total,
        fabric_unit_cost: funding.fabric_unit_cost,
        funding_days: funding.funding_days,
        color_options: funding.color_options,
        size_options: funding.size_options,
      });
      setFunding(updated);
      toast({
        title: "펀딩 페이지가 저장되었습니다",
        description: wasApproved ? "상품명과 상세 설명이 공개 페이지에 반영됐습니다." : "현재 관리자 승인 대기 상태입니다.",
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "저장하지 못했습니다",
        description: error instanceof Error ? error.message : "잠시 후 다시 시도해주세요.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading || !funding) {
    return (
      <div className="min-h-screen bg-[#f7f5f2]">
        <Header />
        <div className="flex min-h-screen items-center justify-center text-gray-500">
          <Loader2 className="mr-2 h-6 w-6 animate-spin text-brand" /> 펀딩 페이지를 자동으로 작성하고 있습니다
        </div>
      </div>
    );
  }

  const canEditContent = true;
  const canEditSales = funding.status === "pending" || funding.status === "rejected";
  const colors = funding.color_options?.length ? funding.color_options : [funding.color || "기본 색상"];
  const sizes = funding.size_options?.length ? funding.size_options : [funding.size || "FREE"];
  const targetQuantity = Math.max(0, funding.moq || 0);
  const sellingPrice = Math.max(0, funding.price || 0);
  const expectedSales = sellingPrice * targetQuantity;
  const fabricUnitCost = Math.max(0, funding.fabric_unit_cost || 0);
  const defaultFabricUnitCost = resolveDefaultFabricUnitCost(funding.material);
  const fabricTotal = fabricUnitCost * targetQuantity;
  const fundingFee = Math.round(expectedSales * 0.1);
  const productionFee = Math.round(expectedSales * 0.15);
  const hasEstimate =
    funding.estimate_direct_unit_min != null &&
    funding.estimate_direct_unit_max != null &&
    funding.estimate_development_total != null;
  const estimateTotalMin = hasEstimate
    ? funding.estimate_direct_unit_min! * targetQuantity +
      funding.estimate_development_total!
    : null;
  const estimateTotalMax = hasEstimate
    ? funding.estimate_direct_unit_max! * targetQuantity +
      funding.estimate_development_total!
    : null;
  const totalProductionCostMin =
    estimateTotalMin == null ? null : estimateTotalMin + fabricTotal;
  const totalProductionCostMax =
    estimateTotalMax == null ? null : estimateTotalMax + fabricTotal;
  const netProfitMin =
    totalProductionCostMax == null
      ? null
      : expectedSales -
        totalProductionCostMax -
        fundingFee -
        productionFee;
  const netProfitMax =
    totalProductionCostMin == null
      ? null
      : expectedSales -
        totalProductionCostMin -
        fundingFee -
        productionFee;

  const addOption = (kind: "color" | "size") => {
    const rawValue = kind === "color" ? newColor : newSize;
    const value = rawValue.trim();
    if (!value) return;

    const key = kind === "color" ? "color_options" : "size_options";
    const current = kind === "color" ? colors : sizes;
    if (current.some((option) => option.toLowerCase() === value.toLowerCase())) {
      toast({ title: "이미 추가된 옵션입니다", variant: "destructive" });
      return;
    }

    setFunding({ ...funding, [key]: [...current, value] });
    if (kind === "color") setNewColor("");
    else setNewSize("");
  };

  const removeOption = (kind: "color" | "size", value: string) => {
    const key = kind === "color" ? "color_options" : "size_options";
    const current = kind === "color" ? colors : sizes;
    setFunding({ ...funding, [key]: current.filter((option) => option !== value) });
  };

  return (
    <div className="min-h-screen bg-[#f7f5f2]">
      <Header />
      <main className="container mx-auto max-w-6xl px-4 pb-20 pt-24">
        <Link to="/fundings" className="mb-6 inline-flex items-center text-sm text-gray-500 hover:text-gray-900">
          <ArrowLeft className="mr-1 h-4 w-4" /> 펀딩 목록
        </Link>

        <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">
                {funding.status === "pending" ? "관리자 승인 대기" : funding.status === "rejected" ? "수정 필요" : "승인 완료"}
              </Badge>
              <span className="text-sm text-gray-500">MOQ 최소 20장 적용</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">펀딩 페이지 자동 작성</h1>
            <p className="mt-2 text-gray-500">생성한 이미지와 옵션을 가져왔습니다. 소개 문구와 가격만 확인해주세요.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="rounded-full">
              <Link to={`/fundings/${funding.id}`}><Eye className="mr-2 h-4 w-4" /> 미리보기</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <Link to={`/fundings/${funding.id}/manage`}><Users className="mr-2 h-4 w-4" /> 참여자 관리</Link>
            </Button>
          </div>
        </div>

        {funding.status === "rejected" && funding.admin_comment && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            <strong>관리자 수정 요청:</strong> {funding.admin_comment}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <Card className="overflow-hidden rounded-3xl">
            <div className="aspect-[4/3] bg-stone-100 p-4">
              <img src={funding.image_url} alt={funding.product_name} className="h-full w-full object-contain" />
            </div>
            <CardContent className="grid grid-cols-2 gap-4 p-6 text-sm">
              <div><p className="text-gray-400">의류 종류</p><p className="mt-1 font-semibold">{funding.cloth_type}</p></div>
              <div><p className="text-gray-400">출시 컬러</p><p className="mt-1 font-semibold">{colors.join(", ")}</p></div>
              <div><p className="text-gray-400">소재</p><p className="mt-1 font-semibold">{funding.material}</p></div>
              <div><p className="text-gray-400">출시 사이즈</p><p className="mt-1 font-semibold">{sizes.join(", ")}</p></div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Sparkles className="h-5 w-5 text-brand" /> 펀딩 정보
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="product-name">상품명</Label>
                <Input
                  id="product-name"
                  value={funding.product_name}
                  disabled={!canEditContent}
                  onChange={(event) => setFunding({ ...funding, product_name: event.target.value })}
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">상품 상세 설명</Label>
                <Textarea
                  id="description"
                  value={funding.description || ""}
                  disabled={!canEditContent}
                  onChange={(event) => setFunding({ ...funding, description: event.target.value })}
                  className="min-h-56 resize-y"
                  placeholder="디자인 특징, 원단, 핏, 제작 의도, 세탁 방법 등 고객에게 보여줄 상세 내용을 자유롭게 작성해주세요."
                />
              </div>

              <div className="grid gap-5 rounded-2xl border bg-stone-50 p-5 md:grid-cols-2">
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="new-color">출시 컬러</Label>
                    <p className="mt-1 text-xs text-gray-500">한 펀딩에 여러 컬러를 추가할 수 있습니다.</p>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      id="new-color"
                      value={newColor}
                      disabled={!canEditSales}
                      onChange={(event) => setNewColor(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addOption("color");
                        }
                      }}
                      placeholder="예: 블랙"
                      className="h-11"
                    />
                    <Button type="button" variant="outline" size="icon" disabled={!canEditSales} onClick={() => addOption("color")}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {colors.map((color) => (
                      <Badge key={color} variant="secondary" className="gap-1 rounded-full px-3 py-1.5">
                        {color}
                        {canEditSales && <button type="button" onClick={() => removeOption("color", color)} aria-label={`${color} 삭제`}><X className="h-3 w-3" /></button>}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label htmlFor="new-size">출시 사이즈</Label>
                    <p className="mt-1 text-xs text-gray-500">S, M, L처럼 판매할 사이즈를 모두 추가하세요.</p>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      id="new-size"
                      value={newSize}
                      disabled={!canEditSales}
                      onChange={(event) => setNewSize(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addOption("size");
                        }
                      }}
                      placeholder="예: XL"
                      className="h-11"
                    />
                    <Button type="button" variant="outline" size="icon" disabled={!canEditSales} onClick={() => addOption("size")}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {sizes.map((size) => (
                      <Badge key={size} variant="secondary" className="gap-1 rounded-full px-3 py-1.5">
                        {size}
                        {canEditSales && <button type="button" onClick={() => removeOption("size", size)} aria-label={`${size} 삭제`}><X className="h-3 w-3" /></button>}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="moq">목표 수량</Label>
                  <div className="relative">
                    <Input id="moq" type="number" min={20} disabled={!canEditSales} value={funding.moq}
                      onChange={(event) => setFunding({ ...funding, moq: Number(event.target.value) })} className="h-12 pr-10" />
                    <span className="absolute right-3 top-3 text-sm text-gray-400">장</span>
                  </div>
                  <p className="text-xs text-brand">최소 20장</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price">판매가</Label>
                  <div className="relative">
                    <Input id="price" type="number" min={0} disabled={!canEditSales} value={funding.price ?? ""}
                      onChange={(event) => setFunding({ ...funding, price: event.target.value ? Number(event.target.value) : null })} className="h-12 pr-10" />
                    <span className="absolute right-3 top-3 text-sm text-gray-400">원</span>
                  </div>
                  <p className="text-xs text-gray-500">
                    자동 기본값 {formatWon(defaultFabricUnitCost)} · 면·린넨 등
                    10,000원, 데님·레더 15,000원
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fabric-unit-cost">원단비 (장당)</Label>
                  <div className="relative">
                    <Input
                      id="fabric-unit-cost"
                      type="number"
                      min={0}
                      disabled={!canEditSales}
                      value={funding.fabric_unit_cost ?? 0}
                      onChange={(event) =>
                        setFunding({
                          ...funding,
                          fabric_unit_cost: Math.max(
                            0,
                            Number(event.target.value),
                          ),
                        })
                      }
                      className="h-12 pr-10"
                    />
                    <span className="absolute right-3 top-3 text-sm text-gray-400">원</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="funding-days">진행 기간</Label>
                  <div className="relative">
                    <Input id="funding-days" type="number" min={1} max={90} disabled={!canEditSales} value={funding.funding_days}
                      onChange={(event) => setFunding({ ...funding, funding_days: Number(event.target.value) })} className="h-12 pr-10" />
                    <span className="absolute right-3 top-3 text-sm text-gray-400">일</span>
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-brand/20 bg-white">
                <div className="flex flex-col justify-between gap-4 bg-brand px-5 py-5 text-white sm:flex-row sm:items-end">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-bold text-white/80">
                      <TrendingUp className="h-4 w-4" />
                      펀딩 성공 시 예상 순이익
                    </p>
                    <p className="mt-2 text-2xl font-black tracking-tight md:text-3xl">
                      {estimating
                        ? "이전 견적 불러오는 중"
                        : netProfitMin == null || netProfitMax == null
                          ? "제작 견적 확인 필요"
                          : netProfitMin === netProfitMax
                            ? formatWon(netProfitMin)
                            : `${formatWon(netProfitMin)} ~ ${formatWon(netProfitMax)}`}
                    </p>
                  </div>
                  <p className="text-xs font-semibold text-white/75">
                    판매가·수량·원단비 입력 즉시 자동 계산
                  </p>
                </div>

                <div className="grid gap-x-8 gap-y-3 p-5 text-sm sm:grid-cols-2">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-gray-500">
                      목표 판매 총액 ({formatWon(sellingPrice)} × {targetQuantity}장)
                    </span>
                    <strong>{formatWon(expectedSales)}</strong>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-gray-500">
                      제작 공임·개발비 (원단 제외)
                    </span>
                    <strong>
                      {estimateTotalMin == null || estimateTotalMax == null
                        ? "확인 중"
                        : estimateTotalMin === estimateTotalMax
                          ? formatWon(estimateTotalMin)
                          : `${formatWon(estimateTotalMin)} ~ ${formatWon(estimateTotalMax)}`}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-gray-500">
                      원단비 ({formatWon(fabricUnitCost)} × {targetQuantity}장)
                    </span>
                    <strong>- {formatWon(fabricTotal)}</strong>
                  </div>
                  <div className="flex items-center justify-between gap-4 rounded-xl bg-amber-50 px-3 py-2 text-amber-900 sm:col-span-2">
                    <span className="font-bold">원단 포함 총 제작원가</span>
                    <strong>
                      {totalProductionCostMin == null ||
                      totalProductionCostMax == null
                        ? "견적 확인 필요"
                        : totalProductionCostMin === totalProductionCostMax
                          ? formatWon(totalProductionCostMin)
                          : `${formatWon(totalProductionCostMin)} ~ ${formatWon(totalProductionCostMax)}`}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-gray-500">펀딩 수수료 10%</span>
                    <strong>- {formatWon(fundingFee)}</strong>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-gray-500">제작 수수료 15%</span>
                    <strong>- {formatWon(productionFee)}</strong>
                  </div>
                  <div
                    className={`flex items-center justify-between gap-4 rounded-xl px-3 py-2 ${
                      netProfitMin != null && netProfitMin < 0
                        ? "bg-red-50 text-red-700"
                        : "bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    <span className="font-bold">내가 가져갈 순이익</span>
                    <strong>
                      {netProfitMin == null || netProfitMax == null
                        ? "견적 확인 필요"
                        : netProfitMin === netProfitMax
                          ? formatWon(netProfitMin)
                          : `${formatWon(netProfitMin)} ~ ${formatWon(netProfitMax)}`}
                    </strong>
                  </div>
                </div>

                <div className="flex gap-2 border-t border-brand/10 bg-brand/5 px-5 py-3 text-xs leading-5 text-gray-600">
                  <Calculator className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                  <p>
                    총 제작원가 = 이전 견적 + (장당 원단비 × 목표 수량) ·
                    순이익 = 목표 판매 총액 − 총 제작원가 − 펀딩 수수료 10% −
                    제작 수수료 15%
                  </p>
                </div>
              </div>

              <div className="rounded-2xl bg-gray-50 p-4 text-sm leading-6 text-gray-600">
                <div className="flex gap-3">
                  <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
                  <p>
                    <strong className="text-gray-900">{canEditSales ? "승인 전 전체 수정 가능" : "공개 펀딩 안전 편집"}</strong><br />
                    {canEditSales
                      ? "관리자가 승인하기 전까지 상품명, 설명, 옵션, 가격과 기간을 모두 수정할 수 있습니다."
                      : "고객이 본 조건을 보호하기 위해 승인 후에는 상품명과 상세 설명만 수정할 수 있습니다."}
                  </p>
                </div>
              </div>

              {canEditContent && (
                <Button onClick={handleSave} disabled={saving} className="h-12 w-full rounded-full bg-brand hover:bg-brand-dark">
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                  {canEditSales ? "저장하고 승인 대기" : "공개 페이지 내용 저장"}
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default FundingEditor;
