
// size-data.ts

// Mapping of clothing types from Korean to English
export const clothingTypeTranslation = {
  "short_sleeve": "shirts",
  "긴팔": "shirts",
  "반팔": "shirts",
  "셔츠": "shirts",
  "티셔츠": "shirts",
  "아우터": "outerwear",
  "자켓": "outerwear",
  "코트": "outerwear",
  "바지": "pants",
  "치마": "skirts",
  "원피스": "dresses"
};

// Mapping of gender from Korean to English
export const genderTranslation = {
  "남성": "men",
  "남자": "men",
  "male": "men",
  "여성": "women",
  "여자": "women",
  "female": "women"
};

// Tolerance values for measurements (in cm)
export const tolerances = {
  "shoulder": 2,
  "chest": 4,
  "waist": 4,
  "sleeve": 2,
  "length": 3,
  "hip": 4,
  "thigh": 2,
  "inseam": 2,
  "bottom_width": 1
};

// What measurements are relevant for each clothing type
export const measurementCategories = {
  "shirts": ["shoulder", "chest", "sleeve", "length"],
  "outerwear": ["shoulder", "chest", "sleeve", "length"],
  "pants": ["waist", "hip", "thigh", "inseam", "length"],
  "skirts": ["waist", "hip", "length"],
  "dresses": ["shoulder", "chest", "waist", "hip", "length"]
};

// Size ranges by height (in cm)
export const sizeRanges = {
  "shirts": {
    "men": {
      "xs": { min: 160, max: 170 },
      "s": { min: 165, max: 175 },
      "m": { min: 170, max: 180 },
      "l": { min: 175, max: 185 },
      "xl": { min: 180, max: 190 },
      "xxl": { min: 185, max: 200 }
    },
    "women": {
      "xs": { min: 150, max: 160 },
      "s": { min: 155, max: 165 },
      "m": { min: 160, max: 170 },
      "l": { min: 165, max: 175 },
      "xl": { min: 170, max: 180 }
    }
  },
  "outerwear": {
    "men": {
      "xs": { min: 160, max: 170 },
      "s": { min: 165, max: 175 },
      "m": { min: 170, max: 180 },
      "l": { min: 175, max: 185 },
      "xl": { min: 180, max: 190 },
      "xxl": { min: 185, max: 200 }
    },
    "women": {
      "xs": { min: 150, max: 160 },
      "s": { min: 155, max: 165 },
      "m": { min: 160, max: 170 },
      "l": { min: 165, max: 175 },
      "xl": { min: 170, max: 180 }
    }
  },
  "pants": {
    "men": {
      "xs": { min: 160, max: 170 },
      "s": { min: 165, max: 175 },
      "m": { min: 170, max: 180 },
      "l": { min: 175, max: 185 },
      "xl": { min: 180, max: 190 },
      "xxl": { min: 185, max: 200 }
    },
    "women": {
      "xs": { min: 150, max: 160 },
      "s": { min: 155, max: 165 },
      "m": { min: 160, max: 170 },
      "l": { min: 165, max: 175 },
      "xl": { min: 170, max: 180 }
    }
  },
  "skirts": {
    "women": {
      "xs": { min: 150, max: 160 },
      "s": { min: 155, max: 165 },
      "m": { min: 160, max: 170 },
      "l": { min: 165, max: 175 },
      "xl": { min: 170, max: 180 }
    }
  },
  "dresses": {
    "women": {
      "xs": { min: 150, max: 160 },
      "s": { min: 155, max: 165 },
      "m": { min: 160, max: 170 },
      "l": { min: 165, max: 175 },
      "xl": { min: 170, max: 180 }
    }
  }
};

