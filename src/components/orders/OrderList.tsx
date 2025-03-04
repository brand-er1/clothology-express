
import { useState } from "react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Order } from "@/types/order";
import { OrderDetails } from "./OrderDetails";
import { ShoppingBag, Clock, CheckCircle, XCircle, Trash2, AlertTriangle } from "lucide-react";

interface OrderListProps {
  orders: Order[];
  onDeleteOrder?: (orderId: string) => Promise<void>;
}

export const OrderList = ({ orders, onDeleteOrder }: OrderListProps) => {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'approved':
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" /> 승인됨</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500"><XCircle className="h-3 w-3 mr-1" /> 거부됨</Badge>;
      case 'draft':
        return <Badge className="bg-blue-500">임시저장</Badge>;
      default:
        return <Badge className="bg-yellow-500"><Clock className="h-3 w-3 mr-1" /> 검토중</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleDelete = async () => {
    if (!orderToDelete || !onDeleteOrder) return;
    
    setIsDeleting(true);
    try {
      await onDeleteOrder(orderToDelete.id);
      setOrderToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const canDelete = (status: string) => {
    return status === 'pending' || status === 'rejected' || status === 'draft';
  };

  if (orders.length === 0) {
    return (
      <Card className="w-full">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <ShoppingBag className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium">주문 내역이 없습니다</h3>
            <p className="text-sm text-gray-500 mt-2">
              아직 주문한 상품이 없습니다. 맞춤 주문을 통해 나만의 의류를 만들어보세요.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>나의 주문 내역</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>주문일자</TableHead>
                  <TableHead>의류 종류</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>상세정보</TableHead>
                  <TableHead>관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>{formatDate(order.created_at)}</TableCell>
                    <TableCell>{order.cloth_type}</TableCell>
                    <TableCell>{getStatusBadge(order.status)}</TableCell>
                    <TableCell>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setSelectedOrder(order)}
                      >
                        상세보기
                      </Button>
                    </TableCell>
                    <TableCell>
                      {canDelete(order.status) && onDeleteOrder && (
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => setOrderToDelete(order)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" /> 삭제
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {selectedOrder && (
        <OrderDetails 
          order={selectedOrder} 
          onClose={() => setSelectedOrder(null)} 
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!orderToDelete} onOpenChange={(open) => !open && setOrderToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>주문 삭제 확인</DialogTitle>
            <DialogDescription>
              정말로 이 주문을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          
          {orderToDelete && (
            <div className="py-4">
              <div className="flex items-center justify-center text-amber-500 mb-4">
                <AlertTriangle className="h-12 w-12" />
              </div>
              <div className="space-y-2">
                <p><span className="font-medium">주문일시:</span> {formatDate(orderToDelete.created_at)}</p>
                <p><span className="font-medium">의류 종류:</span> {orderToDelete.cloth_type}</p>
                <p><span className="font-medium">상태:</span> {getStatusBadge(orderToDelete.status)}</p>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setOrderToDelete(null)}>
              취소
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDelete} 
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              삭제하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
