import { Shirt } from "lucide-react";
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
    id: "tights_short_sleeve",
    name: "상의형 타이즈 (반팔)",
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 3h10l3 4-3 4-2-2v12H9V9l-2 2-3-4 3-4z"/>
      <path d="M9 7c2 1 4 1 6 0"/>
      <path d="M12 8v13"/>
    </svg>,
    description: "반팔 컴프레션·기능성 타이즈",
    category: "tops",
  },
  {
    id: "tights_long_sleeve",
    name: "긴팔 타이즈",
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 3h10l4 5-3 12h-3V9H9v11H6L3 8l4-5z"/>
      <path d="M9 7c2 1 4 1 6 0"/>
      <path d="M12 8v13"/>
    </svg>,
    description: "긴팔 컴프레션 퍼포먼스 타이즈",
    category: "tops",
  },
  {
    id: "hoodie",
    name: "후드티",
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7c0-1 .9-2 2-2h14c1.1 0 2 1 2 2v12c0 1-.9 2-2 2H5c-1.1 0-2-1-2-2V7z"/>
      <path d="M7.5 2h9l-.9 5H8.4L7.5 2z"/>
      <path d="M8.4 7c-.3 2.5-2.4 3-2.4 3"/>
      <path d="M15.6 7c.3 2.5 2.4 3 2.4 3"/>
      <path d="M12 11v4"/>
      <path d="M10 13h4"/>
    </svg>,
    description: "편안하고 따뜻한 후드티",
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
    id: "knit",
    name: "니트",
    icon: <Shirt width={40} height={40} strokeWidth={1.5} />,
    description: "조직감과 실루엣을 살린 니트웨어 · MOQ 100장",
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
  {
    id: "leggings",
    name: "레깅스",
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 3h10l-1 7-1 11h-3V10h0v11H9L8 10 7 3z"/>
      <path d="M8 6h8"/>
    </svg>,
    description: "신축성 있는 스포츠·데일리 레깅스",
    category: "bottoms",
  },
  {
    id: "tights_bottom",
    name: "하의형 타이즈",
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 3h10l1 7-2 11h-3l-1-11-1 11H8L6 10l1-7z"/>
      <path d="M7 7h10"/>
      <path d="M12 8v2"/>
    </svg>,
    description: "바지 단가를 적용하는 하의 컴프레션 타이즈",
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

export const TOTAL_STEPS = 7;
