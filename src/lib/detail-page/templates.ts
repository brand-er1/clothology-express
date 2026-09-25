import type { DetailPageTemplateId } from "@/types/detailPage";

export type DetailTemplateMeta = {
  id: DetailPageTemplateId;
  number: string;
  name: string;
  label: string;
  description: string;
  /** Preview swatch: background, ink, accent. */
  swatch: [string, string, string];
};

export const DETAIL_TEMPLATES: DetailTemplateMeta[] = [
  {
    id: "minimal",
    number: "01",
    name: "MINIMAL",
    label: "미니멀",
    description: "깔끔한 패션 브랜드 쇼핑몰. 라벨-본문 2단 구성과 정사각 이미지.",
    swatch: ["#ffffff", "#1c1917", "#741b2b"],
  },
  {
    id: "street",
    number: "02",
    name: "STREET",
    label: "스트리트",
    description: "강한 타이포그래피, 블랙/화이트 교차 섹션, 풀블리드 이미지.",
    swatch: ["#0c0c0c", "#f5f5f0", "#741b2b"],
  },
  {
    id: "luxury",
    number: "03",
    name: "LUXURY",
    label: "럭셔리",
    description: "세리프 서체와 넓은 여백, 세로로 긴 에디토리얼 이미지 배치.",
    swatch: ["#f6f2ea", "#2a2522", "#8a6d4b"],
  },
  {
    id: "sports",
    number: "04",
    name: "SPORTS",
    label: "스포츠",
    description: "스펙시트형 그리드, 수치 강조, 활동성을 강조한 와이드 레이아웃.",
    swatch: ["#eef0f2", "#11161c", "#741b2b"],
  },
  {
    id: "casual",
    number: "05",
    name: "CASUAL",
    label: "캐주얼",
    description: "밝고 친근한 데일리웨어. 부드러운 톤과 큰 본문, 체크리스트형 포인트.",
    swatch: ["#fbf7f0", "#2d2a26", "#c2703d"],
  },
];

export const isDetailTemplateId = (value: unknown): value is DetailPageTemplateId =>
  DETAIL_TEMPLATES.some((template) => template.id === value);

export const getDetailTemplateMeta = (id: DetailPageTemplateId) =>
  DETAIL_TEMPLATES.find((template) => template.id === id) ?? DETAIL_TEMPLATES[0];
