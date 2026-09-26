import { useEffect, useState } from "react";
import { BellRing, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/use-toast";
import { formatKrPhone, normalizeKrPhone } from "@/lib/kr-phone";
import {
  fetchMyCreatorNotificationSettings,
  saveMyCreatorNotificationSettings,
} from "@/services/creatorNotifications";

// 제작자 연락처/알림 수신 설정. 공개 브랜드 프로필과 분리된 비공개 정보다.
export const CreatorNotificationSettingsCard = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [phone, setPhone] = useState("");
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [fundingSuccessEnabled, setFundingSuccessEnabled] = useState(true);
  const [phoneSource, setPhoneSource] = useState<"settings" | "profile" | "none">("none");

  useEffect(() => {
    void fetchMyCreatorNotificationSettings()
      .then((settings) => {
        setPhone(formatKrPhone(settings.phoneNumber));
        setSmsEnabled(settings.smsNotificationsEnabled);
        setFundingSuccessEnabled(settings.fundingSuccessNotificationsEnabled);
        setPhoneSource(settings.phoneSource);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const phoneInvalid = phone.trim().length > 0 && !normalizeKrPhone(phone);

  const save = async () => {
    if (phoneInvalid) {
      toast({ title: "휴대폰 번호 형식을 확인해주세요", description: "예: 010-1234-5678", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const saved = await saveMyCreatorNotificationSettings({
        phoneNumber: phone,
        smsNotificationsEnabled: smsEnabled,
        fundingSuccessNotificationsEnabled: fundingSuccessEnabled,
      });
      setPhone(formatKrPhone(saved.phoneNumber));
      setPhoneSource(saved.phoneSource);
      toast({ title: "알림 설정을 저장했습니다" });
    } catch (error) {
      toast({ title: "알림 설정을 저장하지 못했습니다", description: error instanceof Error ? error.message : (error as { message?: string })?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="min-w-0 rounded-xl border border-stone-200 bg-white p-5 sm:p-7" aria-labelledby="creator-notification-title">
      <div className="flex items-start gap-3">
        <span className="rounded-lg bg-brand/10 p-2.5 text-brand"><BellRing className="h-5 w-5" /></span>
        <div className="min-w-0">
          <h2 id="creator-notification-title" className="text-xl font-bold">연락처 · 알림 설정</h2>
          <p className="mt-1 text-sm leading-6 text-stone-500">
            펀딩이 목표 수량을 달성하면 사이트 알림과 문자로 알려드립니다. 휴대폰 번호는 공개되지 않으며 알림 발송에만 사용됩니다.
          </p>
        </div>
      </div>
      {loading ? (
        <div className="mt-5 flex items-center text-sm text-stone-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" />불러오는 중</div>
      ) : (
        <div className="mt-5 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="creator-phone">휴대폰 번호</Label>
            <Input
              id="creator-phone"
              inputMode="tel"
              autoComplete="tel"
              maxLength={20}
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              onBlur={() => { if (normalizeKrPhone(phone)) setPhone(formatKrPhone(phone)); }}
              placeholder="010-1234-5678"
              aria-invalid={phoneInvalid}
              className="h-12 rounded-xl"
            />
            <p className={`text-xs ${phoneInvalid ? "text-red-600" : "text-stone-500"}`}>
              {phoneInvalid
                ? "국내 휴대폰 번호(010 등) 형식으로 입력해주세요."
                : phoneSource === "profile"
                  ? "회원 정보의 번호를 불러왔습니다. 저장하면 알림용 번호로 등록됩니다."
                  : "번호가 없으면 사이트 알림만 발송됩니다."}
            </p>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-lg bg-stone-50 px-4 py-3">
            <div className="min-w-0">
              <Label htmlFor="funding-success-toggle" className="font-semibold">펀딩 성공 알림 받기</Label>
              <p className="text-xs text-stone-500">목표 수량 달성 시 사이트 알림(및 문자)을 받습니다.</p>
            </div>
            <Switch id="funding-success-toggle" checked={fundingSuccessEnabled} onCheckedChange={setFundingSuccessEnabled} />
          </div>
          <div className="flex items-center justify-between gap-4 rounded-lg bg-stone-50 px-4 py-3">
            <div className="min-w-0">
              <Label htmlFor="sms-toggle" className="font-semibold">문자(SMS) 알림 수신 동의</Label>
              <p className="text-xs text-stone-500">펀딩 진행 관련 안내 문자를 받습니다.</p>
            </div>
            <Switch id="sms-toggle" checked={smsEnabled} disabled={!fundingSuccessEnabled} onCheckedChange={setSmsEnabled} />
          </div>
          <Button type="button" variant="outline" onClick={save} disabled={saving || phoneInvalid} className="h-12 w-full rounded-[3px] font-bold">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}알림 설정 저장
          </Button>
        </div>
      )}
    </section>
  );
};
