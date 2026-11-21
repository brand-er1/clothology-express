import { useEffect, useRef, useState, type ReactNode } from "react";
import { ExternalLink, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { DefinitionGrid, ErrorBanner, LoadingBlock, Notice, StatusBadge } from "@/components/admin/shell/ui";
import { ReasonDialog, type ReasonDialogState } from "@/components/admin/shell/ReasonDialog";
import { useAdminQuery } from "@/components/admin/shell/useAdminQuery";
import { dateOnly, dateTime, errorMessage } from "@/lib/admin/format";
import { labGarmentText, labSizeText } from "@/lib/lab-export";
import {
  addLabFilmingAgreement, deleteLabApplications, getLabApplication, recordLabConsent, signLabImages, updateLabApplication,
  withdrawLabFilmingAgreement, type LabDetail, type LabFilmingAgreement,
} from "@/services/labAdmin";
import { LAB_STATUS_TONE } from "./labAdminFormat";
import {
  formatLabPhone, LAB_CONSENT_DOCUMENTS, LAB_STATUSES, labFutureProductionLabel, labPurposeLabel, labStatusLabel, labStatusStages, type LabStatus,
} from "../../../../supabase/functions/_shared/labApplication";

const METHOD_LABEL: Record<LabFilmingAgreement["agreement_method"], string> = {
  written: "서면 동의서", electronic: "전자 서명", messenger: "메신저 · 이메일 회신", other: "기타",
};

const EVENT_LABEL: Record<string, string> = {
  submitted: "신청 접수", status_changed: "상태 변경", memo_updated: "메모 수정", consent_recorded: "동의 기록",
  filming_agreement_recorded: "촬영 세부 동의 등록", filming_agreement_withdrawn: "촬영 세부 동의 철회", retention_changed: "보유 기한 변경",
};

const Section = ({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) => (
  <section className="border-t border-stone-100 px-5 py-5">
    <div className="mb-3 flex items-center justify-between gap-2">
      <h3 className="text-sm font-extrabold text-stone-900">{title}</h3>
      {actions}
    </div>
    {children}
  </section>
);

const toDateInput = (iso: string) => {
  const date = new Date(new Date(iso).getTime() + 9 * 3600 * 1000);
  return date.toISOString().slice(0, 10);
};

const emptyAgreement = { filmingScope: "", channels: "", usagePeriod: "", editReuseScope: "", method: "written" as LabFilmingAgreement["agreement_method"], agreedAt: "", evidenceNote: "" };

type Props = { applicationId: string | null; onClose: () => void; onChanged: () => void };

export const LabApplicationDetail = ({ applicationId, onClose, onChanged }: Props) => {
  const { data, loading, error, reload } = useAdminQuery<LabDetail | null>(
    () => (applicationId ? getLabApplication(applicationId) : Promise.resolve(null)),
    [applicationId],
  );
  const [images, setImages] = useState<Record<string, string>>({});
  const [imageError, setImageError] = useState<string | null>(null);
  const [status, setStatus] = useState<LabStatus>("received");
  const [memo, setMemo] = useState("");
  const [retention, setRetention] = useState("");
  const [saving, setSaving] = useState(false);
  const [reasonDialog, setReasonDialog] = useState<ReasonDialogState>(null);
  const [agreement, setAgreement] = useState(emptyAgreement);
  const [showAgreementForm, setShowAgreementForm] = useState(false);
  const deletedRef = useRef(false);

  const app = data?.application;
  const canManage = Boolean(data?.can_manage);

  useEffect(() => {
    if (!app) return;
    setStatus(app.status);
    setMemo(app.admin_memo ?? "");
    setRetention(toDateInput(app.retention_until));
  }, [app]);

  useEffect(() => {
    setImages({}); setImageError(null); setShowAgreementForm(false); setAgreement(emptyAgreement);
    if (!app?.image_paths.length) return;
    let active = true;
    signLabImages(app.image_paths).then((urls) => { if (active) setImages(urls); }).catch((err) => { if (active) setImageError(errorMessage(err)); });
    return () => { active = false; };
  }, [app]);

  const after = (message: string) => { toast({ title: message }); void reload(); onChanged(); };

  const saveMain = async () => {
    if (!app) return;
    const retentionChanged = Boolean(retention) && retention !== toDateInput(app.retention_until);
    const persist = async (reason?: string) => {
      setSaving(true);
      try {
        await updateLabApplication(app.id, {
          status: status !== app.status ? status : undefined,
          memo: memo !== (app.admin_memo ?? "") ? memo : undefined,
          retentionUntil: retentionChanged ? new Date(`${retention}T23:59:59+09:00`).toISOString() : undefined,
          reason,
        });
      } finally {
        setSaving(false);
      }
    };
    if (retentionChanged) {
      // 사유 입력 · 성공/실패 안내는 ReasonDialog 가 맡는다.
      setReasonDialog({
        title: "보유 기한 변경", description: `보유 기한을 ${retention} 까지로 바꿉니다. 변경 사유를 남겨주세요.`,
        confirmLabel: "변경", placeholder: "예: 촬영물 분쟁 대응을 위해 보관 연장, 신청자 요청으로 조기 파기",
        onConfirm: (reason) => persist(reason), successMessage: "저장했습니다",
      });
      return;
    }
    try {
      await persist();
      after("저장했습니다");
    } catch (err) {
      toast({ title: "저장하지 못했습니다", description: errorMessage(err), variant: "destructive" });
    }
  };

  const askConsent = (key: string, title: string, agreed: boolean) => {
    if (!app) return;
    setReasonDialog({
      title: `${title} ${agreed ? "재동의 기록" : "철회 기록"}`,
      description: agreed ? "신청자가 다시 동의한 경로와 일시를 남겨주세요." : "신청자가 철회를 요청한 경로 · 일시 · 내용을 남겨주세요. 철회 후에는 해당 범위의 촬영물 이용을 중단해야 합니다.",
      reasonLabel: "요청 경로 · 내용", placeholder: "예: 2026-11-21 고객센터 전화로 홍보 활용 동의 철회 요청",
      confirmLabel: agreed ? "재동의 기록" : "철회 기록", destructive: !agreed,
      onConfirm: (note) => recordLabConsent(app.id, key, agreed, note), successMessage: "동의 이력을 기록했습니다",
    });
  };

  const submitAgreement = async () => {
    if (!app) return;
    setSaving(true);
    try {
      await addLabFilmingAgreement(app.id, { ...agreement, agreedAt: new Date(agreement.agreedAt).toISOString() });
      setShowAgreementForm(false);
      setAgreement(emptyAgreement);
      after("촬영 세부 동의를 기록했습니다");
    } catch (err) {
      toast({ title: "기록하지 못했습니다", description: errorMessage(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const askDelete = () => {
    if (!app) return;
    setReasonDialog({
      title: "신청 정보 삭제", destructive: true, confirmLabel: "영구 삭제",
      description: <>접수번호 <b>{app.application_no}</b>의 신청서, 참고 이미지 {app.image_paths.length}장, 동의 · 처리 이력을 영구 삭제합니다. 되돌릴 수 없으며 Audit Log 에는 개인정보 없이 접수번호와 사유만 남습니다.</>,
      reasonLabel: "삭제 사유", placeholder: "예: 보유 기간 만료, 신청자 삭제 요청(2026-11-21 이메일)",
      onConfirm: async (reason) => { await deleteLabApplications([{ id: app.id, image_paths: app.image_paths }], reason); deletedRef.current = true; onClose(); },
      successMessage: "신청 정보를 삭제했습니다",
    });
  };

  const agreementValid = agreement.filmingScope.trim() && agreement.channels.trim() && agreement.usagePeriod.trim() && agreement.editReuseScope.trim() && agreement.agreedAt;
  const dirty = app && (status !== app.status || memo !== (app.admin_memo ?? "") || (retention && retention !== toDateInput(app.retention_until)));
  const expired = app && new Date(app.retention_until) <= new Date();

  return (
    <>
      <Sheet open={Boolean(applicationId)} onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
        <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-2xl">
          <SheetHeader className="space-y-1 px-5 pb-4 pt-6 text-left">
            <SheetTitle className="flex flex-wrap items-center gap-2 text-lg font-extrabold">
              {app ? app.application_no : "신청 상세"}
              {app && <StatusBadge tone={LAB_STATUS_TONE[app.status]}>{labStatusLabel(app.status)}</StatusBadge>}
              {expired && <StatusBadge tone="red">보유 기한 만료</StatusBadge>}
            </SheetTitle>
            <SheetDescription className="text-xs">{app ? `접수 ${dateTime(app.created_at)} · 열람 기록이 Audit Log 에 남습니다.` : "불러오는 중"}</SheetDescription>
          </SheetHeader>

          {error && <div className="px-5 pb-4"><ErrorBanner message={error} onRetry={reload} /></div>}
          {loading && !data ? <LoadingBlock /> : app && data && (
            <>
              {!canManage && <div className="px-5 pb-4"><Notice tone="stone">조회 전용 권한입니다. 상태 · 메모 · 동의 기록 변경은 lab.manage 권한이 필요합니다.</Notice></div>}

              <Section title="처리">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1 text-xs font-bold text-stone-600">신청 상태
                    <select value={status} onChange={(e) => setStatus(e.target.value as LabStatus)} disabled={!canManage || saving}
                      className="h-9 rounded-lg border border-stone-200 bg-white px-2 text-sm font-semibold text-stone-800">
                      {LAB_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                  </label>
                  <label className="grid gap-1 text-xs font-bold text-stone-600">개인정보 보유 기한
                    <Input type="date" value={retention} onChange={(e) => setRetention(e.target.value)} disabled={!canManage || saving} className="h-9 text-sm" />
                  </label>
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2 rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs">
                  {([["검토 상태", "review"], ["선정 여부", "selection"], ["제작 진행 상태", "production"]] as const).map(([label, key]) => (
                    <div key={key}>
                      <dt className="text-[11px] font-bold text-stone-400">{label}</dt>
                      <dd className="mt-0.5 font-semibold text-stone-800">{labStatusStages(status)[key]}</dd>
                    </div>
                  ))}
                </dl>
                <label className="mt-3 grid gap-1 text-xs font-bold text-stone-600">관리자 메모 <span className="font-normal text-stone-400">(신청자에게 보이지 않습니다)</span>
                  <Textarea value={memo} onChange={(e) => setMemo(e.target.value)} rows={4} maxLength={5000} disabled={!canManage || saving}
                    placeholder="연락 내역, 선정 사유, 제작 메모 등" />
                </label>
                {app.admin_memo_updated_at && <p className="mt-1 text-[11px] text-stone-400">마지막 수정 {dateTime(app.admin_memo_updated_at)} · {app.admin_memo_updated_by_name ?? "-"}</p>}
                <p className="mt-2 text-[11px] text-stone-400">'콘텐츠 게시 완료'로 바꾸면 보유 기한이 게시일로부터 1년으로 자동 연장됩니다.</p>
                {canManage && (
                  <div className="mt-3 flex flex-wrap justify-between gap-2">
                    <Button variant="outline" size="sm" className="text-rose-700" onClick={askDelete} disabled={saving}><Trash2 className="mr-1 h-3.5 w-3.5" />신청 정보 삭제</Button>
                    <Button size="sm" className="bg-[#741b2b] hover:bg-[#551220]" onClick={() => void saveMain()} disabled={!dirty || saving}>
                      {saving && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}저장
                    </Button>
                  </div>
                )}
              </Section>

              <Section title="신청자 정보">
                <DefinitionGrid items={[
                  { label: "이름", value: app.applicant_name },
                  { label: "연락처", value: <a className="underline-offset-2 hover:underline" href={`tel:${app.phone}`}>{formatLabPhone(app.phone)}</a> },
                  { label: "이메일", value: app.email ? <a className="underline-offset-2 hover:underline" href={`mailto:${app.email}`}>{app.email}</a> : "-" },
                  { label: "인스타그램", value: app.instagram_id ? <a className="inline-flex items-center gap-1 underline-offset-2 hover:underline" href={`https://www.instagram.com/${app.instagram_id}/`} target="_blank" rel="noreferrer noopener">@{app.instagram_id}<ExternalLink className="h-3 w-3" /></a> : "-" },
                  { label: "회원 여부", value: app.is_member ? "회원 신청" : "비회원 신청" },
                  { label: "보유 기한", value: dateOnly(app.retention_until) },
                ]} />
              </Section>

              <Section title="제작 희망 의류 · 신청 내용">
                <DefinitionGrid items={[
                  { label: "희망 의류 종류", value: labGarmentText(app.garment_types, app.garment_type_other) },
                  { label: "제작 목적", value: labPurposeLabel(app.purpose) || "-" },
                  { label: "향후 추가 생산 의향", value: labFutureProductionLabel(app.future_production) || "-" },
                  ...(app.size ? [{ label: "희망 사이즈", value: labSizeText(app.size, app.size_other) }] : []),
                ]} />
                <p className="mt-4 text-[11px] font-bold text-stone-400">디자인 설명</p>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-stone-800">{app.design_description}</p>
                <p className="mt-4 text-[11px] font-bold text-stone-400">제작 목적 상세</p>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-stone-800">{app.reason || "-"}</p>
              </Section>

              <Section title={`참고 이미지 ${app.image_paths.length}장`}>
                {imageError && <ErrorBanner message={`이미지를 열지 못했습니다: ${imageError}`} />}
                {app.image_paths.length === 0 ? <p className="text-sm text-stone-400">첨부한 이미지가 없습니다.</p> : (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                    {app.image_paths.map((path, index) => (
                      <a key={path} href={images[path]} target="_blank" rel="noreferrer noopener"
                        className="relative block aspect-square overflow-hidden rounded-lg border border-stone-200 bg-stone-100" aria-label={`참고 이미지 ${index + 1} 크게 보기`}>
                        {images[path] ? <img src={images[path]} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center"><Loader2 className="h-4 w-4 animate-spin text-stone-400" /></span>}
                      </a>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-[11px] text-stone-400">비공개 저장소의 10분짜리 임시 링크입니다. 외부에 공유하지 마세요.</p>
              </Section>

              <Section title="동의 현황">
                <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200">
                  {LAB_CONSENT_DOCUMENTS.map((doc) => {
                    const state = data.consents[doc.key];
                    return (
                      <li key={doc.key} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-stone-800"><span className={doc.required ? "text-[#741b2b]" : "text-stone-400"}>{doc.required ? "[필수] " : "[선택] "}</span>{doc.title}</p>
                          <p className="text-[11px] text-stone-400">{state ? `${dateTime(state.at)} · 문구 버전 ${state.version}` : "기록 없음"}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge tone={state?.agreed ? "green" : state?.action === "withdraw" ? "red" : "neutral"}>
                            {state?.agreed ? "동의" : state?.action === "withdraw" ? "철회" : "미동의"}
                          </StatusBadge>
                          {canManage && state && (
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => askConsent(doc.key, doc.title, !state.agreed)}>
                              {state.agreed ? "철회 기록" : "재동의 기록"}
                            </Button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <details className="mt-3 text-xs text-stone-500">
                  <summary className="cursor-pointer font-bold">동의 이력 {data.consent_records.length}건 · 동의 당시 문구 보기</summary>
                  <ol className="mt-2 space-y-2">
                    {data.consent_records.map((record) => (
                      <li key={record.id} className="rounded-lg bg-stone-50 p-2.5">
                        <p className="font-semibold text-stone-700">
                          {dateTime(record.created_at)} · {record.title} · {record.agreed ? "동의" : "미동의/철회"}
                          <span className="font-normal text-stone-400"> ({record.action === "initial" ? "신청 시" : record.action === "withdraw" ? "철회 기록" : "재동의 기록"} · {record.source === "applicant_web" ? "신청자 웹" : `관리자 ${record.recorded_by_name ?? ""}`} · v{record.consent_version})</span>
                        </p>
                        {record.note && <p className="mt-0.5 text-stone-600">메모: {record.note}</p>}
                        <p className="mt-0.5 text-stone-400">“{record.body}”</p>
                      </li>
                    ))}
                  </ol>
                </details>
              </Section>

              <Section title="촬영 세부 동의 (촬영 전 별도 동의)" actions={canManage && !showAgreementForm ? (
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowAgreementForm(true)}>세부 동의 기록</Button>
              ) : undefined}>
                <p className="mb-3 text-[11px] leading-5 text-stone-500">실제 촬영 전 신청자에게 촬영 범위 · 게시 매체 · 이용 기간 · 편집 및 재사용 범위를 안내하고 받은 동의를 기록합니다. 동의서 원본은 별도로 보관하고 보관 위치를 남겨주세요.</p>
                {showAgreementForm && (
                  <div className="mb-4 grid gap-2 rounded-xl border border-stone-200 p-3">
                    {([
                      ["filmingScope", "촬영 범위", "예: 작업실 · 피팅 장면, 얼굴 노출 동의, 음성 포함"],
                      ["channels", "게시 매체", "예: 브랜더 공식 인스타그램 릴스 · 피드"],
                      ["usagePeriod", "이용 기간", "예: 게시일로부터 2년"],
                      ["editReuseScope", "편집 및 재사용 범위", "예: 컷 편집 · 자막 가능, 광고 소재 재사용 불가"],
                    ] as const).map(([key, label, placeholder]) => (
                      <label key={key} className="grid gap-1 text-xs font-bold text-stone-600">{label} *
                        <Textarea rows={2} value={agreement[key]} placeholder={placeholder} maxLength={key === "usagePeriod" ? 200 : 1000}
                          onChange={(e) => setAgreement((current) => ({ ...current, [key]: e.target.value }))} />
                      </label>
                    ))}
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="grid gap-1 text-xs font-bold text-stone-600">동의 방법 *
                        <select value={agreement.method} onChange={(e) => setAgreement((c) => ({ ...c, method: e.target.value as LabFilmingAgreement["agreement_method"] }))}
                          className="h-9 rounded-lg border border-stone-200 bg-white px-2 text-sm">
                          {Object.entries(METHOD_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                      </label>
                      <label className="grid gap-1 text-xs font-bold text-stone-600">동의 일시 *
                        <Input type="datetime-local" value={agreement.agreedAt} onChange={(e) => setAgreement((c) => ({ ...c, agreedAt: e.target.value }))} className="h-9 text-sm" />
                      </label>
                    </div>
                    <label className="grid gap-1 text-xs font-bold text-stone-600">동의서 보관 위치 · 증빙
                      <Input value={agreement.evidenceNote} maxLength={1000} placeholder="예: 구글 드라이브 /LAB/동의서/LAB-261121-00001.pdf" onChange={(e) => setAgreement((c) => ({ ...c, evidenceNote: e.target.value }))} className="h-9 text-sm" />
                    </label>
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => { setShowAgreementForm(false); setAgreement(emptyAgreement); }} disabled={saving}>취소</Button>
                      <Button size="sm" className="bg-[#741b2b] hover:bg-[#551220]" onClick={() => void submitAgreement()} disabled={!agreementValid || saving}>기록</Button>
                    </div>
                  </div>
                )}
                {data.filming_agreements.length === 0 ? <p className="text-sm text-stone-400">기록된 촬영 세부 동의가 없습니다.</p> : (
                  <ul className="space-y-2">
                    {data.filming_agreements.map((item) => (
                      <li key={item.id} className="rounded-xl border border-stone-200 p-3 text-xs leading-5 text-stone-600">
                        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                          <p className="font-bold text-stone-800">{dateTime(item.agreed_at)} · {METHOD_LABEL[item.agreement_method]}</p>
                          {item.withdrawn_at ? <StatusBadge tone="red">철회 {dateTime(item.withdrawn_at)}</StatusBadge> : canManage && (
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setReasonDialog({
                              title: "촬영 세부 동의 철회 기록", destructive: true, confirmLabel: "철회 기록", reasonLabel: "요청 경로 · 내용",
                              description: "철회 후에는 해당 촬영물의 게시 중단 · 삭제 등 후속 조치를 진행해주세요.",
                              onConfirm: (note) => withdrawLabFilmingAgreement(item.id, note), successMessage: "철회를 기록했습니다",
                            })}>철회 기록</Button>
                          )}
                        </div>
                        <p><b>촬영 범위</b> {item.filming_scope}</p>
                        <p><b>게시 매체</b> {item.channels}</p>
                        <p><b>이용 기간</b> {item.usage_period}</p>
                        <p><b>편집 · 재사용</b> {item.edit_reuse_scope}</p>
                        {item.evidence_note && <p><b>증빙</b> {item.evidence_note}</p>}
                        {item.withdrawn_note && <p className="text-rose-700"><b>철회 메모</b> {item.withdrawn_note}</p>}
                        <p className="mt-1 text-stone-400">기록 {dateTime(item.created_at)} · {item.recorded_by_name ?? "-"}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section title="처리 이력">
                <ol className="space-y-1.5 text-xs">
                  {data.events.map((event) => (
                    <li key={event.id} className="flex gap-2">
                      <span className="w-28 shrink-0 tabular-nums text-stone-400">{dateTime(event.created_at)}</span>
                      <span className="text-stone-700">
                        <b>{EVENT_LABEL[event.event_type] ?? event.event_type}</b>
                        {event.from_status && event.to_status && ` · ${labStatusLabel(event.from_status)} → ${labStatusLabel(event.to_status)}`}
                        {event.note && ` · ${event.note}`}
                        {event.actor_name && <span className="text-stone-400"> · {event.actor_name}</span>}
                      </span>
                    </li>
                  ))}
                </ol>
              </Section>
            </>
          )}
        </SheetContent>
      </Sheet>
      <ReasonDialog state={reasonDialog} onClose={() => setReasonDialog(null)} onDone={() => {
        // 삭제 직후에는 다시 불러올 상세가 없다.
        if (!deletedRef.current) void reload();
        deletedRef.current = false;
        onChanged();
      }} />
    </>
  );
};
