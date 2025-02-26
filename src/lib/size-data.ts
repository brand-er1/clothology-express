type MeasurementData = {
  [key: string]: number;
};

type SizeData = {
  [size: string]: MeasurementData;
};

type ClothingData = {
  [type: string]: {
    description: string;
    sizes: SizeData;
  };
};

type GenderData = {
  recommendedSizes: Array<{
    height: string;
    size: string;
  }>;
  categories: ClothingData;
};

export const sizeData: {
  men: GenderData;
  women: GenderData;
} = {
  men: {
    recommendedSizes: [
      { height: "160 ~ 165", size: "XS (85)" },
      { height: "165 ~ 170", size: "S (90)" },
      { height: "170 ~ 175", size: "M (95)" },
      { height: "175 ~ 180", size: "L (100)" },
      { height: "180 ~ 185", size: "XL (105)" },
      { height: "185 ~ 190", size: "XXL (110)" },
      { height: "190 ~ 195", size: "XXXL (115)" }
    ],
    categories: {
      outer_jacket: {
        description: "아우터/자켓 (남성)",
        sizes: {
          "XS": { shoulder: 41, chest: 111, waist: 101, sleeve: 82, length: 68 },
          "S": { shoulder: 43, chest: 116, waist: 106, sleeve: 84, length: 70 },
          "M": { shoulder: 45, chest: 121, waist: 111, sleeve: 86.5, length: 72 },
          "L": { shoulder: 47, chest: 126, waist: 116, sleeve: 89, length: 74 },
          "XL": { shoulder: 49, chest: 131, waist: 121, sleeve: 91.5, length: 76 },
          "XXL": { shoulder: 51, chest: 136, waist: 126, sleeve: 94, length: 78 },
          "XXXL": { shoulder: 53, chest: 141, waist: 131, sleeve: 96.5, length: 80 }
        }
      },
      short_sleeve: {
        description: "반팔 티셔츠 (레귤러 핏, 남성)",
        sizes: {
          "XS": { "shoulder": 42, "chest": 92, "waist": 92, "sleeve": 19, "length": 68 },
          "S": { "shoulder": 44, "chest": 96, "waist": 96, "sleeve": 20, "length": 70 },
          "M": { "shoulder": 47, "chest": 101, "waist": 101, "sleeve": 21, "length": 72 },
          "L": { "shoulder": 49, "chest": 107, "waist": 107, "sleeve": 22, "length": 74 },
          "XL": { "shoulder": 52, "chest": 113, "waist": 113, "sleeve": 23, "length": 76 },
          "XXL": { "shoulder": 54, "chest": 120, "waist": 120, "sleeve": 24, "length": 78 },
          "XXXL": { "shoulder": 57, "chest": 127, "waist": 127, "sleeve": 25, "length": 80 }
        }
      },
      long_sleeve_regular: {
        description: "긴팔 티셔츠 (레귤러 핏, 남성)",
        sizes: {
          "XS": { "shoulder": 42, "chest": 92, "waist": 92, "sleeve": 58, "length": 68 },
          "S": { "shoulder": 44, "chest": 96, "waist": 96, "sleeve": 60, "length": 70 },
          "M": { "shoulder": 47, "chest": 101, "waist": 101, "sleeve": 61, "length": 72 },
          "L": { "shoulder": 49, "chest": 107, "waist": 107, "sleeve": 62, "length": 74 },
          "XL": { "shoulder": 52, "chest": 113, "waist": 113, "sleeve": 63, "length": 76 },
          "XXL": { "shoulder": 54, "chest": 120, "waist": 120, "sleeve": 64, "length": 78 },
          "XXXL": { "shoulder": 57, "chest": 127, "waist": 127, "sleeve": 65, "length": 80 }
        }
      },
      long_sleeve_loose: {
        description: "긴팔 티셔츠 (루즈 핏, 남성)",
        sizes: {
          "XS": { "shoulder": 45, "chest": 100, "waist": 100, "sleeve": 60, "length": 70 },
          "S": { "shoulder": 47, "chest": 104, "waist": 104, "sleeve": 62, "length": 72 },
          "M": { "shoulder": 50, "chest": 109, "waist": 109, "sleeve": 63, "length": 74 },
          "L": { "shoulder": 52, "chest": 115, "waist": 115, "sleeve": 64, "length": 76 },
          "XL": { "shoulder": 55, "chest": 121, "waist": 121, "sleeve": 65, "length": 78 },
          "XXL": { "shoulder": 57, "chest": 128, "waist": 128, "sleeve": 66, "length": 80 },
          "XXXL": { "shoulder": 60, "chest": 135, "waist": 135, "sleeve": 67, "length": 82 }
        }
      },
      sweatshirt_regular: {
        description: "맨투맨/스웨트셔츠 (레귤러 핏, 남성)",
        sizes: {
          "XS": { "shoulder": 44, "chest": 97, "waist": 92, "sleeve": 59, "length": 66 },
          "S": { "shoulder": 46, "chest": 101, "waist": 96, "sleeve": 61, "length": 68 },
          "M": { "shoulder": 49, "chest": 106, "waist": 101, "sleeve": 62, "length": 70 },
          "L": { "shoulder": 51, "chest": 112, "waist": 107, "sleeve": 63, "length": 72 },
          "XL": { "shoulder": 54, "chest": 118, "waist": 113, "sleeve": 64, "length": 74 },
          "XXL": { "shoulder": 56, "chest": 125, "waist": 120, "sleeve": 65, "length": 76 },
          "XXXL": { "shoulder": 59, "chest": 132, "waist": 127, "sleeve": 66, "length": 78 }
        }
      },
      sweatshirt_loose: {
        description: "맨투맨/스웨트셔츠 (루즈 핏, 남성)",
        sizes: {
          "XS": { "shoulder": 48, "chest": 105, "waist": 100, "sleeve": 60, "length": 68 },
          "S": { "shoulder": 50, "chest": 109, "waist": 104, "sleeve": 62, "length": 70 },
          "M": { "shoulder": 53, "chest": 114, "waist": 109, "sleeve": 63, "length": 72 },
          "L": { "shoulder": 55, "chest": 120, "waist": 115, "sleeve": 64, "length": 74 },
          "XL": { "shoulder": 58, "chest": 126, "waist": 121, "sleeve": 65, "length": 76 },
          "XXL": { "shoulder": 60, "chest": 133, "waist": 128, "sleeve": 66, "length": 78 },
          "XXXL": { "shoulder": 63, "chest": 140, "waist": 135, "sleeve": 67, "length": 80 }
        }
      },
      shorts: {
        description: "반바지 (남성)",
        sizes: {
          "XS": { "waist": 73, "length": 42 },
          "S": { "waist": 77, "length": 44 },
          "M": { "waist": 81, "length": 46 },
          "L": { "waist": 85, "length": 48 },
          "XL": { "waist": 89, "length": 50 },
          "XXL": { "waist": 93, "length": 52 },
          "XXXL": { "waist": 97, "length": 54 }
        }
      },
      long_pants: {
        description: "긴바지 (남성)",
        sizes: {
          "XS": { "waist": 73, "length_regular": 93, "length_wide": 95, "length_skinny": 91 },
          "S": { "waist": 77, "length_regular": 94, "length_wide": 96, "length_skinny": 92 },
          "M": { "waist": 81, "length_regular": 95, "length_wide": 97, "length_skinny": 93 },
          "L": { "waist": 85, "length_regular": 96, "length_wide": 98, "length_skinny": 94 },
          "XL": { "waist": 89, "length_regular": 97, "length_wide": 99, "length_skinny": 95 },
          "XXL": { "waist": 93, "length_regular": 98, "length_wide": 100, "length_skinny": 96 },
          "XXXL": { "waist": 97, "length_regular": 99, "length_wide": 101, "length_skinny": 97 }
        }
      }
    }
  },
  women: {
    recommendedSizes: [
      { height: "150 ~ 155", size: "XS (44)" },
      { height: "155 ~ 160", size: "S (55)" },
      { height: "160 ~ 165", size: "M (66)" },
      { height: "165 ~ 170", size: "L (77)" },
      { height: "170 ~ 175", size: "XL (88)" },
      { height: "175 ~ 180", size: "XXL (99)" },
      { height: "180 ~ 185", size: "XXXL (110)" }
    ],
    categories: {
      outer_jacket: {
        description: "아우터/자켓 (여성)",
        sizes: {
          "XS": { shoulder: 37, bust: 85, waist: 75, sleeve: 56, length: 63 },
          "S": { shoulder: 38, bust: 90, waist: 80, sleeve: 58, length: 65 },
          "M": { shoulder: 40, bust: 95, waist: 85, sleeve: 60, length: 67 },
          "L": { shoulder: 42, bust: 100, waist: 90, sleeve: 62, length: 69 },
          "XL": { shoulder: 44, bust: 105, waist: 95, sleeve: 64, length: 71 },
          "XXL": { shoulder: 46, bust: 110, waist: 100, sleeve: 66, length: 73 },
          "XXXL": { shoulder: 48, bust: 115, waist: 105, sleeve: 68, length: 75 }
        }
      },
      short_sleeve: {
        description: "반팔 티셔츠 (레귤러 핏, 여성)",
        sizes: {
          "XS": { "shoulder": 37, "bust": 85, "waist": 75, "sleeve": 15, "length": 58 },
          "S": { "shoulder": 38, "bust": 90, "waist": 80, "sleeve": 16, "length": 60 },
          "M": { "shoulder": 40, "bust": 95, "waist": 85, "sleeve": 17, "length": 62 },
          "L": { "shoulder": 42, "bust": 100, "waist": 90, "sleeve": 18, "length": 64 },
          "XL": { "shoulder": 44, "bust": 105, "waist": 95, "sleeve": 19, "length": 66 },
          "XXL": { "shoulder": 46, "bust": 110, "waist": 100, "sleeve": 20, "length": 68 },
          "XXXL": { "shoulder": 48, "bust": 115, "waist": 105, "sleeve": 21, "length": 70 }
        }
      },
      long_sleeve_regular: {
        description: "긴팔 티셔츠 (레귤러 핏, 여성)",
        sizes: {
          "XS": { "shoulder": 37, "bust": 85, "waist": 75, "sleeve": 56, "length": 58 },
          "S": { "shoulder": 38, "bust": 90, "waist": 80, "sleeve": 58, "length": 60 },
          "M": { "shoulder": 40, "bust": 95, "waist": 85, "sleeve": 60, "length": 62 },
          "L": { "shoulder": 42, "bust": 100, "waist": 90, "sleeve": 62, "length": 64 },
          "XL": { "shoulder": 44, "bust": 105, "waist": 95, "sleeve": 64, "length": 66 },
          "XXL": { "shoulder": 46, "bust": 110, "waist": 100, "sleeve": 66, "length": 68 },
          "XXXL": { "shoulder": 48, "bust": 115, "waist": 105, "sleeve": 68, "length": 70 }
        }
      },
      long_sleeve_loose: {
        description: "긴팔 티셔츠 (루즈 핏, 여성)",
        sizes: {
          "XS": { "shoulder": 40, "bust": 93, "waist": 88, "sleeve": 58, "length": 60 },
          "S": { "shoulder": 41, "bust": 98, "waist": 93, "sleeve": 60, "length": 62 },
          "M": { "shoulder": 43, "bust": 103, "waist": 98, "sleeve": 62, "length": 64 },
          "L": { "shoulder": 45, "bust": 108, "waist": 103, "sleeve": 64, "length": 66 },
          "XL": { "shoulder": 47, "bust": 113, "waist": 108, "sleeve": 66, "length": 68 },
          "XXL": { "shoulder": 49, "bust": 118, "waist": 113, "sleeve": 68, "length": 70 },
          "XXXL": { "shoulder": 51, "bust": 123, "waist": 118, "sleeve": 70, "length": 72 }
        }
      },
      sweatshirt_regular: {
        description: "맨투맨/스웨트셔츠 (레귤러 핏, 여성)",
        sizes: {
          "XS": { "shoulder": 39, "bust": 90, "waist": 85, "sleeve": 57, "length": 56 },
          "S": { "shoulder": 40, "bust": 95, "waist": 90, "sleeve": 59, "length": 58 },
          "M": { "shoulder": 42, "bust": 100, "waist": 95, "sleeve": 60, "length": 60 },
          "L": { "shoulder": 44, "bust": 105, "waist": 100, "sleeve": 62, "length": 62 },
          "XL": { "shoulder": 46, "bust": 110, "waist": 105, "sleeve": 64, "length": 64 },
          "XXL": { "shoulder": 48, "bust": 115, "waist": 110, "sleeve": 66, "length": 66 },
          "XXXL": { "shoulder": 50, "bust": 120, "waist": 115, "sleeve": 68, "length": 68 }
        }
      },
      sweatshirt_loose: {
        description: "맨투맨/스웨트셔츠 (루즈 핏, 여성)",
        sizes: {
          "XS": { "shoulder": 43, "bust": 98, "waist": 93, "sleeve": 58, "length": 58 },
          "S": { "shoulder": 44, "bust": 103, "waist": 98, "sleeve": 60, "length": 60 },
          "M": { "shoulder": 46, "bust": 108, "waist": 103, "sleeve": 62, "length": 62 },
          "L": { "shoulder": 48, "bust": 113, "waist": 108, "sleeve": 64, "length": 64 },
          "XL": { "shoulder": 50, "bust": 118, "waist": 113, "sleeve": 66, "length": 66 },
          "XXL": { "shoulder": 52, "bust": 123, "waist": 118, "sleeve": 68, "length": 68 },
          "XXXL": { "shoulder": 54, "bust": 128, "waist": 123, "sleeve": 70, "length": 70 }
        }
      },
      shorts: {
        description: "반바지 (여성)",
        sizes: {
          "XS": { "waist": 61, "length": 30 },
          "S": { "waist": 66, "length": 32 },
          "M": { "waist": 71, "length": 34 },
          "L": { "waist": 76, "length": 36 },
          "XL": { "waist": 81, "length": 38 },
          "XXL": { "waist": 86, "length": 40 },
          "XXXL": { "waist": 91, "length": 42 }
        }
      },
      long_pants: {
        description: "긴바지 (여성)",
        sizes: {
          "XS": { "waist": 61, "length_regular": 92, "length_wide": 94, "length_skinny": 90 },
          "S": { "waist": 66, "length_regular": 94, "length_wide": 96, "length_skinny": 92 },
          "M": { "waist": 71, "length_regular": 96, "length_wide": 98, "length_skinny": 94 },
          "L": { "waist": 76, "length_regular": 98, "length_wide": 100, "length_skinny": 96 },
          "XL": { "waist": 81, "length_regular": 100, "length_wide": 102, "length_skinny": 98 },
          "XXL": { "waist": 86, "length_regular": 102, "length_wide": 104, "length_skinny": 100 },
          "XXXL": { "waist": 91, "length_regular": 104, "length_wide": 106, "length_skinny": 102 }
        }
      }
    }
  }
};

