
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/use-toast";
import { Order } from "@/types/order";

export const fetchUserOrders = async (): Promise<Order[] | null> => {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    
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
