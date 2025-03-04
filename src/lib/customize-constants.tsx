import { Shirt, Scissors } from "lucide-react";
import React from 'react';

export type ClothType = {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  category: "tops" | "bottoms" | "custom";
};

export const clothTypes: ClothType[] = [
  // Tops
  {
    id: "short_sleeve",
    name: "반팔 티셔츠",
    icon: React.createElement(Shirt, { className: "w-8 h-8" }),
    description: "시원하고 캐주얼한 반팔 티셔츠",
    category: "tops",
  },
  {
    id: "long_sleeve",
    name: "긴소매 티셔츠",
    icon: React.createElement(Shirt, { className: "w-8 h-8" }),
    description: "편안하고 실용적인 긴소매 티셔츠",
    category: "tops",
  },
  {
    id: "sweatshirt",
    name: "맨투맨",
    icon: React.createElement(Shirt, { className: "w-8 h-8" }),
    description: "포근하고 세련된 맨투맨",
    category: "tops",
  },
  {
    id: "jacket",
    name: "자켓",
    icon: React.createElement(Shirt, { className: "w-8 h-8" }),
    description: "스타일리시한 자켓",
    category: "tops",
  },
  // Bottoms
  {
    id: "short_pants",
    name: "반바지",
    icon: React.createElement(Shirt, { className: "w-8 h-8" }),
    description: "시원하고 활동적인 반바지",
    category: "bottoms",
  },
  {
    id: "long_pants",
    name: "긴바지",
    icon: React.createElement(Shirt, { className: "w-8 h-8" }),
    description: "편안하고 세련된 긴바지",
    category: "bottoms",
  },
  // Custom
  {
    id: "custom",
    name: "커스텀",
    icon: React.createElement(Scissors, { className: "w-8 h-8" }),
    description: "나만의 특별한 의상을 제작해보세요 (※ 상황에 따라 주문이 반려될 수 있습니다)",
    category: "custom",
  },
];

export type StyleOption = {
  value: string;
  label: string;
};

export const styleOptions: StyleOption[] = [
  { value: "casual", label: "캐주얼" },
  { value: "formal", label: "포멀" },
  { value: "street", label: "스트릿" },
  { value: "modern", label: "모던" },
];

export type PocketOption = {
  value: string;
  label: string;
};

export const pocketOptions: PocketOption[] = [
  { value: "none", label: "없음" },
  { value: "one-chest", label: "가슴 포켓 1개" },
  { value: "two-side", label: "사이드 포켓 2개" },
  { value: "multiple", label: "멀티 포켓" },
];

export type ColorOption = {
  value: string;
  label: string;
  hex: string;
};

export const colorOptions: ColorOption[] = [
  { value: "black", label: "검정", hex: "#000000" },
  { value: "white", label: "흰색", hex: "#FFFFFF" },
  { value: "navy", label: "네이비", hex: "#000080" },
  { value: "gray", label: "회색", hex: "#808080" },
];

export type FitOption = {
  value: string;
  label: string;
};

export const fitOptions: FitOption[] = [
  { value: "loose", label: "루즈핏" },
  { value: "regular", label: "레귤러핏" },
  { value: "slim", label: "슬림핏" },
  { value: "oversized", label: "오버사이즈" },
];

export type TextureOption = {
  value: string;
  label: string;
};

export const textureOptions: TextureOption[] = [
  { value: "soft", label: "부드러움" },
  { value: "slightly_soft", label: "약간 부드러움" },
  { value: "medium", label: "보통" },
  { value: "slightly_stiff", label: "약간 뻣뻣함" },
  { value: "stiff", label: "뻣뻣함" },
];

export type ElasticityOption = {
  value: string;
  label: string;
};

export const elasticityOptions: ElasticityOption[] = [
  { value: "none", label: "없음" },
  { value: "minimal", label: "거의 없음" },
  { value: "medium", label: "보통" },
  { value: "moderate", label: "약간 있음" },
  { value: "high", label: "있음" },
];

export type TransparencyOption = {
  value: string;
  label: string;
};

export const transparencyOptions: TransparencyOption[] = [
  { value: "high", label: "있음" },
  { value: "moderate", label: "약간 있음" },
  { value: "medium", label: "보통" },
  { value: "minimal", label: "거의 없음" },
  { value: "none", label: "없음" },
];

export type ThicknessOption = {
  value: string;
  label: string;
};

export const thicknessOptions: ThicknessOption[] = [
  { value: "thin", label: "얇음" },
  { value: "slightly_thin", label: "약간 얇음" },
  { value: "medium", label: "보통" },
  { value: "slightly_thick", label: "약간 두꺼움" },
  { value: "thick", label: "두꺼움" },
];

export type SeasonOption = {
  value: string;
  label: string;
};

export const seasonOptions: SeasonOption[] = [
  { value: "spring", label: "봄" },
  { value: "summer", label: "여름" },
  { value: "fall", label: "가을" },
  { value: "winter", label: "겨울" },
];

export const TOTAL_STEPS = 5;
