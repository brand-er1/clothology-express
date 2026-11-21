import { useId, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  LAB_CONSENT_DOCUMENTS, LAB_CONSENT_VERSION, LAB_CONTACT, LAB_PRIVACY_NOTICE, type LabConsentKey,
} from "../../../supabase/functions/_shared/labApplication";

export type LabConsentState = Record<LabConsentKey, boolean>;

export const emptyLabConsents = (): LabConsentState => ({ participation: false, filming: false, privacy: false, marketing: false });

const Box = ({ checked, id, onChange, label, disabled }: { checked: boolean; id: string; onChange: (next: boolean) => void; label: string; disabled?: boolean }) => (
  <span className="relative mt-0.5 flex h-6 w-6 shrink-0">
    <input
      id={id}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(event) => onChange(event.target.checked)}
      className="peer absolute inset-0 h-6 w-6 cursor-pointer appearance-none rounded-[2px] border border-black/30 bg-white transition checked:border-brand checked:bg-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed"
      aria-label={label}
    />
    <Check className="pointer-events-none absolute inset-0 m-auto h-4 w-4 text-white opacity-0 peer-checked:opacity-100" strokeWidth={3} />
  </span>
);

const PrivacyDetails = () => (
  <dl className="mt-3 divide-y divide-black/[0.07] border-y border-black/[0.07] text-[13px] leading-6">
    {[
      ["수집 항목", LAB_PRIVACY_NOTICE.items],
      ["이용 목적", LAB_PRIVACY_NOTICE.purpose],
      ["보유 및 이용 기간", LAB_PRIVACY_NOTICE.retention],
      ["동의 거부 권리 및 불이익", LAB_PRIVACY_NOTICE.refusal],
    ].map(([term, description]) => (
      <div key={term} className="grid gap-1 py-3 sm:grid-cols-[9rem_1fr] sm:gap-4">
        <dt className="font-semibold text-[#211b1c]">{term}</dt>
        <dd className="text-stone-600">{description}</dd>
      </div>
    ))}
  </dl>
);

const FilmingDetails = () => (
  <ul className="mt-3 space-y-1.5 border-l border-brand/30 pl-3 text-[13px] leading-6 text-stone-600">
    <li>촬영은 선정된 분과 일정 · 장소를 미리 협의한 뒤 진행합니다.</li>
    <li>실제 촬영 전 <b className="font-semibold text-[#211b1c]">촬영 범위(얼굴 · 음성 노출 여부), 게시 매체, 이용 기간, 편집 및 재사용 범위</b>를 구체적으로 안내드리고 별도 동의서를 받습니다. 이때 동의하지 않으셔도 됩니다.</li>
    <li>신청 시 입력한 인스타그램 아이디로 자동 태그하거나 공개하지 않습니다. 태그 여부는 별도로 여쭤봅니다.</li>
    <li>게시 후에도 촬영물 이용 동의 철회를 요청하실 수 있습니다. ({LAB_CONTACT.email} · {LAB_CONTACT.phone})</li>
  </ul>
);

const DETAILS: Partial<Record<LabConsentKey, () => JSX.Element>> = { privacy: PrivacyDetails, filming: FilmingDetails };

type Props = { value: LabConsentState; onChange: (next: LabConsentState) => void; disabled?: boolean; showErrors?: boolean };

/** 필수 3개 · 선택 1개 동의. 전체 동의는 한 번에 체크/해제하고, 각 항목은 따로 바꿀 수 있다. */
export const LabConsentPanel = ({ value, onChange, disabled, showErrors }: Props) => {
  const baseId = useId();
  const [open, setOpen] = useState<Partial<Record<LabConsentKey, boolean>>>({ privacy: true });
  const allChecked = LAB_CONSENT_DOCUMENTS.every((doc) => value[doc.key]);

  const setAll = (next: boolean) => onChange(Object.fromEntries(LAB_CONSENT_DOCUMENTS.map((doc) => [doc.key, next])) as LabConsentState);

  return (
    <div>
      <label htmlFor={`${baseId}-all`} className="flex cursor-pointer items-start gap-3 border border-[#211b1c] bg-white px-4 py-4 sm:px-5">
        <Box id={`${baseId}-all`} checked={allChecked} onChange={setAll} label="전체 동의" disabled={disabled} />
        <span>
          <span className="block text-[15px] font-semibold text-[#211b1c]">전체 동의 (선택 항목 포함)</span>
          <span className="mt-0.5 block text-[12.5px] leading-5 text-stone-500">아래 항목을 모두 확인했으며 전체에 동의합니다. 각 항목은 개별로 바꿀 수 있고, 선택 항목에 동의하지 않아도 신청할 수 있습니다.</span>
        </span>
      </label>

      <ul className="mt-3 divide-y divide-black/[0.08] border-y border-black/[0.08]">
        {LAB_CONSENT_DOCUMENTS.map((doc) => {
          const id = `${baseId}-${doc.key}`;
          const Details = DETAILS[doc.key];
          const missing = showErrors && doc.required && !value[doc.key];
          return (
            <li key={doc.key} className="py-4">
              <div className="flex items-start gap-3">
                <Box id={id} checked={value[doc.key]} onChange={(next) => onChange({ ...value, [doc.key]: next })} label={`${doc.required ? "[필수]" : "[선택]"} ${doc.title}`} disabled={disabled} />
                <div className="min-w-0 flex-1">
                  <label htmlFor={id} className="cursor-pointer text-[14.5px] font-semibold leading-6 text-[#211b1c]">
                    <span className={cn("mr-1.5", doc.required ? "text-brand" : "text-stone-500")}>{doc.required ? "[필수]" : "[선택]"}</span>
                    {doc.title}
                  </label>
                  <p className="mt-1 text-[13px] leading-6 text-stone-600">{doc.body}</p>
                  {Details && (
                    <>
                      <button
                        type="button"
                        onClick={() => setOpen((current) => ({ ...current, [doc.key]: !current[doc.key] }))}
                        className="mt-1 inline-flex min-h-[36px] items-center gap-1 text-[12.5px] font-semibold text-stone-500 hover:text-brand"
                        aria-expanded={Boolean(open[doc.key])}
                      >
                        {doc.key === "privacy" ? "개인정보 처리 안내" : "촬영 진행 안내"}
                        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open[doc.key] && "rotate-180")} />
                      </button>
                      {open[doc.key] && <Details />}
                    </>
                  )}
                  {missing && <p className="mt-1.5 text-[12.5px] font-medium text-rose-700">필수 동의 항목입니다.</p>}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[11.5px] text-stone-400">동의 문구 버전 {LAB_CONSENT_VERSION}</p>
    </div>
  );
};