// Size measurement data (in cm)
export const sizeData = {
  "shirts": {
    "men": {
      "xs": {
        "shoulder": 40,
        "chest": 90,
        "sleeve": 59,
        "length": 65
      },
      "s": {
        "shoulder": 42,
        "chest": 96,
        "sleeve": 61,
        "length": 67
      },
      "m": {
        "shoulder": 44,
        "chest": 102,
        "sleeve": 63,
        "length": 69
      },
      "l": {
        "shoulder": 46,
        "chest": 108,
        "sleeve": 65,
        "length": 71
      },
      "xl": {
        "shoulder": 48,
        "chest": 114,
        "sleeve": 67,
        "length": 73
      },
      "xxl": {
        "shoulder": 50,
        "chest": 120,
        "sleeve": 69,
        "length": 75
      }
    },
    "women": {
      "xs": {
        "shoulder": 36,
        "chest": 80,
        "sleeve": 55,
        "length": 60
      },
      "s": {
        "shoulder": 38,
        "chest": 86,
        "sleeve": 57,
        "length": 62
      },
      "m": {
        "shoulder": 40,
        "chest": 92,
        "sleeve": 59,
        "length": 64
      },
      "l": {
        "shoulder": 42,
        "chest": 98,
        "sleeve": 61,
        "length": 66
      },
      "xl": {
        "shoulder": 44,
        "chest": 104,
        "sleeve": 63,
        "length": 68
      }
    }
  },
  "outerwear": {
    "men": {
      "xs": {
        "shoulder": 42,
        "chest": 96,
        "sleeve": 60,
        "length": 68
      },
      "s": {
        "shoulder": 44,
        "chest": 102,
        "sleeve": 62,
        "length": 70
      },
      "m": {
        "shoulder": 46,
        "chest": 108,
        "sleeve": 64,
        "length": 72
      },
      "l": {
        "shoulder": 48,
        "chest": 114,
        "sleeve": 66,
        "length": 74
      },
      "xl": {
        "shoulder": 50,
        "chest": 120,
        "sleeve": 68,
        "length": 76
      },
      "xxl": {
        "shoulder": 52,
        "chest": 126,
        "sleeve": 70,
        "length": 78
      }
    },
    "women": {
      "xs": {
        "shoulder": 38,
        "chest": 86,
        "sleeve": 56,
        "length": 62
      },
      "s": {
        "shoulder": 40,
        "chest": 92,
        "sleeve": 58,
        "length": 64
      },
      "m": {
        "shoulder": 42,
        "chest": 98,
        "sleeve": 60,
        "length": 66
      },
      "l": {
        "shoulder": 44,
        "chest": 104,
        "sleeve": 62,
        "length": 68
      },
      "xl": {
        "shoulder": 46,
        "chest": 110,
        "sleeve": 64,
        "length": 70
      }
    }
  },
  "pants": {
    "men": {
      "xs": {
        "waist": 74,
        "hip": 90,
        "thigh": 54,
        "inseam": 78,
        "length": 100
      },
      "s": {
        "waist": 78,
        "hip": 94,
        "thigh": 56,
        "inseam": 80,
        "length": 102
      },
      "m": {
        "waist": 82,
        "hip": 98,
        "thigh": 58,
        "inseam": 82,
        "length": 104
      },
      "l": {
        "waist": 86,
        "hip": 102,
        "thigh": 60,
        "inseam": 84,
        "length": 106
      },
      "xl": {
        "waist": 90,
        "hip": 106,
        "thigh": 62,
        "inseam": 86,
        "length": 108
      },
      "xxl": {
        "waist": 94,
        "hip": 110,
        "thigh": 64,
        "inseam": 88,
        "length": 110
      }
    },
    "women": {
      "xs": {
        "waist": 64,
        "hip": 88,
        "thigh": 52,
        "inseam": 75,
        "length": 95
      },
      "s": {
        "waist": 68,
        "hip": 92,
        "thigh": 54,
        "inseam": 77,
        "length": 97
      },
      "m": {
        "waist": 72,
        "hip": 96,
        "thigh": 56,
        "inseam": 79,
        "length": 99
      },
      "l": {
        "waist": 76,
        "hip": 100,
        "thigh": 58,
        "inseam": 81,
        "length": 101
      },
      "xl": {
        "waist": 80,
        "hip": 104,
        "thigh": 60,
        "inseam": 83,
        "length": 103
      }
    }
  },
  "skirts": {
    "women": {
      "xs": {
        "waist": 64,
        "hip": 88,
        "length": 50
      },
      "s": {
        "waist": 68,
        "hip": 92,
        "length": 52
      },
      "m": {
        "waist": 72,
        "hip": 96,
        "length": 54
      },
      "l": {
        "waist": 76,
        "hip": 100,
        "length": 56
      },
      "xl": {
        "waist": 80,
        "hip": 104,
        "length": 58
      }
    }
  },
  "dresses": {
    "women": {
      "xs": {
        "shoulder": 36,
        "chest": 80,
        "waist": 64,
        "hip": 88,
        "length": 85
      },
      "s": {
        "shoulder": 38,
        "chest": 86,
        "waist": 68,
        "hip": 92,
        "length": 87
      },
      "m": {
        "shoulder": 40,
        "chest": 92,
        "waist": 72,
        "hip": 96,
        "length": 89
      },
      "l": {
        "shoulder": 42,
        "chest": 98,
        "waist": 76,
        "hip": 100,
        "length": 91
      },
      "xl": {
        "shoulder": 44,
        "chest": 104,
        "waist": 80,
        "hip": 104,
        "length": 93
      }
    }
  }
};
