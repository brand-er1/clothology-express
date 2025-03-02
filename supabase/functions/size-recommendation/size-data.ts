
export type SizeData = {
  men: {
    sizes: {
      S: Record<string, number>;
      M: Record<string, number>;
      L: Record<string, number>;
      XL: Record<string, number>;
    };
  };
  women: {
    sizes: {
      S: Record<string, number>;
      M: Record<string, number>;
      L: Record<string, number>;
      XL: Record<string, number>;
    };
  };
};

export const getSizeData = (): SizeData => {
  return {
    men: {
      sizes: {
        S: {
          "가슴 둘레": 92,
          "어깨 너비": 42,
          "소매 길이": 60,
          "총장": 65,
          "허리 둘레": 76,
          "엉덩이 둘레": 94,
          "허벅지 둘레": 54,
          "인심": 78
        },
        M: {
          "가슴 둘레": 96,
          "어깨 너비": 44,
          "소매 길이": 61,
          "총장": 67,
          "허리 둘레": 80,
          "엉덩이 둘레": 98,
          "허벅지 둘레": 56,
          "인심": 80
        },
        L: {
          "가슴 둘레": 100,
          "어깨 너비": 46,
          "소매 길이": 62,
          "총장": 69,
          "허리 둘레": 84,
          "엉덩이 둘레": 102,
          "허벅지 둘레": 58,
          "인심": 82
        },
        XL: {
          "가슴 둘레": 104,
          "어깨 너비": 48,
          "소매 길이": 63,
          "총장": 71,
          "허리 둘레": 88,
          "엉덩이 둘레": 106,
          "허벅지 둘레": 60,
          "인심": 84
        }
      }
    },
    women: {
      sizes: {
        S: {
          "가슴 둘레": 84,
          "어깨 너비": 38,
          "소매 길이": 57,
          "총장": 62,
          "허리 둘레": 68,
          "엉덩이 둘레": 90,
          "허벅지 둘레": 52,
          "인심": 76
        },
        M: {
          "가슴 둘레": 88,
          "어깨 너비": 40,
          "소매 길이": 58,
          "총장": 64,
          "허리 둘레": 72,
          "엉덩이 둘레": 94,
          "허벅지 둘레": 54,
          "인심": 78
        },
        L: {
          "가슴 둘레": 92,
          "어깨 너비": 42,
          "소매 길이": 59,
          "총장": 66,
          "허리 둘레": 76,
          "엉덩이 둘레": 98,
          "허벅지 둘레": 56,
          "인심": 80
        },
        XL: {
          "가슴 둘레": 96,
          "어깨 너비": 44,
          "소매 길이": 60,
          "총장": 68,
          "허리 둘레": 80,
          "엉덩이 둘레": 102,
          "허벅지 둘레": 58,
          "인심": 82
        }
      }
    }
  };
};
