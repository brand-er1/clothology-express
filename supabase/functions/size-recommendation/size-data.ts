
export const typeMapping: Record<string, string> = {
  "티셔츠": "tshirt",
  "셔츠": "shirt",
  "후드": "hoodie",
  "맨투맨": "sweatshirt",
  "자켓": "jacket",
  "코트": "coat",
  "바지": "pants",
  "청바지": "jeans",
  "반바지": "shorts",
  "치마": "skirt",
  "원피스": "dress"
};

export const categoryMapping: Record<string, string> = {
  "tshirt": "tops",
  "shirt": "tops",
  "hoodie": "tops",
  "sweatshirt": "tops",
  "jacket": "outerwear",
  "coat": "outerwear",
  "pants": "bottoms",
  "jeans": "bottoms",
  "shorts": "bottoms",
  "skirt": "bottoms",
  "dress": "dresses"
};

export const heightRanges: Record<string, Record<string, { min: number, max: number }>> = {
  "men": {
    "XS": { min: 160, max: 165 },
    "S": { min: 166, max: 170 },
    "M": { min: 171, max: 175 },
    "L": { min: 176, max: 180 },
    "XL": { min: 181, max: 185 },
    "XXL": { min: 186, max: 195 }
  },
  "women": {
    "XS": { min: 150, max: 155 },
    "S": { min: 156, max: 160 },
    "M": { min: 161, max: 165 },
    "L": { min: 166, max: 170 },
    "XL": { min: 171, max: 175 },
    "XXL": { min: 176, max: 185 }
  }
};

// Define size charts for different categories and genders
export const sizeCharts: Record<string, Record<string, Record<string, Record<string, number>>>> = {
  "남성": {
    "tops": {
      "XS": { "shoulder": 41, "chest": 92, "sleeve": 59, "length": 65 },
      "S": { "shoulder": 43, "chest": 96, "sleeve": 60, "length": 67 },
      "M": { "shoulder": 45, "chest": 100, "sleeve": 61, "length": 69 },
      "L": { "shoulder": 47, "chest": 104, "sleeve": 62, "length": 71 },
      "XL": { "shoulder": 49, "chest": 108, "sleeve": 63, "length": 73 },
      "XXL": { "shoulder": 51, "chest": 112, "sleeve": 64, "length": 75 }
    },
    "outerwear": {
      "XS": { "shoulder": 43, "chest": 98, "sleeve": 61, "length": 68 },
      "S": { "shoulder": 45, "chest": 102, "sleeve": 62, "length": 70 },
      "M": { "shoulder": 47, "chest": 106, "sleeve": 63, "length": 72 },
      "L": { "shoulder": 49, "chest": 110, "sleeve": 64, "length": 74 },
      "XL": { "shoulder": 51, "chest": 114, "sleeve": 65, "length": 76 },
      "XXL": { "shoulder": 53, "chest": 118, "sleeve": 66, "length": 78 }
    },
    "bottoms": {
      "XS": { "waist": 74, "hip": 90, "thigh": 56, "length": 99, "inseam": 72 },
      "S": { "waist": 77, "hip": 93, "thigh": 58, "length": 100, "inseam": 73 },
      "M": { "waist": 80, "hip": 96, "thigh": 60, "length": 101, "inseam": 74 },
      "L": { "waist": 83, "hip": 99, "thigh": 62, "length": 102, "inseam": 75 },
      "XL": { "waist": 86, "hip": 102, "thigh": 64, "length": 103, "inseam": 76 },
      "XXL": { "waist": 89, "hip": 105, "thigh": 66, "length": 104, "inseam": 77 }
    }
  },
  "여성": {
    "tops": {
      "XS": { "shoulder": 36, "bust": 82, "sleeve": 56, "length": 60 },
      "S": { "shoulder": 37, "bust": 86, "sleeve": 57, "length": 62 },
      "M": { "shoulder": 38, "bust": 90, "sleeve": 58, "length": 64 },
      "L": { "shoulder": 39, "bust": 94, "sleeve": 59, "length": 66 },
      "XL": { "shoulder": 40, "bust": 98, "sleeve": 60, "length": 68 },
      "XXL": { "shoulder": 41, "bust": 102, "sleeve": 61, "length": 70 }
    },
    "outerwear": {
      "XS": { "shoulder": 38, "bust": 88, "sleeve": 58, "length": 65 },
      "S": { "shoulder": 39, "bust": 92, "sleeve": 59, "length": 67 },
      "M": { "shoulder": 40, "bust": 96, "sleeve": 60, "length": 69 },
      "L": { "shoulder": 41, "bust": 100, "sleeve": 61, "length": 71 },
      "XL": { "shoulder": 42, "bust": 104, "sleeve": 62, "length": 73 },
      "XXL": { "shoulder": 43, "bust": 108, "sleeve": 63, "length": 75 }
    },
    "bottoms": {
      "XS": { "waist": 64, "hip": 88, "thigh": 54, "length": 94, "inseam": 70 },
      "S": { "waist": 67, "hip": 91, "thigh": 56, "length": 95, "inseam": 71 },
      "M": { "waist": 70, "hip": 94, "thigh": 58, "length": 96, "inseam": 72 },
      "L": { "waist": 73, "hip": 97, "thigh": 60, "length": 97, "inseam": 73 },
      "XL": { "waist": 76, "hip": 100, "thigh": 62, "length": 98, "inseam": 74 },
      "XXL": { "waist": 79, "hip": 103, "thigh": 64, "length": 99, "inseam": 75 }
    },
    "dresses": {
      "XS": { "shoulder": 36, "bust": 82, "waist": 66, "hip": 90, "length": 90 },
      "S": { "shoulder": 37, "bust": 86, "waist": 70, "hip": 94, "length": 92 },
      "M": { "shoulder": 38, "bust": 90, "waist": 74, "hip": 98, "length": 94 },
      "L": { "shoulder": 39, "bust": 94, "waist": 78, "hip": 102, "length": 96 },
      "XL": { "shoulder": 40, "bust": 98, "waist": 82, "hip": 106, "length": 98 },
      "XXL": { "shoulder": 41, "bust": 102, "waist": 86, "hip": 110, "length": 100 }
    }
  }
};
