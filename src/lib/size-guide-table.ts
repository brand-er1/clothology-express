/**
 * Parses funding `measurements` into a plain size table (same rules as FundingSizeGuide),
 * so other layouts can draw it in their own style.
 */

export type SizeGuideTable = {
  sizes: Array<{ key: string; label: string; number: string | null }>;
  rows: Array<{ label: string; values: string[] }>;
  note: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const stringRecord = (value: unknown): Record<string, string> | null => {
  if (!isRecord(value)) return null;
  const entries = Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string");
  return entries.length ? Object.fromEntries(entries) : null;
};

export const parseSizeGuide = (measurements: Record<string, unknown> | null, sizeOptions: string[]): SizeGuideTable | null => {
  if (!measurements || !isRecord(measurements.sizeTable)) return null;
  const table = Object.fromEntries(
    Object.entries(measurements.sizeTable)
      .map(([size, value]) => [size, stringRecord(value)] as const)
      .filter((entry): entry is [string, Record<string, string>] => entry[1] !== null),
  );
  const visible = sizeOptions.filter((size) => table[size]);
  if (!visible.length) return null;
  const numberMap = stringRecord(measurements.sizeNumberMap) ?? {};
  const domestic = stringRecord(measurements.domesticSizeMap) ?? {};
  const numberByLabel = Object.fromEntries(Object.entries(numberMap).map(([number, label]) => [label, number]));
  const keys = Array.from(new Set(visible.flatMap((size) => Object.keys(table[size]))));
  const gender = typeof measurements.gender === "string" ? measurements.gender : "";
  const category = typeof measurements.category === "string" ? measurements.category : "";
  return {
    sizes: visible.map((size) => ({ key: size, label: domestic[size] || size, number: numberByLabel[size] ?? null })),
    rows: keys.map((label) => ({ label, values: visible.map((size) => table[size][label] || "-") })),
    note: [[gender, category].filter(Boolean).join(" · "), "단면 측정 · 단위 cm"].filter(Boolean).join(" · "),
  };
};
