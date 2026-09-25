/**
 * Guards against AI copy stating product facts nobody verified — fiber composition,
 * fabric weight/yarn count, functional performance or certifications. Any sentence that
 * makes such a claim is dropped unless the same term appears in the creator's own data
 * (the "verified corpus": design description, fabric name, typed-in composition...).
 */

const FIBER = "(?:면|코튼|cotton|폴리에스테?르?|polyester|나일론|nylon|레이온|rayon|울|wool|캐시미어|cashmere|린넨|리넨|linen|스판덱스|스판|spandex|엘라스틴|elastane|아크릴|acrylic|모달|modal|텐셀|tencel|실크|silk|비스코스|viscose)";

const UNVERIFIED_PATTERNS: RegExp[] = [
  // 혼용률: "면 100%", "100% 코튼", "폴리 65 / 면 35"
  new RegExp(`${FIBER}\\s*\\d{1,3}\\s*%`, "i"),
  new RegExp(`\\d{1,3}\\s*%\\s*${FIBER}`, "i"),
  // 중량 / 번수
  /\d+\s*(?:g\s*\/\s*(?:m|㎡|yd)|gsm|oz|온스|그램)/i,
  /\d{2}\s*수(?![가-힣])/,
  // 기능성
  /방수|발수|투습|흡습\s*속건|속건|자외선\s*차단|UV\s*차단|UPF|항균|항취|방풍|냉감|접촉\s*냉감|발열|보온성|쿨링|정전기\s*방지|구김\s*방지|방오/i,
  // 인증 / 등록 상표 소재
  /인증|certified|oeko|gots|bluesign|kc\s*마크|특허|고어텍스|gore-?tex|쿨맥스|coolmax|오가닉|유기농|친환경\s*소재|리사이클|recycled/i,
];

const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, "");

const splitSentences = (line: string) => line.match(/[^.!?。]+[.!?。]*\s*/g) ?? [line];

const isVerified = (sentence: string, corpus: string) =>
  UNVERIFIED_PATTERNS.every((pattern) => {
    const match = sentence.match(pattern);
    if (!match) return true;
    return corpus.includes(normalize(match[0]));
  });

export const buildVerifiedCorpus = (...values: Array<string | null | undefined>) =>
  normalize(values.filter(Boolean).join(" "));

/** Removes sentences with unverified material/performance/certification claims. */
export const stripUnverifiedClaims = (text: string, corpus: string): string => {
  if (!text) return "";
  return text
    .split("\n")
    .map((line) =>
      splitSentences(line)
        .filter((sentence) => isVerified(sentence, corpus))
        .join("")
        .trim(),
    )
    .filter((line, index, lines) => line || (index > 0 && lines[index - 1]))
    .join("\n")
    .trim();
};

export const hasUnverifiedClaim = (text: string, corpus: string) =>
  stripUnverifiedClaims(text, corpus) !== text.trim();
