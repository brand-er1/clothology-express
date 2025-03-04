
import { Shirt, Scissors, PanelBottomClose } from "lucide-react";
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
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h12l-4 5h-4l-4-5z"/>
      <path d="M6 3l-2 7c0 1 .6 1 1 1h1v10h12V11h1c.4 0 1 0 1-1l-2-7"/>
      <path d="M6.5 8L6 10.5"/>
      <path d="M17.5 8l.5 2.5"/>
    </svg>,
    description: "시원하고 캐주얼한 반팔 티셔츠",
    category: "tops",
  },
  {
    id: "long_sleeve",
    name: "긴소매 티셔츠",
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h12l-4 5h-4l-4-5z"/>
      <path d="M6 3l-4 5c0 4 1 7 2 9l2 5h2V11h8v11h2l2-5c1-2 2-5 2-9l-4-5"/>
    </svg>,
    description: "편안하고 실용적인 긴소매 티셔츠",
    category: "tops",
  },
  {
    id: "sweatshirt",
    name: "맨투맨",
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h12l-4 5h-4l-4-5z"/>
      <path d="M6 3l-4 7c0 2 1 3 3 3h1v8h12v-8h1c2 0 3-1 3-3l-4-7"/>
      <path d="M10 12a2 2 0 0 0 4 0"/>
    </svg>,
    description: "포근하고 세련된 맨투맨",
    category: "tops",
  },
  {
    id: "jacket",
    name: "자켓",
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7.5 3h9l-1 7h-7l-1-7z"/>
      <path d="M3 10l4-7"/>
      <path d="M21 10l-4-7"/>
      <path d="M3 10v10h18V10"/>
      <path d="M9 17v-4"/>
      <path d="M15 17v-4"/>
    </svg>,
    description: "스타일리시한 자켓",
    category: "tops",
  },
  // Bottoms
  {
    id: "short_pants",
    name: "반바지",
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h12l-2 7h-8l-2-7z"/>
      <path d="M6 3l-2 12h4l2-9"/>
      <path d="M18 3l2 12h-4l-2-9"/>
    </svg>,
    description: "시원하고 활동적인 반바지",
    category: "bottoms",
  },
  {
    id: "long_pants",
    name: "긴바지",
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h12l-2 7h-8l-2-7z"/>
      <path d="M6 3l-2 19h4l2-14"/>
      <path d="M18 3l2 19h-4l-2-14"/>
    </svg>,
    description: "편안하고 세련된 긴바지",
    category: "bottoms",
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
