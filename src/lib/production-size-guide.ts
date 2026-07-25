export type ProductionGender = "남성" | "여성";
export type ProductionSizeNumber = "1" | "2" | "3";

export type ProductionSizeMeasurements = Record<string, string>;

export interface ProductionSizeColumn {
  number: ProductionSizeNumber;
  label: string;
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
  sweatshirt: "맨투맨",
  short_pants: "반바지",
  long_pants: "긴바지",
};

const maleUpper: StandardSizeGuide = {
  M: {
    "추천 키": "170~175cm",
    어깨너비: "46cm",
    가슴단면: "53.5cm",
    소매길이: "64cm",
    총장: "67cm",
  },
  L: {
    "추천 키": "175~180cm",
    어깨너비: "48cm",
    가슴단면: "56cm",
    소매길이: "66cm",
    총장: "69cm",
  },
  XL: {
    "추천 키": "180~185cm",
    어깨너비: "50cm",
    가슴단면: "58.5cm",
    소매길이: "68cm",
    총장: "71cm",
  },
};

const femaleUpper: StandardSizeGuide = {
  S: {
    "추천 키": "155~160cm",
    어깨너비: "41cm",
    가슴단면: "49cm",
    소매길이: "59cm",
    총장: "63cm",
  },
  M: {
    "추천 키": "160~165cm",
    어깨너비: "43cm",
    가슴단면: "51.5cm",
    소매길이: "61cm",
    총장: "65cm",
  },
  L: {
    "추천 키": "165~170cm",
    어깨너비: "45cm",
    가슴단면: "54cm",
    소매길이: "63cm",
    총장: "67cm",
  },
};

const withShortSleeve = (
  guide: StandardSizeGuide,
  sleeveLengths: Record<string, string>,
): StandardSizeGuide =>
  Object.fromEntries(
    Object.entries(guide).map(([size, measurements]) => [
      size,
      { ...measurements, 소매길이: sleeveLengths[size] },
    ]),
  );

const maleShortSleeve = withShortSleeve(maleUpper, {
  M: "24cm",
  L: "26cm",
  XL: "28cm",
});

const femaleShortSleeve = withShortSleeve(femaleUpper, {
  S: "21cm",
  M: "23cm",
  L: "25cm",
});

const maleShortPants: StandardSizeGuide = {
  M: {
    "추천 키": "170~175cm",
    허리단면: "40.5cm",
    엉덩이단면: "53cm",
    허벅지단면: "33cm",
    "바지 길이": "48cm",
    밑위: "27cm",
    밑단: "29cm",
  },
  L: {
    "추천 키": "175~180cm",
    허리단면: "43cm",
    엉덩이단면: "55.5cm",
    허벅지단면: "34cm",
    "바지 길이": "50cm",
    밑위: "28cm",
    밑단: "30cm",
  },
  XL: {
    "추천 키": "180~185cm",
    허리단면: "45.5cm",
    엉덩이단면: "58cm",
    허벅지단면: "35cm",
    "바지 길이": "52cm",
    밑위: "29cm",
    밑단: "31cm",
  },
};

const femaleShortPants: StandardSizeGuide = {
  S: {
    "추천 키": "155~160cm",
    허리단면: "35.5cm",
    엉덩이단면: "48cm",
    허벅지단면: "31cm",
    "바지 길이": "44cm",
    밑위: "24cm",
    밑단: "26cm",
  },
  M: {
    "추천 키": "160~165cm",
    허리단면: "38cm",
    엉덩이단면: "50.5cm",
    허벅지단면: "32cm",
    "바지 길이": "46cm",
    밑위: "25cm",
    밑단: "27cm",
  },
  L: {
    "추천 키": "165~170cm",
    허리단면: "40.5cm",
    엉덩이단면: "53cm",
    허벅지단면: "33cm",
    "바지 길이": "48cm",
    밑위: "26cm",
    밑단: "28cm",
  },
};

const maleLongPants: StandardSizeGuide = {
  M: {
    "추천 키": "170~175cm",
    허리단면: "40.5cm",
    엉덩이단면: "53cm",
    허벅지단면: "33cm",
    "바지 길이": "107cm",
    밑위: "28cm",
    밑단: "18cm",
  },
  L: {
    "추천 키": "175~180cm",
    허리단면: "43cm",
    엉덩이단면: "55.5cm",
    허벅지단면: "34cm",
    "바지 길이": "111cm",
    밑위: "29cm",
    밑단: "18.5cm",
  },
  XL: {
    "추천 키": "180~185cm",
    허리단면: "45.5cm",
    엉덩이단면: "58cm",
    허벅지단면: "35cm",
    "바지 길이": "115cm",
    밑위: "30cm",
    밑단: "19cm",
  },
};

const femaleLongPants: StandardSizeGuide = {
  S: {
    "추천 키": "155~160cm",
    허리단면: "35.5cm",
    엉덩이단면: "48cm",
    허벅지단면: "31cm",
    "바지 길이": "99cm",
    밑위: "25cm",
    밑단: "15.5cm",
  },
  M: {
    "추천 키": "160~165cm",
    허리단면: "38cm",
    엉덩이단면: "50.5cm",
    허벅지단면: "32cm",
    "바지 길이": "103cm",
    밑위: "26cm",
    밑단: "16cm",
  },
  L: {
    "추천 키": "165~170cm",
    허리단면: "40.5cm",
    엉덩이단면: "53cm",
    허벅지단면: "33cm",
    "바지 길이": "107cm",
    밑위: "27cm",
    밑단: "16.5cm",
  },
};

const guides: Record<ProductionGender, Record<string, StandardSizeGuide>> = {
  남성: {
    자켓: maleUpper,
    후드티: maleUpper,
    긴팔티셔츠: maleUpper,
    반팔티셔츠: maleShortSleeve,
    맨투맨: maleUpper,
    반바지: maleShortPants,
    긴바지: maleLongPants,
  },
  여성: {
    자켓: femaleUpper,
    후드티: femaleUpper,
    긴팔티셔츠: femaleUpper,
    반팔티셔츠: femaleShortSleeve,
    맨투맨: femaleUpper,
    반바지: femaleShortPants,
    긴바지: femaleLongPants,
  },
};

const sizeLabels: Record<
  ProductionGender,
  Record<ProductionSizeNumber, string>
> = {
  남성: { "1": "M", "2": "L", "3": "XL" },
  여성: { "1": "S", "2": "M", "3": "L" },
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
    const label = sizeLabels[gender][number];
    return {
      number,
      label,
      measurements: { ...standardGuide[label] },
    };
  });

  return { category, sizes };
};

export const createFundingSizeMeasurements = (
  selection: ProductionSizeSelection,
) => ({
  guideVersion: 1,
  gender: selection.gender,
  category: selection.category,
  sizeNumberMap: Object.fromEntries(
    selection.sizes.map((size) => [size.number, size.label]),
  ),
  sizeTable: Object.fromEntries(
    selection.sizes.map((size) => [size.label, size.measurements]),
  ),
});
