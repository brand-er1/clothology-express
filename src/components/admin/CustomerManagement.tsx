import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ChevronDown,
  Clipboard,
  Download,
  Eye,
  Image,
  Link2,
  MousePointerClick,
  PackageCheck,
  Plus,
  Power,
  RefreshCw,
  Search,
  UserCheck,
  UserRound,
  UserSearch,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/use-toast";
import {
  createSalesTrackingLink,
  fetchCustomerAnalytics,
  setSalesTrackingLinkActive,
} from "@/services/customerAnalytics";
import type {
  AdminCustomer,
  AdminVisitSession,
  CustomerOverview,
  SalesTrackingLink,
  VisitPeriod,
} from "@/types/customerAnalytics";
import { getAppPath } from "@/utils/appUrl";

const EMPTY_OVERVIEW: CustomerOverview = {
  registered_customers: 0,
  today_visitors: 0,
  active_now: 0,
  repeat_visitors: 0,
  confirmed_today: 0,
  lead_today: 0,
  anonymous_today: 0,
};

const formatDateTime = (value: string | null) => {
  if (!value) return "기록 없음";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));

const isRecentlyActive = (value: string | null) =>
  Boolean(value && Date.now() - new Date(value).getTime() <= 5 * 60 * 1000);

const getCustomerName = (customer: AdminCustomer) =>
  customer.brand_name ||
  customer.username ||
  customer.full_name ||
  customer.email ||
  "이름 미등록";

const accountTypeLabel = (accountType: string | null) => {
  if (accountType === "seller") return "브랜드 메이커";
  if (accountType === "buyer") return "서포터";
  return "게스트";
};

const deviceLabel = (deviceType: string) => {
  if (deviceType === "mobile") return "모바일";
  if (deviceType === "tablet") return "태블릿";
  if (deviceType === "desktop") return "PC";
  return "기타";
};

const escapeCsv = (value: unknown) =>
  `"${String(value ?? "").replace(/"/g, '""')}"`;

const eventLabels: Record<string, string> = {
  page_view: "페이지 조회",
  design_generated: "AI 디자인 생성",
  design_modified: "디자인 수정",
  funding_draft_created: "펀딩 초안 생성",
  production_request_submitted: "제작 의뢰 접수",
  design_quote_submitted: "내 디자인 견적 접수",
  fabric_swatch_submitted: "원단 스와치 신청",
  funding_checkout_started: "펀딩 결제 시작",
};

const identityMeta = {
  confirmed: {
    label: "확정 회원",
    note: "로그인으로 확인",
    className: "bg-emerald-50 text-emerald-700",
    icon: UserCheck,
  },
  lead: {
    label: "추정 영업고객",
    note: "개인 링크로 추정",
    className: "bg-amber-50 text-amber-700",
    icon: UserSearch,
  },
  anonymous: {
    label: "익명 방문자",
    note: "신원 미확인",
    className: "bg-stone-100 text-stone-600",
    icon: UserRound,
  },
} as const;

const getTrafficSource = (visit: AdminVisitSession) => {
  if (visit.lead_channel) return visit.lead_channel;
  if (visit.utm_source) {
    return [visit.utm_source, visit.utm_medium].filter(Boolean).join(" / ");
  }
  if (visit.referrer) {
    try {
      return new URL(visit.referrer).hostname.replace(/^www\./, "");
    } catch {
      return visit.referrer;
    }
  }
  return "직접 방문";
};

