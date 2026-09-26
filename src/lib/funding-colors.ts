// 펀딩 컬러 옵션(funding_colors / funding_color_images) 공용 모델과 순수 함수.
// 펀딩 상세 갤러리 · 컬러 관리 · AI 상세페이지가 모두 이 구조를 공유한다.

export type ColorView = "front" | "back";
export type ColorImageStatus = "generating" | "preview" | "approved" | "rejected" | "failed" | "replaced";

export type FundingColorImage = {
  id: string;
  colorId: string;
  view: ColorView;
  status: ColorImageStatus;
  source: "original" | "ai" | "upload";
  url: string | null;
  errorMessage: string | null;
  createdAt: string;
};

export type FundingColor = {
  id: string;
  fundingId: string;
  name: string;
  hex: string | null;
  sortOrder: number;
  isBase: boolean;
  /** 고객에게 노출되는 승인 이미지(면별 1장) */
  approved: Partial<Record<ColorView, FundingColorImage>>;
  /** 관리 화면 전용: 승인 대기/실패 등 최근 이미지 */
  candidates: FundingColorImage[];
};

/** 자주 쓰는 의류 컬러 프리셋(이름은 고객 노출용 대문자 영문). */
export const COLOR_PRESETS: { name: string; hex: string; aliases: string[] }[] = [
  { name: "BLACK", hex: "#111111", aliases: ["블랙", "검정", "검정색", "black"] },
  { name: "WHITE", hex: "#F7F7F5", aliases: ["화이트", "흰색", "white"] },
  { name: "IVORY", hex: "#F2ECDD", aliases: ["아이보리", "ivory", "cream", "크림"] },
  { name: "GRAY", hex: "#8C8C8C", aliases: ["그레이", "회색", "grey", "gray", "멜란지"] },
  { name: "CHARCOAL", hex: "#3B3B3D", aliases: ["차콜", "charcoal"] },
  { name: "NAVY", hex: "#1F2A44", aliases: ["네이비", "navy", "남색"] },
  { name: "BURGUNDY", hex: "#6D1F2F", aliases: ["버건디", "burgundy", "와인", "wine"] },
  { name: "BEIGE", hex: "#D8C3A5", aliases: ["베이지", "beige"] },
  { name: "KHAKI", hex: "#7C7A4F", aliases: ["카키", "khaki", "올리브", "olive"] },
  { name: "BROWN", hex: "#6B4A36", aliases: ["브라운", "갈색", "brown"] },
  { name: "SKY BLUE", hex: "#9CC3E6", aliases: ["스카이블루", "하늘색", "sky blue", "skyblue"] },
  { name: "PINK", hex: "#E8B4C0", aliases: ["핑크", "분홍", "pink"] },
  { name: "RED", hex: "#B3242E", aliases: ["레드", "빨강", "red"] },
  { name: "GREEN", hex: "#2F5D46", aliases: ["그린", "초록", "green"] },
];

const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

/** 컬러명으로 대표 색상 코드를 추정(프리셋/별칭). 모르면 null. */
export const guessColorHex = (name: string): string | null => {
  const key = normalize(name);
  const preset = COLOR_PRESETS.find((entry) => normalize(entry.name) === key || entry.aliases.some((alias) => normalize(alias) === key));
  return preset?.hex ?? null;
};

export const colorHexOf = (color: Pick<FundingColor, "name" | "hex">) => color.hex ?? guessColorHex(color.name) ?? "#D6D3CE";

export type ColorSlide = {
  key: string;
  colorId: string | null;
  colorName: string;
  view: ColorView | "design";
  url: string;
};

/**
 * 상단 이미지 슬라이드: 컬러 순서대로 [앞, 뒤]. 이미지가 아직 없는 컬러는 원본 디자인 이미지로
 * 대체해 슬라이드 ↔ 컬러 선택 동기화가 항상 1:1 로 동작하게 한다.
 */
export const buildColorSlides = (colors: FundingColor[], fallbackImage: string | null): ColorSlide[] => {
  const slides: ColorSlide[] = [];
  for (const color of colors) {
    const views = (["front", "back"] as const).filter((view) => color.approved[view]?.url);
    if (views.length) {
      for (const view of views) {
        slides.push({ key: `${color.id}:${view}`, colorId: color.id, colorName: color.name, view, url: color.approved[view]!.url! });
      }
    } else if (fallbackImage) {
      slides.push({ key: `${color.id}:design`, colorId: color.id, colorName: color.name, view: "design", url: fallbackImage });
    }
  }
  if (!slides.length && fallbackImage) slides.push({ key: "design", colorId: null, colorName: "", view: "design", url: fallbackImage });
  return slides;
};

/** 컬러 선택 → 해당 컬러의 첫 슬라이드 */
export const slideIndexForColor = (slides: ColorSlide[], colorName: string) => {
  const key = normalize(colorName);
  return slides.findIndex((slide) => normalize(slide.colorName) === key);
};

/** 컬러 행과 주문 가능한 컬러명 목록을 합친다(컬러 행이 없는 과거 펀딩은 color_options 사용). */
export const orderableColorNames = (colors: FundingColor[], legacyOptions: string[]) =>
  colors.length ? colors.map((color) => color.name) : legacyOptions;

export const VIEW_LABEL: Record<ColorView, string> = { front: "앞면", back: "뒷면" };
