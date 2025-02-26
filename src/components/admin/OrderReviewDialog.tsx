
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { type Order } from "@/types/order";

interface OrderReviewDialogProps {
  order: Order | null;
  isOpen: boolean;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateStatus: (status: 'approved' | 'rejected', comment: string) => Promise<void>;
}

export const OrderReviewDialog = ({
  order,
  isOpen,
  isSaving,
  onOpenChange,
  onUpdateStatus,
}: OrderReviewDialogProps) => {
  const [adminComment, setAdminComment] = useState(order?.admin_comment || "");

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>주문 검토</DialogTitle>
        </DialogHeader>
        
        {order && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="font-semibold mb-2">주문 정보</h3>
                <dl className="space-y-2">
                  <div>
                    <dt className="text-sm text-gray-500">의류 종류</dt>
                    <dd>{order.cloth_type}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">소재</dt>
                    <dd>{order.material}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">스타일</dt>
                    <dd>{order.style}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">포켓</dt>
                    <dd>{order.pocket_type}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">색상</dt>
                    <dd>{order.color}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">사이즈</dt>
                    <dd>{order.size}</dd>
                  </div>
                </dl>
              </div>
              <div>
                <h3 className="font-semibold mb-2">생성된 이미지</h3>
                {order.generated_image_url && (
                  <img
                    src={order.generated_image_url}
                    alt="Generated design"
                    className="w-full h-auto rounded-lg"
                  />
                )}
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">상세 설명</h3>
              <p className="text-sm">{order.detail_description || '-'}</p>
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
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            취소
          </Button>
          <Button
            variant="destructive"
            onClick={() => onUpdateStatus('rejected', adminComment)}
            disabled={isSaving || !adminComment}
          >
            거부하기
          </Button>
          <Button
            onClick={() => onUpdateStatus('approved', adminComment)}
            disabled={isSaving}
          >
            승인하기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
