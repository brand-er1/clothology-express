
// Size data for different clothing types
export const sizeData = {
  // Men's standard body measurements in cm
  men: {
    xs: { chest: 84, waist: 71, hips: 87, height: 165 },
    s: { chest: 89, waist: 76, hips: 92, height: 170 },
    m: { chest: 94, waist: 81, hips: 97, height: 175 },
    l: { chest: 99, waist: 86, hips: 102, height: 180 },
    xl: { chest: 104, waist: 91, hips: 107, height: 185 },
    xxl: { chest: 109, waist: 96, hips: 112, height: 190 },
  },
  
  // Women's standard body measurements in cm
  women: {
    xs: { bust: 80, waist: 62, hips: 88, height: 160 },
    s: { bust: 84, waist: 66, hips: 92, height: 165 },
    m: { bust: 88, waist: 70, hips: 96, height: 170 },
    l: { bust: 92, waist: 74, hips: 100, height: 175 },
    xl: { bust: 96, waist: 78, hips: 104, height: 180 },
    xxl: { bust: 100, waist: 82, hips: 108, height: 185 },
  },
  
  // Clothing specific sizing
  tops: {
    men: {
      xs: { shoulder: 42, chest: 86, length: 65, sleeve: 60 },
      s: { shoulder: 44, chest: 92, length: 68, sleeve: 62 },
      m: { shoulder: 46, chest: 98, length: 71, sleeve: 64 },
      l: { shoulder: 48, chest: 104, length: 74, sleeve: 66 },
      xl: { shoulder: 50, chest: 110, length: 77, sleeve: 68 },
      xxl: { shoulder: 52, chest: 116, length: 80, sleeve: 70 },
    },
    women: {
      xs: { shoulder: 37, bust: 82, length: 60, sleeve: 56 },
      s: { shoulder: 38, bust: 86, length: 62, sleeve: 57 },
      m: { shoulder: 39, bust: 90, length: 64, sleeve: 58 },
      l: { shoulder: 40, bust: 94, length: 66, sleeve: 59 },
      xl: { shoulder: 41, bust: 98, length: 68, sleeve: 60 },
      xxl: { shoulder: 42, bust: 102, length: 70, sleeve: 61 },
    }
  },
  
  bottoms: {
    men: {
      xs: { waist: 71, hips: 87, inseam: 76, outseam: 100 },
      s: { waist: 76, hips: 92, inseam: 78, outseam: 102 },
      m: { waist: 81, hips: 97, inseam: 80, outseam: 104 },
      l: { waist: 86, hips: 102, inseam: 82, outseam: 106 },
      xl: { waist: 91, hips: 107, inseam: 84, outseam: 108 },
      xxl: { waist: 96, hips: 112, inseam: 86, outseam: 110 },
    },
    women: {
      xs: { waist: 62, hips: 88, inseam: 73, outseam: 96 },
      s: { waist: 66, hips: 92, inseam: 74, outseam: 98 },
      m: { waist: 70, hips: 96, inseam: 75, outseam: 100 },
      l: { waist: 74, hips: 100, inseam: 76, outseam: 102 },
      xl: { waist: 78, hips: 104, inseam: 77, outseam: 104 },
      xxl: { waist: 82, hips: 108, inseam: 78, outseam: 106 },
    }
  },
  
  outerwear: {
    men: {
      xs: { shoulder: 44, chest: 90, length: 68, sleeve: 62 },
      s: { shoulder: 46, chest: 96, length: 71, sleeve: 64 },
      m: { shoulder: 48, chest: 102, length: 74, sleeve: 66 },
      l: { shoulder: 50, chest: 108, length: 77, sleeve: 68 },
      xl: { shoulder: 52, chest: 114, length: 80, sleeve: 70 },
      xxl: { shoulder: 54, chest: 120, length: 83, sleeve: 72 },
    },
    women: {
      xs: { shoulder: 38, bust: 86, length: 62, sleeve: 58 },
      s: { shoulder: 39, bust: 90, length: 64, sleeve: 59 },
      m: { shoulder: 40, bust: 94, length: 66, sleeve: 60 },
      l: { shoulder: 41, bust: 98, length: 68, sleeve: 61 },
      xl: { shoulder: 42, bust: 102, length: 70, sleeve: 62 },
      xxl: { shoulder: 43, bust: 106, length: 72, sleeve: 63 },
    }
  },
  
  dresses: {
    women: {
      xs: { bust: 82, waist: 62, hips: 88, length: 90 },
      s: { bust: 86, waist: 66, hips: 92, length: 92 },
      m: { bust: 90, waist: 70, hips: 96, length: 94 },
      l: { bust: 94, waist: 74, hips: 100, length: 96 },
      xl: { bust: 98, waist: 78, hips: 104, length: 98 },
      xxl: { bust: 102, waist: 82, hips: 108, length: 100 },
    }
  },
  
  suits: {
    men: {
      xs: { shoulder: 43, chest: 88, waist: 73, sleeve: 61, inseam: 76 },
      s: { shoulder: 45, chest: 94, waist: 78, sleeve: 63, inseam: 78 },
      m: { shoulder: 47, chest: 100, waist: 83, sleeve: 65, inseam: 80 },
      l: { shoulder: 49, chest: 106, waist: 88, sleeve: 67, inseam: 82 },
      xl: { shoulder: 51, chest: 112, waist: 93, sleeve: 69, inseam: 84 },
      xxl: { shoulder: 53, chest: 118, waist: 98, sleeve: 71, inseam: 86 },
    },
    women: {
      xs: { shoulder: 37.5, bust: 84, waist: 64, sleeve: 57, inseam: 73 },
      s: { shoulder: 38.5, bust: 88, waist: 68, sleeve: 58, inseam: 74 },
      m: { shoulder: 39.5, bust: 92, waist: 72, sleeve: 59, inseam: 75 },
      l: { shoulder: 40.5, bust: 96, waist: 76, sleeve: 60, inseam: 76 },
      xl: { shoulder: 41.5, bust: 100, waist: 80, sleeve: 61, inseam: 77 },
      xxl: { shoulder: 42.5, bust: 104, waist: 84, sleeve: 62, inseam: 78 },
    }
  }
};

