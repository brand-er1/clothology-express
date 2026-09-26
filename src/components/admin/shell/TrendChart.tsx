import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { compactWon } from "@/lib/admin/format";

const WINE = "#741b2b";

type Point = Record<string, number | string | null>;

const shortDate = (value: string) => (typeof value === "string" && value.length >= 10 ? `${Number(value.slice(5, 7))}/${Number(value.slice(8, 10))}` : value);

// 단일 시리즈 추이 차트(축 1개). 서로 다른 단위의 지표는 차트를 나눠서 보여준다.
export const TrendChart = ({ data, dataKey, label, money = false, kind = "area", height = 220 }: {
  data: Point[]; dataKey: string; label: string; money?: boolean; kind?: "area" | "bar"; height?: number;
}) => {
  const format = (value: number) => (money ? `${compactWon(value)}원` : Number(value).toLocaleString("ko-KR"));
  const tooltip = (
    <Tooltip
      cursor={kind === "bar" ? { fill: "rgba(116,27,43,0.06)" } : { stroke: "#d6d3d1", strokeWidth: 1 }}
      content={({ active, payload, label: tipLabel }) =>
        active && payload?.length ? (
          <div className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs shadow-lg">
            <p className="font-bold text-stone-500">{tipLabel}</p>
            <p className="mt-0.5 flex items-center gap-1.5 font-extrabold text-stone-900">
              <span className="h-2 w-2 rounded-full" style={{ background: WINE }} />{label} {format(Number(payload[0].value ?? 0))}
            </p>
          </div>
        ) : null
      }
    />
  );
  const axes = (
    <>
      <CartesianGrid stroke="#f0eeec" vertical={false} />
      <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11, fill: "#a8a29e" }} axisLine={false} tickLine={false} minTickGap={16} />
      <YAxis tickFormatter={(v) => (money ? compactWon(Number(v)) : Number(v).toLocaleString("ko-KR"))} tick={{ fontSize: 11, fill: "#a8a29e" }} axisLine={false} tickLine={false} width={48} allowDecimals={false} />
    </>
  );
  return (
    <div style={{ height }} role="img" aria-label={`${label} 추이 차트`}>
      <ResponsiveContainer width="100%" height="100%">
        {kind === "bar" ? (
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            {axes}{tooltip}
            <Bar dataKey={dataKey} fill={WINE} radius={[4, 4, 0, 0]} maxBarSize={24} />
          </BarChart>
        ) : (
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`fill-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={WINE} stopOpacity={0.22} />
                <stop offset="100%" stopColor={WINE} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            {axes}{tooltip}
            <Area type="monotone" dataKey={dataKey} stroke={WINE} strokeWidth={2} fill={`url(#fill-${dataKey})`} activeDot={{ r: 4, stroke: "#fff", strokeWidth: 2 }} />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
};

// 순위 막대(가로). 값 텍스트는 잉크 색, 막대만 브랜드 색.
export const RankBars = ({ rows, valueLabel }: { rows: { name: string; value: number; sub?: string }[]; valueLabel: (v: number) => string }) => {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <ol className="grid gap-2.5">
      {rows.map((row, index) => (
        <li key={`${row.name}-${index}`} className="grid grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-2 text-sm">
          <span className="text-xs font-bold tabular-nums text-stone-400">{index + 1}</span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-stone-800">{row.name}</p>
            <div className="mt-1 h-1.5 rounded-full bg-stone-100">
              <div className="h-1.5 rounded-full bg-[#741b2b]" style={{ width: `${Math.max(3, (row.value / max) * 100)}%` }} />
            </div>
          </div>
          <div className="text-right">
            <p className="font-bold tabular-nums text-stone-900">{valueLabel(row.value)}</p>
            {row.sub && <p className="text-[11px] text-stone-400">{row.sub}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
};