const getDuration = (visit: AdminVisitSession) => {
  const seconds = Math.max(
    0,
    Math.round((new Date(visit.last_seen_at).getTime() - new Date(visit.started_at).getTime()) / 1000),
  );
  if (seconds < 60) return `${seconds}초`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}분 ${seconds % 60}초`;
  return `${Math.floor(seconds / 3600)}시간 ${Math.floor((seconds % 3600) / 60)}분`;
};

const buildTrackingUrl = (link: SalesTrackingLink) => {
  const configuredOrigin = import.meta.env.VITE_PUBLIC_SITE_URL?.trim();
  const origin = configuredOrigin || window.location.origin;
  const destination = getAppPath(link.destination_path);
  const url = new URL(destination, origin);
  url.searchParams.set("lead", link.lead_code);
  url.searchParams.set("utm_source", link.channel || "direct");
  url.searchParams.set("utm_medium", "sales_link");
  return url.toString();
};

export const CustomerManagement = () => {
  const [overview, setOverview] = useState<CustomerOverview>(EMPTY_OVERVIEW);
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [visits, setVisits] = useState<AdminVisitSession[]>([]);
  const [trackingLinks, setTrackingLinks] = useState<SalesTrackingLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [accountFilter, setAccountFilter] = useState<"all" | "seller" | "buyer">("all");
  const [period, setPeriod] = useState<VisitPeriod>("today");
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [leadName, setLeadName] = useState("");
  const [leadChannel, setLeadChannel] = useState("문자");
  const [destinationPath, setDestinationPath] = useState("/");
  const [isCreatingLink, setIsCreatingLink] = useState(false);

  const loadAnalytics = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await fetchCustomerAnalytics(period);
      setOverview(data.overview);
      setCustomers(data.customers);
      setVisits(data.visits);
      setTrackingLinks(data.links);
    } catch (error) {
      console.error("Error loading customer analytics:", error);
      toast({
        title: "고객 정보를 불러오지 못했습니다",
        description: "잠시 후 다시 시도해주세요.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  useEffect(() => {
    const timer = window.setInterval(() => void loadAnalytics(), 30_000);
    return () => window.clearInterval(timer);
  }, [loadAnalytics]);

  const filteredCustomers = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("ko-KR");

    return customers.filter((customer) => {
      const matchesAccount =
        accountFilter === "all" || customer.account_type === accountFilter;
      const matchesSearch =
        !keyword ||
        [
          customer.email,
          customer.username,
          customer.full_name,
          customer.phone_number,
          customer.brand_name,
        ].some((value) => value?.toLocaleLowerCase("ko-KR").includes(keyword));

      return matchesAccount && matchesSearch;
    });
  }, [accountFilter, customers, search]);

  const filteredVisits = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("ko-KR");
    if (!keyword) return visits;

    return visits.filter((visit) =>
      [
        visit.display_name,
        visit.email,
        visit.entry_path,
        visit.last_path,
        visit.visitor_id,
        visit.lead_name,
        visit.lead_channel,
        visit.utm_source,
        visit.utm_campaign,
      ].some((value) => value?.toLocaleLowerCase("ko-KR").includes(keyword)),
    );
  }, [search, visits]);

  const createTrackingLink = async () => {
    if (!leadName.trim()) {
      toast({ title: "고객명 또는 브랜드명을 입력해주세요", variant: "destructive" });
      return;
    }

    try {
      setIsCreatingLink(true);
      const created = await createSalesTrackingLink({
        leadName: leadName.trim(),
        channel: leadChannel.trim() || "direct",
        destinationPath: destinationPath.trim() || "/",
      });
      setLeadName("");
      await loadAnalytics();
      if (created) {
        await navigator.clipboard.writeText(buildTrackingUrl(created));
        toast({ title: "개인별 영업 링크를 만들고 복사했습니다" });
      }
    } catch (error) {
      toast({
        title: "영업 링크를 만들지 못했습니다",
        description: error instanceof Error ? error.message : "입력 내용을 확인해주세요.",
        variant: "destructive",
      });
    } finally {
      setIsCreatingLink(false);
    }
  };

  const toggleTrackingLink = async (link: SalesTrackingLink) => {
    try {
      await setSalesTrackingLinkActive(link.id, !link.is_active);
      await loadAnalytics();
      toast({ title: link.is_active ? "링크를 중지했습니다" : "링크를 다시 활성화했습니다" });
    } catch (error) {
      toast({
        title: "링크 상태를 변경하지 못했습니다",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    }
  };

  const downloadCustomers = () => {
    const headers = [
      "고객명",
      "이메일",
      "이름",
      "전화번호",
      "회원유형",
      "브랜드명",
      "주소",
      "가입일",
      "마지막로그인",
      "마지막방문",
      "방문세션",
      "페이지조회",
      "AI이미지",
      "제작의뢰",
      "펀딩개설",
      "펀딩참여",
    ];
    const rows = filteredCustomers.map((customer) => [
      getCustomerName(customer),
      customer.email,
      customer.full_name,
      customer.phone_number,
      accountTypeLabel(customer.account_type),
      customer.brand_name,
      customer.address,
      customer.signed_up_at,
      customer.last_sign_in_at,
      customer.last_seen_at,
      customer.session_count,
      customer.page_view_count,
      customer.generated_image_count,
      customer.order_count,
      customer.funding_count,
      customer.participation_count,
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCsv).join(","))
      .join("\n");
    const url = URL.createObjectURL(
      new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `브랜더_고객목록_${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const summaryCards = [
    {
      label: "오늘 방문자",
      value: overview.today_visitors,
      note: "로그인·비로그인 포함",
      icon: Eye,
    },
    {
      label: "현재 접속",
      value: overview.active_now,
      note: "최근 5분 활동 기준",
      icon: Activity,
    },
    {
      label: "확정 회원",
      value: overview.confirmed_today,
      note: "오늘 로그인 확인",
      icon: UserCheck,
    },
    {
      label: "추정 영업고객",
      value: overview.lead_today,
      note: "개인 링크 방문",
      icon: UserSearch,
    },
    {
      label: "익명 방문자",
      value: overview.anonymous_today,
      note: "신원 미확인",
      icon: UserRound,
    },
    {
      label: "전체 가입 고객",
      value: overview.registered_customers,
      note: `재방문 ${overview.repeat_visitors.toLocaleString()}명`,
      icon: Users,
    },
  ];

  return (
    <section className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
      <div className="border-b border-stone-200 px-5 py-6 md:px-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">
              Customer intelligence
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-stone-950">
              고객 관리
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              회원 정보와 방문 흐름, 디자인·제작·펀딩 활동을 함께 확인합니다.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => void loadAnalytics()}
              disabled={isLoading}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              새로고침
            </Button>
            <Button
              type="button"
              className="rounded-full bg-stone-950 hover:bg-brand"
              onClick={downloadCustomers}
              disabled={filteredCustomers.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              CSV 저장
            </Button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {summaryCards.map(({ label, value, note, icon: Icon }) => (
            <div key={label} className="rounded-2xl border border-stone-200 bg-[#fbfaf8] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-stone-500">{label}</p>
                  <p className="mt-2 text-3xl font-black text-stone-950">
                    {isLoading ? "—" : value.toLocaleString()}
                  </p>
                  <p className="mt-1 text-xs text-stone-400">{note}</p>
                </div>
                <span className="rounded-xl bg-white p-2.5 text-brand shadow-sm">
                  <Icon className="h-5 w-5" />
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-5 py-6 md:px-7">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="이름, 이메일, 전화번호, 브랜드명 검색"
              className="h-11 rounded-xl bg-[#fbfaf8] pl-10"
            />
          </div>
          <div className="flex rounded-xl bg-stone-100 p-1">
            {[
              ["today", "오늘"],
              ["7d", "7일"],
              ["all", "전체"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setPeriod(value as VisitPeriod)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  period === value
                    ? "bg-white text-stone-950 shadow-sm"
                    : "text-stone-500 hover:text-stone-800"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex rounded-xl bg-stone-100 p-1">
            {[
              ["all", "전체"],
              ["seller", "메이커"],
              ["buyer", "서포터"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setAccountFilter(value as "all" | "seller" | "buyer")}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  accountFilter === value
                    ? "bg-white text-stone-950 shadow-sm"
                    : "text-stone-500 hover:text-stone-800"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <Tabs defaultValue="visits">
          <TabsList className="mb-4 grid h-11 w-full grid-cols-3 rounded-xl bg-stone-100 p-1 md:w-[560px]">
            <TabsTrigger value="customers" className="rounded-lg">
              회원 고객 {filteredCustomers.length}
            </TabsTrigger>
            <TabsTrigger value="visits" className="rounded-lg">
              {period === "today" ? "오늘 방문" : "방문 기록"} {filteredVisits.length}
            </TabsTrigger>
            <TabsTrigger value="links" className="rounded-lg">
              영업 링크 {trackingLinks.length}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="customers">
            <div className="overflow-x-auto rounded-2xl border border-stone-200">
              <table className="w-full min-w-[1120px] text-left text-sm">
                <thead className="bg-stone-50 text-xs font-bold uppercase tracking-wide text-stone-500">
                  <tr>
                    <th className="px-4 py-3">고객</th>
                    <th className="px-4 py-3">유형</th>
                    <th className="px-4 py-3">연락처</th>
                    <th className="px-4 py-3">가입일</th>
                    <th className="px-4 py-3">마지막 방문</th>
                    <th className="px-4 py-3">방문</th>
                    <th className="px-4 py-3">활동</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {!isLoading &&
                    filteredCustomers.map((customer) => {
                      const active = isRecentlyActive(customer.last_seen_at);
                      return (
                        <tr key={customer.user_id} className="align-top hover:bg-stone-50/70">
                          <td className="px-4 py-4">
                            <div className="flex items-start gap-3">
                              <span
                                className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                                  active ? "bg-emerald-500" : "bg-stone-300"
                                }`}
                              />
                              <div>
                                <p className="font-bold text-stone-950">
                                  {getCustomerName(customer)}
                                </p>
                                <p className="mt-1 text-xs text-stone-500">{customer.email}</p>
                                {customer.full_name &&
                                  customer.full_name !== getCustomerName(customer) && (
                                    <p className="mt-0.5 text-xs text-stone-400">
                                      {customer.full_name}
                                    </p>
                                  )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <span className="inline-flex rounded-full bg-[#f4e7e4] px-2.5 py-1 text-xs font-bold text-brand">
                              {accountTypeLabel(customer.account_type)}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-stone-600">
                            {customer.phone_number || "미등록"}
                          </td>
                          <td className="px-4 py-4 text-stone-600">
                            {formatDate(customer.signed_up_at)}
                          </td>
                          <td className="px-4 py-4">
                            <p className="font-semibold text-stone-800">
                              {formatDateTime(customer.last_seen_at || customer.last_sign_in_at)}
                            </p>
                            <p className="mt-1 max-w-[180px] truncate text-xs text-stone-400">
                              {customer.last_path || "방문 기록 수집 전"}
                            </p>
                          </td>
                          <td className="px-4 py-4 text-stone-600">
                            <p>{customer.session_count.toLocaleString()}회</p>
                            <p className="mt-1 text-xs text-stone-400">
                              페이지 {customer.page_view_count.toLocaleString()}
                            </p>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex flex-wrap gap-1.5">
                              <span className="inline-flex items-center rounded-lg bg-violet-50 px-2 py-1 text-xs font-semibold text-violet-700">
                                <Image className="mr-1 h-3 w-3" />
                                디자인 {customer.generated_image_count}
                              </span>
                              <span className="inline-flex items-center rounded-lg bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                                <PackageCheck className="mr-1 h-3 w-3" />
                                의뢰 {customer.order_count}
                              </span>
                              <span className="rounded-lg bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
                                펀딩 {customer.funding_count}/{customer.participation_count}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  {isLoading && (
                    <tr>
                      <td colSpan={7} className="px-4 py-14 text-center text-stone-500">
                        고객 정보를 불러오는 중입니다.
                      </td>
                    </tr>
                  )}
                  {!isLoading && filteredCustomers.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-14 text-center text-stone-500">
                        조건에 맞는 고객이 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="visits">
            <div className="overflow-x-auto rounded-2xl border border-stone-200">
              <table className="w-full min-w-[1250px] text-left text-sm">
                <thead className="bg-stone-50 text-xs font-bold uppercase tracking-wide text-stone-500">
                  <tr>
                    <th className="px-4 py-3">방문자</th>
                    <th className="px-4 py-3">확인 수준</th>
                    <th className="px-4 py-3">접속 상태</th>
                    <th className="px-4 py-3">유입</th>
                    <th className="px-4 py-3">이동 경로</th>
                    <th className="px-4 py-3">접속 환경</th>
                    <th className="px-4 py-3">활동</th>
                    <th className="w-12 px-4 py-3" aria-label="상세" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {!isLoading &&
                    filteredVisits.map((visit) => {
                      const identity = identityMeta[visit.identity_status];
                      const IdentityIcon = identity.icon;
                      const expanded = expandedSessionId === visit.session_id;

                      return (
                        <Fragment key={visit.session_id}>
                          <tr className="align-top hover:bg-stone-50/70">
                            <td className="px-4 py-4">
                              <p className="font-bold text-stone-950">{visit.display_name}</p>
                              <p className="mt-1 text-xs text-stone-400">
                                {visit.email ||
                                  visit.lead_code ||
                                  `익명 ID ${visit.visitor_id.slice(0, 8)}`}
                              </p>
                            </td>
                            <td className="px-4 py-4">
                              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${identity.className}`}>
                                <IdentityIcon className="mr-1 h-3.5 w-3.5" />
                                {identity.label}
                              </span>
                              <p className="mt-1 text-[11px] text-stone-400">{identity.note}</p>
                            </td>
                            <td className="px-4 py-4">
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${
                                  visit.is_active
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-stone-100 text-stone-500"
                                }`}
                              >
                                <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${visit.is_active ? "bg-emerald-500" : "bg-stone-400"}`} />
                                {visit.is_active ? "접속 중" : "방문 종료"}
                              </span>
                              <p className="mt-1 text-[11px] text-stone-400">
                                {formatDateTime(visit.last_seen_at)} · {getDuration(visit)}
                              </p>
                            </td>
                            <td className="px-4 py-4">
                              <p className="max-w-[170px] truncate font-semibold text-stone-700">
                                {getTrafficSource(visit)}
                              </p>
                              <p className="mt-1 max-w-[170px] truncate text-xs text-stone-400">
                                {visit.utm_campaign || visit.referrer || "유입정보 없음"}
                              </p>
                            </td>
                            <td className="px-4 py-4">
                              <p className="max-w-[180px] truncate text-stone-700">{visit.entry_path}</p>
                              <p className="mt-1 max-w-[180px] truncate text-xs text-stone-400">→ {visit.last_path}</p>
                            </td>
                            <td className="px-4 py-4 text-stone-600">
                              <p>{deviceLabel(visit.device_type)}</p>
                              <p className="mt-1 text-xs text-stone-400">{visit.browser}</p>
                            </td>
                            <td className="px-4 py-4">
                              <p className="font-semibold text-stone-700">
                                {visit.page_view_count.toLocaleString()}페이지
                              </p>
                              <p className="mt-1 text-xs text-stone-400">
                                {eventLabels[visit.last_event_name || ""] || "방문"} · 이벤트 {visit.event_count}
                              </p>
                            </td>
                            <td className="px-4 py-4">
                              <button
                                type="button"
                                onClick={() => setExpandedSessionId(expanded ? null : visit.session_id)}
                                className="rounded-full p-2 text-stone-400 transition hover:bg-stone-100 hover:text-brand"
                                aria-label={expanded ? "방문 상세 닫기" : "방문 상세 보기"}
                              >
                                <ChevronDown className={`h-4 w-4 transition ${expanded ? "rotate-180" : ""}`} />
                              </button>
                            </td>
                          </tr>
                          {expanded && (
                            <tr>
                              <td colSpan={8} className="bg-[#fbfaf8] px-5 py-5">
                                <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
                                  <div className="rounded-2xl border border-stone-200 bg-white p-4 text-xs text-stone-600">
                                    <p className="font-bold text-stone-900">방문 정보</p>
                                    <dl className="mt-3 space-y-2">
                                      <div><dt className="text-stone-400">시작</dt><dd>{formatDateTime(visit.started_at)}</dd></div>
                                      <div><dt className="text-stone-400">마지막 활동</dt><dd>{formatDateTime(visit.last_seen_at)}</dd></div>
                                      <div><dt className="text-stone-400">UTM</dt><dd className="break-all">{[visit.utm_source, visit.utm_medium, visit.utm_campaign].filter(Boolean).join(" / ") || "없음"}</dd></div>
                                      <div><dt className="text-stone-400">방문자 번호</dt><dd className="break-all">{visit.visitor_id}</dd></div>
                                    </dl>
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold text-stone-900">최근 행동 흐름</p>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                      {visit.journey.length ? visit.journey.map((event, index) => (
                                        <div key={`${event.created_at}-${index}`} className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs">
                                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand/10 font-bold text-brand">{index + 1}</span>
                                          <span>
                                            <strong className="text-stone-800">{eventLabels[event.event_name] || event.event_name}</strong>
                                            <span className="ml-2 text-stone-400">{event.path}</span>
                                          </span>
                                        </div>
                                      )) : (
                                        <p className="text-sm text-stone-400">세부 행동 기록 수집 전입니다.</p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  {isLoading && (
                    <tr>
                      <td colSpan={8} className="px-4 py-14 text-center text-stone-500">
                        방문 기록을 불러오는 중입니다.
                      </td>
                    </tr>
                  )}
                  {!isLoading && filteredVisits.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-14 text-center text-stone-500">
                        선택한 기간에 수집된 방문 기록이 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="links">
            <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
              <section className="h-fit rounded-2xl border border-stone-200 bg-[#fbfaf8] p-5">
                <div className="flex items-center gap-2">
                  <span className="rounded-xl bg-brand/10 p-2 text-brand"><Link2 className="h-5 w-5" /></span>
                  <div>
                    <h3 className="font-black text-stone-950">개인별 영업 링크 만들기</h3>
                    <p className="mt-0.5 text-xs text-stone-500">문자·메일·DM 고객별로 구분합니다.</p>
                  </div>
                </div>
                <div className="mt-5 space-y-4">
                  <label className="block text-sm font-bold text-stone-700">
                    고객명 또는 브랜드명
                    <Input value={leadName} onChange={(event) => setLeadName(event.target.value)} placeholder="예: BAVEON" className="mt-2 h-11 rounded-xl bg-white" />
                  </label>
                  <label className="block text-sm font-bold text-stone-700">
                    발송 채널
                    <Input value={leadChannel} onChange={(event) => setLeadChannel(event.target.value)} placeholder="문자, 이메일, 인스타 DM" className="mt-2 h-11 rounded-xl bg-white" />
                  </label>
                  <label className="block text-sm font-bold text-stone-700">
                    연결 페이지
                    <Input value={destinationPath} onChange={(event) => setDestinationPath(event.target.value)} placeholder="/ 또는 /design-quote" className="mt-2 h-11 rounded-xl bg-white" />
                  </label>
                  <Button type="button" onClick={() => void createTrackingLink()} disabled={isCreatingLink} className="h-12 w-full rounded-full bg-brand font-bold hover:bg-brand-dark">
                    <Plus className="mr-2 h-4 w-4" /> 링크 만들고 복사
                  </Button>
                  <p className="text-xs leading-5 text-stone-400">
                    링크 방문은 ‘추정 영업고객’으로 표시됩니다. 로그인하거나 견적을 접수하면 확정 회원으로 연결됩니다.
                  </p>
                </div>
              </section>

              <section className="overflow-hidden rounded-2xl border border-stone-200">
                <div className="border-b border-stone-200 bg-stone-50 px-5 py-4">
                  <h3 className="font-black text-stone-950">발급한 링크</h3>
                  <p className="mt-1 text-xs text-stone-500">클릭 여부와 마지막 방문 시간을 확인할 수 있습니다.</p>
                </div>
                <div className="divide-y divide-stone-100">
                  {trackingLinks.map((link) => (
                    <div key={link.id} className="grid gap-4 px-5 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold text-stone-950">{link.lead_name}</p>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${link.is_active ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-500"}`}>
                            {link.is_active ? "사용 중" : "중지"}
                          </span>
                          <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-bold text-brand">{link.channel}</span>
                        </div>
                        <p className="mt-2 truncate text-xs text-stone-400">{buildTrackingUrl(link)}</p>
                        <p className="mt-2 text-xs text-stone-500">
                          <MousePointerClick className="mr-1 inline h-3.5 w-3.5" /> 클릭 {link.click_count.toLocaleString()}회
                          <span className="mx-2 text-stone-300">·</span>
                          마지막 {formatDateTime(link.last_clicked_at)}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => {
                          void navigator.clipboard.writeText(buildTrackingUrl(link));
                          toast({ title: "영업 링크를 복사했습니다" });
                        }}>
                          <Clipboard className="mr-1.5 h-3.5 w-3.5" /> 복사
                        </Button>
                        <Button type="button" variant="ghost" size="sm" className="rounded-full text-stone-500" onClick={() => void toggleTrackingLink(link)}>
                          <Power className="mr-1.5 h-3.5 w-3.5" /> {link.is_active ? "중지" : "활성화"}
                        </Button>
                      </div>
                    </div>
                  ))}
                  {!isLoading && trackingLinks.length === 0 && (
                    <p className="px-5 py-14 text-center text-sm text-stone-500">아직 발급한 영업 링크가 없습니다.</p>
                  )}
                </div>
              </section>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </section>
  );
};
