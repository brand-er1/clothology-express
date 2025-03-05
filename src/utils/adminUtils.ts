
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/use-toast";

export const addAdminRoles = async () => {
  try {
    const { data, error } = await supabase.functions.invoke('add-admin');
    
    if (error) throw error;
    
    console.log("Admin role assignment response:", data);
    
    toast({
      title: "관리자 권한 부여 완료",
      description: "지정된 사용자에게 관리자 권한이 부여되었습니다.",
    });
    
    return data;
  } catch (error) {
    console.error("Error assigning admin roles:", error);
    toast({
      title: "관리자 권한 부여 실패",
      description: "권한 부여 중 오류가 발생했습니다.",
      variant: "destructive",
    });
    return null;
  }
};
