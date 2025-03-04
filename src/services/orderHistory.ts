
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/use-toast";
import { Order } from "@/types/order";

export const fetchUserOrders = async (): Promise<Order[] | null> => {
  try {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    
    if (!user) {
      toast({
        title: "로그인 필요",
        description: "주문 내역을 확인하려면 로그인해주세요.",
        variant: "destructive",
      });
      return null;
    }

    const { data: orders, error } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', user.id)
      .neq('status', 'deleted') // Exclude deleted orders
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching orders:", error);
      toast({
        title: "주문 내역 로드 실패",
        description: "주문 내역을 불러오는데 실패했습니다.",
        variant: "destructive",
      });
      return null;
    }

    return orders as Order[];
  } catch (error: any) {
    console.error("Order fetching error:", error);
    toast({
      title: "주문 내역 로드 실패",
      description: "주문 내역을 불러오는데 예상치 못한 오류가 발생했습니다.",
      variant: "destructive",
    });
    return null;
  }
};

export const deleteOrder = async (orderId: string): Promise<boolean> => {
  try {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    
    if (!user) {
      toast({
        title: "로그인 필요",
        description: "주문을 삭제하려면 로그인해주세요.",
        variant: "destructive",
      });
      return false;
    }

    // Get order to check if it belongs to the user
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('user_id, status')
      .eq('id', orderId)
      .single();
    
    if (fetchError) {
      console.error("Error fetching order:", fetchError);
      toast({
        title: "주문 정보 확인 실패",
        description: "주문 정보를 확인하는데 실패했습니다.",
        variant: "destructive",
      });
      return false;
    }

    // Check if order belongs to user
    if (order.user_id !== user.id) {
      toast({
        title: "권한 없음",
        description: "해당 주문을 삭제할 권한이 없습니다.",
        variant: "destructive",
      });
      return false;
    }
    
    // Check order status - only allow deleting pending or rejected orders
    if (order.status === 'approved') {
      toast({
        title: "삭제 불가",
        description: "승인된 주문은 삭제할 수 없습니다. 고객센터로 문의해주세요.",
        variant: "destructive",
      });
      return false;
    }

    // Update the order status to 'deleted' instead of removing it
    const { error: updateError } = await supabase
      .from('orders')
      .update({ status: 'deleted' })
      .eq('id', orderId);

    if (updateError) {
      console.error("Error marking order as deleted:", updateError);
      toast({
        title: "주문 삭제 실패",
        description: "주문을 삭제하는데 실패했습니다.",
        variant: "destructive",
      });
      return false;
    }

    toast({
      title: "주문 삭제 완료",
      description: "주문이 성공적으로 삭제되었습니다.",
    });
    
    return true;
  } catch (error: any) {
    console.error("Order deletion error:", error);
    toast({
      title: "주문 삭제 실패",
      description: "주문을 삭제하는데 예상치 못한 오류가 발생했습니다.",
      variant: "destructive",
    });
    return false;
  }
};
