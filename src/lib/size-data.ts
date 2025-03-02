
// export type SizeInfo = {
//   size: string;
//   measurements: {
//     [key: string]: number;
//   };
// };

// type ClothingType = {
//   description: string;
//   sizes: SizeInfo[];
// };

// type HeightRange = {
//   range: string;
//   baseSize: string;
//   clothingTypes: {
//     [type: string]: ClothingType;
//   };
// };

// export const sizeData = {
//   men: {
//     heightRanges: [
//       {
//         range: "160~165",
//         baseSize: "XS (85)",
//         clothingTypes: {
//           outer_jacket: {
//             description: "아우터/자켓 (남성)",
//             sizes: [
//               {
//                 size: "XS",
//                 measurements: { shoulder: 41, chest: 111, waist: 101, sleeve: 82, length: 68 }
//               },
//               {
//                 size: "S",
//                 measurements: { shoulder: 43, chest: 116, waist: 106, sleeve: 84, length: 70 }
//               },
//               {
//                 size: "M",
//                 measurements: { shoulder: 45, chest: 121, waist: 111, sleeve: 86.5, length: 72 }
//               },
//               {
//                 size: "L",
//                 measurements: { shoulder: 47, chest: 126, waist: 116, sleeve: 89, length: 74 }
//               },
//               {
//                 size: "XL",
//                 measurements: { shoulder: 49, chest: 131, waist: 121, sleeve: 91.5, length: 76 }
//               },
//               {
//                 size: "XXL",
//                 measurements: { shoulder: 51, chest: 136, waist: 126, sleeve: 94, length: 78 }
//               },
//               {
//                 size: "XXXL",
//                 measurements: { shoulder: 53, chest: 141, waist: 131, sleeve: 96.5, length: 80 }
//               }
//             ]
//           },
//           short_sleeve: {
//             description: "반팔 티셔츠 (레귤러 핏, 남성)",
//             sizes: [
//               {
//                 size: "XS",
//                 measurements: { shoulder: 42, chest: 92, waist: 92, sleeve: 19, length: 68 }
//               },
//               {
//                 size: "S",
//                 measurements: { shoulder: 44, chest: 96, waist: 96, sleeve: 20, length: 70 }
//               },
//               {
//                 size: "M",
//                 measurements: { shoulder: 47, chest: 101, waist: 101, sleeve: 21, length: 72 }
//               },
//               {
//                 size: "L",
//                 measurements: { shoulder: 49, chest: 107, waist: 107, sleeve: 22, length: 74 }
//               },
//               {
//                 size: "XL",
//                 measurements: { shoulder: 52, chest: 113, waist: 113, sleeve: 23, length: 76 }
//               },
//               {
//                 size: "XXL",
//                 measurements: { shoulder: 54, chest: 120, waist: 120, sleeve: 24, length: 78 }
//               },
//               {
//                 size: "XXXL",
//                 measurements: { shoulder: 57, chest: 127, waist: 127, sleeve: 25, length: 80 }
//               }
//             ]
//           },
//         }
//       },
//       {
//         range: "165~170",
//         baseSize: "S (90)",
//         clothingTypes: {
//           outer_jacket: {
//             description: "아우터/자켓 (남성)",
//             sizes: [
//               {
//                 size: "XS",
//                 measurements: { shoulder: 41, chest: 111, waist: 101, sleeve: 82, length: 68 }
//               },
//               {
//                 size: "S",
//                 measurements: { shoulder: 43, chest: 116, waist: 106, sleeve: 84, length: 70 }
//               },
//               {
//                 size: "M",
//                 measurements: { shoulder: 45, chest: 121, waist: 111, sleeve: 86.5, length: 72 }
//               },
//               {
//                 size: "L",
//                 measurements: { shoulder: 47, chest: 126, waist: 116, sleeve: 89, length: 74 }
//               },
//               {
//                 size: "XL",
//                 measurements: { shoulder: 49, chest: 131, waist: 121, sleeve: 91.5, length: 76 }
//               },
//               {
//                 size: "XXL",
//                 measurements: { shoulder: 51, chest: 136, waist: 126, sleeve: 94, length: 78 }
//               },
//               {
//                 size: "XXXL",
//                 measurements: { shoulder: 53, chest: 141, waist: 131, sleeve: 96.5, length: 80 }
//               }
//             ]
//           },
//           short_sleeve: {
//             description: "반팔 티셔츠 (레귤러 핏, 남성)",
//             sizes: [
//               {
//                 size: "XS",
//                 measurements: { shoulder: 42, chest: 92, waist: 92, sleeve: 19, length: 68 }
//               },
//               {
//                 size: "S",
//                 measurements: { shoulder: 44, chest: 96, waist: 96, sleeve: 20, length: 70 }
//               },
//               {
//                 size: "M",
//                 measurements: { shoulder: 47, chest: 101, waist: 101, sleeve: 21, length: 72 }
//               },
//               {
//                 size: "L",
//                 measurements: { shoulder: 49, chest: 107, waist: 107, sleeve: 22, length: 74 }
//               },
//               {
//                 size: "XL",
//                 measurements: { shoulder: 52, chest: 113, waist: 113, sleeve: 23, length: 76 }
//               },
//               {
//                 size: "XXL",
//                 measurements: { shoulder: 54, chest: 120, waist: 120, sleeve: 24, length: 78 }
//               },
//               {
//                 size: "XXXL",
//                 measurements: { shoulder: 57, chest: 127, waist: 127, sleeve: 25, length: 80 }
//               }
//             ]
//           },
//         }
//       },
//       {
//         range: "170~175",
//         baseSize: "M (95)",
//         clothingTypes: {
//           outer_jacket: {
//             description: "아우터/자켓 (남성)",
//             sizes: [
//               {
//                 size: "XS",
//                 measurements: { shoulder: 41, chest: 111, waist: 101, sleeve: 82, length: 68 }
//               },
//               {
//                 size: "S",
//                 measurements: { shoulder: 43, chest: 116, waist: 106, sleeve: 84, length: 70 }
//               },
//               {
//                 size: "M",
//                 measurements: { shoulder: 45, chest: 121, waist: 111, sleeve: 86.5, length: 72 }
//               },
//               {
//                 size: "L",
//                 measurements: { shoulder: 47, chest: 126, waist: 116, sleeve: 89, length: 74 }
//               },
//               {
//                 size: "XL",
//                 measurements: { shoulder: 49, chest: 131, waist: 121, sleeve: 91.5, length: 76 }
//               },
//               {
//                 size: "XXL",
//                 measurements: { shoulder: 51, chest: 136, waist: 126, sleeve: 94, length: 78 }
//               },
//               {
//                 size: "XXXL",
//                 measurements: { shoulder: 53, chest: 141, waist: 131, sleeve: 96.5, length: 80 }
//               }
//             ]
//           },
//           short_sleeve: {
//             description: "반팔 티셔츠 (레귤러 핏, 남성)",
//             sizes: [
//               {
//                 size: "XS",
//                 measurements: { shoulder: 42, chest: 92, waist: 92, sleeve: 19, length: 68 }
//               },
//               {
//                 size: "S",
//                 measurements: { shoulder: 44, chest: 96, waist: 96, sleeve: 20, length: 70 }
//               },
//               {
//                 size: "M",
//                 measurements: { shoulder: 47, chest: 101, waist: 101, sleeve: 21, length: 72 }
//               },
//               {
//                 size: "L",
//                 measurements: { shoulder: 49, chest: 107, waist: 107, sleeve: 22, length: 74 }
//               },
//               {
//                 size: "XL",
//                 measurements: { shoulder: 52, chest: 113, waist: 113, sleeve: 23, length: 76 }
//               },
//               {
//                 size: "XXL",
//                 measurements: { shoulder: 54, chest: 120, waist: 120, sleeve: 24, length: 78 }
//               },
//               {
//                 size: "XXXL",
//                 measurements: { shoulder: 57, chest: 127, waist: 127, sleeve: 25, length: 80 }
//               }
//             ]
//           },
//         }
//       },
//       {
//         range: "175~180",
//         baseSize: "L (100)",
//         clothingTypes: {
//           outer_jacket: {
//             description: "아우터/자켓 (남성)",
//             sizes: [
//               {
//                 size: "XS",
//                 measurements: { shoulder: 41, chest: 111, waist: 101, sleeve: 82, length: 68 }
//               },
//               {
//                 size: "S",
//                 measurements: { shoulder: 43, chest: 116, waist: 106, sleeve: 84, length: 70 }
//               },
//               {
//                 size: "M",
//                 measurements: { shoulder: 45, chest: 121, waist: 111, sleeve: 86.5, length: 72 }
//               },
//               {
//                 size: "L",
//                 measurements: { shoulder: 47, chest: 126, waist: 116, sleeve: 89, length: 74 }
//               },
//               {
//                 size: "XL",
//                 measurements: { shoulder: 49, chest: 131, waist: 121, sleeve: 91.5, length: 76 }
//               },
//               {
//                 size: "XXL",
//                 measurements: { shoulder: 51, chest: 136, waist: 126, sleeve: 94, length: 78 }
//               },
//               {
//                 size: "XXXL",
//                 measurements: { shoulder: 53, chest: 141, waist: 131, sleeve: 96.5, length: 80 }
//               }
//             ]
//           },
//           short_sleeve: {
//             description: "반팔 티셔츠 (레귤러 핏, 남성)",
//             sizes: [
//               {
//                 size: "XS",
//                 measurements: { shoulder: 42, chest: 92, waist: 92, sleeve: 19, length: 68 }
//               },
//               {
//                 size: "S",
//                 measurements: { shoulder: 44, chest: 96, waist: 96, sleeve: 20, length: 70 }
//               },
//               {
//                 size: "M",
//                 measurements: { shoulder: 47, chest: 101, waist: 101, sleeve: 21, length: 72 }
//               },
//               {
//                 size: "L",
//                 measurements: { shoulder: 49, chest: 107, waist: 107, sleeve: 22, length: 74 }
//               },
//               {
//                 size: "XL",
//                 measurements: { shoulder: 52, chest: 113, waist: 113, sleeve: 23, length: 76 }
//               },
//               {
//                 size: "XXL",
//                 measurements: { shoulder: 54, chest: 120, waist: 120, sleeve: 24, length: 78 }
//               },
//               {
//                 size: "XXXL",
//                 measurements: { shoulder: 57, chest: 127, waist: 127, sleeve: 25, length: 80 }
//               }
//             ]
//           },
//         }
//       },
//       {
//         range: "180~185",
//         baseSize: "XL (105)",
//         clothingTypes: {
//           outer_jacket: {
//             description: "아우터/자켓 (남성)",
//             sizes: [
//               {
//                 size: "XS",
//                 measurements: { shoulder: 41, chest: 111, waist: 101, sleeve: 82, length: 68 }
//               },
//               {
//                 size: "S",
//                 measurements: { shoulder: 43, chest: 116, waist: 106, sleeve: 84, length: 70 }
//               },
//               {
//                 size: "M",
//                 measurements: { shoulder: 45, chest: 121, waist: 111, sleeve: 86.5, length: 72 }
//               },
//               {
//                 size: "L",
//                 measurements: { shoulder: 47, chest: 126, waist: 116, sleeve: 89, length: 74 }
//               },
//               {
//                 size: "XL",
//                 measurements: { shoulder: 49, chest: 131, waist: 121, sleeve: 91.5, length: 76 }
//               },
//               {
//                 size: "XXL",
//                 measurements: { shoulder: 51, chest: 136, waist: 126, sleeve: 94, length: 78 }
//               },
//               {
//                 size: "XXXL",
//                 measurements: { shoulder: 53, chest: 141, waist: 131, sleeve: 96.5, length: 80 }
//               }
//             ]
//           },
//           short_sleeve: {
//             description: "반팔 티셔츠 (레귤러 핏, 남성)",
//             sizes: [
//               {
//                 size: "XS",
//                 measurements: { shoulder: 42, chest: 92, waist: 92, sleeve: 19, length: 68 }
//               },
//               {
//                 size: "S",
//                 measurements: { shoulder: 44, chest: 96, waist: 96, sleeve: 20, length: 70 }
//               },
//               {
//                 size: "M",
//                 measurements: { shoulder: 47, chest: 101, waist: 101, sleeve: 21, length: 72 }
//               },
//               {
//                 size: "L",
//                 measurements: { shoulder: 49, chest: 107, waist: 107, sleeve: 22, length: 74 }
//               },
//               {
//                 size: "XL",
//                 measurements: { shoulder: 52, chest: 113, waist: 113, sleeve: 23, length: 76 }
//               },
//               {
//                 size: "XXL",
//                 measurements: { shoulder: 54, chest: 120, waist: 120, sleeve: 24, length: 78 }
//               },
//               {
//                 size: "XXXL",
//                 measurements: { shoulder: 57, chest: 127, waist: 127, sleeve: 25, length: 80 }
//               }
//             ]
//           },
//         }
//       },
//       {
//         range: "185~190",
//         baseSize: "XXL (110)",
//         clothingTypes: {
//           outer_jacket: {
//             description: "아우터/자켓 (남성)",
//             sizes: [
//               {
//                 size: "XS",
//                 measurements: { shoulder: 41, chest: 111, waist: 101, sleeve: 82, length: 68 }
//               },
//               {
//                 size: "S",
//                 measurements: { shoulder: 43, chest: 116, waist: 106, sleeve: 84, length: 70 }
//               },
//               {
//                 size: "M",
//                 measurements: { shoulder: 45, chest: 121, waist: 111, sleeve: 86.5, length: 72 }
//               },
//               {
//                 size: "L",
//                 measurements: { shoulder: 47, chest: 126, waist: 116, sleeve: 89, length: 74 }
//               },
//               {
//                 size: "XL",
//                 measurements: { shoulder: 49, chest: 131, waist: 121, sleeve: 91.5, length: 76 }
//               },
//               {
//                 size: "XXL",
//                 measurements: { shoulder: 51, chest: 136, waist: 126, sleeve: 94, length: 78 }
//               },
//               {
//                 size: "XXXL",
//                 measurements: { shoulder: 53, chest: 141, waist: 131, sleeve: 96.5, length: 80 }
//               }
//             ]
//           },
//           short_sleeve: {
//             description: "반팔 티셔츠 (레귤러 핏, 남성)",
//             sizes: [
//               {
//                 size: "XS",
//                 measurements: { shoulder: 42, chest: 92, waist: 92, sleeve: 19, length: 68 }
//               },
//               {
//                 size: "S",
//                 measurements: { shoulder: 44, chest: 96, waist: 96, sleeve: 20, length: 70 }
//               },
//               {
//                 size: "M",
//                 measurements: { shoulder: 47, chest: 101, waist: 101, sleeve: 21, length: 72 }
//               },
//               {
//                 size: "L",
//                 measurements: { shoulder: 49, chest: 107, waist: 107, sleeve: 22, length: 74 }
//               },
//               {
//                 size: "XL",
//                 measurements: { shoulder: 52, chest: 113, waist: 113, sleeve: 23, length: 76 }
//               },
//               {
//                 size: "XXL",
//                 measurements: { shoulder: 54, chest: 120, waist: 120, sleeve: 24, length: 78 }
//               },
//               {
//                 size: "XXXL",
//                 measurements: { shoulder: 57, chest: 127, waist: 127, sleeve: 25, length: 80 }
//               }
//             ]
//           },
//         }
//       },
//       {
//         range: "190~195",
//         baseSize: "XXXL (115)",
//         clothingTypes: {
//           outer_jacket: {
//             description: "아우터/자켓 (남성)",
//             sizes: [
//               {
//                 size: "XS",
//                 measurements: { shoulder: 41, chest: 111, waist: 101, sleeve: 82, length: 68 }
//               },
//               {
//                 size: "S",
//                 measurements: { shoulder: 43, chest: 116, waist: 106, sleeve: 84, length: 70 }
//               },
//               {
//                 size: "M",
//                 measurements: { shoulder: 45, chest: 121, waist: 111, sleeve: 86.5, length: 72 }
//               },
//               {
//                 size: "L",
//                 measurements: { shoulder: 47, chest: 126, waist: 116, sleeve: 89, length: 74 }
//               },
//               {
//                 size: "XL",
//                 measurements: { shoulder: 49, chest: 131, waist: 121, sleeve: 91.5, length: 76 }
//               },
//               {
//                 size: "XXL",
//                 measurements: { shoulder: 51, chest: 136, waist: 126, sleeve: 94, length: 78 }
//               },
//               {
//                 size: "XXXL",
//                 measurements: { shoulder: 53, chest: 141, waist: 131, sleeve: 96.5, length: 80 }
//               }
//             ]
//           },
//           short_sleeve: {
//             description: "반팔 티셔츠 (레귤러 핏, 남성)",
//             sizes: [
//               {
//                 size: "XS",
//                 measurements: { shoulder: 42, chest: 92, waist: 92, sleeve: 19, length: 68 }
//               },
//               {
//                 size: "S",
//                 measurements: { shoulder: 44, chest: 96, waist: 96, sleeve: 20, length: 70 }
//               },
//               {
//                 size: "M",
//                 measurements: { shoulder: 47, chest: 101, waist: 101, sleeve: 21, length: 72 }
//               },
//               {
//                 size: "L",
//                 measurements: { shoulder: 49, chest: 107, waist: 107, sleeve: 22, length: 74 }
//               },
//               {
//                 size: "XL",
//                 measurements: { shoulder: 52, chest: 113, waist: 113, sleeve: 23, length: 76 }
//               },
//               {
//                 size: "XXL",
//                 measurements: { shoulder: 54, chest: 120, waist: 120, sleeve: 24, length: 78 }
//               },
//               {
//                 size: "XXXL",
//                 measurements: { shoulder: 57, chest: 127, waist: 127, sleeve: 25, length: 80 }
//               }
//             ]
//           },
//         }
//       },
//     ]
//   },
//   women: {
//     heightRanges: [
//       {
//         range: "150~155",
//         baseSize: "XS (80)",
//         clothingTypes: {
//           outer_jacket: {
//             description: "아우터/자켓 (여성)",
//             sizes: [
//               {
//                 size: "XS",
//                 measurements: { shoulder: 37, bust: 85, waist: 75, sleeve: 56, length: 63 }
//               },
//               {
//                 size: "S",
//                 measurements: { shoulder: 38, bust: 90, waist: 80, sleeve: 58, length: 65 }
//               },
//               {
//                 size: "M",
//                 measurements: { shoulder: 40, bust: 95, waist: 85, sleeve: 60, length: 67 }
//               },
//               {
//                 size: "L",
//                 measurements: { shoulder: 42, bust: 100, waist: 90, sleeve: 62, length: 69 }
//               },
//               {
//                 size: "XL",
//                 measurements: { shoulder: 44, bust: 105, waist: 95, sleeve: 64, length: 71 }
//               },
//               {
//                 size: "XXL",
//                 measurements: { shoulder: 46, bust: 110, waist: 100, sleeve: 66, length: 73 }
//               },
//               {
//                 size: "XXXL",
//                 measurements: { shoulder: 48, bust: 115, waist: 105, sleeve: 68, length: 75 }
//               }
//             ]
//           },
//           short_sleeve: {
//             description: "반팔 티셔츠 (레귤러 핏, 여성)",
//             sizes: [
//               {
//                 size: "XS",
//                 measurements: { shoulder: 37, bust: 85, waist: 75, sleeve: 15, length: 58 }
//               },
//               {
//                 size: "S",
//                 measurements: { shoulder: 38, bust: 90, waist: 80, sleeve: 16, length: 60 }
//               },
//               {
//                 size: "M",
//                 measurements: { shoulder: 40, bust: 95, waist: 85, sleeve: 17, length: 62 }
//               },
//               {
//                 size: "L",
//                 measurements: { shoulder: 42, bust: 100, waist: 90, sleeve: 18, length: 64 }
//               },
//               {
//                 size: "XL",
//                 measurements: { shoulder: 44, bust: 105, waist: 95, sleeve: 19, length: 66 }
//               },
//               {
//                 size: "XXL",
//                 measurements: { shoulder: 46, bust: 110, waist: 100, sleeve: 20, length: 68 }
//               },
//               {
//                 size: "XXXL",
//                 measurements: { shoulder: 48, bust: 115, waist: 105, sleeve: 21, length: 70 }
//               }
//             ]
//           },
//         }
//       },
//     ]
//   }
// };

