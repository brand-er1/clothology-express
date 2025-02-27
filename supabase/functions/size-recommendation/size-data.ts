
// 남성과 여성의 의류 사이즈 데이터

export interface SizeDataItem {
  성별: '남성' | '여성';
  키: number;
  사이즈: string; // 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL' 등
  옷_종류: string; // 'short_sleeve', 'long_sleeve_regular', 'long_pants' 등
  그에_맞는_사이즈_표: {
    총장?: number;
    어깨너비?: number;
    가슴둘레?: number;
    허리둘레?: number;
    소매길이?: number;
    엉덩이둘레?: number;
    허벅지둘레?: number;
    밑단_너비?: number;
    인심?: number; // inseam (다리 안쪽 길이)
  };
}

// 키에 따른 사이즈 매핑 설정 (남성)
const menHeightToSize: { height: [number, number], size: string }[] = [
  { height: [160, 165], size: "XS" },
  { height: [165, 170], size: "S" },
  { height: [170, 175], size: "M" },
  { height: [175, 180], size: "L" },
  { height: [180, 185], size: "XL" },
  { height: [185, 190], size: "XXL" },
  { height: [190, 195], size: "XXXL" }
];

// 키에 따른 사이즈 매핑 설정 (여성)
const womenHeightToSize: { height: [number, number], size: string }[] = [
  { height: [150, 155], size: "XS" },
  { height: [155, 160], size: "S" },
  { height: [160, 165], size: "M" },
  { height: [165, 170], size: "L" },
  { height: [170, 175], size: "XL" },
  { height: [175, 180], size: "XXL" },
  { height: [180, 185], size: "XXXL" }
];

