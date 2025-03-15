
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type Order } from "@/types/order";
import { Clock, CheckCircle, XCircle, Trash2 } from "lucide-react";

interface OrderListProps {
  orders: Order[];
  onReviewOrder: (order: Order) => void;
}

export const OrderList = ({ orders, onReviewOrder }: OrderListProps) => {
  const isMobile = useIsMobile();

  // 상태에 따른 스타일 및 텍스트
  const getStatusDisplay = (status: string) => {
    switch(status) {
      case 'approved':
        return { 
          color: 'text-green-600',
          icon: <CheckCircle className="h-4 w-4 mr-1" />,
          text: '승인됨' 
        };
      case 'rejected':
        return { 
          color: 'text-red-600',
          icon: <XCircle className="h-4 w-4 mr-1" />,
          text: '거부됨' 
        };
      case 'deleted':
        return { 
          color: 'text-gray-600',
          icon: <Trash2 className="h-4 w-4 mr-1" />,
          text: '삭제됨' 
        };
      default:
        return { 
          color: 'text-yellow-600',
          icon: <Clock className="h-4 w-4 mr-1" />,
          text: '대기 중' 
        };
    }
  };
  
  // 날짜 포맷팅
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return isMobile 
      ? date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
      : date.toLocaleDateString('ko-KR', { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit' 
        });
  };

  // 모바일 카드 뷰
  const MobileOrderList = () => (
    <div className="space-y-3">
      {orders.map((order) => {
        const status = getStatusDisplay(order.status);
        return (
          <Card key={order.id} className="w-full">
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-2">
                <div className="text-lg font-medium">{order.cloth_type}</div>
                <div className={`flex items-center ${status.color}`}>
                  {status.icon}
                  <span className="text-sm">{status.text}</span>
                </div>
              </div>
              <div className="text-sm text-gray-600 mb-3">
                {formatDate(order.created_at)}
              </div>
              <div className="mb-3 text-sm text-gray-700 line-clamp-2">
                {order.detail_description || '-'}
              </div>
              <Button
                variant={order.status === 'pending' ? "default" : "ghost"}
                size="sm"
                onClick={() => onReviewOrder(order)}
                className="w-full h-10 text-base"
              >
                {order.status === 'pending' ? '검토하기' : '상세보기'}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );

  // 데스크탑 테이블 뷰
  const DesktopOrderList = () => (
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
        {orders.map((order) => {
          const status = getStatusDisplay(order.status);
          return (
            <TableRow key={order.id}>
              <TableCell>
                {formatDate(order.created_at)}
              </TableCell>
              <TableCell>{order.cloth_type}</TableCell>
              <TableCell>
                <span className={`flex items-center ${status.color}`}>
                  {status.icon}
                  <span>{status.text}</span>
                </span>
              </TableCell>
              <TableCell className="max-w-xs truncate">
                {order.detail_description || '-'}
              </TableCell>
              <TableCell>
                {order.status === 'pending' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onReviewOrder(order)}
                  >
                    검토하기
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onReviewOrder(order)}
                  >
                    상세보기
                  </Button>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );

  return (
    <Card className="p-4 md:p-6">
      <CardHeader className="px-0 pt-0">
        <CardTitle className="text-xl md:text-2xl">주문 관리</CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {isMobile ? <MobileOrderList /> : <DesktopOrderList />}
      </CardContent>
    </Card>
  );
};
