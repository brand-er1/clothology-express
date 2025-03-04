
import { Card } from "@/components/ui/card";
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

interface OrderListProps {
  orders: Order[];
  onReviewOrder: (order: Order) => void;
}

export const OrderList = ({ orders, onReviewOrder }: OrderListProps) => {
  return (
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
                  order.status === 'deleted' ? 'text-gray-600' :
                  'text-yellow-600'
                }>
                  {order.status === 'approved' ? '승인됨' :
                   order.status === 'rejected' ? '거부됨' :
                   order.status === 'deleted' ? '삭제됨' :
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
                    onClick={() => onReviewOrder(order)}
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
  );
};
