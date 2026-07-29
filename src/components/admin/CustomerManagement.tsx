import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Download,
  Eye,
  Image,
  PackageCheck,
  RefreshCw,
  Repeat2,
  Search,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/use-toast";
import { fetchCustomerAnalytics } from "@/services/customerAnalytics";
import type {
  AdminCustomer,
  AdminVisitSession,
  CustomerOverview,
} from "@/types/customerAnalytics";

const EMPTY_OVERVIEW: CustomerOverview = {
  registered_customers: 0,
  today_visitors: 0,
  active_now: 0,
  repeat_visitors: 0,
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

export const CustomerManagement = () => {
  const [overview, setOverview] = useState<CustomerOverview>(EMPTY_OVERVIEW);
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [visits, setVisits] = useState<AdminVisitSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [accountFilter, setAccountFilter] = useState<"all" | "seller" | "buyer">("all");

  const loadAnalytics = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await fetchCustomerAnalytics();
      setOverview(data.overview);
      setCustomers(data.customers);
      setVisits(data.visits);
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
  }, []);

  useEffect(() => {
    void loadAnalytics();
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
      ].some((value) => value?.toLocaleLowerCase("ko-KR").includes(keyword)),
    );
  }, [search, visits]);

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
      label: "가입 고객",
      value: overview.registered_customers,
      note: "관리자 제외 전체 회원",
      icon: Users,
    },
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
      label: "재방문 고객",
      value: overview.repeat_visitors,
      note: "2회 이상 방문",
      icon: Repeat2,
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

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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

        <Tabs defaultValue="customers">
          <TabsList className="mb-4 grid h-11 w-full grid-cols-2 rounded-xl bg-stone-100 p-1 md:w-[360px]">
            <TabsTrigger value="customers" className="rounded-lg">
              회원 고객 {filteredCustomers.length}
            </TabsTrigger>
            <TabsTrigger value="visits" className="rounded-lg">
              최근 방문 {filteredVisits.length}
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
              <table className="w-full min-w-[1050px] text-left text-sm">
                <thead className="bg-stone-50 text-xs font-bold uppercase tracking-wide text-stone-500">
                  <tr>
                    <th className="px-4 py-3">방문자</th>
                    <th className="px-4 py-3">상태</th>
                    <th className="px-4 py-3">방문 시작</th>
                    <th className="px-4 py-3">마지막 활동</th>
                    <th className="px-4 py-3">이동 경로</th>
                    <th className="px-4 py-3">접속 환경</th>
                    <th className="px-4 py-3">조회</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {!isLoading &&
                    filteredVisits.map((visit) => (
                      <tr key={visit.session_id} className="hover:bg-stone-50/70">
                        <td className="px-4 py-4">
                          <p className="font-bold text-stone-950">{visit.display_name}</p>
                          <p className="mt-1 text-xs text-stone-400">
                            {visit.email || `익명 ID ${visit.visitor_id.slice(0, 8)}`}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${
                              visit.is_active
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-stone-100 text-stone-500"
                            }`}
                          >
                            <span
                              className={`mr-1.5 h-1.5 w-1.5 rounded-full ${
                                visit.is_active ? "bg-emerald-500" : "bg-stone-400"
                              }`}
                            />
                            {visit.is_active ? "접속 중" : "방문 종료"}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-stone-600">
                          {formatDateTime(visit.started_at)}
                        </td>
                        <td className="px-4 py-4 text-stone-600">
                          {formatDateTime(visit.last_seen_at)}
                        </td>
                        <td className="px-4 py-4">
                          <p className="max-w-[190px] truncate text-stone-700">
                            {visit.entry_path}
                          </p>
                          <p className="mt-1 max-w-[190px] truncate text-xs text-stone-400">
                            → {visit.last_path}
                          </p>
                        </td>
                        <td className="px-4 py-4 text-stone-600">
                          <p>{deviceLabel(visit.device_type)}</p>
                          <p className="mt-1 text-xs text-stone-400">{visit.browser}</p>
                        </td>
                        <td className="px-4 py-4 font-semibold text-stone-700">
                          {visit.page_view_count.toLocaleString()}페이지
                        </td>
                      </tr>
                    ))}
                  {isLoading && (
                    <tr>
                      <td colSpan={7} className="px-4 py-14 text-center text-stone-500">
                        방문 기록을 불러오는 중입니다.
                      </td>
                    </tr>
                  )}
                  {!isLoading && filteredVisits.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-14 text-center text-stone-500">
                        아직 수집된 방문 기록이 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </section>
  );
};
