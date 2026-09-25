import type { DetailPageCopy, DetailPageSource } from "@/types/detailPage";

/**
 * Deterministic copy writer used when the AI copy function is unavailable (not deployed,
 * no API key, network error). It only restates facts from `source`, so it can never
 * invent composition, weight, functionality or certifications.
 */

const EN_CLOTH_NAMES: Array<[RegExp, string]> = [
  [/후드\s*집업|후드집업/, "HOODED ZIP-UP"],
  [/후드/, "HOODIE"],
  [/맨투맨|스웨트/, "SWEATSHIRT"],
  [/반팔|티셔츠/, "T-SHIRT"],
  [/긴소매|긴팔/, "LONG SLEEVE TEE"],
  [/셔츠/, "SHIRT"],
  [/니트/, "KNIT"],
  [/자켓|재킷/, "JACKET"],
  [/바람막이|윈드/, "WINDBREAKER"],
  [/코트/, "COAT"],
  [/조거/, "JOGGER PANTS"],
  [/청바지|데님/, "DENIM PANTS"],
  [/반바지|쇼츠/, "SHORTS"],
  [/바지|팬츠|슬랙스/, "PANTS"],
  [/스커트|치마/, "SKIRT"],
  [/원피스|드레스/, "DRESS"],
  [/레깅스/, "LEGGINGS"],
  [/타이즈/, "COMPRESSION TOP"],
  [/조끼|베스트/, "VEST"],
];

const EN_COLORS: Record<string, string> = {
  검정: "BLACK",
  블랙: "BLACK",
  흰색: "WHITE",
  화이트: "WHITE",
  네이비: "NAVY",
  회색: "GREY",
  그레이: "GREY",
  베이지: "BEIGE",
  아이보리: "IVORY",
  카키: "KHAKI",
  브라운: "BROWN",
  레드: "RED",
  블루: "BLUE",
  그린: "GREEN",
};

const toEnglishName = (source: DetailPageSource) => {
  const cloth = EN_CLOTH_NAMES.find(([pattern]) => pattern.test(source.clothType))?.[1] ?? "GARMENT";
  const colorKey = source.userProvided.colorName || source.color;
  const color = Object.entries(EN_COLORS).find(([ko]) => colorKey.includes(ko))?.[1];
  return ["SIGNATURE", color, cloth].filter(Boolean).join(" ");
};

const firstSentence = (text: string) =>
  text
    .split(/\n|(?<=[.!?])\s/)
    .map((line) => line.trim())
    .find(Boolean) ?? "";

export const buildFallbackCopy = (source: DetailPageSource): DetailPageCopy => {
  const color = source.userProvided.colorName || source.color;
  const cloth = source.clothType || "의류";
  const brand = source.brandName || "BRAND-ER 제작자";
  const productName = [color, cloth].filter(Boolean).join(" ");
  const design = source.designDescription.trim();
  const decorations = source.decorations
    .map((decoration) => [decoration.location, decoration.label].filter(Boolean).join(" "))
    .filter(Boolean);

  const designPoints = [
    ...decorations.map((label) => ({ title: label, text: "디자인에서 직접 배치한 포인트 요소입니다." })),
    ...source.constructionFeatures.map((feature) => ({ title: feature, text: "디자인에 포함된 구성 요소입니다." })),
    ...source.accessories.map((accessory) => ({ title: accessory, text: "디자인에 사용된 부자재입니다." })),
    ...(source.fit ? [{ title: source.fit, text: `${source.fit} 실루엣으로 설계했습니다.` }] : []),
    ...(color ? [{ title: `${color} 컬러`, text: `${color} 톤을 메인 컬러로 사용했습니다.` }] : []),
  ].slice(0, 5);

  return {
    productName,
    productNameEn: toEnglishName(source),
    oneLiner: firstSentence(design) || `${brand}가 직접 디자인한 ${cloth}`,
    mainCopy: `${brand}의 ${cloth}`,
    story: [
      source.userProvided.background,
      design ? `${design}` : `${brand}가 BRAND-ER에서 직접 디자인한 ${cloth}입니다.`,
      "펀딩으로 필요한 수량만 모아 제작합니다.",
    ]
      .filter(Boolean)
      .join("\n\n"),
    designDescription: design || `${cloth}의 앞면과 뒷면 디자인을 확인해보세요.`,
    designPoints,
    fabricDescription: source.material ? `${source.material} 원단으로 제작합니다.` : "",
    fitDescription: source.fit ? `${source.fit}으로 설계된 ${cloth}입니다.` : "",
    colorDescription: color ? `${color} 컬러로 제작됩니다. 모니터 환경에 따라 실제 색상과 차이가 있을 수 있습니다.` : "",
    productionMethod: source.productionMethod,
    styling: [],
    sizeGuide: source.sizeOptions.length
      ? `${source.sizeOptions.join(" / ")} 사이즈로 제작됩니다. 아래 실측 사이즈표를 참고해주세요.`
      : "사이즈 정보는 펀딩 등록 단계에서 확정됩니다.",
    care: [
      source.userProvided.careNote,
      "세탁 전 제품에 부착된 케어라벨을 확인해주세요.",
    ].filter(Boolean),
    fundingGuide: "목표 수량이 모이면 제작이 확정됩니다. 펀딩 결과와 이후 진행 상황은 주문 내역에서 안내드립니다.",
    productionSchedule: "펀딩 종료 후 원단 컨택, 샘플 제작, 본생산, 검수/포장을 거쳐 배송됩니다. 상세 일정은 진행 상황에 따라 안내드립니다.",
    shippingGuide: "생산과 검수가 끝난 뒤 순차적으로 발송됩니다.",
    notices: [
      "주문 제작 상품으로, 제작이 시작된 이후에는 단순 변심에 의한 취소가 어려울 수 있습니다.",
      "제품 하자 또는 오배송의 경우 교환·환불을 요청할 수 있습니다. 자세한 기준은 판매자 안내를 따릅니다.",
      "펀딩 참여 취소와 환불은 주문 내역에서 확인할 수 있습니다.",
      "촬영 및 모니터 환경에 따라 실제 제품의 색상이 다르게 보일 수 있습니다.",
    ],
    missingInfo: [],
  };
};
