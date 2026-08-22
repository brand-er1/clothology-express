import { useEffect, useMemo, useState } from "react";
import { NavLink, Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Boxes,
  FileImage,
  FlaskConical,
  Image,
  PackageCheck,
  Settings,
  Shirt,
  Users,
  WalletCards,
} from "lucide-react";
import { Header } from "@/components/Header";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";
import { useAdmin } from "@/hooks/useAdmin";
import { SystemPromptEditor } from "@/components/admin/SystemPromptEditor";
import { OrderList } from "@/components/admin/OrderList";
import { OrderReviewDialog } from "@/components/admin/OrderReviewDialog";
import { type Order } from "@/types/order";
import { type Funding } from "@/types/funding";
import { FundingList } from "@/components/admin/FundingList";
import { FundingReviewDialog } from "@/components/admin/FundingReviewDialog";
import { fetchAllFundings, getFundingErrorMessage, reviewFunding as saveFundingReview } from "@/services/funding";
import { FabricSwatchList } from "@/components/admin/FabricSwatchList";
import { fetchAllFabricSwatchRequests, updateFabricSwatchRequest } from "@/services/fabricSwatch";
import type { FabricSwatchRequest, FabricSwatchStatus } from "@/types/fabricSwatch";
import { GeneratedImageList } from "@/components/admin/GeneratedImageList";
import type { AdminGeneratedImage } from "@/types/generatedImage";
import { CustomerManagement } from "@/components/admin/CustomerManagement";
import { ClosetActivityList } from "@/components/admin/ClosetActivityList";
import type { AdminClosetActivity } from "@/types/closetActivity";

const DEFAULT_SYSTEM_PROMPT = `Produce one concise, production-ready prompt that captures garment type, material, color, fit, key design details, seasonality, and styling cues from the user request. Keep it ecommerce-focused, photorealistic, and avoid adding models, text overlays, or props. Keep language consistent with the user input.`;

const sectionMeta = {
  dashboard: { label: "대시보드", description: "전체 운영 현황을 빠르게 확인합니다.", icon: BarChart3 },
  customers: { label: "고객 관리", description: "회원 정보와 방문 활동을 확인합니다.", icon: Users },
  images: { label: "이미지 생성", description: "고객이 생성한 AI 의류 이미지를 관리합니다.", icon: Image },
  closet: { label: "브랜더 옷장", description: "고객이 옷장에서 만들고 수정하고 입혀본 모든 활동을 확인합니다.", icon: Shirt },
  orders: { label: "제작 의뢰", description: "바로 제작 요청을 검토하고 상태를 변경합니다.", icon: PackageCheck },
  swatches: { label: "원단 스와치", description: "원단 추천 신청과 진행 상태를 관리합니다.", icon: FlaskConical },
  fundings: { label: "펀딩 관리", description: "펀딩 승인 요청과 진행 상태를 확인합니다.", icon: WalletCards },
  settings: { label: "AI 설정", description: "이미지 생성용 시스템 프롬프트를 관리합니다.", icon: Settings },
} as const;

type AdminSection = keyof typeof sectionMeta;

