export type ProductionGender = "남성" | "여성";
export type ProductionSizeNumber = "1" | "2" | "3";

export type ProductionSizeMeasurements = Record<string, string>;

export interface ProductionSizeColumn {
  number: ProductionSizeNumber;
  label: string;
  domesticLabel: string;
  measurements: ProductionSizeMeasurements;
}

export interface ProductionSizeSelection {
  gender: ProductionGender;
  category: string;
  selectedSizes: string[];
  sizes: ProductionSizeColumn[];
}

type StandardSizeGuide = Record<string, ProductionSizeMeasurements>;

const categoryMap: Record<string, string> = {
  jacket: "자켓",
  hoodie: "후드티",
  long_sleeve: "긴팔티셔츠",
  short_sleeve: "반팔티셔츠",
  tights_short_sleeve: "반팔티셔츠",
  tights_long_sleeve: "긴팔티셔츠",
  sweatshirt: "맨투맨",
  short_pants: "반바지",
  long_pants: "바지",
  leggings: "바지",
  tights_bottom: "바지",
};

const maleJacket: StandardSizeGuide = {
  M: { 어깨너비: "49cm", 가슴단면: "54cm", 소매길이: "63cm", 총장: "68cm" },
  L: { 어깨너비: "51cm", 가슴단면: "57cm", 소매길이: "64cm", 총장: "70cm" },
  XL: { 어깨너비: "53cm", 가슴단면: "60cm", 소매길이: "65cm", 총장: "72cm" },
};

const maleSweatshirt: StandardSizeGuide = {
  M: { 어깨너비: "49cm", 가슴단면: "56cm", 소매길이: "59cm", 총장: "68cm" },
  L: { 어깨너비: "51cm", 가슴단면: "59cm", 소매길이: "60cm", 총장: "70cm" },
  XL: { 어깨너비: "53cm", 가슴단면: "62cm", 소매길이: "61cm", 총장: "72cm" },
};

const maleHoodie: StandardSizeGuide = {
  M: { 어깨너비: "50cm", 가슴단면: "58cm", 소매길이: "59cm", 총장: "70cm" },
  L: { 어깨너비: "52cm", 가슴단면: "61cm", 소매길이: "60cm", 총장: "72cm" },
  XL: { 어깨너비: "54cm", 가슴단면: "64cm", 소매길이: "61cm", 총장: "74cm" },
};

const maleShortSleeve: StandardSizeGuide = {
  M: { 어깨너비: "53cm", 가슴단면: "54cm", 소매길이: "22cm", 총장: "69cm" },
  L: { 어깨너비: "55cm", 가슴단면: "56cm", 소매길이: "23cm", 총장: "71cm" },
  XL: { 어깨너비: "57cm", 가슴단면: "58cm", 소매길이: "24cm", 총장: "73cm" },
};

const malePants: StandardSizeGuide = {
  M: {
    허리단면: "35cm",
    엉덩이단면: "52cm",
    허벅지단면: "32cm",
    밑위: "29cm",
    "총장(기장)": "98cm",
  },
  L: {
    허리단면: "38cm",
    엉덩이단면: "54cm",
    허벅지단면: "34cm",
    밑위: "30cm",
    "총장(기장)": "100cm",
  },
  XL: {
    허리단면: "40cm",
    엉덩이단면: "57cm",
    허벅지단면: "35cm",
    밑위: "31cm",
    "총장(기장)": "102cm",
  },
};

const femaleJacket: StandardSizeGuide = {
  S: { 어깨너비: "40cm", 가슴단면: "47cm", 소매길이: "56cm", 총장: "58cm" },
  M: { 어깨너비: "42cm", 가슴단면: "50cm", 소매길이: "57cm", 총장: "60cm" },
  L: { 어깨너비: "44cm", 가슴단면: "53cm", 소매길이: "58cm", 총장: "62cm" },
};

const femaleSweatshirt: StandardSizeGuide = {
  S: { 어깨너비: "42cm", 가슴단면: "48cm", 소매길이: "54cm", 총장: "60cm" },
  M: { 어깨너비: "44cm", 가슴단면: "51cm", 소매길이: "55cm", 총장: "62cm" },
  L: { 어깨너비: "46cm", 가슴단면: "54cm", 소매길이: "56cm", 총장: "64cm" },
};