// 사이즈 데이터 생성 함수
function generateSizeData(): SizeDataItem[] {
  const sizeData: SizeDataItem[] = [];
  
  // 남성 데이터 생성
  menHeightToSize.forEach(({ height, size }) => {
    const avgHeight = Math.floor((height[0] + height[1]) / 2);
    
    // 아우터/자켓
    sizeData.push({
      성별: "남성",
      키: avgHeight,
      사이즈: size,
      옷_종류: "outer_jacket",
      그에_맞는_사이즈_표: {
        어깨너비: MEN.categories.outer_jacket.sizes[size].shoulder,
        가슴둘레: MEN.categories.outer_jacket.sizes[size].chest,
        허리둘레: MEN.categories.outer_jacket.sizes[size].waist,
        소매길이: MEN.categories.outer_jacket.sizes[size].sleeve,
        총장: MEN.categories.outer_jacket.sizes[size].length
      }
    });
    
    // 반팔 티셔츠
    sizeData.push({
      성별: "남성",
      키: avgHeight,
      사이즈: size,
      옷_종류: "short_sleeve",
      그에_맞는_사이즈_표: {
        어깨너비: MEN.categories.short_sleeve.sizes[size].shoulder,
        가슴둘레: MEN.categories.short_sleeve.sizes[size].chest,
        허리둘레: MEN.categories.short_sleeve.sizes[size].waist,
        소매길이: MEN.categories.short_sleeve.sizes[size].sleeve,
        총장: MEN.categories.short_sleeve.sizes[size].length
      }
    });
    
    // 긴팔 티셔츠 (레귤러)
    sizeData.push({
      성별: "남성",
      키: avgHeight,
      사이즈: size,
      옷_종류: "long_sleeve_regular",
      그에_맞는_사이즈_표: {
        어깨너비: MEN.categories.long_sleeve_regular.sizes[size].shoulder,
        가슴둘레: MEN.categories.long_sleeve_regular.sizes[size].chest,
        허리둘레: MEN.categories.long_sleeve_regular.sizes[size].waist,
        소매길이: MEN.categories.long_sleeve_regular.sizes[size].sleeve,
        총장: MEN.categories.long_sleeve_regular.sizes[size].length
      }
    });
    
    // 긴팔 티셔츠 (루즈)
    sizeData.push({
      성별: "남성",
      키: avgHeight,
      사이즈: size,
      옷_종류: "long_sleeve_loose",
      그에_맞는_사이즈_표: {
        어깨너비: MEN.categories.long_sleeve_loose.sizes[size].shoulder,
        가슴둘레: MEN.categories.long_sleeve_loose.sizes[size].chest,
        허리둘레: MEN.categories.long_sleeve_loose.sizes[size].waist,
        소매길이: MEN.categories.long_sleeve_loose.sizes[size].sleeve,
        총장: MEN.categories.long_sleeve_loose.sizes[size].length
      }
    });
    
    // 맨투맨/스웨트셔츠 (레귤러)
    sizeData.push({
      성별: "남성",
      키: avgHeight,
      사이즈: size,
      옷_종류: "sweatshirt_regular",
      그에_맞는_사이즈_표: {
        어깨너비: MEN.categories.sweatshirt_regular.sizes[size].shoulder,
        가슴둘레: MEN.categories.sweatshirt_regular.sizes[size].chest,
        허리둘레: MEN.categories.sweatshirt_regular.sizes[size].waist,
        소매길이: MEN.categories.sweatshirt_regular.sizes[size].sleeve,
        총장: MEN.categories.sweatshirt_regular.sizes[size].length
      }
    });
    
    // 맨투맨/스웨트셔츠 (루즈)
    sizeData.push({
      성별: "남성",
      키: avgHeight,
      사이즈: size,
      옷_종류: "sweatshirt_loose",
      그에_맞는_사이즈_표: {
        어깨너비: MEN.categories.sweatshirt_loose.sizes[size].shoulder,
        가슴둘레: MEN.categories.sweatshirt_loose.sizes[size].chest,
        허리둘레: MEN.categories.sweatshirt_loose.sizes[size].waist,
        소매길이: MEN.categories.sweatshirt_loose.sizes[size].sleeve,
        총장: MEN.categories.sweatshirt_loose.sizes[size].length
      }
    });
    
    // 반바지
    sizeData.push({
      성별: "남성",
      키: avgHeight,
      사이즈: size,
      옷_종류: "shorts",
      그에_맞는_사이즈_표: {
        허리둘레: MEN.categories.shorts.sizes[size].waist,
        총장: MEN.categories.shorts.sizes[size].length
      }
    });
    
    // 긴바지 (레귤러)
    sizeData.push({
      성별: "남성",
      키: avgHeight,
      사이즈: size,
      옷_종류: "long_pants_regular",
      그에_맞는_사이즈_표: {
        허리둘레: MEN.categories.long_pants.fits.regular[size].waist,
        엉덩이둘레: MEN.categories.long_pants.fits.regular[size].hip,
        허벅지둘레: MEN.categories.long_pants.fits.regular[size].thigh,
        인심: MEN.categories.long_pants.fits.regular[size].inseam,
        밑단_너비: MEN.categories.long_pants.fits.regular[size].bottom_width,
        총장: MEN.categories.long_pants.fits.regular[size].inseam
      }
    });
    
    // 긴바지 (와이드)
    sizeData.push({
      성별: "남성",
      키: avgHeight,
      사이즈: size,
      옷_종류: "long_pants_wide",
      그에_맞는_사이즈_표: {
        허리둘레: MEN.categories.long_pants.fits.wide[size].waist,
        엉덩이둘레: MEN.categories.long_pants.fits.wide[size].hip,
        허벅지둘레: MEN.categories.long_pants.fits.wide[size].thigh,
        인심: MEN.categories.long_pants.fits.wide[size].inseam,
        밑단_너비: MEN.categories.long_pants.fits.wide[size].bottom_width,
        총장: MEN.categories.long_pants.fits.wide[size].inseam
      }
    });
    
    // 긴바지 (스키니)
    sizeData.push({
      성별: "남성",
      키: avgHeight,
      사이즈: size,
      옷_종류: "long_pants_skinny",
      그에_맞는_사이즈_표: {
        허리둘레: MEN.categories.long_pants.fits.skinny[size].waist,
        엉덩이둘레: MEN.categories.long_pants.fits.skinny[size].hip,
        허벅지둘레: MEN.categories.long_pants.fits.skinny[size].thigh,
        인심: MEN.categories.long_pants.fits.skinny[size].inseam,
        밑단_너비: MEN.categories.long_pants.fits.skinny[size].bottom_width,
        총장: MEN.categories.long_pants.fits.skinny[size].inseam
      }
    });
  });
  
  // 여성 데이터 생성
  womenHeightToSize.forEach(({ height, size }) => {
    const avgHeight = Math.floor((height[0] + height[1]) / 2);
    
    // 아우터/자켓
    sizeData.push({
      성별: "여성",
      키: avgHeight,
      사이즈: size,
      옷_종류: "outer_jacket",
      그에_맞는_사이즈_표: {
        어깨너비: WOMEN.categories.outer_jacket.sizes[size].shoulder,
        가슴둘레: WOMEN.categories.outer_jacket.sizes[size].bust,
        허리둘레: WOMEN.categories.outer_jacket.sizes[size].waist,
        소매길이: WOMEN.categories.outer_jacket.sizes[size].sleeve,
        총장: WOMEN.categories.outer_jacket.sizes[size].length
      }
    });
    
    // 반팔 티셔츠
    sizeData.push({
      성별: "여성",
      키: avgHeight,
      사이즈: size,
      옷_종류: "short_sleeve",
      그에_맞는_사이즈_표: {
        어깨너비: WOMEN.categories.short_sleeve.sizes[size].shoulder,
        가슴둘레: WOMEN.categories.short_sleeve.sizes[size].bust,
        허리둘레: WOMEN.categories.short_sleeve.sizes[size].waist,
        소매길이: WOMEN.categories.short_sleeve.sizes[size].sleeve,
        총장: WOMEN.categories.short_sleeve.sizes[size].length
      }
    });
    
    // 긴팔 티셔츠 (레귤러)
    sizeData.push({
      성별: "여성",
      키: avgHeight,
      사이즈: size,
      옷_종류: "long_sleeve_regular",
      그에_맞는_사이즈_표: {
        어깨너비: WOMEN.categories.long_sleeve_regular.sizes[size].shoulder,
        가슴둘레: WOMEN.categories.long_sleeve_regular.sizes[size].bust,
        허리둘레: WOMEN.categories.long_sleeve_regular.sizes[size].waist,
        소매길이: WOMEN.categories.long_sleeve_regular.sizes[size].sleeve,
        총장: WOMEN.categories.long_sleeve_regular.sizes[size].length
      }
    });
    
    // 긴팔 티셔츠 (루즈)
    sizeData.push({
      성별: "여성",
      키: avgHeight,
      사이즈: size,
      옷_종류: "long_sleeve_loose",
      그에_맞는_사이즈_표: {
        어깨너비: WOMEN.categories.long_sleeve_loose.sizes[size].shoulder,
        가슴둘레: WOMEN.categories.long_sleeve_loose.sizes[size].bust,
        허리둘레: WOMEN.categories.long_sleeve_loose.sizes[size].waist,
        소매길이: WOMEN.categories.long_sleeve_loose.sizes[size].sleeve,
        총장: WOMEN.categories.long_sleeve_loose.sizes[size].length
      }
    });
    
    // 맨투맨/스웨트셔츠 (레귤러)
    sizeData.push({
      성별: "여성",
      키: avgHeight,
      사이즈: size,
      옷_종류: "sweatshirt_regular",
      그에_맞는_사이즈_표: {
        어깨너비: WOMEN.categories.sweatshirt_regular.sizes[size].shoulder,
        가슴둘레: WOMEN.categories.sweatshirt_regular.sizes[size].bust,
        허리둘레: WOMEN.categories.sweatshirt_regular.sizes[size].waist,
        소매길이: WOMEN.categories.sweatshirt_regular.sizes[size].sleeve,
        총장: WOMEN.categories.sweatshirt_regular.sizes[size].length
      }
    });
    
    // 맨투맨/스웨트셔츠 (루즈)
    sizeData.push({
      성별: "여성",
      키: avgHeight,
      사이즈: size,
      옷_종류: "sweatshirt_loose",
      그에_맞는_사이즈_표: {
        어깨너비: WOMEN.categories.sweatshirt_loose.sizes[size].shoulder,
        가슴둘레: WOMEN.categories.sweatshirt_loose.sizes[size].bust,
        허리둘레: WOMEN.categories.sweatshirt_loose.sizes[size].waist,
        소매길이: WOMEN.categories.sweatshirt_loose.sizes[size].sleeve,
        총장: WOMEN.categories.sweatshirt_loose.sizes[size].length
      }
    });
    
    // 반바지
    sizeData.push({
      성별: "여성",
      키: avgHeight,
      사이즈: size,
      옷_종류: "shorts",
      그에_맞는_사이즈_표: {
        허리둘레: WOMEN.categories.shorts.sizes[size].waist,
        총장: WOMEN.categories.shorts.sizes[size].length
      }
    });
    
    // 긴바지 (레귤러)
    sizeData.push({
      성별: "여성",
      키: avgHeight,
      사이즈: size,
      옷_종류: "long_pants_regular",
      그에_맞는_사이즈_표: {
        허리둘레: WOMEN.categories.long_pants.fits.regular[size].waist,
        엉덩이둘레: WOMEN.categories.long_pants.fits.regular[size].hip,
        허벅지둘레: WOMEN.categories.long_pants.fits.regular[size].thigh,
        인심: WOMEN.categories.long_pants.fits.regular[size].inseam,
        밑단_너비: WOMEN.categories.long_pants.fits.regular[size].bottom_width,
        총장: WOMEN.categories.long_pants.fits.regular[size].inseam
      }
    });
    
    // 긴바지 (와이드)
    sizeData.push({
      성별: "여성",
      키: avgHeight,
      사이즈: size,
      옷_종류: "long_pants_wide",
      그에_맞는_사이즈_표: {
        허리둘레: WOMEN.categories.long_pants.fits.wide[size].waist,
        엉덩이둘레: WOMEN.categories.long_pants.fits.wide[size].hip,
        허벅지둘레: WOMEN.categories.long_pants.fits.wide[size].thigh,
        인심: WOMEN.categories.long_pants.fits.wide[size].inseam,
        밑단_너비: WOMEN.categories.long_pants.fits.wide[size].bottom_width,
        총장: WOMEN.categories.long_pants.fits.wide[size].inseam
      }
    });
    
    // 긴바지 (스키니)
    sizeData.push({
      성별: "여성",
      키: avgHeight,
      사이즈: size,
      옷_종류: "long_pants_skinny",
      그에_맞는_사이즈_표: {
        허리둘레: WOMEN.categories.long_pants.fits.skinny[size].waist,
        엉덩이둘레: WOMEN.categories.long_pants.fits.skinny[size].hip,
        허벅지둘레: WOMEN.categories.long_pants.fits.skinny[size].thigh,
        인심: WOMEN.categories.long_pants.fits.skinny[size].inseam,
        밑단_너비: WOMEN.categories.long_pants.fits.skinny[size].bottom_width,
        총장: WOMEN.categories.long_pants.fits.skinny[size].inseam
      }
    });
  });
  
  return sizeData;
}

