
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Order } from "@/types/order";
import { CheckCircle, XCircle, Clock } from "lucide-react";

interface OrderDetailsProps {
  order: Order;
  onClose: () => void;
}

export const OrderDetails = ({ order, onClose }: OrderDetailsProps) => {
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

  return (
    <Dialog open={!!order} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>주문 상세 정보</DialogTitle>
          <DialogDescription>
            주문일시: {formatDate(order.created_at)}
            <span className="ml-2">{getStatusBadge(order.status)}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 왼쪽: 주문 정보 */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">기본 정보</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-gray-500">의류 종류:</span>
              <span>{order.cloth_type}</span>
              
              <span className="text-gray-500">소재:</span>
              <span>{order.material}</span>
              
              <span className="text-gray-500">스타일:</span>
              <span>{order.style}</span>
              
              <span className="text-gray-500">주머니 타입:</span>
              <span>{order.pocket_type}</span>
              
              <span className="text-gray-500">색상:</span>
              <span>{order.color}</span>
              
              <span className="text-gray-500">사이즈:</span>
              <span>{order.size}</span>
            </div>

            {order.detail_description && (
              <div className="mt-4">
                <h4 className="text-md font-medium">추가 디테일</h4>
                <p className="mt-1 text-sm whitespace-pre-wrap">{order.detail_description}</p>
              </div>
            )}

            {/* 측정 정보가 있는 경우에만 표시 */}
            {order.measurements && Object.keys(order.measurements).length > 0 && (
              <div className="mt-4">
                <h4 className="text-md font-medium">맞춤 측정 정보</h4>
                <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                  {Object.entries(order.measurements).map(([key, value]) => (
                    <React.Fragment key={key}>
                      <span className="text-gray-500">{key}:</span>
                      <span>{value}</span>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}

            {/* 관리자 코멘트가 있는 경우에만 표시 */}
            {order.admin_comment && (
              <div className="mt-4">
                <h4 className="text-md font-medium">관리자 코멘트</h4>
                <p className="mt-1 text-sm p-2 bg-gray-50 rounded border border-gray-200">{order.admin_comment}</p>
              </div>
            )}
          </div>

          {/* 오른쪽: 이미지 */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">생성된.이미지</h3>
            <div className="border rounded-md p-1 bg-gray-50 h-80 flex items-center justify-center">
              {order.generated_image_url ? (
                <img
                  src={order.generated_image_url}
                  alt="Generated clothing design"
                  className="max-h-full max-w-full object-contain rounded"
                  onError={(e) => {
                    console.error("Image loading error:", e);
                    e.currentTarget.src = "/placeholder.svg";
                  }}
                />
              ) : (
                <div className="text-gray-400 text-center">
                  <p>이미지가 없습니다</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <Separator />

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>닫기</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
