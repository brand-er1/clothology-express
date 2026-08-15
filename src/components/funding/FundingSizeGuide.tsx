import type { FundingMeasurements } from "@/types/funding";

interface FundingSizeGuideProps {
  measurements: FundingMeasurements | null;
  sizeOptions: string[];
  title?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const getStringRecord = (value: unknown): Record<string, string> | null => {
  if (!isRecord(value)) return null;

  const entries = Object.entries(value).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string",
  );
  return entries.length ? Object.fromEntries(entries) : null;
};

export const FundingSizeGuide = ({
  measurements,
  sizeOptions,
  title = "상품 사이즈표",
}: FundingSizeGuideProps) => {
  if (!measurements) return null;

  const sizeTableValue = measurements.sizeTable;
  if (!isRecord(sizeTableValue)) return null;

  const sizeTable = Object.fromEntries(
    Object.entries(sizeTableValue)
      .map(([size, value]) => [size, getStringRecord(value)] as const)
      .filter(
        (entry): entry is [string, Record<string, string>] =>
          entry[1] !== null,
      ),
  );
  const visibleSizes = sizeOptions.filter((size) => sizeTable[size]);
  if (!visibleSizes.length) return null;

  const numberMap = getStringRecord(measurements.sizeNumberMap) || {};
  const domesticSizeMap =
    getStringRecord(measurements.domesticSizeMap) || {};
  const sizeNumberByLabel = Object.fromEntries(
    Object.entries(numberMap).map(([number, label]) => [label, number]),
  );
  const measurementKeys = Array.from(
    new Set(
      visibleSizes.flatMap((size) => Object.keys(sizeTable[size])),
    ),
  );
  const gender =
    typeof measurements.gender === "string" ? measurements.gender : "";
  const category =
    typeof measurements.category === "string" ? measurements.category : "";

  return (
    <section className="overflow-hidden rounded-[2rem] border bg-white">
      <div className="flex flex-col justify-between gap-3 border-b bg-gray-50 px-6 py-5 sm:flex-row sm:items-end md:px-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">
            SIZE GUIDE
          </p>
          <h2 className="mt-1 text-xl font-black text-gray-950">{title}</h2>
        </div>
        <p className="text-xs leading-5 text-gray-500">
          {[gender, category].filter(Boolean).join(" · ")} 평균 기준 · 단면
          측정 · 단위 cm
        </p>
      </div>

      <div className="overflow-x-auto p-4 md:p-6">
        <table className="w-full min-w-[560px] border-collapse overflow-hidden rounded-2xl border text-sm">
          <thead>
            <tr className="bg-gray-950 text-white">
              <th className="px-4 py-4 text-left">측정 부위</th>
              {visibleSizes.map((size) => (
                <th key={size} className="bg-brand px-4 py-4 text-center">
                  <span className="block text-xs text-white/70">
                    {sizeNumberByLabel[size]
                      ? `${sizeNumberByLabel[size]}사이즈`
                      : "출시 사이즈"}
                  </span>
                  <span className="mt-0.5 block text-base">
                    {domesticSizeMap[size] || size}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {measurementKeys.map((measurement, index) => (
              <tr
                key={measurement}
                className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
              >
                <th className="border-t px-4 py-3 text-left font-semibold text-gray-700">
                  {measurement}
                </th>
                {visibleSizes.map((size) => (
                  <td
                    key={`${size}-${measurement}`}
                    className="border-l border-t px-4 py-3 text-center font-semibold text-gray-800"
                  >
                    {sizeTable[size][measurement] || "-"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs leading-5 text-gray-400">
          평균 사이즈는 제작 기준 초안이며, 원단과 패턴·샘플 과정에 따라
          최종 실측이 조정될 수 있습니다.
        </p>
      </div>
    </section>
  );
};

export default FundingSizeGuide;
