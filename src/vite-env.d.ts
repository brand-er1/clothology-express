/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 결제 운영 모드: mock | test | live | disabled (src/services/payment/config.ts) */
  readonly VITE_PAYMENT_MODE?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_PUBLIC_SITE_URL?: string;
}
