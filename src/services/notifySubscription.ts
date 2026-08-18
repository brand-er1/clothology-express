import { supabase } from "@/lib/supabase";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const subscribeToHomepageNotify = async (
  email: string,
  source = "homepage",
) => {
  const normalizedEmail = email.trim().toLowerCase();

  if (!EMAIL_PATTERN.test(normalizedEmail)) {
    throw new Error("올바른 이메일 주소를 입력해주세요.");
  }

  const { error } = await supabase
    .from("homepage_notify_subscriptions")
    .insert({ email: normalizedEmail, source });

  if (error) {
    if (error.code === "23505") {
      throw new Error("이미 알림 신청이 완료된 이메일입니다.");
    }
    throw new Error("알림 신청에 실패했습니다. 잠시 후 다시 시도해주세요.");
  }
};