// // 사용 가능한 사이즈 목록 가져오기
// export const getAvailableSizes = (gender: string, clothingType: string): string[] => {
//   const genderData = gender === "남성" ? sizeData.men : sizeData.women;
  
//   for (const range of genderData.heightRanges) {
//     const clothing = range.clothingTypes[clothingType];
//     if (clothing) {
//       return clothing.sizes.map(size => size.size);
//     }
//   }
  
//   return ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];
// };

// // 선택한 사이즈의 측정값 가져오기
// export const getMeasurements = (gender: string, clothingType: string, size: string): Record<string, number> | null => {
//   const genderData = gender === "남성" ? sizeData.men : sizeData.women;
  
//   for (const range of genderData.heightRanges) {
//     const clothing = range.clothingTypes[clothingType];
//     if (clothing) {
//       const sizeInfo = clothing.sizes.find(s => s.size === size);
//       return sizeInfo?.measurements || null;
//     }
//   }
  
//   return null;
// };

// // 사이즈 가이드 정보 가져오기
// export const getSizeGuide = (gender: string, clothingType: string): { label: string; unit: string }[] => {
//   const genderData = gender === "남성" ? sizeData.men : sizeData.women;
  
//   for (const range of genderData.heightRanges) {
//     const clothing = range.clothingTypes[clothingType];
//     if (clothing && clothing.sizes[0]) {
//       return Object.keys(clothing.sizes[0].measurements).map(key => ({
//         label: getKoreanLabel(key),
//         unit: "cm"
//       }));
//     }
//   }
  
