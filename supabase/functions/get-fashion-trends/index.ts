import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "public, max-age=300",
};

const SOURCE = "musinsa-product-ranking";
const SOURCE_URL = "https://www.musinsa.com/main/musinsa/ranking";
const RANKING_API =
  "https://api.musinsa.com/api2/hm/web/v5/pans/ranking/sections/199";
const CACHE_DURATION_MS = 30 * 60 * 1000;

type GarmentType =
  | "short_sleeve"
  | "long_sleeve"
  | "hoodie"
  | "sweatshirt"
  | "jacket"
  | "short_pants"
  | "long_pants";

type RankingProduct = {
  productName: string;
  brandName: string;
  rank: number;
  category: "top" | "outer" | "pants";
};

type TrendItem = {
  keyword: string;
  rank: number;
};

type TrendMap = Record<GarmentType, TrendItem[]>;

const GARMENT_LABELS: Record<GarmentType, string> = {
  short_sleeve: "반팔 티셔츠",
  long_sleeve: "긴팔 티셔츠",
  hoodie: "후드",
  sweatshirt: "맨투맨",
  jacket: "자켓",
  short_pants: "반바지",
  long_pants: "팬츠",
};

const FALLBACK_KEYWORDS: Record<GarmentType, string[]> = {
  short_sleeve: [
    "크롭 링거 반팔 티셔츠",
    "피그먼트 오버핏 반팔 티셔츠",
    "스트라이프 헨리넥 반팔 티셔츠",
  ],
  long_sleeve: [
    "래글런 배색 긴팔 티셔츠",
    "빈티지 워싱 긴팔 티셔츠",
    "슬림 크롭 긴팔 티셔츠",
  ],
  hoodie: [
    "라이트웨이트 집업 후드",
    "피그먼트 오버핏 후드",
    "크롭 투웨이 집업 후드",
  ],
  sweatshirt: [
    "릴렉스핏 그래픽 맨투맨",
    "피그먼트 오버핏 맨투맨",
    "세미 크롭 맨투맨",
  ],
  jacket: [
    "라이트웨이트 윈드브레이커 자켓",
    "워시드 레더 크롭 자켓",
    "미니멀 트랙 자켓",
  ],
  short_pants: [
    "원턱 와이드 반바지",
    "나일론 스트링 반바지",
    "버뮤다 스웨트 반바지",
  ],
  long_pants: [
    "린넨 세미 와이드 팬츠",
    "원턱 커브드 팬츠",
    "나일론 스트링 팬츠",
  ],
};

