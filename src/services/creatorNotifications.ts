import { supabase } from "@/lib/supabase";

export type CreatorNotificationSettings = {
  configured: boolean;
  phoneNumber: string | null;
  smsNotificationsEnabled: boolean;
  fundingSuccessNotificationsEnabled: boolean;
  phoneSource: "settings" | "profile" | "none";
};

type RawSettings = {
  configured: boolean;
  phone_number: string | null;
  sms_notifications_enabled: boolean;
  funding_success_notifications_enabled: boolean;
  phone_source: CreatorNotificationSettings["phoneSource"];
};

const mapSettings = (raw: RawSettings): CreatorNotificationSettings => ({
  configured: raw.configured,
  phoneNumber: raw.phone_number,
  smsNotificationsEnabled: raw.sms_notifications_enabled,
  fundingSuccessNotificationsEnabled: raw.funding_success_notifications_enabled,
  phoneSource: raw.phone_source,
});

// 휴대폰 번호는 비공개 테이블(creator_notification_settings)에 저장되며 본인 RPC 로만 읽고 쓴다.
export const fetchMyCreatorNotificationSettings = async (): Promise<CreatorNotificationSettings> => {
  const { data, error } = await supabase.rpc("get_my_creator_notification_settings");
  if (error) throw error;
  return mapSettings(data as RawSettings);
};

export const saveMyCreatorNotificationSettings = async (input: {
  phoneNumber: string;
  smsNotificationsEnabled: boolean;
  fundingSuccessNotificationsEnabled: boolean;
}): Promise<CreatorNotificationSettings> => {
  const { data, error } = await supabase.rpc("update_my_creator_notification_settings", {
    p_phone_number: input.phoneNumber.trim() || null,
    p_sms_notifications_enabled: input.smsNotificationsEnabled,
    p_funding_success_notifications_enabled: input.fundingSuccessNotificationsEnabled,
  });
  if (error) throw error;
  return mapSettings(data as RawSettings);
};