// 원본 데이터 정의 (남성)
const MEN = {
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
        XS: { shoulder: 41, chest: 111, waist: 101, sleeve: 82, length: 68 },
        S: { shoulder: 43, chest: 116, waist: 106, sleeve: 84, length: 70 },
        M: { shoulder: 45, chest: 121, waist: 111, sleeve: 86.5, length: 72 },
        L: { shoulder: 47, chest: 126, waist: 116, sleeve: 89, length: 74 },
        XL: { shoulder: 49, chest: 131, waist: 121, sleeve: 91.5, length: 76 },
        XXL: { shoulder: 51, chest: 136, waist: 126, sleeve: 94, length: 78 },
        XXXL: { shoulder: 53, chest: 141, waist: 131, sleeve: 96.5, length: 80 }
      }
    },
    short_sleeve: {
      description: "반팔 티셔츠 (레귤러 핏, 남성)",
      sizes: {
        XS: { shoulder: 42, chest: 92, waist: 92, sleeve: 19, length: 68 },
        S: { shoulder: 44, chest: 96, waist: 96, sleeve: 20, length: 70 },
        M: { shoulder: 47, chest: 101, waist: 101, sleeve: 21, length: 72 },
        L: { shoulder: 49, chest: 107, waist: 107, sleeve: 22, length: 74 },
        XL: { shoulder: 52, chest: 113, waist: 113, sleeve: 23, length: 76 },
        XXL: { shoulder: 54, chest: 120, waist: 120, sleeve: 24, length: 78 },
        XXXL: { shoulder: 57, chest: 127, waist: 127, sleeve: 25, length: 80 }
      }
    },
    long_sleeve_regular: {
      description: "긴팔 티셔츠 (레귤러 핏, 남성)",
      sizes: {
        XS: { shoulder: 42, chest: 92, waist: 92, sleeve: 58, length: 68 },
        S: { shoulder: 44, chest: 96, waist: 96, sleeve: 60, length: 70 },
        M: { shoulder: 47, chest: 101, waist: 101, sleeve: 61, length: 72 },
        L: { shoulder: 49, chest: 107, waist: 107, sleeve: 62, length: 74 },
        XL: { shoulder: 52, chest: 113, waist: 113, sleeve: 63, length: 76 },
        XXL: { shoulder: 54, chest: 120, waist: 120, sleeve: 64, length: 78 },
        XXXL: { shoulder: 57, chest: 127, waist: 127, sleeve: 65, length: 80 }
      }
    },
    long_sleeve_loose: {
      description: "긴팔 티셔츠 (루즈 핏, 남성)",
      sizes: {
        XS: { shoulder: 45, chest: 100, waist: 100, sleeve: 60, length: 70 },
        S: { shoulder: 47, chest: 104, waist: 104, sleeve: 62, length: 72 },
        M: { shoulder: 50, chest: 109, waist: 109, sleeve: 63, length: 74 },
        L: { shoulder: 52, chest: 115, waist: 115, sleeve: 64, length: 76 },
        XL: { shoulder: 55, chest: 121, waist: 121, sleeve: 65, length: 78 },
        XXL: { shoulder: 57, chest: 128, waist: 128, sleeve: 66, length: 80 },
        XXXL: { shoulder: 60, chest: 135, waist: 135, sleeve: 67, length: 82 }
      }
    },
    sweatshirt_regular: {
      description: "맨투맨/스웨트셔츠 (레귤러 핏, 남성)",
      sizes: {
        XS: { shoulder: 44, chest: 97, waist: 92, sleeve: 59, length: 66 },
        S: { shoulder: 46, chest: 101, waist: 96, sleeve: 61, length: 68 },
        M: { shoulder: 49, chest: 106, waist: 101, sleeve: 62, length: 70 },
        L: { shoulder: 51, chest: 112, waist: 107, sleeve: 63, length: 72 },
        XL: { shoulder: 54, chest: 118, waist: 113, sleeve: 64, length: 74 },
        XXL: { shoulder: 56, chest: 125, waist: 120, sleeve: 65, length: 76 },
        XXXL: { shoulder: 59, chest: 132, waist: 127, sleeve: 66, length: 78 }
      }
    },
    sweatshirt_loose: {
      description: "맨투맨/스웨트셔츠 (루즈 핏, 남성)",
      sizes: {
        XS: { shoulder: 48, chest: 105, waist: 100, sleeve: 60, length: 68 },
        S: { shoulder: 50, chest: 109, waist: 104, sleeve: 62, length: 70 },
        M: { shoulder: 53, chest: 114, waist: 109, sleeve: 63, length: 72 },
        L: { shoulder: 55, chest: 120, waist: 115, sleeve: 64, length: 74 },
        XL: { shoulder: 58, chest: 126, waist: 121, sleeve: 65, length: 76 },
        XXL: { shoulder: 60, chest: 133, waist: 128, sleeve: 66, length: 78 },
        XXXL: { shoulder: 63, chest: 140, waist: 135, sleeve: 67, length: 80 }
      }
    },
    shorts: {
      description: "반바지 (남성)",
      sizes: {
        XS: { waist: 73, length: 42 },
        S: { waist: 77, length: 44 },
        M: { waist: 81, length: 46 },
        L: { waist: 85, length: 48 },
        XL: { waist: 89, length: 50 },
        XXL: { waist: 93, length: 52 },
        XXXL: { waist: 97, length: 54 }
      }
    },
    long_pants: {
      description: "긴바지 (남성)",
      fits: {
        regular: {
          XS: { waist: 70, hip: 91, thigh: 52, inseam: 100, bottom_width: 18 },
          S: { waist: 75, hip: 96, thigh: 55, inseam: 103, bottom_width: 19 },
          M: { waist: 80, hip: 101, thigh: 58, inseam: 106, bottom_width: 20 },
          L: { waist: 85, hip: 106, thigh: 61, inseam: 109, bottom_width: 21 },
          XL: { waist: 90, hip: 111, thigh: 64, inseam: 112, bottom_width: 22 },
          XXL: { waist: 95, hip: 116, thigh: 66, inseam: 115, bottom_width: 23 },
          XXXL: { waist: 100, hip: 121, thigh: 68, inseam: 118, bottom_width: 24 }
        },
        wide: {
          XS: { waist: 70, hip: 91, thigh: 56, inseam: 100, bottom_width: 22 },
          S: { waist: 75, hip: 96, thigh: 59, inseam: 103, bottom_width: 23 },
          M: { waist: 80, hip: 101, thigh: 62, inseam: 106, bottom_width: 24 },
          L: { waist: 85, hip: 106, thigh: 66, inseam: 109, bottom_width: 25 },
          XL: { waist: 90, hip: 111, thigh: 70, inseam: 112, bottom_width: 26 },
          XXL: { waist: 95, hip: 116, thigh: 72, inseam: 115, bottom_width: 27 },
          XXXL: { waist: 100, hip: 121, thigh: 74, inseam: 118, bottom_width: 28 }
        },
        skinny: {
          XS: { waist: 70, hip: 91, thigh: 48, inseam: 100, bottom_width: 14 },
          S: { waist: 75, hip: 96, thigh: 51, inseam: 103, bottom_width: 15 },
          M: { waist: 80, hip: 101, thigh: 54, inseam: 106, bottom_width: 16 },
          L: { waist: 85, hip: 106, thigh: 57, inseam: 109, bottom_width: 17 },
          XL: { waist: 90, hip: 111, thigh: 60, inseam: 112, bottom_width: 18 },
          XXL: { waist: 95, hip: 116, thigh: 62, inseam: 115, bottom_width: 19 },
          XXXL: { waist: 100, hip: 121, thigh: 64, inseam: 118, bottom_width: 20 }
        }
      }
    }
  }
};