const femaleHoodie: StandardSizeGuide = {
  S: { 어깨너비: "43cm", 가슴단면: "50cm", 소매길이: "54cm", 총장: "62cm" },
  M: { 어깨너비: "45cm", 가슴단면: "53cm", 소매길이: "55cm", 총장: "64cm" },
  L: { 어깨너비: "47cm", 가슴단면: "56cm", 소매길이: "56cm", 총장: "66cm" },
};

const femaleShortSleeve: StandardSizeGuide = {
  S: { 어깨너비: "39cm", 가슴단면: "46cm", 소매길이: "18cm", 총장: "58cm" },
  M: { 어깨너비: "41cm", 가슴단면: "49cm", 소매길이: "19cm", 총장: "60cm" },
  L: { 어깨너비: "43cm", 가슴단면: "52cm", 소매길이: "20cm", 총장: "62cm" },
};

const femalePants: StandardSizeGuide = {
  S: {
    허리단면: "33cm",
    엉덩이단면: "48cm",
    허벅지단면: "29cm",
    밑위: "28cm",
    "총장(기장)": "98cm",
  },
  M: {
    허리단면: "35cm",
    엉덩이단면: "50cm",
    허벅지단면: "30cm",
    밑위: "29cm",
    "총장(기장)": "100cm",
  },
  L: {
    허리단면: "38cm",
    엉덩이단면: "53cm",
    허벅지단면: "32cm",
    밑위: "30cm",
    "총장(기장)": "101cm",
  },
};

const withoutPantsLength = (guide: StandardSizeGuide): StandardSizeGuide =>
  Object.fromEntries(
    Object.entries(guide).map(([size, measurements]) => [
      size,
      Object.fromEntries(
        Object.entries(measurements).filter(
          ([measurement]) => measurement !== "총장(기장)",
        ),
      ),
    ]),
  );

const guides: Record<ProductionGender, Record<string, StandardSizeGuide>> = {
  남성: {
    자켓: maleJacket,
    맨투맨: maleSweatshirt,
    후드티: maleHoodie,
    긴팔티셔츠: maleSweatshirt,
    반팔티셔츠: maleShortSleeve,
    바지: malePants,
    반바지: withoutPantsLength(malePants),
  },
  여성: {
    자켓: femaleJacket,
    맨투맨: femaleSweatshirt,
    후드티: femaleHoodie,
    긴팔티셔츠: femaleSweatshirt,
    반팔티셔츠: femaleShortSleeve,
    바지: femalePants,
    반바지: withoutPantsLength(femalePants),
  },
};

const sizeLabels: Record<
  ProductionGender,
  Record<ProductionSizeNumber, { label: string; domesticLabel: string }>
> = {
  남성: {
    "1": { label: "M", domesticLabel: "M (95)" },
    "2": { label: "L", domesticLabel: "L (100)" },
    "3": { label: "XL", domesticLabel: "XL (105)" },
  },
  여성: {
    "1": { label: "S", domesticLabel: "S (85)" },
    "2": { label: "M", domesticLabel: "M (90)" },
    "3": { label: "L", domesticLabel: "L (95)" },
  },
};

export const normalizeProductionGender = (gender?: string): ProductionGender =>
  /여|female|woman/i.test(gender || "") ? "여성" : "남성";

export const getProductionSizeGuide = (
  gender: ProductionGender,
  selectedType: string,
): { category: string; sizes: ProductionSizeColumn[] } => {
  const category = categoryMap[selectedType] || selectedType || "반팔티셔츠";
  const standardGuide =
    guides[gender][category] || guides[gender].반팔티셔츠;

  const sizes = (["1", "2", "3"] as ProductionSizeNumber[]).map((number) => {
    const { label, domesticLabel } = sizeLabels[gender][number];
    return {
      number,
      label,
      domesticLabel,
      measurements: { ...standardGuide[label] },
    };
  });

  return { category, sizes };
};

export const createFundingSizeMeasurements = (
  selection: ProductionSizeSelection,
) => ({
  guideVersion: 2,
  sourceFile: "표준_사이즈_참고표.xlsx",
  gender: selection.gender,
  category: selection.category,
  sizeNumberMap: Object.fromEntries(
    selection.sizes.map((size) => [size.number, size.label]),
  ),
  domesticSizeMap: Object.fromEntries(
    selection.sizes.map((size) => [size.label, size.domesticLabel]),
  ),
  sizeTable: Object.fromEntries(
    selection.sizes.map((size) => [size.label, size.measurements]),
  ),
});
