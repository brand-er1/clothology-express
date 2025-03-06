
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
import { Separator } from "@/components/ui/separator";
import { type Order } from "@/types/order";
import { ImageOff } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";

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
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  // 주문 정보가 변경되면 댓글 초기화 및 사용자 정보 가져오기
  useEffect(() => {
    if (order) {
      setAdminComment(order.admin_comment || "");
      setImageError(false);
      setImageUrl(null); // Reset image URL
      setUserProfile(null); // Reset user profile
      
      if (order.user_id) {
        fetchUserProfile(order.user_id);
      }
    }
  }, [order]);

  // 사용자 프로필 정보 가져오기 - 개선된 방식
  const fetchUserProfile = async (userId: string) => {
    if (!userId) {
      console.warn('No user ID provided for profile fetch');
      setUserProfile(null);
      setIsLoadingProfile(false);
      return;
    }
    
    setIsLoadingProfile(true);
    
    try {
      console.log('Fetching user profile for ID:', userId);
      
      // 직접 RPC 호출하지 않고 테이블에서 조회
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .limit(1)
        .maybeSingle();
      
      console.log('Profile query result:', { data, error });
      
      if (error) {
        console.error('Error fetching user profile:', error);
        setUserProfile(null);
      } else if (!data) {
        console.warn('No profile found for user:', userId);
        setUserProfile(null);
      } else {
        console.log('Successfully fetched user profile:', data);
        setUserProfile(data);
      }
    } catch (error) {
      console.error('Exception in fetchUserProfile:', error);
      setUserProfile(null);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  // 이미지 경로가 있으면 스토리지에서 이미지 URL 가져오기
  useEffect(() => {
    const fetchImageUrl = async () => {
      if (order?.image_path) {
        try {
          const { data } = await supabase.storage
            .from('generated_images')
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>주문 검토</DialogTitle>
        </DialogHeader>
        
        {order && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
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
                      <dt className="text-sm text-gray-500">사이즈</dt>
                      <dd>
                        <Badge>{order.size}</Badge>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm text-gray-500">상세 설명</dt>
                      <dd className="whitespace-pre-wrap bg-gray-50 p-2 rounded text-sm">
                        {order.detail_description || '-'}
                      </dd>
                    </div>
                  </dl>
                </div>

                {order.measurements && Object.keys(order.measurements).length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2">상세 사이즈 정보</h3>
                    <div className="bg-gray-50 p-3 rounded">
                      <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
                        {Object.entries(order.measurements).map(([key, value]) => (
                          <div key={key} className="flex justify-between">
                            <span className="text-gray-600">{key}:</span>
                            <span>{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <h3 className="font-semibold mb-2">생성된 이미지</h3>
                <div className="w-full h-auto min-h-48 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center border border-gray-200">
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

            <Separator />

            {/* 사용자 정보 섹션 - 개선된 표시 방식 */}
            <div>
              <h3 className="font-semibold mb-2">고객 정보</h3>
              {isLoadingProfile ? (
                <p className="text-sm text-gray-500">고객 정보를 불러오는 중...</p>
              ) : userProfile ? (
                <div className="bg-gray-50 p-3 rounded">
                  <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
                    <div>
                      <span className="text-gray-500">이름:</span>
                      <span className="ml-2">{userProfile.full_name || '-'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">연락처:</span>
                      <span className="ml-2">{userProfile.phone_number || '-'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">주소:</span>
                      <span className="ml-2">{userProfile.address || '-'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">성별:</span>
                      <span className="ml-2">{userProfile.gender || '-'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">키:</span>
                      <span className="ml-2">{userProfile.height ? `${userProfile.height}cm` : '-'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">체중:</span>
                      <span className="ml-2">{userProfile.weight ? `${userProfile.weight}kg` : '-'}</span>
                    </div>
                  </div>
                </div>
              ) : order.user_id ? (
                <p className="text-sm text-gray-500">고객 정보를 불러올 수 없습니다. (ID: {order.user_id})</p>
              ) : (
                <p className="text-sm text-gray-500">고객 ID 정보가 없습니다.</p>
              )}
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