// 원본 데이터 정의 (여성)
const WOMEN = {
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
        XS: { shoulder: 37, bust: 85, waist: 75, sleeve: 56, length: 63 },
        S: { shoulder: 38, bust: 90, waist: 80, sleeve: 58, length: 65 },
        M: { shoulder: 40, bust: 95, waist: 85, sleeve: 60, length: 67 },
        L: { shoulder: 42, bust: 100, waist: 90, sleeve: 62, length: 69 },
        XL: { shoulder: 44, bust: 105, waist: 95, sleeve: 64, length: 71 },
        XXL: { shoulder: 46, bust: 110, waist: 100, sleeve: 66, length: 73 },
        XXXL: { shoulder: 48, bust: 115, waist: 105, sleeve: 68, length: 75 }
      }
    },
    short_sleeve: {
      description: "반팔 티셔츠 (레귤러 핏, 여성)",
      sizes: {
        XS: { shoulder: 37, bust: 85, waist: 75, sleeve: 15, length: 58 },
        S: { shoulder: 38, bust: 90, waist: 80, sleeve: 16, length: 60 },
        M: { shoulder: 40, bust: 95, waist: 85, sleeve: 17, length: 62 },
        L: { shoulder: 42, bust: 100, waist: 90, sleeve: 18, length: 64 },
        XL: { shoulder: 44, bust: 105, waist: 95, sleeve: 19, length: 66 },
        XXL: { shoulder: 46, bust: 110, waist: 100, sleeve: 20, length: 68 },
        XXXL: { shoulder: 48, bust: 115, waist: 105, sleeve: 21, length: 70 }
      }
    },
    long_sleeve_regular: {
      description: "긴팔 티셔츠 (레귤러 핏, 여성)",
      sizes: {
        XS: { shoulder: 37, bust: 85, waist: 75, sleeve: 56, length: 58 },
        S: { shoulder: 38, bust: 90, waist: 80, sleeve: 58, length: 60 },
        M: { shoulder: 40, bust: 95, waist: 85, sleeve: 60, length: 62 },
        L: { shoulder: 42, bust: 100, waist: 90, sleeve: 62, length: 64 },
        XL: { shoulder: 44, bust: 105, waist: 95, sleeve: 64, length: 66 },
        XXL: { shoulder: 46, bust: 110, waist: 100, sleeve: 66, length: 68 },
        XXXL: { shoulder: 48, bust: 115, waist: 105, sleeve: 68, length: 70 }
      }
    },
    long_sleeve_loose: {
      description: "긴팔 티셔츠 (루즈 핏, 여성)",
      sizes: {
        XS: { shoulder: 40, bust: 93, waist: 88, sleeve: 58, length: 60 },
        S: { shoulder: 41, bust: 98, waist: 93, sleeve: 60, length: 62 },
        M: { shoulder: 43, bust: 103, waist: 98, sleeve: 62, length: 64 },
        L: { shoulder: 45, bust: 108, waist: 103, sleeve: 64, length: 66 },
        XL: { shoulder: 47, bust: 113, waist: 108, sleeve: 66, length: 68 },
        XXL: { shoulder: 49, bust: 118, waist: 113, sleeve: 68, length: 70 },
        XXXL: { shoulder: 51, bust: 123, waist: 118, sleeve: 70, length: 72 }
      }
    },
    sweatshirt_regular: {
      description: "맨투맨/스웨트셔츠 (레귤러 핏, 여성)",
      sizes: {
        XS: { shoulder: 39, bust: 90, waist: 85, sleeve: 57, length: 56 },
        S: { shoulder: 40, bust: 95, waist: 90, sleeve: 59, length: 58 },
        M: { shoulder: 42, bust: 100, waist: 95, sleeve: 60, length: 60 },
        L: { shoulder: 44, bust: 105, waist: 100, sleeve: 62, length: 62 },
        XL: { shoulder: 46, bust: 110, waist: 105, sleeve: 64, length: 64 },
        XXL: { shoulder: 48, bust: 115, waist: 110, sleeve: 66, length: 66 },
        XXXL: { shoulder: 50, bust: 120, waist: 115, sleeve: 68, length: 68 }
      }
    },
    sweatshirt_loose: {
      description: "맨투맨/스웨트셔츠 (루즈 핏, 여성)",
      sizes: {
        XS: { shoulder: 43, bust: 98, waist: 93, sleeve: 58, length: 58 },
        S: { shoulder: 44, bust: 103, waist: 98, sleeve: 60, length: 60 },
        M: { shoulder: 46, bust: 108, waist: 103, sleeve: 62, length: 62 },
        L: { shoulder: 48, bust: 113, waist: 108, sleeve: 64, length: 64 },
        XL: { shoulder: 50, bust: 118, waist: 113, sleeve: 66, length: 66 },
        XXL: { shoulder: 52, bust: 123, waist: 118, sleeve: 68, length: 68 },
        XXXL: { shoulder: 54, bust: 128, waist: 123, sleeve: 70, length: 70 }
      }
    },
    shorts: {
      description: "반바지 (여성)",
      sizes: {
        XS: { waist: 61, length: 30 },
        S: { waist: 66, length: 32 },
        M: { waist: 71, length: 34 },
        L: { waist: 76, length: 36 },
        XL: { waist: 81, length: 38 },
        XXL: { waist: 86, length: 40 },
        XXXL: { waist: 91, length: 42 }
      }
    },
    long_pants: {
      description: "긴바지 (여성)",
      fits: {
        regular: {
          XS: { waist: 60, hip: 80, thigh: 45, inseam: 96, bottom_width: 16 },
          S: { waist: 65, hip: 85, thigh: 48, inseam: 98, bottom_width: 17 },
          M: { waist: 70, hip: 90, thigh: 51, inseam: 100, bottom_width: 18 },
          L: { waist: 75, hip: 95, thigh: 54, inseam: 102, bottom_width: 19 },
          XL: { waist: 80, hip: 100, thigh: 57, inseam: 104, bottom_width: 20 },
          XXL: { waist: 85, hip: 105, thigh: 60, inseam: 106, bottom_width: 21 },
          XXXL: { waist: 90, hip: 110, thigh: 62, inseam: 108, bottom_width: 22 }
        },
        wide: {
          XS: { waist: 60, hip: 80, thigh: 48, inseam: 96, bottom_width: 20 },
          S: { waist: 65, hip: 85, thigh: 52, inseam: 98, bottom_width: 21 },
          M: { waist: 70, hip: 90, thigh: 55, inseam: 100, bottom_width: 22 },
          L: { waist: 75, hip: 95, thigh: 58, inseam: 102, bottom_width: 23 },
          XL: { waist: 80, hip: 100, thigh: 61, inseam: 104, bottom_width: 24 },
          XXL: { waist: 85, hip: 105, thigh: 64, inseam: 106, bottom_width: 25 },
          XXXL: { waist: 90, hip: 110, thigh: 66, inseam: 108, bottom_width: 26 }
        },
        skinny: {
          XS: { waist: 60, hip: 80, thigh: 42, inseam: 96, bottom_width: 12 },
          S: { waist: 65, hip: 85, thigh: 44, inseam: 98, bottom_width: 13 },
          M: { waist: 70, hip: 90, thigh: 47, inseam: 100, bottom_width: 14 },
          L: { waist: 75, hip: 95, thigh: 50, inseam: 102, bottom_width: 15 },
          XL: { waist: 80, hip: 100, thigh: 53, inseam: 104, bottom_width: 16 },
          XXL: { waist: 85, hip: 105, thigh: 56, inseam: 106, bottom_width: 17 },
          XXXL: { waist: 90, hip: 110, thigh: 58, inseam: 108, bottom_width: 18 }
        }
      }
    }
  }
};

// 최종 사이즈 데이터 생성 및 내보내기
export const sizeData: SizeDataItem[] = generateSizeData();