//   return [
//     { label: "총장", unit: "cm" },
//     { label: "어깨 너비", unit: "cm" },
//     { label: "가슴 둘레", unit: "cm" },
//     { label: "밑단 둘레", unit: "cm" }
//   ];
// };

// // 키 기반 사이즈 추천
// export const recommendSizeByHeight = (height: number, gender: string, clothingType: string): string => {
//   const genderData = gender === "남성" ? sizeData.men : sizeData.women;
  
//   for (const range of genderData.heightRanges) {
//     const [min, max] = range.range.split("~").map(Number);
//     if (height >= min && height <= max) {
//       if (range.clothingTypes[clothingType]) {
//         return range.clothingTypes[clothingType].sizes[0].size;
//       }
//       return range.baseSize;
//     }
//   }
  
//   return "M";
// };

// // 성별과 키를 기반으로 기본 사이즈 추천
// export const getBaseSizeByHeight = (gender: string, height: number): string => {
//   const genderData = gender === "남성" ? sizeData.men : sizeData.women;
  
//   for (const range of genderData.heightRanges) {
//     const [min, max] = range.range.split("~").map(Number);
//     if (height >= min && height <= max) {
//       return range.baseSize;
//     }
//   }
  
//   return "M (95)"; // 기본값
// };

// // 성별, 키, 의류 종류에 따른 상세 사이즈 정보 조회
// export const getDetailedSizeInfo = (
//   gender: string,
//   height: number,
//   clothingType: string
// ): SizeInfo | null => {
//   const genderData = gender === "남성" ? sizeData.men : sizeData.women;
  
