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
    <li>촬영 대상: 길거리 인터뷰, 의류 제작 과정, 완성품 전달 및 착용 장면. 편집 후 BRAND-ER LAB 공식 인스타그램 릴스로 게시될 수 있습니다.</li>
    <li>촬영은 선정된 분과 일정 · 장소를 미리 협의한 뒤 진행합니다. 프로젝트 선정 및 제작 가능 여부는 별도로 안내드립니다.</li>
    <li>실제 촬영 전 <b className="font-semibold text-[#211b1c]">촬영 범위(얼굴 · 음성 노출 여부), 게시 매체, 이용 기간, 편집 및 재사용 범위</b>를 구체적으로 안내드리고 별도 동의서를 받습니다. 이때 동의하지 않으셔도 됩니다.</li>
    <li>신청 시 입력한 인스타그램 아이디로 자동 태그하거나 공개하지 않습니다. 태그 여부는 별도로 여쭤봅니다.</li>
    <li>게시 후에도 촬영물 이용 동의 철회를 요청하실 수 있습니다. ({LAB_CONTACT.email} · {LAB_CONTACT.phone})</li>
  </ul>
);

const DETAILS: Partial<Record<LabConsentKey, () => JSX.Element>> = { privacy: PrivacyDetails, filming: FilmingDetails };

type Props = { value: LabConsentState; onChange: (next: LabConsentState) => void; disabled?: boolean; showErrors?: boolean };

const REQUIRED_DOCS = LAB_CONSENT_DOCUMENTS.filter((doc) => doc.required);
const OPTIONAL_DOCS = LAB_CONSENT_DOCUMENTS.filter((doc) => !doc.required);

/**
 * 필수 동의(참여 · 개인정보)와 선택 동의(촬영 · SNS 게시, 홍보 활용)를 나눠 보여준다.
 * '필수 항목 전체 동의'는 필수 항목만 체크한다. 촬영 · 게시 동의는 반드시 따로 체크해야 하며,
 * 신청서를 냈다는 이유만으로 동의한 것으로 처리하지 않는다.
 */
export const LabConsentPanel = ({ value, onChange, disabled, showErrors }: Props) => {
  const baseId = useId();
  const [open, setOpen] = useState<Partial<Record<LabConsentKey, boolean>>>({ privacy: true });
  const allRequiredChecked = REQUIRED_DOCS.every((doc) => value[doc.key]);

  const setAllRequired = (next: boolean) => onChange({ ...value, ...Object.fromEntries(REQUIRED_DOCS.map((doc) => [doc.key, next])) });

  const renderItem = (doc: (typeof LAB_CONSENT_DOCUMENTS)[number]) => {
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
  };

  return (
    <div>
      <label htmlFor={`${baseId}-all`} className="flex cursor-pointer items-start gap-3 border border-[#211b1c] bg-white px-4 py-4 sm:px-5">
        <Box id={`${baseId}-all`} checked={allRequiredChecked} onChange={setAllRequired} label="필수 항목 전체 동의" disabled={disabled} />
        <span>
          <span className="block text-[15px] font-semibold text-[#211b1c]">필수 항목 전체 동의</span>
          <span className="mt-0.5 block text-[12.5px] leading-5 text-stone-500">아래 필수 항목을 모두 확인했으며 동의합니다. 촬영 · 게시 동의 등 선택 항목은 포함되지 않습니다.</span>
        </span>
      </label>

      <ul className="mt-3 divide-y divide-black/[0.08] border-y border-black/[0.08]">{REQUIRED_DOCS.map(renderItem)}</ul>

      <div className="mt-8 rounded-[12px] border border-dashed border-brand/40 bg-[#fbf8f7] px-4 pt-4 sm:px-5" data-testid="lab-optional-consents">
        <p className="text-[14px] font-bold text-[#211b1c]">별도 선택 동의 — 촬영 및 SNS 게시</p>
        <p className="mt-1 text-[12.5px] leading-5 text-stone-500">
          선택 사항입니다. 동의하지 않아도 신청과 제작 검토는 그대로 진행되며, 선정 결과에 불이익이 없습니다.
          릴스 촬영은 이 항목에 동의하고, 촬영 전 개별 동의서를 받은 경우에만 진행합니다.
        </p>
        <ul className="mt-1 divide-y divide-black/[0.08]">{OPTIONAL_DOCS.map(renderItem)}</ul>
      </div>
      <p className="mt-3 text-[11.5px] text-stone-400">동의 문구 버전 {LAB_CONSENT_VERSION}</p>
    </div>
  );
};