export const getAvailableSizes = (gender: string, clothType: string): string[] => {
  const genderKey = gender === "남성" ? "men" : "women";
  const categoryKey = getCategoryKey(clothType);
  
  try {
    return Object.keys(sizeData[genderKey].categories[categoryKey].sizes);
  } catch (e) {
    return ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];
  }
};

export const getMeasurements = (gender: string, clothType: string, size: string): MeasurementData | null => {
  const genderKey = gender === "남성" ? "men" : "women";
  const categoryKey = getCategoryKey(clothType);
  
  try {
    return sizeData[genderKey].categories[categoryKey].sizes[size];
  } catch (e) {
    return null;
  }
};

export const getSizeGuide = (gender: string, clothType: string): { label: string; unit: string }[] => {
  const genderKey = gender === "남성" ? "men" : "women";
  const categoryKey = getCategoryKey(clothType);
  
  try {
    const measurements = sizeData[genderKey].categories[categoryKey].sizes["M"];
    return Object.keys(measurements).map(key => ({
      label: getKoreanLabel(key),
      unit: "cm"
    }));
  } catch (e) {
    return [
      { label: "총장", unit: "cm" },
      { label: "어깨 너비", unit: "cm" },
      { label: "가슴 둘레", unit: "cm" },
      { label: "밑단 둘레", unit: "cm" }
    ];
  }
};