// Tolerance values for size recommendations
export const tolerances = {
  chest: 4,
  bust: 4,
  waist: 4,
  hips: 4,
  shoulder: 2,
  sleeve: 2,
  length: 3,
  inseam: 2,
  outseam: 3,
  height: 5
};

// Size ranges with comfortable fit consideration
export const sizeRanges = {
  men: {
    xs: { min: { height: 160, chest: 80, waist: 67, hips: 83 }, max: { height: 170, chest: 88, waist: 75, hips: 91 } },
    s: { min: { height: 165, chest: 85, waist: 72, hips: 88 }, max: { height: 175, chest: 93, waist: 80, hips: 96 } },
    m: { min: { height: 170, chest: 90, waist: 77, hips: 93 }, max: { height: 180, chest: 98, waist: 85, hips: 101 } },
    l: { min: { height: 175, chest: 95, waist: 82, hips: 98 }, max: { height: 185, chest: 103, waist: 90, hips: 106 } },
    xl: { min: { height: 180, chest: 100, waist: 87, hips: 103 }, max: { height: 190, chest: 108, waist: 95, hips: 111 } },
    xxl: { min: { height: 185, chest: 105, waist: 92, hips: 108 }, max: { height: 195, chest: 113, waist: 100, hips: 116 } }
  },
  women: {
    xs: { min: { height: 155, bust: 76, waist: 58, hips: 84 }, max: { height: 165, bust: 84, waist: 66, hips: 92 } },
    s: { min: { height: 160, bust: 80, waist: 62, hips: 88 }, max: { height: 170, bust: 88, waist: 70, hips: 96 } },
    m: { min: { height: 165, bust: 84, waist: 66, hips: 92 }, max: { height: 175, bust: 92, waist: 74, hips: 100 } },
    l: { min: { height: 170, bust: 88, waist: 70, hips: 96 }, max: { height: 180, bust: 96, waist: 78, hips: 104 } },
    xl: { min: { height: 175, bust: 92, waist: 74, hips: 100 }, max: { height: 185, bust: 100, waist: 82, hips: 108 } },
    xxl: { min: { height: 180, bust: 96, waist: 78, hips: 104 }, max: { height: 190, bust: 104, waist: 86, hips: 112 } }
  }
};

// Map clothing types to their relevant measurement categories
export const measurementCategories = {
  "상의": ["shoulder", "chest", "bust", "length", "sleeve"],
  "하의": ["waist", "hips", "inseam", "outseam"],
  "아우터": ["shoulder", "chest", "bust", "length", "sleeve"],
  "드레스": ["bust", "waist", "hips", "length"],
  "정장": ["shoulder", "chest", "bust", "waist", "sleeve", "inseam"]
};

// English translation mapping
export const clothingTypeTranslation = {
  "상의": "tops",
  "하의": "bottoms",
  "아우터": "outerwear",
  "드레스": "dresses",
  "정장": "suits"
};

// Gender translation
export const genderTranslation = {
  "남성": "men",
  "여성": "women"
};
