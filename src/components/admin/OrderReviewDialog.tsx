
import { useState, useEffect } from "react";
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
import { ImageOff } from "lucide-react";
import { supabase } from "@/lib/supabase";

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
  const [imageError, setImageError] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(order?.generated_image_url || null);

  // 주문 정보가 변경되면 댓글 초기화
  useEffect(() => {
    if (order) {
      setAdminComment(order.admin_comment || "");
      setImageError(false);
    }
  }, [order]);

  // 이미지 경로가 있으면 스토리지에서 이미지 URL 가져오기
  useEffect(() => {
    const fetchImageUrl = async () => {
      if (order?.image_path) {
        try {
          const { data } = await supabase.storage
            .from('generated_images')  // 수정: 하이픈(-) 대신 언더스코어(_) 사용
            .getPublicUrl(order.image_path);
          
          if (data && data.publicUrl) {
            console.log("Using storage URL in review dialog:", data.publicUrl);
            setImageUrl(data.publicUrl);
            setImageError(false);
          }
        } catch (error) {
          console.error("Failed to get public URL in review dialog:", error);
          // 원래 URL 사용
          setImageUrl(order.generated_image_url);
        }
      } else {
        // 이미지 경로가 없으면 원래 URL 사용
        setImageUrl(order?.generated_image_url || null);
      }
    };

    if (order) {
      fetchImageUrl();
    }
  }, [order]);

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
                    <dt className="text-sm text-gray-500">상세 설명</dt>
                    <dd>{order.detail_description || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">사이즈</dt>
                    <dd>{order.size}</dd>
                  </div>
                  {order.fit && (
                    <div>
                      <dt className="text-sm text-gray-500">핏</dt>
                      <dd>{order.fit}</dd>
                    </div>
                  )}
                </dl>
              </div>
              <div>
                <h3 className="font-semibold mb-2">생성된 이미지</h3>
                <div className="w-full h-auto min-h-48 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                  {imageUrl && !imageError ? (
                    <img
                      src={imageUrl}
                      alt="Generated design"
                      className="w-full h-auto rounded-lg"
                      onLoad={() => console.log("Image loaded successfully in review dialog")}
                      onError={(e) => {
                        console.error("Image loading error in review dialog:", imageUrl);
                        setImageError(true);
                      }}
                    />
                  ) : (
                    <div className="p-4 flex flex-col items-center justify-center h-48 text-center">
                      <ImageOff className="w-8 h-8 mb-2 text-gray-400" />
                      <p className="text-sm text-gray-400">이미지를 불러올 수 없습니다</p>
                      {order.image_path && (
                        <p className="text-xs mt-2 text-gray-400">파일 경로: {order.image_path}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
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