// 한글 라벨로 변환
const getKoreanLabel = (key: string): string => {
  const labels: Record<string, string> = {
    shoulder: "어깨 너비",
    chest: "가슴 둘레",
    bust: "가슴 둘레",
    waist: "허리 둘레",
    sleeve: "소매 길이",
    length: "총장",
    length_regular: "기장 (레귤러)",
    length_wide: "기장 (와이드)",
    length_skinny: "기장 (스키니)"
  };
  return labels[key] || key;
};

// 카테고리 키 매핑
const getCategoryKey = (type: string): string => {
  const categoryMap: Record<string, string> = {
    "아우터": "outer_jacket",
    "티셔츠 레귤러핏": "short_sleeve",
    "티셔츠 루즈핏": "long_sleeve_loose",
    "맨투맨 레귤러핏": "sweatshirt_regular",
    "맨투맨 루즈핏": "sweatshirt_loose",
    "하의": "long_pants"
  };
  return categoryMap[type] || "outer_jacket";
};

// 키를 기반으로 사이즈 추천
export const recommendSizeByHeight = (height: number, gender: string): string => {
  const genderKey = gender === "남성" ? "men" : "women";
  const recommendations = sizeData[genderKey].recommendedSizes;
  
  for (const rec of recommendations) {
    const [min, max] = rec.height.split(" ~ ").map(h => parseInt(h));
    if (height >= min && height <= max) {
      return rec.size.split(" ")[0]; // XS, S, M, L, XL, XXL, XXXL만 반환
    }
  }
  
  return "M"; // 기본값
};
