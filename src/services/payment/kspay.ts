/**
 * KSPay 결제창을 브라우저에서 띄우는 부분입니다. form 필드는 서버(ksnet-ready)가 만들어
 * 내려주므로 여기서는 금액이나 상점 정보를 조립하지 않습니다.
 */

export type KspayForm = {
  scriptUrl: string;
  /** 모바일 결제창 주소. PC 와 경로가 다릅니다. */
  submitUrl: string;
  fields: Record<string, string>;
};

declare global {
  interface Window {
    _pay?: (form: HTMLFormElement) => void;
    /** KSPay 가 띄운 팝업 창. 닫힘을 감지하는 유일한 통로입니다. */
    _kspay_pop_obj?: Window | null;
    /** KSPay 가 딤을 걷을 때 쓰는 함수입니다. */
    closeEvent?: () => void;
  }
}

/** KSPay 가 body 에 직접 까는 요소들. 팝업 방식은 `_KSPAY_WIN`, 나머지는 레이어 방식입니다. */
const KSPAY_LAYERS = ["_KSPAY_WIN", "payment-frame", "popup", "overlay"];

/**
 * 결제창 잔해를 걷습니다. KSPay 는 정상 종료 때만 딤을 치우므로, 결제 없이 팝업을 닫으면
 * 화면 전체가 회색으로 덮인 채 아무것도 눌리지 않습니다.
 */
export const clearKspayLayer = () => {
  window.closeEvent?.();
  for (const id of KSPAY_LAYERS) document.getElementById(id)?.remove();
};

const loadKspayScript = async (scriptUrl: string) => {
  if (window._pay) return;
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = scriptUrl;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("결제 모듈을 불러오지 못했습니다."));
    document.head.appendChild(script);
  });
  if (!window._pay) throw new Error("결제 모듈을 불러오지 못했습니다.");
};

/** `KSPayWebV1.4` 스크립트는 모바일을 alert 로 막습니다. 모바일은 별도 결제창으로 직접 제출합니다. */
const isMobile = () => /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);

const buildForm = (fields: Record<string, string>) => {
  const form = document.createElement("form");
  form.method = "POST";
  form.style.display = "none";
  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  return form;
};

/**
 * 결제창을 엽니다. PC 는 팝업, 모바일은 같은 창에서 결제창으로 이동합니다.
 * 결제가 끝나면 KSPay 가 ksnet-return 으로 POST 하고, 그쪽이 결과 화면으로 보내줍니다.
 */
export const openKspayWindow = async (form: KspayForm) => {
  if (isMobile()) {
    const element = buildForm(form.fields);
    element.action = form.submitUrl;
    element.target = "_self";
    element.submit();
    return;
  }

  await loadKspayScript(form.scriptUrl);
  window._pay?.(buildForm(form.fields));
};

/** 결제에 성공했다면 이 시간 안에 이 창이 결과 화면으로 떠납니다. */
const PAYMENT_SETTLE_GRACE_MS = 800;

/**
 * 결제창이 닫힐 때까지 기다립니다. `_pay()` 는 팝업만 띄우고 바로 반환하므로, 기다리지 않으면
 * 결제창이 떠 있는 동안 결제 버튼이 다시 눌려 참여가 하나 더 생깁니다.
 *
 * 결제에 성공하면 팝업이 이 창을 결과 화면으로 보내므로 이 약속은 취소·닫힘일 때만 의미가 있습니다.
 * 모바일은 이미 결제창으로 이동 중이라 끝나지 않는 약속을 돌려줍니다. PC 에서 팝업을 못 찾으면
 * (팝업 차단 등) 바로 끝내서 결제 버튼이 잠긴 채 남지 않게 합니다.
 */
export const watchKspayWindow = (): Promise<void> => {
  if (isMobile()) return new Promise(() => {});
  const hasFrame = () => !!document.getElementById("payment-frame");
  if (!window._kspay_pop_obj && !hasFrame()) return Promise.resolve();

  return new Promise((resolve) => {
    const timer = window.setInterval(() => {
      const popup = window._kspay_pop_obj;
      if (popup ? !popup.closed : hasFrame()) return;
      window.clearInterval(timer);
      window.setTimeout(resolve, PAYMENT_SETTLE_GRACE_MS);
    }, 400);
  });
};
