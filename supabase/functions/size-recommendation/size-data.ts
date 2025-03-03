
// This file contains size data for different clothing types and body measurements

// Size chart for men's tops
export const mensTopsSizeChart = {
  "XS": {
    "shoulder": 42,
    "chest": 90,
    "sleeve": 60,
    "length": 65
  },
  "S": {
    "shoulder": 44,
    "chest": 95,
    "sleeve": 61,
    "length": 67
  },
  "M": {
    "shoulder": 46,
    "chest": 100,
    "sleeve": 62,
    "length": 69
  },
  "L": {
    "shoulder": 48,
    "chest": 105,
    "sleeve": 63,
    "length": 71
  },
  "XL": {
    "shoulder": 50,
    "chest": 110,
    "sleeve": 64,
    "length": 73
  },
  "XXL": {
    "shoulder": 52,
    "chest": 115,
    "sleeve": 65,
    "length": 75
  }
};

// Size chart for women's tops
export const womensTopsSizeChart = {
  "XS": {
    "shoulder": 38,
    "bust": 82,
    "sleeve": 57,
    "length": 60
  },
  "S": {
    "shoulder": 39,
    "bust": 86,
    "sleeve": 58,
    "length": 61
  },
  "M": {
    "shoulder": 40,
    "bust": 90,
    "sleeve": 59,
    "length": 62
  },
  "L": {
    "shoulder": 41,
    "bust": 94,
    "sleeve": 60,
    "length": 63
  },
  "XL": {
    "shoulder": 42,
    "bust": 98,
    "sleeve": 61,
    "length": 64
  },
  "XXL": {
    "shoulder": 43,
    "bust": 102,
    "sleeve": 62,
    "length": 65
  }
};

// Size chart for men's bottoms
export const mensBottomsSizeChart = {
  "XS": {
    "waist": 74,
    "hip": 90,
    "thigh": 54,
    "inseam": 78,
    "length": 100
  },
  "S": {
    "waist": 78,
    "hip": 94,
    "thigh": 56,
    "inseam": 79,
    "length": 101
  },
  "M": {
    "waist": 82,
    "hip": 98,
    "thigh": 58,
    "inseam": 80,
    "length": 102
  },
  "L": {
    "waist": 86,
    "hip": 102,
    "thigh": 60,
    "inseam": 81,
    "length": 103
  },
  "XL": {
    "waist": 90,
    "hip": 106,
    "thigh": 62,
    "inseam": 82,
    "length": 104
  },
  "XXL": {
    "waist": 94,
    "hip": 110,
    "thigh": 64,
    "inseam": 83,
    "length": 105
  }
};

// Size chart for women's bottoms
export const womensBottomsSizeChart = {
  "XS": {
    "waist": 64,
    "hip": 88,
    "thigh": 50,
    "inseam": 76,
    "length": 98
  },
  "S": {
    "waist": 68,
    "hip": 92,
    "thigh": 52,
    "inseam": 77,
    "length": 99
  },
  "M": {
    "waist": 72,
    "hip": 96,
    "thigh": 54,
    "inseam": 78,
    "length": 100
  },
  "L": {
    "waist": 76,
    "hip": 100,
    "thigh": 56,
    "inseam": 79,
    "length": 101
  },
  "XL": {
    "waist": 80,
    "hip": 104,
    "thigh": 58,
    "inseam": 80,
    "length": 102
  },
  "XXL": {
    "waist": 84,
    "hip": 108,
    "thigh": 60,
    "inseam": 81,
    "length": 103
  }
};

// Size chart for men's outerwear
export const mensOuterwearSizeChart = {
  "XS": {
    "shoulder": 43,
    "chest": 95,
    "sleeve": 62,
    "length": 67
  },
  "S": {
    "shoulder": 45,
    "chest": 100,
    "sleeve": 63,
    "length": 69
  },
  "M": {
    "shoulder": 47,
    "chest": 105,
    "sleeve": 64,
    "length": 71
  },
  "L": {
    "shoulder": 49,
    "chest": 110,
    "sleeve": 65,
    "length": 73
  },
  "XL": {
    "shoulder": 51,
    "chest": 115,
    "sleeve": 66,
    "length": 75
  },
  "XXL": {
    "shoulder": 53,
    "chest": 120,
    "sleeve": 67,
    "length": 77
  }
};

// Size chart for women's outerwear
export const womensOuterwearSizeChart = {
  "XS": {
    "shoulder": 39,
    "bust": 86,
    "sleeve": 59,
    "length": 62
  },
  "S": {
    "shoulder": 40,
    "bust": 90,
    "sleeve": 60,
    "length": 63
  },
  "M": {
    "shoulder": 41,
    "bust": 94,
    "sleeve": 61,
    "length": 64
  },
  "L": {
    "shoulder": 42,
    "bust": 98,
    "sleeve": 62,
    "length": 65
  },
  "XL": {
    "shoulder": 43,
    "bust": 102,
    "sleeve": 63,
    "length": 66
  },
  "XXL": {
    "shoulder": 44,
    "bust": 106,
    "sleeve": 64,
    "length": 67
  }
};

// Height ranges for size recommendations
export const heightRanges = {
  "men": {
    "XS": { min: 160, max: 167 },
    "S": { min: 168, max: 173 },
    "M": { min: 174, max: 179 },
    "L": { min: 180, max: 185 },
    "XL": { min: 186, max: 191 },
    "XXL": { min: 192, max: 200 }
  },
  "women": {
    "XS": { min: 150, max: 157 },
    "S": { min: 158, max: 163 },
    "M": { min: 164, max: 169 },
    "L": { min: 170, max: 175 },
    "XL": { min: 176, max: 181 },
    "XXL": { min: 182, max: 190 }
  }
};

// Type mapping (UI type selection to internal type)
export const typeMapping = {
  "티셔츠": "tshirt",
  "셔츠": "shirt",
  "바지": "pants",
  "자켓": "jacket",
  "코트": "coat",
  "스웨터": "sweater",
  "드레스": "dress",
  "스커트": "skirt"
};

// Category mapping (maps types to their category: tops, bottoms, outerwear)
export const categoryMapping = {
  "tshirt": "tops",
  "shirt": "tops",
  "sweater": "tops",
  "pants": "bottoms",
  "skirt": "bottoms",
  "jacket": "outerwear",
  "coat": "outerwear",
  "dress": "tops" // simplified for now
};

// Size charts organized by gender and category
export const sizeCharts = {
  "남성": {
    "tops": mensTopsSizeChart,
    "bottoms": mensBottomsSizeChart,
    "outerwear": mensOuterwearSizeChart
  },
  "여성": {
    "tops": womensTopsSizeChart,
    "bottoms": womensBottomsSizeChart,
    "outerwear": womensOuterwearSizeChart
  }
};
