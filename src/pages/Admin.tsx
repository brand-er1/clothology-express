import { useEffect, useMemo, useState } from "react";
import { NavLink, Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Building2,
  Boxes,
  FileImage,
  FlaskConical,
  GalleryHorizontalEnd,
  Image,
  MessagesSquare,
  PackageCheck,
  Settings,
  Shirt,
  Users,
  WalletCards,
} from "lucide-react";
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
import { PortfolioProjectList } from "@/components/admin/PortfolioProjectList";
import { fetchAllPortfolioProjectsForAdmin } from "@/services/portfolioProjects";
import type { PortfolioProject } from "@/types/portfolio";
import { CommunityAdminPanel } from "@/components/admin/CommunityAdminPanel";
import { fetchAdminCommunityStats } from "@/services/community";
import { VisitorAnalyticsDashboard } from "@/components/admin/VisitorAnalyticsDashboard";
import { useAdminContext } from "@/components/admin/shell/AdminContext";
import { assignFundingBrand, fetchAdminBrands } from "@/services/brand";
import type { AdminBrandSummary } from "@/types/brand";

const DEFAULT_SYSTEM_PROMPT = `Produce one concise, production-ready prompt that captures garment type, material, color, fit, key design details, seasonality, and styling cues from the user request. Keep it ecommerce-focused, photorealistic, and avoid adding models, text overlays, or props. Keep language consistent with the user input.`;