//   // 키 범위 찾기
//   const heightRange = genderData.heightRanges.find(range => {
//     const [min, max] = range.range.split("~").map(Number);
//     return height >= min && height <= max;
//   });

//   if (!heightRange) return null;

//   // 해당 키 범위에서 의류 종류에 맞는 사이즈 정보 반환
//   return heightRange.clothingTypes[clothingType]?.sizes[0] || null;
// };

// // 한글 라벨로 변환
// const getKoreanLabel = (key: string): string => {
//   const labels: Record<string, string> = {
//     shoulder: "어깨 너비",
//     chest: "가슴 둘레",
//     bust: "가슴 둘레",
//     waist: "허리 둘레",
//     sleeve: "소매 길이",
//     length: "총장",
//     length_regular: "기장 (레귤러)",
//     length_wide: "기장 (와이드)",
//     length_skinny: "기장 (스키니)"
//   };
//   return labels[key] || key;
// };

// // 의류 종류별 한글 이름
// export const getClothingTypeLabel = (type: string): string => {
//   const types: Record<string, string> = {
//     outer_jacket: "아우터/자켓",
//     short_sleeve: "반팔 티셔츠",
//     long_sleeve_regular: "긴팔 티셔츠 (레귤러핏)",
//     long_sleeve_loose: "긴팔 티셔츠 (루즈핏)",
//     sweatshirt_regular: "맨투맨 (레귤러핏)",
//     sweatshirt_loose: "맨투맨 (루즈핏)",
//     shorts: "반바지",
//     long_pants: "긴바지"
//   };
//   return types[type] || type;
// };
