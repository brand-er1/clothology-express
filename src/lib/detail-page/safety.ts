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

/**
 * Empty shopping-mall superlatives ("최고의 품질", "완벽한 핏", "당신만을 위한 특별한"...). Editorial
 * copy states what the product is; sentences built on these claims are dropped.
 */
const HYPE_PATTERNS: RegExp[] = [
  /최고의?\s*(?:품질|퀄리티|소재|핏|제품|선택)/,
  /완벽한?\s*(?:핏|품질|마감|착용감|디자인|스타일|선택)/,
  /당신만을\s*위한|오직\s*당신/,
  /특별한\s*당신|당신을\s*위한\s*특별한/,
  /압도적인?|역대급|끝판왕|인생\s*(?:템|아이템|후드|티)/,
  /놓치지\s*마세요|지금\s*바로\s*(?:구매|참여)|품절\s*임박|한정\s*특가/,
  /누구나\s*(?:반할|만족)|모두가\s*(?:반한|찾는)/,
  /100%\s*만족|만족\s*보장/,
];

export const hasHype = (text: string) => HYPE_PATTERNS.some((pattern) => pattern.test(text));

/** Removes sentences that lean on unsupported superlatives. */
export const stripHype = (text: string): string => {
  if (!text) return "";
  return text
    .split("\n")
    .map((line) =>
      splitSentences(line)
        .filter((sentence) => !hasHype(sentence))
        .join("")
        .trim(),
    )
    .filter((line, index, lines) => line || (index > 0 && lines[index - 1]))
    .join("\n")
    .trim();
};
