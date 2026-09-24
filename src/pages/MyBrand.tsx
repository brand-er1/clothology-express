import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, ExternalLink, Loader2, Save, XCircle } from "lucide-react";
import { Header } from "@/components/Header";
import { BrandImageUpload } from "@/components/brand/BrandImageUpload";
import { BrandIdentity } from "@/components/brand/BrandIdentity";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import {
  fetchLegacyBrandDefaults,
  fetchMyBrand,
  getBrandErrorMessage,
  isBrandNameAvailable,
  normalizeBrandName,
  saveMyBrand,
} from "@/services/brand";
import type { BrandProfileInput, BrandWithCreator } from "@/types/brand";

const EMPTY_FORM: BrandProfileInput = {
  displayName: "",
  profileImageUrl: null,
  creatorBio: "",
  brandName: "",
  brandLogoUrl: null,
  shortDescription: "",
  description: "",
  instagramUrl: "",
  websiteUrl: "",
};

const MyBrand = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [brand, setBrand] = useState<BrandWithCreator | null>(null);
  const [form, setForm] = useState<BrandProfileInput>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [availability, setAvailability] = useState<"idle" | "checking" | "available" | "taken">("idle");

  useEffect(() => {
    const load = async () => {
      try {
        const [current, legacy] = await Promise.all([fetchMyBrand(), fetchLegacyBrandDefaults()]);
        setBrand(current);
        setForm(current ? {
          displayName: current.creator_profile?.display_name || legacy.displayName,
          profileImageUrl: current.creator_profile?.profile_image_url || legacy.profileImageUrl,
          creatorBio: current.creator_profile?.bio || legacy.creatorBio,
          brandName: current.brand_name,
          brandLogoUrl: current.brand_logo_url,
          shortDescription: current.short_description || "",
          description: current.description || "",
          instagramUrl: current.instagram_url || "",
          websiteUrl: current.website_url || "",
        } : { ...EMPTY_FORM, ...legacy });
      } catch (error) {
        toast({ title: "브랜드 정보를 불러오지 못했습니다", description: getBrandErrorMessage(error), variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  useEffect(() => {
    const name = form.brandName.trim();
    if (!name) {
      setAvailability("idle");
      return;
    }
    if (brand && normalizeBrandName(name) === brand.normalized_brand_name) {
      setAvailability("available");
      return;
    }
    setAvailability("checking");
    const timer = window.setTimeout(() => {
      void isBrandNameAvailable(name, brand?.id)
        .then((available) => setAvailability(available ? "available" : "taken"))
        .catch(() => setAvailability("idle"));
    }, 400);
    return () => window.clearTimeout(timer);
  }, [brand, form.brandName]);

  const previewBrand = useMemo<BrandWithCreator | null>(() => {
    if (!form.brandName.trim() && !brand) return null;
    return {
      ...(brand || {
        id: "preview",
        owner_user_id: "preview",
        creator_profile_user_id: "preview",
        normalized_brand_name: normalizeBrandName(form.brandName),
        status: "active" as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
      brand_name: form.brandName.trim() || "브랜드명",
      brand_logo_url: form.brandLogoUrl,
      short_description: form.shortDescription || null,
      description: form.description || null,
      instagram_url: form.instagramUrl || null,
      website_url: form.websiteUrl || null,
      creator_profile: {
        user_id: brand?.owner_user_id || "preview",
        display_name: form.displayName.trim() || "제작자명",
        profile_image_url: form.profileImageUrl,
        bio: form.creatorBio || null,
        created_at: brand?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    };
  }, [brand, form]);

  const setField = <K extends keyof BrandProfileInput>(key: K, value: BrandProfileInput[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.displayName.trim() || !form.brandName.trim()) {
      toast({ title: "제작자명과 브랜드명을 입력해주세요", variant: "destructive" });
      return;
    }
    const available = await isBrandNameAvailable(form.brandName, brand?.id);
    if (!available) {
      setAvailability("taken");
      toast({ title: "이미 사용 중인 브랜드명입니다.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const saved = await saveMyBrand(form);
      setBrand(saved);
      setAvailability("available");
      toast({ title: brand ? "브랜드 프로필을 수정했습니다" : "내 브랜드를 등록했습니다" });
      const requested = searchParams.get("returnTo");
      const safeReturn = requested?.startsWith("/") && !requested.startsWith("//") ? requested : null;
      if (safeReturn) navigate(safeReturn, { replace: true });
    } catch (error) {
      toast({ title: "브랜드 정보를 저장하지 못했습니다", description: getBrandErrorMessage(error), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-[#f4f0ea]"><Header /><div className="flex min-h-screen items-center justify-center text-stone-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" />브랜드 정보를 불러오는 중입니다</div></div>;
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f4f0ea] text-[#211b1c]">
      <Header />
      <main className="mx-auto w-full max-w-5xl px-4 pb-24 pt-24 sm:px-6">
        <Link to="/profile" className="inline-flex items-center text-sm text-stone-500 hover:text-brand"><ArrowLeft className="mr-1 h-4 w-4" />마이페이지</Link>
        <div className="mt-6 grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <form onSubmit={handleSubmit} className="min-w-0 space-y-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">Creator & brand</p>
              <h1 className="mt-3 text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">{brand ? "내 브랜드 수정" : "내 브랜드 등록"}</h1>
              <p className="mt-3 text-sm leading-6 text-stone-500">이 정보는 펀딩 카드와 상세페이지에 제작자 정보로 공개됩니다.</p>
            </div>

            <section className="min-w-0 rounded-3xl border border-stone-200 bg-white p-5 sm:p-7">
              <h2 className="text-xl font-bold">제작자 프로필</h2>
              <div className="mt-5 grid min-w-0 gap-4 sm:grid-cols-2">
                <BrandImageUpload label="프로필 사진" kind="profile" value={form.profileImageUrl} onChange={(url) => setField("profileImageUrl", url)} />
                <div className="space-y-4">
                  <div className="space-y-2"><Label htmlFor="creator-name">제작자명 또는 닉네임 *</Label><Input id="creator-name" maxLength={60} value={form.displayName} onChange={(e) => setField("displayName", e.target.value)} className="h-12 rounded-xl" /></div>
                  <div className="space-y-2"><Label htmlFor="creator-bio">제작자 소개</Label><Textarea id="creator-bio" maxLength={500} value={form.creatorBio} onChange={(e) => setField("creatorBio", e.target.value)} className="min-h-24 rounded-xl" /></div>
                </div>
              </div>
            </section>

            <section className="min-w-0 rounded-3xl border border-stone-200 bg-white p-5 sm:p-7">
              <h2 className="text-xl font-bold">브랜드 정보</h2>
              <div className="mt-5 grid min-w-0 gap-5 sm:grid-cols-2">
                <BrandImageUpload label="브랜드 로고" kind="logo" value={form.brandLogoUrl} onChange={(url) => setField("brandLogoUrl", url)} />
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="brand-name">브랜드명 *</Label>
                  <Input id="brand-name" maxLength={80} value={form.brandName} onChange={(e) => setField("brandName", e.target.value)} className="h-12 rounded-xl" placeholder="예: FENRAX" />
                  <div className="min-h-5 text-xs">
                    {availability === "checking" && <span className="text-stone-500">중복 확인 중...</span>}
                    {availability === "available" && <span className="inline-flex items-center text-emerald-600"><CheckCircle2 className="mr-1 h-3.5 w-3.5" />사용 가능한 브랜드명입니다.</span>}
                    {availability === "taken" && <span className="inline-flex items-center text-red-600"><XCircle className="mr-1 h-3.5 w-3.5" />이미 사용 중인 브랜드명입니다.</span>}
                  </div>
                </div>
              </div>
              <div className="mt-5 space-y-5">
                <div className="space-y-2"><Label htmlFor="short-description">브랜드 한 줄 소개</Label><Input id="short-description" maxLength={120} value={form.shortDescription} onChange={(e) => setField("shortDescription", e.target.value)} className="h-12 rounded-xl" /></div>
                <div className="space-y-2"><Label htmlFor="brand-description">브랜드 상세 소개</Label><Textarea id="brand-description" maxLength={3000} value={form.description} onChange={(e) => setField("description", e.target.value)} className="min-h-40 rounded-xl" /></div>
                <div className="grid min-w-0 gap-5 sm:grid-cols-2">
                  <div className="min-w-0 space-y-2"><Label htmlFor="instagram">Instagram 또는 SNS</Label><Input id="instagram" type="url" value={form.instagramUrl} onChange={(e) => setField("instagramUrl", e.target.value)} className="h-12 min-w-0 rounded-xl" placeholder="https://instagram.com/..." /></div>
                  <div className="min-w-0 space-y-2"><Label htmlFor="website">브랜드 웹사이트</Label><Input id="website" type="url" value={form.websiteUrl} onChange={(e) => setField("websiteUrl", e.target.value)} className="h-12 min-w-0 rounded-xl" placeholder="https://..." /></div>
                </div>
              </div>
            </section>

            <Button type="submit" disabled={saving || availability === "taken" || availability === "checking"} className="h-14 w-full rounded-full bg-brand text-base font-bold hover:bg-brand-dark">
              {saving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}{saving ? "저장 중" : "브랜드 프로필 저장"}
            </Button>
          </form>

          <aside className="min-w-0 lg:sticky lg:top-24 lg:h-fit">
            <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">펀딩 노출 미리보기</p>
              <div className="mt-5"><BrandIdentity brand={previewBrand} linked={false} /></div>
              <p className="mt-5 text-sm leading-6 text-stone-500">{form.shortDescription || "브랜드 한 줄 소개가 여기에 표시됩니다."}</p>
              {brand && <Button asChild variant="outline" className="mt-5 w-full rounded-full"><Link to={`/brands/${brand.id}`}>공개 프로필 보기 <ExternalLink className="ml-2 h-4 w-4" /></Link></Button>}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
};

export default MyBrand;
