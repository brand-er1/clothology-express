import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export type AccountType = "seller" | "buyer";

export const getAccountType = (user: User | null | undefined): AccountType =>
  user?.user_metadata?.account_type === "buyer" ? "buyer" : "seller";

export const getAccountLandingPath = (user: User | null | undefined) =>
  getAccountType(user) === "buyer" ? "/fundings" : "/customize";

export const syncAccountTypeToProfile = async (user: User | null | undefined) => {
  if (!user) return;

  const { error } = await supabase
    .from("profiles")
    .update({ account_type: getAccountType(user) })
    .eq("id", user.id);

  if (error) {
    console.warn("프로필 회원 유형 동기화 실패:", error.message);
  }
};

