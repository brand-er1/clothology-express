
export type Size = {
  id: string;
  category: "tops" | "bottoms";
  name: string;
  measurements: {
    label: string;
    min: number;
    max: number;
    unit: string;
  }[];
};

// 상의 사이즈 정의
export const topSizes: Size[] = [
  {
    id: "top-s",
    category: "tops",
    name: "S",
    measurements: [
      { label: "총장", min: 65, max: 67, unit: "cm" },
      { label: "어깨넓이", min: 43, max: 45, unit: "cm" },
      { label: "가슴둘레", min: 48, max: 50, unit: "cm" },
      { label: "밑단둘레", min: 46, max: 48, unit: "cm" },
      { label: "소매길이", min: 59, max: 61, unit: "cm" },
    ],
  },
  {
    id: "top-m",
    category: "tops",
    name: "M",
    measurements: [
      { label: "총장", min: 67, max: 69, unit: "cm" },
      { label: "어깨넓이", min: 45, max: 47, unit: "cm" },
      { label: "가슴둘레", min: 50, max: 52, unit: "cm" },
      { label: "밑단둘레", min: 48, max: 50, unit: "cm" },
      { label: "소매길이", min: 61, max: 63, unit: "cm" },
    ],
  },
  {
    id: "top-l",
    category: "tops",
    name: "L",
    measurements: [
      { label: "총장", min: 69, max: 71, unit: "cm" },
      { label: "어깨넓이", min: 47, max: 49, unit: "cm" },
      { label: "가슴둘레", min: 52, max: 54, unit: "cm" },
      { label: "밑단둘레", min: 50, max: 52, unit: "cm" },
      { label: "소매길이", min: 63, max: 65, unit: "cm" },
    ],
  },
];

// 하의 사이즈 정의
export const bottomSizes: Size[] = [
  {
    id: "bottom-s",
    category: "bottoms",
    name: "S",
    measurements: [
      { label: "총장", min: 95, max: 97, unit: "cm" },
      { label: "허리둘레", min: 35, max: 37, unit: "cm" },
      { label: "엉덩이단면", min: 47, max: 49, unit: "cm" },
      { label: "허벅지단면", min: 28, max: 30, unit: "cm" },
    ],
  },
  {
    id: "bottom-m",
    category: "bottoms",
    name: "M",
    measurements: [
      { label: "총장", min: 97, max: 99, unit: "cm" },
      { label: "허리둘레", min: 37, max: 39, unit: "cm" },
      { label: "엉덩이단면", min: 49, max: 51, unit: "cm" },
      { label: "허벅지단면", min: 30, max: 32, unit: "cm" },
    ],
  },
  {
    id: "bottom-l",
    category: "bottoms",
    name: "L",
    measurements: [
      { label: "총장", min: 99, max: 101, unit: "cm" },
      { label: "허리둘레", min: 39, max: 41, unit: "cm" },
      { label: "엉덩이단면", min: 51, max: 53, unit: "cm" },
      { label: "허벅지단면", min: 32, max: 34, unit: "cm" },
    ],
  },
];