const Admin = () => {
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { isAdmin, isLoading: isCheckingAdmin } = useAdmin();
  const navigate = useNavigate();
  const location = useLocation();

  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [fundings, setFundings] = useState<Funding[]>([]);
  const [selectedFunding, setSelectedFunding] = useState<Funding | null>(null);
  const [isFundingReviewOpen, setIsFundingReviewOpen] = useState(false);
  const [fabricSwatchRequests, setFabricSwatchRequests] = useState<FabricSwatchRequest[]>([]);
  const [generatedImages, setGeneratedImages] = useState<AdminGeneratedImage[]>([]);
  const [isLoadingGeneratedImages, setIsLoadingGeneratedImages] = useState(true);
  const [closetActivities, setClosetActivities] = useState<AdminClosetActivity[]>([]);
  const [isLoadingClosetActivities, setIsLoadingClosetActivities] = useState(true);

  const section = useMemo<AdminSection>(() => {
    const value = location.pathname.split("/").filter(Boolean)[1] as AdminSection | undefined;
    return value && value in sectionMeta ? value : "dashboard";
  }, [location.pathname]);

  useEffect(() => {
    if (!isCheckingAdmin && !isAdmin) {
      toast({ title: "접근 권한이 없습니다", description: "관리자만 접근할 수 있는 페이지입니다.", variant: "destructive" });
      navigate("/");
    }
  }, [isAdmin, isCheckingAdmin, navigate]);

  useEffect(() => {
    if (!isAdmin) return;
    void loadSystemPrompt();
    void loadOrders();
    void loadFundings();
    void loadFabricSwatchRequests();
    void loadGeneratedImages();
    void loadClosetActivities();
  }, [isAdmin]);

  const loadOrders = async () => {
    try {
      const { data, error } = await supabase.from("orders").select("*").neq("status", "draft").neq("status", "deleted").order("created_at", { ascending: false });
      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error("Error loading orders:", error);
      toast({ title: "오류", description: "바로 제작 의뢰 목록을 불러오는데 실패했습니다.", variant: "destructive" });
    }
  };

  const loadSystemPrompt = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.from("system_prompts").select("prompt").order("created_at", { ascending: false }).limit(1);
      if (error) throw error;
      setSystemPrompt(data?.[0]?.prompt || DEFAULT_SYSTEM_PROMPT);
    } catch (error) {
      console.error("Error loading system prompt:", error);
      toast({ title: "오류", description: "시스템 프롬프트를 불러오는데 실패했습니다.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const loadFundings = async () => {
    try { setFundings(await fetchAllFundings()); }
    catch (error) {
      console.error("Error loading fundings:", error);
      toast({ title: "펀딩 목록을 불러오지 못했습니다", variant: "destructive" });
    }
  };

  const loadFabricSwatchRequests = async () => {
    try { setFabricSwatchRequests(await fetchAllFabricSwatchRequests()); }
    catch (error) {
      console.error("Error loading fabric swatch requests:", error);
      toast({ title: "원단 스와치 신청을 불러오지 못했습니다", variant: "destructive" });
    }
  };

  const loadGeneratedImages = async () => {
    try {
      setIsLoadingGeneratedImages(true);
      const { data, error } = await supabase.rpc("get_admin_generated_images");
      if (error) throw error;
      setGeneratedImages((data || []) as AdminGeneratedImage[]);
    } catch (error) {
      console.error("Error loading generated images:", error);
      toast({ title: "AI 생성 이미지 내역을 불러오지 못했습니다", variant: "destructive" });
    } finally {
      setIsLoadingGeneratedImages(false);
    }
  };

  const loadClosetActivities = async () => {
    try {
      setIsLoadingClosetActivities(true);
      const { data, error } = await supabase.rpc("get_admin_closet_activity", { p_limit: 500 });
      if (error) throw error;
      setClosetActivities((data || []) as AdminClosetActivity[]);
    } catch (error) {
      console.error("Error loading closet activity:", error);
      toast({ title: "브랜더 옷장 활동 내역을 불러오지 못했습니다", variant: "destructive" });
    } finally {
      setIsLoadingClosetActivities(false);
    }
  };

  const handleUpdateFabricSwatch = async (request: FabricSwatchRequest, status: FabricSwatchStatus, adminNote: string) => {
    try {
      setIsSaving(true);
      await updateFabricSwatchRequest(request.id, status, adminNote);
      toast({ title: "원단 스와치 진행 상태를 저장했습니다" });
      await loadFabricSwatchRequests();
    } catch (error) {
      console.error("Error updating fabric swatch request:", error);
      toast({ title: "원단 스와치 상태를 저장하지 못했습니다", variant: "destructive" });
      throw error;
    } finally { setIsSaving(false); }
  };

  const handleReviewFunding = async (
    status: "approved" | "rejected",
    comment: string,
    reviewValues: Pick<Funding, "moq" | "price">,
  ) => {
    if (!selectedFunding) return;
    setIsSaving(true);
    try {
      await saveFundingReview(selectedFunding.id, status, comment, reviewValues);
      toast({ title: status === "approved" ? "펀딩을 승인했습니다" : "펀딩을 거절했습니다" });
      setIsFundingReviewOpen(false);
      setSelectedFunding(null);
      await loadFundings();
    } catch (error) {
      toast({ title: "펀딩 상태를 변경하지 못했습니다", description: getFundingErrorMessage(error), variant: "destructive" });
    } finally { setIsSaving(false); }
  };

  const handleSaveSystemPrompt = async (newPrompt: string) => {
    try {
      setIsSaving(true);
      const { error } = await supabase.functions.invoke("update-system-prompt", { body: { systemPrompt: newPrompt } });
      if (error) throw error;
      setSystemPrompt(newPrompt);
      toast({ title: "저장 완료", description: "시스템 프롬프트가 업데이트되었습니다." });
    } catch (error) {
      console.error("Error saving system prompt:", error);
      toast({ title: "오류", description: "시스템 프롬프트 저장에 실패했습니다.", variant: "destructive" });
    } finally { setIsSaving(false); }
  };

  const handleUpdateOrderStatus = async (status: "approved" | "rejected", comment: string) => {
    if (!selectedOrder) return;
    try {
      setIsSaving(true);
      const { data } = await supabase.auth.getSession();
      const { error } = await supabase.from("orders").update({ status, admin_comment: comment, reviewed_at: new Date().toISOString(), reviewed_by: data.session?.user?.id }).eq("id", selectedOrder.id);
      if (error) throw error;
      toast({ title: status === "approved" ? "제작 의뢰를 접수했습니다" : "진행 불가로 처리했습니다" });
      setIsReviewDialogOpen(false);
      await loadOrders();
    } catch (error) {
      console.error("Error updating order status:", error);
      toast({ title: "오류", description: "제작 의뢰 상태를 변경하지 못했습니다.", variant: "destructive" });
    } finally { setIsSaving(false); }
  };

  if (isCheckingAdmin) return <div className="min-h-screen bg-gray-50"><Header /><main className="container mx-auto px-4 pb-12 pt-24"><p className="text-center text-gray-500">로딩 중...</p></main></div>;
  if (!isAdmin) return null;

  const counts: Record<AdminSection, number | null> = {
    dashboard: null,
    customers: null,
    images: generatedImages.length,
    closet: closetActivities.length,
    orders: orders.filter((order) => order.status === "pending").length,
    swatches: fabricSwatchRequests.filter((request) => request.status === "pending").length,
    fundings: fundings.filter((funding) => funding.status === "pending").length,
    settings: null,
  };

  const dashboardCards = [
    { section: "customers" as const, label: "고객 관리", value: "회원·방문", icon: Users },
    { section: "images" as const, label: "전체 이미지 생성", value: generatedImages.length.toLocaleString(), icon: FileImage },
    { section: "closet" as const, label: "브랜더 옷장 활동", value: closetActivities.length.toLocaleString(), icon: Shirt },
    { section: "orders" as const, label: "신규 제작 의뢰", value: counts.orders?.toLocaleString() || "0", icon: PackageCheck },
    { section: "swatches" as const, label: "신규 스와치 신청", value: counts.swatches?.toLocaleString() || "0", icon: FlaskConical },
    { section: "fundings" as const, label: "펀딩 승인 대기", value: counts.fundings?.toLocaleString() || "0", icon: WalletCards },
  ];

  const currentMeta = sectionMeta[section];

  return (
    <div className="min-h-screen bg-[#f4f0ea]">
      <Header />
      <main className="mx-auto max-w-[1500px] px-4 pb-16 pt-24 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
          <aside className="h-fit rounded-3xl border border-stone-200 bg-stone-950 p-3 text-white shadow-xl lg:sticky lg:top-24">
            <div className="px-3 pb-4 pt-3">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-stone-400">Brand-er operations</p>
              <h1 className="mt-2 text-xl font-black">관리자 센터</h1>
            </div>
            <nav className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-1">
              {(Object.keys(sectionMeta) as AdminSection[]).map((key) => {
                const item = sectionMeta[key];
                const Icon = item.icon;
                return (
                  <NavLink key={key} to={key === "dashboard" ? "/admin" : `/admin/${key}`} end={key === "dashboard"}
                    className={({ isActive }) => `flex min-h-12 items-center justify-between rounded-2xl px-3 py-2 text-sm font-bold transition ${isActive ? "bg-white text-stone-950" : "text-stone-300 hover:bg-white/10 hover:text-white"}`}>
                    <span className="flex items-center gap-2"><Icon className="h-4 w-4" />{item.label}</span>
                    {counts[key] !== null && <span className="rounded-full bg-brand px-2 py-0.5 text-xs text-white">{counts[key]?.toLocaleString()}</span>}
                  </NavLink>
                );
              })}
            </nav>
          </aside>

          <section className="min-w-0">
            <div className="mb-6 rounded-3xl border border-stone-200 bg-white px-5 py-6 shadow-sm sm:px-7">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">Admin workspace</p>
              <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-stone-950">{currentMeta.label}</h2>
              <p className="mt-2 text-sm text-stone-500">{currentMeta.description}</p>
            </div>

            {section === "dashboard" && (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {dashboardCards.map(({ section: target, label, value, icon: Icon }) => (
                  <NavLink key={target} to={`/admin/${target}`} className="group rounded-3xl border border-stone-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-brand hover:shadow-lg">
                    <div className="flex items-start justify-between"><div><p className="text-sm font-bold text-stone-500">{label}</p><p className="mt-3 text-3xl font-black text-stone-950">{value}</p></div><span className="rounded-2xl bg-stone-100 p-3 group-hover:bg-brand/10"><Icon className="h-6 w-6 text-brand" /></span></div>
                    <p className="mt-5 text-sm font-bold text-brand">페이지 열기 →</p>
                  </NavLink>
                ))}
              </div>
            )}
            {section === "customers" && <CustomerManagement />}
            {section === "images" && <GeneratedImageList images={generatedImages} isLoading={isLoadingGeneratedImages} />}
            {section === "closet" && <ClosetActivityList activities={closetActivities} isLoading={isLoadingClosetActivities} />}
            {section === "orders" && <OrderList orders={orders} onReviewOrder={(order) => { setSelectedOrder(order); setIsReviewDialogOpen(true); }} />}
            {section === "swatches" && <FabricSwatchList requests={fabricSwatchRequests} isSaving={isSaving} onUpdate={handleUpdateFabricSwatch} />}
            {section === "fundings" && <FundingList fundings={fundings} onReview={(funding) => { setSelectedFunding(funding); setIsFundingReviewOpen(true); }} />}
            {section === "settings" && <SystemPromptEditor systemPrompt={systemPrompt} isLoading={isLoading} onSave={handleSaveSystemPrompt} />}
          </section>
        </div>
      </main>

      <OrderReviewDialog order={selectedOrder} isOpen={isReviewDialogOpen} isSaving={isSaving} onOpenChange={setIsReviewDialogOpen} onUpdateStatus={handleUpdateOrderStatus} />
      <FundingReviewDialog funding={selectedFunding} open={isFundingReviewOpen} saving={isSaving} onOpenChange={setIsFundingReviewOpen} onReview={handleReviewFunding} />
    </div>
  );
};

export default Admin;
