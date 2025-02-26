import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";
import { useAdmin } from "@/hooks/useAdmin";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

type Order = {
  id: string;
  created_at: string;
  user_id: string;
  status: 'pending' | 'approved' | 'rejected';
  cloth_type: string;
  material: string;
  style: string;
  pocket_type: string;
  color: string;
  detail_description: string;
  size: string;
  measurements: Record<string, number> | null;
  generated_image_url: string;
  admin_comment?: string;
};

const Admin = () => {
  const [systemPrompt, setSystemPrompt] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { isAdmin, isLoading: isCheckingAdmin } = useAdmin();
  const navigate = useNavigate();
  
  // 주문 관리 상태
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [adminComment, setAdminComment] = useState("");
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);

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

  const handleReviewOrder = (order: Order) => {
    setSelectedOrder(order);
    setAdminComment(order.admin_comment || "");
    setIsReviewDialogOpen(true);
  };

  const handleUpdateOrderStatus = async (status: 'approved' | 'rejected') => {
    if (!selectedOrder) return;

    try {
      setIsSaving(true);

      const { error } = await supabase
        .from('orders')
        .update({
          status,
          admin_comment: adminComment,
          reviewed_at: new Date().toISOString(),
          reviewed_by: (await supabase.auth.getUser()).data.user?.id,
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

  const handleSave = async () => {
    try {
      setIsSaving(true);
      
      const { error } = await supabase.functions.invoke('update-system-prompt', {
        body: { systemPrompt }
      });

      if (error) throw error;

      toast({
        title: "저장 완료",
        description: "시스템 프롬프트가 업데이트되었습니다.",
      });
      
      setIsEditing(false);
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
          <h1 className="text-3xl font-bold mb-8">관리자 설정</h1>
          
          {/* 시스템 프롬프트 섹션 */}
          <Card className="p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">이미지 생성 시스템 프롬프트</h2>
            <div className="space-y-4">
              {isLoading ? (
                <div className="h-[300px] flex items-center justify-center">
                  <p className="text-gray-500">로딩 중...</p>
                </div>
              ) : (
                <Textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  disabled={!isEditing}
                  className="min-h-[300px] font-mono text-sm"
                />
              )}
              
              <div className="flex justify-end gap-4">
                {!isEditing ? (
                  <Button onClick={() => setIsEditing(true)} disabled={isLoading}>
                    수정하기
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setIsEditing(false)}
                      disabled={isSaving}
                    >
                      취소
                    </Button>
                    <Button
                      onClick={handleSave}
                      disabled={isSaving}
                    >
                      {isSaving ? "저장 중..." : "저장하기"}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Card>

          {/* 주문 관리 섹션 */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">주문 관리</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>주문일시</TableHead>
                  <TableHead>의류 종류</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>상세</TableHead>
                  <TableHead>관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>
                      {new Date(order.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>{order.cloth_type}</TableCell>
                    <TableCell>
                      <span className={
                        order.status === 'approved' ? 'text-green-600' :
                        order.status === 'rejected' ? 'text-red-600' :
                        'text-yellow-600'
                      }>
                        {order.status === 'approved' ? '승인됨' :
                         order.status === 'rejected' ? '거부됨' :
                         '대기 중'}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {order.detail_description || '-'}
                    </TableCell>
                    <TableCell>
                      {order.status === 'pending' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleReviewOrder(order)}
                        >
                          검토하기
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      </main>

      {/* 주문 검토 다이얼로그 */}
      <Dialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>주문 검토</DialogTitle>
          </DialogHeader>
          
          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold mb-2">주문 정보</h3>
                  <dl className="space-y-2">
                    <div>
                      <dt className="text-sm text-gray-500">의류 종류</dt>
                      <dd>{selectedOrder.cloth_type}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-gray-500">소재</dt>
                      <dd>{selectedOrder.material}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-gray-500">스타일</dt>
                      <dd>{selectedOrder.style}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-gray-500">포켓</dt>
                      <dd>{selectedOrder.pocket_type}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-gray-500">색상</dt>
                      <dd>{selectedOrder.color}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-gray-500">사이즈</dt>
                      <dd>{selectedOrder.size}</dd>
                    </div>
                  </dl>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">생성된 이미지</h3>
                  {selectedOrder.generated_image_url && (
                    <img
                      src={selectedOrder.generated_image_url}
                      alt="Generated design"
                      className="w-full h-auto rounded-lg"
                    />
                  )}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">상세 설명</h3>
                <p className="text-sm">{selectedOrder.detail_description || '-'}</p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">검토 의견</h3>
                <Textarea
                  value={adminComment}
                  onChange={(e) => setAdminComment(e.target.value)}
                  placeholder="승인 또는 거부 사유를 입력하세요"
                  className="min-h-[100px]"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setIsReviewDialogOpen(false)}
              disabled={isSaving}
            >
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleUpdateOrderStatus('rejected')}
              disabled={isSaving || !adminComment}
            >
              거부하기
            </Button>
            <Button
              onClick={() => handleUpdateOrderStatus('approved')}
              disabled={isSaving}
            >
              승인하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Admin;
