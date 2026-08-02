import type {
  AccessoryAnalysisKind,
  DecorationAnalysisKind,
  DecorationLocation,
  PrintSize,
} from "@/types/productionEstimate";

export const estimateGarmentOptions = [
  { value: "short_sleeve", label: "반팔" },
  { value: "long_sleeve", label: "긴팔" },
  { value: "hoodie", label: "후드티" },
  { value: "sweatshirt", label: "맨투맨" },
  { value: "knit", label: "니트" },
  { value: "shirt", label: "셔츠" },
  { value: "pants", label: "바지" },
  { value: "jogger_pants", label: "조거팬츠" },
  { value: "denim_pants", label: "데님 팬츠" },
  { value: "jacket", label: "자켓" },
  { value: "jacket_lined", label: "자켓 (안감)" },
  { value: "jumper", label: "점퍼" },
  { value: "jumper_lined", label: "점퍼 (안감)" },
  { value: "dress", label: "원피스" },
  { value: "skirt", label: "스커트" },
  { value: "leggings", label: "레깅스" },
  { value: "tights_short_sleeve", label: "상의형 타이즈 (반팔)" },
  { value: "tights_long_sleeve", label: "긴팔 타이즈" },
  { value: "tights_bottom", label: "하의형 타이즈" },
] as const;

export const estimateMaterialOptions = [
  { value: "cotton", label: "면" },
  { value: "cotton_30s", label: "코마 싱글 30수" },
  { value: "cotton_20s", label: "헤비 코튼 싱글 20수" },
  { value: "cotton_rib", label: "코튼 골지" },
  { value: "pique_cotton", label: "PK 피케" },
  { value: "polyester", label: "폴리" },
  { value: "poly_spandex", label: "기능성 폴리 스판" },
  { value: "nylon_spandex", label: "나일론 스판" },
  { value: "performance_mesh", label: "기능성 메쉬" },
  { value: "functional", label: "기능성 원단" },
  { value: "linen", label: "린넨" },
  { value: "french_terry", label: "쭈리(프렌치 테리)" },
  { value: "brushed_fleece", label: "기모 원단" },
  { value: "cotton_twill", label: "코튼 트윌" },
  { value: "woven_nylon", label: "우븐 나일론" },
  { value: "denim", label: "데님" },
  { value: "leather", label: "레더" },
  { value: "knit", label: "니트" },
  { value: "wool_blend", label: "울 혼방 니트" },
  { value: "cotton_knit", label: "코튼 니트" },
  { value: "acrylic_blend", label: "아크릴 혼방 니트" },
  { value: "other", label: "기타" },
] as const;

export const decorationOptions: Array<{
  value: DecorationAnalysisKind;
  label: string;
}> = [
  { value: "screen_print_1_color", label: "실크나염 1도" },
  { value: "screen_print_multi_color", label: "실크나염 다도" },
  { value: "dtf", label: "DTF" },
  { value: "transfer", label: "전사" },
  { value: "dtg", label: "DTG" },
  { value: "embroidery", label: "자수" },
  { value: "silicone_print", label: "실리콘" },
  { value: "pu", label: "PU" },
  { value: "patch", label: "패치" },
  { value: "label", label: "라벨" },
  { value: "pigment", label: "염색 / 피그먼트" },
  { value: "washing", label: "워싱" },
  { value: "unknown_print", label: "기타 프린팅" },
];

export const accessoryOptions: Array<{
  value: AccessoryAnalysisKind;
  label: string;
}> = [
  { value: "zipper", label: "지퍼" },
  { value: "hood_cord", label: "후드끈" },
  { value: "drawstring", label: "스트링" },
  { value: "button", label: "단추" },
  { value: "rivet", label: "리벳" },
  { value: "buckle", label: "버클" },
  { value: "stud", label: "징" },
  { value: "snap_button", label: "스냅" },
];

export const decorationLocationLabels: Record<DecorationLocation, string> = {
  front: "앞면",
  back: "뒷면",
  left_sleeve: "왼쪽 소매",
  right_sleeve: "오른쪽 소매",
  neck: "목",
  other: "기타",
};

export const printSizeLabels: Record<PrintSize, string> = {
  small: "소형",
  medium: "중형",
  large: "대형",
  unknown: "크기 미확인",
};
