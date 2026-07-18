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
import { fetchFunding, updateFunding } from "@/services/funding";
import type { Funding } from "@/types/funding";
import { ArrowLeft, Check, Eye, Loader2, LockKeyhole, Plus, Sparkles, Users, X } from "lucide-react";

const FundingEditor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [funding, setFunding] = useState<Funding | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newColor, setNewColor] = useState("");
  const [newSize, setNewSize] = useState("");

  useEffect(() => {
    if (!id) return;
    fetchFunding(id)
      .then(setFunding)
      .catch((error) => {
        console.error(error);
        toast({ title: "펀딩을 불러오지 못했습니다", variant: "destructive" });
        navigate("/fundings");
      })
      .finally(() => setLoading(false));
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

    setSaving(true);
    try {
      const updated = await updateFunding(id, {
        product_name: funding.product_name.trim(),
        description: funding.description,
        moq: funding.moq,
        price: funding.price,
        funding_days: funding.funding_days,
        color_options: funding.color_options,
        size_options: funding.size_options,
      });
      setFunding(updated);
      toast({ title: "펀딩 페이지가 저장되었습니다", description: "현재 관리자 승인 대기 상태입니다." });
    } catch (error) {
      console.error(error);
      toast({ title: "저장하지 못했습니다", description: "잠시 후 다시 시도해주세요.", variant: "destructive" });
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

  const editable = funding.status === "pending" || funding.status === "rejected";
  const colors = funding.color_options?.length ? funding.color_options : [funding.color || "기본 색상"];
  const sizes = funding.size_options?.length ? funding.size_options : [funding.size || "FREE"];

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
                  disabled={!editable}
                  onChange={(event) => setFunding({ ...funding, product_name: event.target.value })}
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">상품 상세 설명</Label>
                <Textarea
                  id="description"
                  value={funding.description || ""}
                  disabled={!editable}
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
                      disabled={!editable}
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
                    <Button type="button" variant="outline" size="icon" disabled={!editable} onClick={() => addOption("color")}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {colors.map((color) => (
                      <Badge key={color} variant="secondary" className="gap-1 rounded-full px-3 py-1.5">
                        {color}
                        {editable && <button type="button" onClick={() => removeOption("color", color)} aria-label={`${color} 삭제`}><X className="h-3 w-3" /></button>}
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
                      disabled={!editable}
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
                    <Button type="button" variant="outline" size="icon" disabled={!editable} onClick={() => addOption("size")}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {sizes.map((size) => (
                      <Badge key={size} variant="secondary" className="gap-1 rounded-full px-3 py-1.5">
                        {size}
                        {editable && <button type="button" onClick={() => removeOption("size", size)} aria-label={`${size} 삭제`}><X className="h-3 w-3" /></button>}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="moq">목표 수량</Label>
                  <div className="relative">
                    <Input id="moq" type="number" min={20} disabled={!editable} value={funding.moq}
                      onChange={(event) => setFunding({ ...funding, moq: Number(event.target.value) })} className="h-12 pr-10" />
                    <span className="absolute right-3 top-3 text-sm text-gray-400">장</span>
                  </div>
                  <p className="text-xs text-brand">최소 20장</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price">판매가</Label>
                  <div className="relative">
                    <Input id="price" type="number" min={0} disabled={!editable} value={funding.price ?? ""}
                      onChange={(event) => setFunding({ ...funding, price: event.target.value ? Number(event.target.value) : null })} className="h-12 pr-10" />
                    <span className="absolute right-3 top-3 text-sm text-gray-400">원</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="funding-days">진행 기간</Label>
                  <div className="relative">
                    <Input id="funding-days" type="number" min={1} max={90} disabled={!editable} value={funding.funding_days}
                      onChange={(event) => setFunding({ ...funding, funding_days: Number(event.target.value) })} className="h-12 pr-10" />
                    <span className="absolute right-3 top-3 text-sm text-gray-400">일</span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-gray-50 p-4 text-sm leading-6 text-gray-600">
                <div className="flex gap-3">
                  <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
                  <p><strong className="text-gray-900">승인 전 비공개</strong><br />관리자가 승인하기 전까지 작성자와 관리자만 이 페이지를 볼 수 있습니다.</p>
                </div>
              </div>

              {editable && (
                <Button onClick={handleSave} disabled={saving} className="h-12 w-full rounded-full bg-brand hover:bg-brand-dark">
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                  저장하고 승인 대기
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