// 신규 관리자 콘솔(/admin)의 "기타 운영 도구"(/admin/tools/*)로 이동한 기존 관리 화면들.
// 대시보드·브랜드는 신규 콘솔 메뉴로 대체되었고, 나머지 기능은 그대로 유지한다.
const sectionMeta = {
  orders: { label: "제작 의뢰", description: "바로 제작 요청을 검토하고 상태를 변경합니다.", icon: PackageCheck },
  fundings: { label: "펀딩 상세 검수", description: "상표 검수 결과와 브랜드 연결을 포함한 기존 펀딩 검토 화면입니다.", icon: WalletCards },
  customers: { label: "고객·방문 분석", description: "회원 정보와 방문 활동을 확인합니다.", icon: Users },
  visits: { label: "방문 통계", description: "기간별 방문 세션과 페이지뷰를 확인합니다.", icon: BarChart3 },
  images: { label: "이미지 생성", description: "고객이 생성한 AI 의류 이미지를 관리합니다.", icon: Image },
  closet: { label: "브랜더 옷장", description: "고객이 옷장에서 만들고 수정하고 입혀본 모든 활동을 확인합니다.", icon: Shirt },
  portfolio: { label: "포트폴리오", description: "Selected Works에 노출되는 프로젝트를 관리합니다.", icon: GalleryHorizontalEnd },
  swatches: { label: "원단 스와치", description: "원단 추천 신청과 진행 상태를 관리합니다.", icon: FlaskConical },
  community: { label: "커뮤니티 통계", description: "게시물·댓글·신고와 구매의향/펀딩 전환 현황을 관리합니다.", icon: MessagesSquare },
  settings: { label: "AI 설정", description: "이미지 생성용 시스템 프롬프트를 관리합니다. (Super Admin)", icon: Settings },
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
  const [portfolioProjects, setPortfolioProjects] = useState<PortfolioProject[]>([]);
  const [isLoadingPortfolioProjects, setIsLoadingPortfolioProjects] = useState(true);
  const [communityPendingReports, setCommunityPendingReports] = useState(0);
  const [brands, setBrands] = useState<AdminBrandSummary[]>([]);
  const { can } = useAdminContext();

  const section = useMemo<AdminSection>(() => {
    const value = location.pathname.split("/").filter(Boolean)[2] as AdminSection | undefined;
    return value && value in sectionMeta ? value : "orders";
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
    void loadPortfolioProjects();
    void loadCommunitySummary();
    void loadBrands();
  }, [isAdmin]);

  const loadCommunitySummary = async () => {
    try {
      const stats = await fetchAdminCommunityStats();
      setCommunityPendingReports(stats.pendingReports);
    } catch (error) {
      console.error("Error loading community summary:", error);
    }
  };

  const loadBrands = async () => {
    try { setBrands(await fetchAdminBrands()); }
    catch (error) {
      console.error("Error loading brands:", error);
      toast({ title: "브랜드 목록을 불러오지 못했습니다", variant: "destructive" });
    }
  };

  const loadOrders = async () => {
    try {
      // Uses the same SECURITY DEFINER RPC pattern as every other admin list
      // (get_admin_customers, get_admin_closet_activity, ...) rather than a
      // direct select — a guest order (user_id null) wasn't reliably visible
      // through the plain RLS-scoped select.
      const { data, error } = await supabase.rpc("get_admin_orders");
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

  const loadPortfolioProjects = async () => {
    try {
      setIsLoadingPortfolioProjects(true);
      setPortfolioProjects(await fetchAllPortfolioProjectsForAdmin());
    } catch (error) {
      console.error("Error loading portfolio projects:", error);
      toast({ title: "포트폴리오 목록을 불러오지 못했습니다", variant: "destructive" });
    } finally {
      setIsLoadingPortfolioProjects(false);
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

  const handleAssignFundingBrand = async (fundingId: string, brandId: string) => {
    setIsSaving(true);
    try {
      await assignFundingBrand(fundingId, brandId);
      const refreshed = await fetchAllFundings();
      setFundings(refreshed);
      setSelectedFunding(refreshed.find((item) => item.id === fundingId) || null);
      await loadBrands();
      toast({ title: "펀딩 제작자와 브랜드를 연결했습니다" });
    } catch (error) {
      toast({ title: "브랜드를 연결하지 못했습니다", description: getFundingErrorMessage(error), variant: "destructive" });
      throw error;
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

  if (isCheckingAdmin) return <p className="py-14 text-center text-sm text-stone-500">로딩 중...</p>;
  if (!isAdmin) return null;

  const counts: Record<AdminSection, number | null> = {
    customers: null,
    visits: null,
    images: generatedImages.length,
    closet: closetActivities.length,
    orders: orders.filter((order) => order.status === "pending").length,
    portfolio: portfolioProjects.length,
    swatches: fabricSwatchRequests.filter((request) => request.status === "pending").length,
    fundings: fundings.filter((funding) => funding.status === "pending").length,
    community: communityPendingReports || null,
    settings: null,
  };

  const currentMeta = sectionMeta[section];

  const visibleSections = (Object.keys(sectionMeta) as AdminSection[]).filter((key) => key !== "settings" || can("legacy.settings"));

  return (
    <div>
      <div className="mb-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#741b2b]">Operations tools</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.03em] text-stone-950 sm:text-[28px]">기타 운영 도구</h1>
        <p className="mt-1 text-sm text-stone-500">기존 관리자 화면(제작 의뢰, AI 이미지, 옷장, 포트폴리오, 스와치 등)을 그대로 제공합니다.</p>
      </div>
      <nav className="-mx-1 mb-5 flex gap-1 overflow-x-auto px-1 pb-1" aria-label="운영 도구">
        {visibleSections.map((key) => {
          const item = sectionMeta[key];
          const Icon = item.icon;
          return (
            <NavLink key={key} to={`/admin/tools/${key}`}
              className={() => `flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${section === key ? "bg-stone-900 text-white" : "bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-stone-100"}`}>
              <Icon className="h-3.5 w-3.5" />{item.label}
              {counts[key] ? <span className="rounded-full bg-[#741b2b] px-1.5 text-[10px] text-white">{counts[key]?.toLocaleString()}</span> : null}
            </NavLink>
          );
        })}
      </nav>
      <section className="min-w-0">
        <div className="mb-4 rounded-2xl border border-stone-200/80 bg-white px-5 py-4">
          <h2 className="text-lg font-extrabold text-stone-950">{currentMeta.label}</h2>
          <p className="mt-0.5 text-sm text-stone-500">{currentMeta.description}</p>
        </div>
        {section === "customers" && <CustomerManagement />}
        {section === "visits" && <VisitorAnalyticsDashboard />}
        {section === "images" && <GeneratedImageList images={generatedImages} isLoading={isLoadingGeneratedImages} />}
        {section === "closet" && <ClosetActivityList activities={closetActivities} isLoading={isLoadingClosetActivities} />}
        {section === "orders" && <OrderList orders={orders} onReviewOrder={(order) => { setSelectedOrder(order); setIsReviewDialogOpen(true); }} />}
        {section === "portfolio" && (
          <PortfolioProjectList
            projects={portfolioProjects}
            isLoading={isLoadingPortfolioProjects}
            onReload={loadPortfolioProjects}
          />
        )}
        {section === "swatches" && <FabricSwatchList requests={fabricSwatchRequests} isSaving={isSaving} onUpdate={handleUpdateFabricSwatch} />}
        {section === "fundings" && <FundingList fundings={fundings} onReview={(funding) => { setSelectedFunding(funding); setIsFundingReviewOpen(true); }} />}
        {section === "community" && <CommunityAdminPanel />}
        {section === "settings" && can("legacy.settings") && <SystemPromptEditor systemPrompt={systemPrompt} isLoading={isLoading} onSave={handleSaveSystemPrompt} />}
      </section>

      <OrderReviewDialog order={selectedOrder} isOpen={isReviewDialogOpen} isSaving={isSaving} onOpenChange={setIsReviewDialogOpen} onUpdateStatus={handleUpdateOrderStatus} />
      <FundingReviewDialog funding={selectedFunding} brands={brands} open={isFundingReviewOpen} saving={isSaving} onOpenChange={setIsFundingReviewOpen} onReview={handleReviewFunding} onAssignBrand={handleAssignFundingBrand} />
    </div>
  );
};

export default Admin;
