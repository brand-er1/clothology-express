
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { fetchAllFundings, reviewFunding as saveFundingReview } from "@/services/funding";

const DEFAULT_SYSTEM_PROMPT = `Produce one concise, production-ready prompt that captures garment type, material, color, fit, key design details, seasonality, and styling cues from the user request. Keep it ecommerce-focused, photorealistic, and avoid adding models, text overlays, or props. Keep language consistent with the user input.`;

const Admin = () => {
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { isAdmin, isLoading: isCheckingAdmin } = useAdmin();
  const navigate = useNavigate();
  
  // 주문 관리 상태
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [fundings, setFundings] = useState<Funding[]>([]);
  const [selectedFunding, setSelectedFunding] = useState<Funding | null>(null);
  const [isFundingReviewOpen, setIsFundingReviewOpen] = useState(false);

  useEffect(() => {
    if (!isCheckingAdmin && !isAdmin) {
      toast({
        title: "접근 권한이 없습니다",
        description: "관리자만 접근할 수 있는 페이지입니다.",
        variant: "destructive",
      });
      navigate("/");
    }
  }, [isAdmin, isCheckingAdmin, navigate]);

  useEffect(() => {
    if (isAdmin) {
      loadSystemPrompt();
      loadOrders();
      loadFundings();
    }
  }, [isAdmin]);

  const loadOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error loading orders:', error);
      toast({
        title: "오류",
        description: "주문 목록을 불러오는데 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  const loadSystemPrompt = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('system_prompts')
        .select('prompt')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        setSystemPrompt(data[0].prompt);
      } else {
        setSystemPrompt(DEFAULT_SYSTEM_PROMPT);
      }
    } catch (error) {
      console.error('Error loading system prompt:', error);
      toast({
        title: "오류",
        description: "시스템 프롬프트를 불러오는데 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadFundings = async () => {
    try {
      setFundings(await fetchAllFundings());
    } catch (error) {
      console.error("Error loading fundings:", error);
      toast({ title: "펀딩 목록을 불러오지 못했습니다", variant: "destructive" });
    }
  };

  const handleReviewFunding = async (status: "approved" | "rejected", comment: string) => {
    if (!selectedFunding) return;

    setIsSaving(true);
    try {
      await saveFundingReview(selectedFunding.id, status, comment);
      toast({
        title: status === "approved" ? "펀딩을 승인했습니다" : "펀딩을 거절했습니다",
        description: status === "approved" ? "공개 펀딩 목록에 노출됩니다." : "작성자에게 수정 요청 상태로 표시됩니다.",
      });
      setIsFundingReviewOpen(false);
      setSelectedFunding(null);
      await loadFundings();
    } catch (error) {
      console.error("Error reviewing funding:", error);
      toast({ title: "펀딩 상태를 변경하지 못했습니다", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSystemPrompt = async (newPrompt: string) => {
    try {
      setIsSaving(true);
      
      const { error } = await supabase.functions.invoke('update-system-prompt', {
        body: { systemPrompt: newPrompt }
      });

      if (error) throw error;

      setSystemPrompt(newPrompt);
      toast({
        title: "저장 완료",
        description: "시스템 프롬프트가 업데이트되었습니다.",
      });
    } catch (error) {
      console.error('Error saving system prompt:', error);
      toast({
        title: "오류",
        description: "시스템 프롬프트 저장에 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateOrderStatus = async (status: 'approved' | 'rejected', comment: string) => {
    if (!selectedOrder) return;

    try {
      setIsSaving(true);

      const { data } = await supabase.auth.getSession(); 
      const user = data.session?.user;

      const { error } = await supabase
        .from('orders')
        .update({
          status,
          admin_comment: comment,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id,
        })
        .eq('id', selectedOrder.id);

      if (error) throw error;

      toast({
        title: "상태 업데이트 완료",
        description: `주문이 ${status === 'approved' ? '승인' : '거부'}되었습니다.`,
      });

      setIsReviewDialogOpen(false);
      loadOrders();
    } catch (error) {
      console.error('Error updating order status:', error);
      toast({
        title: "오류",
        description: "주문 상태 업데이트에 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isCheckingAdmin) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="container mx-auto px-4 pt-24 pb-12">
          <div className="flex items-center justify-center">
            <p className="text-gray-500">로딩 중...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">브랜더 관리자</h1>
          
          <SystemPromptEditor
            systemPrompt={systemPrompt}
            isLoading={isLoading}
            onSave={handleSaveSystemPrompt}
          />

          <div className="my-8">
            <FundingList
              fundings={fundings}
              onReview={(funding) => {
                setSelectedFunding(funding);
                setIsFundingReviewOpen(true);
              }}
            />
          </div>

          <OrderList
            orders={orders}
            onReviewOrder={(order) => {
              setSelectedOrder(order);
              setIsReviewDialogOpen(true);
            }}
          />

          <OrderReviewDialog
            order={selectedOrder}
            isOpen={isReviewDialogOpen}
            isSaving={isSaving}
            onOpenChange={setIsReviewDialogOpen}
            onUpdateStatus={handleUpdateOrderStatus}
          />

          <FundingReviewDialog
            funding={selectedFunding}
            open={isFundingReviewOpen}
            saving={isSaving}
            onOpenChange={setIsFundingReviewOpen}
            onReview={handleReviewFunding}
          />
        </div>
      </main>
    </div>
  );
};

export default Admin;
