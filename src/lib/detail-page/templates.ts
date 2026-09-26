import type { DetailLayoutId, DetailPageTemplateId } from "@/types/detailPage";

export type DetailTemplateMeta = {
  id: DetailPageTemplateId;
  number: string;
  name: string;
  label: string;
  description: string;
  /** Preview swatch: background, ink, accent. */
  swatch: [string, string, string];
  /** Renderer layout this style is built on. */
  layout: DetailLayoutId;
};

export const DETAIL_TEMPLATES: DetailTemplateMeta[] = [
  {
    id: "minimal",
    layout: "minimal",
    number: "01",
    name: "MINIMAL",
    label: "미니멀",
    description: "깔끔한 패션 브랜드 쇼핑몰. 라벨-본문 2단 구성과 정사각 이미지.",
    swatch: ["#ffffff", "#1c1917", "#741b2b"],
  },
  {
    id: "street",
    layout: "street",
    number: "02",
    name: "STREET",
    label: "스트리트",
    description: "강한 타이포그래피, 블랙/화이트 교차 섹션, 풀블리드 이미지.",
    swatch: ["#0c0c0c", "#f5f5f0", "#741b2b"],
  },
  {
    id: "luxury",
    layout: "luxury",
    number: "03",
    name: "LUXURY",
    label: "럭셔리",
    description: "세리프 서체와 넓은 여백, 세로로 긴 에디토리얼 이미지 배치.",
    swatch: ["#f6f2ea", "#2a2522", "#8a6d4b"],
  },
  {
    id: "sports",
    layout: "sports",
    number: "04",
    name: "SPORTS",
    label: "스포츠",
    description: "스펙시트형 그리드, 수치 강조, 활동성을 강조한 와이드 레이아웃.",
    swatch: ["#eef0f2", "#11161c", "#741b2b"],
  },
  {
    id: "casual",
    layout: "casual",
    number: "05",
    name: "CASUAL",
    label: "캐주얼",
    description: "밝고 친근한 데일리웨어. 부드러운 톤과 큰 본문, 체크리스트형 포인트.",
    swatch: ["#fbf7f0", "#2d2a26", "#c2703d"],
  },
  {
    id: "vintage",
    layout: "luxury",
    number: "06",
    name: "VINTAGE",
    label: "빈티지",
    description: "바랜 필름 톤과 세리프 타이포. 시간이 쌓인 듯한 따뜻한 에디토리얼.",
    swatch: ["#efe6d6", "#3b2f25", "#9c5b2e"],
  },
  {
    id: "y2k",
    layout: "street",
    number: "07",
    name: "Y2K",
    label: "Y2K",
    description: "비비드 컬러와 굵은 타이포, 2000년대 팝 무드의 교차 섹션.",
    swatch: ["#1a0b2e", "#fdf2ff", "#ff4fd8"],
  },
  {
    id: "emotional",
    layout: "casual",
    number: "08",
    name: "EMOTIONAL",
    label: "감성적",
    description: "파스텔 톤과 넓은 여백, 에세이처럼 읽히는 부드러운 구성.",
    swatch: ["#f7f1f3", "#3d3438", "#b07a8c"],
  },
  {
    id: "lookbook",
    layout: "minimal",
    number: "09",
    name: "LOOKBOOK",
    label: "브랜드 룩북",
    description: "시즌 룩북처럼 큰 이미지 중심, 절제된 캡션과 에디토리얼 그리드.",
    swatch: ["#f2f1ee", "#141414", "#741b2b"],
  },
];

/** Renderer layout for a style (new styles reuse one of the five base layouts). */
export const getLayoutTemplate = (id: DetailPageTemplateId): DetailLayoutId =>
  DETAIL_TEMPLATES.find((template) => template.id === id)?.layout ?? "minimal";

export const isDetailTemplateId = (value: unknown): value is DetailPageTemplateId =>
  DETAIL_TEMPLATES.some((template) => template.id === value);

export const getDetailTemplateMeta = (id: DetailPageTemplateId) =>
  DETAIL_TEMPLATES.find((template) => template.id === id) ?? DETAIL_TEMPLATES[0];
