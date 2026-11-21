import { useEffect, useState, type FormEvent } from "react";
import { useLocation } from "react-router-dom";
import { Loader2, Phone } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";
import { formatMobilePhone, isPhoneMissing, MOBILE_PHONE_ERROR, normalizeMobilePhone } from "@/utils/phone";

// 로그인 · 가입 처리 중인 화면에서는 띄우지 않는다.
const SKIP_PATHS = ["/auth", "/auth/callback"];

/**
 * 전화번호 필수: 로그인한 회원의 프로필에 전화번호가 없으면 닫을 수 없는 등록 창을 띄운다.
 * 카카오 · 구글 간편가입 회원과 전화번호 없이 가입했던 기존 회원이 대상이다(이메일 가입은 가입 폼에서 받는다).
 * 등록하지 않으려면 로그아웃할 수 있다.
 */
export const PhoneRequiredGate = () => {
  const { pathname } = useLocation();
  const [userId, setUserId] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    const check = async (id: string | null) => {
      if (!active) return;
      setUserId(id);
      if (!id) { setMissing(false); return; }
      const { data, error: loadError } = await supabase.from("profiles").select("phone_number").eq("id", id).maybeSingle();
      // 프로필을 못 읽으면(네트워크 · 아직 생성 전) 막지 않는다. 다음 로그인 때 다시 확인한다.
      if (!active || loadError || !data) return;
      setMissing(isPhoneMissing(data.phone_number));
    };
    supabase.auth.getSession().then(({ data }) => check(data.session?.user.id ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") void check(session?.user.id ?? null);
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  const open = Boolean(userId) && missing && !SKIP_PATHS.includes(pathname.replace(/\/$/, ""));

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const digits = normalizeMobilePhone(phone);
    if (!digits) { setError(MOBILE_PHONE_ERROR); return; }
    if (!userId) return;
    setSaving(true);
    setError(null);
    const { error: saveError } = await supabase.from("profiles").update({ phone_number: formatMobilePhone(digits) }).eq("id", userId);
    setSaving(false);
    if (saveError) { setError("저장하지 못했습니다. 잠시 후 다시 시도해주세요."); return; }
    setMissing(false);
    toast({ title: "전화번호를 등록했습니다", description: "주문 · 제작 안내 연락에 사용됩니다." });
  };

  return (
    <Dialog open={open}>
      <DialogContent
        className="sm:max-w-md [&>button:last-child]:hidden"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="text-left">
          <span className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-brand text-white"><Phone className="h-5 w-5" /></span>
          <DialogTitle className="text-xl font-bold">전화번호를 등록해주세요</DialogTitle>
          <DialogDescription className="leading-6">
            BRAND-ER는 주문 · 제작 · 배송 안내와 BRAND-ER LAB 선정 연락을 위해 휴대폰 번호를 필수로 받고 있습니다.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={save} noValidate className="space-y-3">
          <label htmlFor="required-phone" className="text-sm font-semibold text-stone-900">휴대폰 번호 <span className="text-xs font-medium text-brand">필수</span></label>
          <input
            id="required-phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="010-1234-5678"
            value={phone}
            maxLength={16}
            onChange={(e) => { setPhone(e.target.value); setError(null); }}
            onBlur={() => setPhone((value) => formatMobilePhone(value))}
            aria-invalid={Boolean(error)}
            className="block h-12 w-full rounded-xl border border-black/15 bg-[#fbfaf8] px-3.5 text-[16px] focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            disabled={saving}
          />
          {error && <p className="text-[13px] font-medium text-rose-700" role="alert">{error}</p>}
          <button type="submit" disabled={saving}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[3px] bg-brand text-[15px] font-bold text-white hover:bg-brand-dark disabled:opacity-60">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}등록하고 계속하기
          </button>
          <button type="button" onClick={() => void supabase.auth.signOut()} className="w-full py-2 text-[13px] text-stone-500 underline-offset-4 hover:underline" disabled={saving}>
            로그아웃
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
