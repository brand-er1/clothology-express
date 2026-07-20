export const ESTIMATE_QUANTITY = 20;

export type ProductionEstimateDefinition = {
  category: string;
  productionUnitMin: number;
  productionUnitMax: number;
  patternCost: number;
  sampleCost: number;
  note?: string;
};

export type ProductionEstimate = ProductionEstimateDefinition & {
  quantity: number;
  productionMin: number;
  productionMax: number;
  totalMin: number;
  totalMax: number;
};

// 브랜더 _ 가격.xlsx의 고객용 '의류 공임'과 '패턴·샘플 원가' 기준.
// 반바지는 별도 행이 없어 가장 가까운 '일반 팬츠' 기준을 적용한다.
const estimateByClothType: Record<string, ProductionEstimateDefinition> = {
  short_sleeve: {
    category: "반팔 티셔츠",
    productionUnitMin: 8_000,
    productionUnitMax: 10_000,
    patternCost: 60_000,
    sampleCost: 60_000,
  },
  long_sleeve: {
    category: "긴소매 티셔츠",
    productionUnitMin: 10_000,
    productionUnitMax: 15_000,
    patternCost: 70_000,
    sampleCost: 70_000,
  },
  sweatshirt: {
    category: "맨투맨",
    productionUnitMin: 18_000,
    productionUnitMax: 18_000,
    patternCost: 80_000,
    sampleCost: 60_000,
  },
  hoodie: {
    category: "후드티",
    productionUnitMin: 20_000,
    productionUnitMax: 20_000,
    patternCost: 80_000,
    sampleCost: 80_000,
  },
  long_pants: {
    category: "긴바지",
    productionUnitMin: 23_000,
    productionUnitMax: 33_000,
    patternCost: 130_000,
    sampleCost: 120_000,
  },
  short_pants: {
    category: "반바지",
    productionUnitMin: 23_000,
    productionUnitMax: 33_000,
    patternCost: 130_000,
    sampleCost: 120_000,
    note: "반바지는 일반 팬츠 공임 기준으로 계산됩니다.",
  },
  jacket: {
    category: "자켓",
    productionUnitMin: 45_000,
    productionUnitMax: 50_000,
    patternCost: 150_000,
    sampleCost: 200_000,
  },
};

export const getProductionEstimate = (
  clothType: string,
  quantity = ESTIMATE_QUANTITY,
): ProductionEstimate | null => {
  const definition = estimateByClothType[clothType];
  if (!definition) return null;

  const productionMin = definition.productionUnitMin * quantity;
  const productionMax = definition.productionUnitMax * quantity;
  const developmentCost = definition.patternCost + definition.sampleCost;

  return {
    ...definition,
    quantity,
    productionMin,
    productionMax,
    totalMin: productionMin + developmentCost,
    totalMax: productionMax + developmentCost,
  };
};