const STYLE_TERMS: Array<[RegExp, string]> = [
  [/(세미\s*크롭|semi[\s-]*crop)/i, "세미 크롭"],
  [/(크롭|cropped?|crop)/i, "크롭"],
  [/(오버\s*핏|오버핏|oversized?|over[\s-]*fit)/i, "오버핏"],
  [/(릴렉스\s*핏|릴렉스핏|relaxed?[\s-]*fit)/i, "릴렉스핏"],
  [/(슬림\s*핏|슬림핏|slim[\s-]*fit)/i, "슬림핏"],
  [/(세미\s*와이드|semi[\s-]*wide)/i, "세미 와이드"],
  [/(와이드|wide)/i, "와이드"],
  [/(부츠컷|bootcut)/i, "부츠컷"],
  [/(커브드|curved?)/i, "커브드"],
  [/(로우\s*라이즈|로우라이즈|low[\s-]*rise)/i, "로우라이즈"],
  [/(원턱|one[\s-]*tuck)/i, "원턱"],
  [/(투턱|two[\s-]*tuck)/i, "투턱"],
  [/(카고|cargo)/i, "카고"],
  [/(파라슈트|parachute)/i, "파라슈트"],
  [/(카펜터|carpenter)/i, "카펜터"],
  [/(스트링|drawstring)/i, "스트링"],
  [/(밴딩|banding|elastic waist)/i, "밴딩"],
  [/(피그먼트|pigment)/i, "피그먼트"],
  [/(워시드|워싱|washed?|washing)/i, "워시드"],
  [/(빈티지|vintage)/i, "빈티지"],
  [/(스트라이프|striped?)/i, "스트라이프"],
  [/(링거|ringer)/i, "링거"],
  [/(헨리\s*넥|헨리넥|henley)/i, "헨리넥"],
  [/(래글런|raglan)/i, "래글런"],
  [/(배색|color[\s-]*block)/i, "배색"],
  [/(레이어드|layered?)/i, "레이어드"],
  [/(오프\s*숄더|off[\s-]*shoulder)/i, "오프숄더"],
  [/(폴로|polo)/i, "폴로"],
  [/(골지|ribbed?)/i, "골지"],
  [/(자수|embroidery|embroidered?)/i, "자수"],
  [/(그래픽|graphic)/i, "그래픽"],
  [/(린넨|linen)/i, "린넨"],
  [/(나일론|nylon)/i, "나일론"],
  [/(코튼|cotton)/i, "코튼"],
  [/(데님|denim)/i, "데님"],
  [/(레더|가죽|leather|sheepskin)/i, "레더"],
  [/(라이트\s*웨이트|라이트웨이트|light[\s-]*weight)/i, "라이트웨이트"],
  [/(패커블|packable)/i, "패커블"],
  [/(윈드\s*브레이커|윈드브레이커|windbreaker)/i, "윈드브레이커"],
  [/(트랙|track)/i, "트랙"],
  [/(스웨트|sweat)/i, "스웨트"],
  [/(버뮤다|bermuda)/i, "버뮤다"],
  [/(롤업|roll[\s-]*up)/i, "롤업"],
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const collectProductColumns = (
  value: unknown,
  category: RankingProduct["category"],
  products: RankingProduct[] = [],
): RankingProduct[] => {
  if (Array.isArray(value)) {
    value.forEach((item) => collectProductColumns(item, category, products));
    return products;
  }

  if (!isRecord(value)) return products;

  if (value.type === "PRODUCT_COLUMN") {
    const info = isRecord(value.info) ? value.info : {};
    const image = isRecord(value.image) ? value.image : {};
    const productName =
      typeof info.productName === "string" ? info.productName.trim() : "";

    if (productName) {
      products.push({
        productName,
        brandName:
          typeof info.brandName === "string" ? info.brandName.trim() : "",
        rank:
          typeof image.rank === "number" && Number.isFinite(image.rank)
            ? image.rank
            : 999,
        category,
      });
    }

    return products;
  }

  Object.values(value).forEach((item) =>
    collectProductColumns(item, category, products)
  );
  return products;
};

const inferGarmentType = (product: RankingProduct): GarmentType | null => {
  const name = product.productName.toLowerCase();

  if (product.category === "pants") {
    if (
      /(반바지|숏\s*팬츠|쇼츠|shorts?|short[\s-]*pants|버뮤다|bermuda)/i.test(
        name,
      )
    ) {
      return "short_pants";
    }

    return /(팬츠|바지|슬랙스|데님|pants?|trousers?|slacks?|jeans?|denim)/i.test(
      name,
    )
      ? "long_pants"
      : null;
  }

  if (/(후드티|후드\s*집업|hoodie|hooded\s*sweat)/i.test(name)) {
    return "hoodie";
  }

  if (
    /(맨투맨|스웨트\s*셔츠|sweatshirts?|sweat\s*shirts?|crewneck\s*sweat)/i.test(
      name,
    )
  ) {
    return "sweatshirt";
  }

  if (product.category === "outer") {
    return "jacket";
  }

  if (
    /(긴팔|긴소매|long[\s-]*sleeve|long\s*tee|l\/s\s*(tee|t-shirt))/i.test(
      name,
    )
  ) {
    return "long_sleeve";
  }

  if (
    /(반팔|반소매|short[\s-]*sleeve|half[\s-]*sleeve|half\s*(tee|t-shirt)|t-shirts?|tee\b|탱크\s*탑|tank\s*top)/i.test(
      name,
    )
  ) {
    return "short_sleeve";
  }

  return null;
};

const extractKeyword = (
  productName: string,
  garmentType: GarmentType,
): string => {
  const styles = STYLE_TERMS.filter(([pattern]) => pattern.test(productName))
    .map(([, label]) => label)
    .filter((label, index, all) => all.indexOf(label) === index)
    .filter(
      (label, _index, all) =>
        !(label === "크롭" && all.includes("세미 크롭")) &&
        !(label === "와이드" && all.includes("세미 와이드")),
    )
    .slice(0, 2);

  if (styles.length === 0) return GARMENT_LABELS[garmentType];
  return `${styles.join(" ")} ${GARMENT_LABELS[garmentType]}`;
};

const buildTrendMap = (products: RankingProduct[]): TrendMap => {
  const trends = Object.fromEntries(
    Object.keys(GARMENT_LABELS).map((type) => [type, []]),
  ) as TrendMap;

  products
    .sort((left, right) => left.rank - right.rank)
    .forEach((product) => {
      const garmentType = inferGarmentType(product);
      if (!garmentType) return;

      const keyword = extractKeyword(product.productName, garmentType);
      if (
        keyword === GARMENT_LABELS[garmentType] ||
        trends[garmentType].some((trend) => trend.keyword === keyword)
      ) {
        return;
      }

      if (trends[garmentType].length < 5) {
        trends[garmentType].push({ keyword, rank: product.rank });
      }
    });

  (Object.keys(trends) as GarmentType[]).forEach((garmentType) => {
    FALLBACK_KEYWORDS[garmentType].forEach((keyword, index) => {
      if (
        trends[garmentType].length < 4 &&
        !trends[garmentType].some((trend) => trend.keyword === keyword)
      ) {
        trends[garmentType].push({ keyword, rank: 900 + index });
      }
    });
  });

  return trends;
};

const fetchRankingCategory = async (
  categoryCode: string,
  category: RankingProduct["category"],
): Promise<RankingProduct[]> => {
  const url = new URL(RANKING_API);
  url.searchParams.set("storeCode", "musinsa");
  url.searchParams.set("categoryCode", categoryCode);
  url.searchParams.set("contentsId", "");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent":
        "Mozilla/5.0 (compatible; Brand-erTrendBot/1.0; +https://brand-er.store)",
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Ranking request failed with ${response.status}`);
  }

  return collectProductColumns(await response.json(), category);
};

const createFallbackTrends = (): TrendMap =>
  Object.fromEntries(
    (Object.keys(FALLBACK_KEYWORDS) as GarmentType[]).map((garmentType) => [
      garmentType,
      FALLBACK_KEYWORDS[garmentType].map((keyword, index) => ({
        keyword,
        rank: 900 + index,
      })),
    ]),
  ) as TrendMap;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== "GET" && request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: "Trend service is not configured." }),
      { status: 500, headers: jsonHeaders },
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  const now = new Date();
  const { data: cached } = await supabase
    .from("fashion_trend_cache")
    .select("trends, fetched_at, expires_at")
    .eq("source", SOURCE)
    .maybeSingle();

  if (
    cached?.trends &&
    typeof cached.expires_at === "string" &&
    new Date(cached.expires_at) > now
  ) {
    return new Response(
      JSON.stringify({
        source: SOURCE,
        sourceUrl: SOURCE_URL,
        trends: cached.trends,
        fetchedAt: cached.fetched_at,
        expiresAt: cached.expires_at,
        stale: false,
        fallback: false,
      }),
      { headers: jsonHeaders },
    );
  }

  try {
    const categoryProducts = await Promise.all([
      fetchRankingCategory("001", "top"),
      fetchRankingCategory("002", "outer"),
      fetchRankingCategory("003", "pants"),
    ]);
    const trends = buildTrendMap(categoryProducts.flat());
    const fetchedAt = now.toISOString();
    const expiresAt = new Date(
      now.getTime() + CACHE_DURATION_MS,
    ).toISOString();

    const { error: cacheError } = await supabase
      .from("fashion_trend_cache")
      .upsert(
        {
          source: SOURCE,
          trends,
          fetched_at: fetchedAt,
          expires_at: expiresAt,
        },
        { onConflict: "source" },
      );

    if (cacheError) {
      console.warn("Unable to update trend cache:", cacheError.message);
    }

    return new Response(
      JSON.stringify({
        source: SOURCE,
        sourceUrl: SOURCE_URL,
        trends,
        fetchedAt,
        expiresAt,
        stale: false,
        fallback: false,
      }),
      { headers: jsonHeaders },
    );
  } catch (error) {
    console.error("Unable to refresh fashion trends:", error);

    if (cached?.trends) {
      return new Response(
        JSON.stringify({
          source: SOURCE,
          sourceUrl: SOURCE_URL,
          trends: cached.trends,
          fetchedAt: cached.fetched_at,
          expiresAt: cached.expires_at,
          stale: true,
          fallback: false,
        }),
        { headers: jsonHeaders },
      );
    }

    return new Response(
      JSON.stringify({
        source: SOURCE,
        sourceUrl: SOURCE_URL,
        trends: createFallbackTrends(),
        fetchedAt: now.toISOString(),
        expiresAt: new Date(
          now.getTime() + CACHE_DURATION_MS,
        ).toISOString(),
        stale: false,
        fallback: true,
      }),
      { headers: jsonHeaders },
    );
  }
});
