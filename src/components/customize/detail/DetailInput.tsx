
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ExternalLink,
  Lightbulb,
  LoaderCircle,
  RefreshCw,
  TrendingUp,
  WandSparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  FASHION_TREND_REFRESH_MS,
  fetchFashionTrends,
  type FashionTrendResponse,
  type GarmentTrendType,
} from "@/services/fashionTrends";

interface DetailInputProps {
  detailInput: string;
  selectedType?: string;
  onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onExampleUse?: (value: string) => void;
}

const DEFAULT_PROMPT_EXAMPLES = [
  "차콜 컬러의 여유 있는 오버핏으로 만들어주세요. 앞면 왼쪽 가슴에는 작은 흰색 레터링, 뒷면 중앙에는 큰 빈티지 그래픽을 넣고 자연스러운 워싱과 두꺼운 질감으로 가을·겨울에 어울리게 표현해주세요.",
  "아이보리 컬러의 깔끔한 레귤러핏으로 만들어주세요. 왼쪽 가슴에는 작은 블루 자수를 넣고 장식은 최소화해 봄·여름에 어울리는 가벼운 미니멀 무드로 표현해주세요.",
  "워시드 블랙 컬러에 여유 있는 실루엣으로 만들어주세요. 앞면에는 작은 실버 심볼, 뒷면에는 큰 타이포그래피를 넣어 빈티지 스트릿 분위기로 표현해주세요.",
  "버건디 컬러의 짧은 크롭 기장으로 만들어주세요. 금속 지퍼와 입체적인 절개선을 강조하고 도시적인 Y2K 무드로 표현해주세요.",
];

const TYPE_PROMPT_EXAMPLES: Record<string, string[]> = {
  short_sleeve: [
    "오프화이트 반팔 티셔츠를 넉넉한 오버핏으로 만들어주세요. 앞면 왼쪽 가슴에는 작은 레드 레터링, 뒷면에는 빈티지한 레이싱 그래픽을 크게 넣어주세요.",
    "워시드 차콜 반팔 티셔츠에 드롭 숄더와 긴 소매 기장을 적용해주세요. 앞면 중앙에는 작은 실버 심볼만 넣어 미니멀 스트릿 무드로 표현해주세요.",
    "크림 컬러 반팔 티셔츠를 짧은 크롭핏으로 만들어주세요. 앞면에는 손그림 느낌의 플라워 그래픽을 넣고 여름에 어울리는 산뜻한 분위기로 표현해주세요.",
  ],
  long_sleeve: [
    "네이비 긴소매 티셔츠를 루즈핏으로 만들어주세요. 양쪽 소매에는 얇은 레터링을 길게 넣고 앞면은 작은 로고만 배치해 빈티지 스포츠 무드로 표현해주세요.",
    "오프화이트 긴소매 티셔츠에 블랙 래글런 소매를 적용해주세요. 앞면 중앙에는 레트로 숫자 그래픽을 크게 넣어 캐주얼한 분위기로 만들어주세요.",
    "워시드 그레이 긴소매 티셔츠를 슬림한 크롭핏으로 만들어주세요. 넥라인과 소매 끝에 배색 스티치를 넣어 Y2K 무드로 표현해주세요.",
  ],
  tights_short_sleeve: [
    "블랙 컴프레션 반팔 타이즈를 몸에 밀착되는 퍼포먼스 핏으로 만들어주세요. 어깨와 옆선에는 톤온톤 절개선을 넣고 가슴에는 작은 실버 심볼을 배치해주세요.",
    "딥 네이비 반팔 타이즈에 통기성 메시 패널과 라글란 절개를 적용해 러닝과 트레이닝에 어울리게 만들어주세요.",
    "차콜 심리스 반팔 타이즈를 미니멀하게 만들고 등판 중앙에는 작은 리플렉티브 그래픽을 넣어주세요.",
  ],
  tights_long_sleeve: [
    "블랙 컴프레션 긴팔 타이즈를 슬림한 베이스레이어 핏으로 만들어주세요. 팔과 몸판에는 인체공학적인 절개선을 넣어주세요.",
    "딥 그레이 긴팔 타이즈에 겨드랑이 메시 패널과 리플렉티브 라인을 적용해 야간 러닝 무드로 표현해주세요.",
    "네이비 심리스 긴팔 타이즈를 로고 없이 깔끔하게 만들고 어깨와 소매의 톤온톤 조직감을 강조해주세요.",
  ],
  hoodie: [
    "차콜 후드티를 넉넉한 오버핏으로 만들어주세요. 앞면 왼쪽 가슴에는 작은 흰색 레터링, 뒷면에는 빈티지 그래픽을 크게 넣고 자연스러운 피그먼트 워싱을 표현해주세요.",
    "멜란지 그레이 후드티에 투웨이 지퍼와 넓은 후드를 적용해주세요. 로고는 없이 절개선과 실루엣을 강조한 미니멀한 디자인으로 만들어주세요.",
    "딥 네이비 후드티를 짧은 크롭 기장으로 만들어주세요. 후드와 소매에 아이보리 배색 파이핑을 넣어 스포티한 분위기로 표현해주세요.",
  ],
  sweatshirt: [
    "버건디 맨투맨을 여유 있는 오버핏으로 만들어주세요. 앞면 중앙에는 크림 컬러의 아치형 대학 로고를 넣어 클래식한 캠퍼스 무드로 표현해주세요.",
    "워시드 블랙 맨투맨에 드롭 숄더를 적용해주세요. 앞면과 뒷면의 절개선이 자연스럽게 이어지도록 만들어 모던한 분위기를 강조해주세요.",
    "오트밀 맨투맨을 레귤러핏으로 만들어주세요. 왼쪽 가슴에는 작은 그린 자수, 소매에는 얇은 레터링을 넣어 담백한 캐주얼 무드로 표현해주세요.",
  ],
  knit: [
    "버건디 크루넥 니트를 여유 있는 세미 오버핏으로 만들어주세요. 굵은 골지 시보리와 부드러운 조직감을 살려 미니멀한 가을·겨울 무드로 표현해주세요.",
    "아이보리 케이블 니트를 레귤러핏으로 만들어주세요. 앞판의 입체적인 꽈배기 조직과 단정한 넥라인을 강조해주세요.",
    "차콜 집업 니트를 짧은 크롭 기장으로 만들어주세요. 투웨이 지퍼와 촘촘한 골지 조직을 적용해 세련된 분위기로 표현해주세요.",
  ],
  jacket: [
    "버건디 레더 자켓을 짧은 크롭핏으로 만들어주세요. 넓은 카라와 실버 지퍼, 입체적인 절개선을 강조해 세련된 빈티지 무드로 표현해주세요.",
    "워시드 블루 데님 자켓을 여유 있는 박시핏으로 만들어주세요. 앞면에는 큰 플랩 포켓을 넣고 자연스러운 페이딩을 표현해주세요.",
    "블랙 집업 자켓을 미니멀한 세미 오버핏으로 만들어주세요. 하이넥과 히든 지퍼, 밑단 스트링을 적용해 테크웨어 분위기로 표현해주세요.",
  ],
  short_pants: [
    "워시드 차콜 반바지를 무릎 위로 내려오는 와이드핏으로 만들어주세요. 옆선에는 카고 포켓을 넣고 빈티지한 스트릿 무드로 표현해주세요.",
    "네이비 나일론 반바지를 여유 있는 핏으로 만들어주세요. 허리 스트링과 뒷면 지퍼 포켓을 적용해 스포티한 여름 디자인으로 표현해주세요.",
    "크림 컬러 반바지를 깔끔한 세미 와이드핏으로 만들어주세요. 턱 디테일과 작은 금속 버클을 넣어 미니멀한 분위기로 표현해주세요.",
  ],
  long_pants: [
    "워시드 블랙 데님 팬츠를 밑단이 넓은 와이드핏으로 만들어주세요. 무릎 부분에 자연스러운 페이딩과 입체적인 주름을 표현해주세요.",
    "차콜 카고 팬츠를 루즈한 스트레이트핏으로 만들어주세요. 양쪽 허벅지에 입체 포켓과 밑단 스트링을 넣어 테크웨어 무드로 표현해주세요.",
    "딥 네이비 슬랙스를 세미 와이드핏으로 만들어주세요. 허리의 투턱과 길게 떨어지는 실루엣을 강조해 미니멀한 분위기로 표현해주세요.",
  ],
  leggings: [
    "블랙 하이웨이스트 레깅스를 발목까지 오는 슬림핏으로 만들어주세요. 허리 밴드를 넓게 잡고 옆선에는 작은 포켓을 넣어주세요.",
    "딥 브라운 부츠컷 요가 레깅스를 허벅지까지 밀착되고 무릎 아래부터 자연스럽게 퍼지는 실루엣으로 표현해주세요.",
    "차콜 심리스 레깅스에 몸의 움직임을 따라가는 톤온톤 조직 패턴을 넣고 로고는 최소화해주세요.",
  ],
  tights_bottom: [
    "블랙 러닝 하프 타이즈를 허벅지 중간 기장으로 만들어주세요. 허리 뒤쪽에는 작은 지퍼 포켓과 리플렉티브 디테일을 넣어주세요.",
    "차콜 컴프레션 롱 타이즈를 발목까지 오는 밀착핏으로 만들고 무릎과 종아리에 인체공학적인 절개선을 적용해주세요.",
    "딥 네이비 베이스레이어 하의 타이즈를 심리스 구조로 만들고 허리 밴드와 옆선의 톤온톤 디테일을 강조해주세요.",
  ],
};

const EXAMPLE_ROTATION_MS = 7000;

const GARMENT_TYPE_LABELS: Record<GarmentTrendType, string> = {
  short_sleeve: "반팔 티셔츠",
  long_sleeve: "긴팔 티셔츠",
  tights_short_sleeve: "상의형 타이즈 (반팔)",
  tights_long_sleeve: "긴팔 타이즈",
  hoodie: "후드",
  sweatshirt: "맨투맨",
  jacket: "자켓",
  short_pants: "반바지",
  long_pants: "팬츠",
  leggings: "레깅스",
  tights_bottom: "하의형 타이즈",
};

interface PromptExample {
  text: string;
  isTrend: boolean;
  keyword?: string;
  rank?: number;
}

const isGarmentTrendType = (value: string): value is GarmentTrendType =>
  Object.prototype.hasOwnProperty.call(GARMENT_TYPE_LABELS, value);

const buildTrendPrompt = (
  keyword: string,
  selectedType: GarmentTrendType,
) =>
  `현재 무신사 상품 랭킹에서 주목받는 “${keyword}” 트렌드를 반영한 ${GARMENT_TYPE_LABELS[selectedType]} 디자인으로 만들어주세요. 트렌드의 실루엣과 디테일은 살리되 특정 브랜드의 로고, 문구, 상품 디자인은 복제하지 말고 독창적인 컬러와 그래픽으로 재해석해주세요. 의류 전체가 화면을 크게 채우는 고품질 3D 제품 렌더링으로 표현해주세요.`;

export const DetailInput = ({
  detailInput,
  selectedType = "",
  onChange,
  onExampleUse,
}: DetailInputProps) => {
  const [trendData, setTrendData] = useState<FashionTrendResponse | null>(
    null,
  );
  const [isTrendLoading, setIsTrendLoading] = useState(true);
  const [trendLoadFailed, setTrendLoadFailed] = useState(false);
  const [exampleIndex, setExampleIndex] = useState(0);

  useEffect(() => {
    let isActive = true;

    const loadTrends = async () => {
      try {
        const response = await fetchFashionTrends();
        if (!isActive) return;
        setTrendData(response);
        setTrendLoadFailed(false);
      } catch (error) {
        console.warn("Unable to load fashion trends:", error);
        if (isActive) setTrendLoadFailed(true);
      } finally {
        if (isActive) setIsTrendLoading(false);
      }
    };

    void loadTrends();
    const refreshTimer = window.setInterval(() => {
      void loadTrends();
    }, FASHION_TREND_REFRESH_MS);

    return () => {
      isActive = false;
      window.clearInterval(refreshTimer);
    };
  }, []);

  const promptExamples = useMemo<PromptExample[]>(() => {
    const selectedTypeExamples =
      TYPE_PROMPT_EXAMPLES[selectedType] ?? DEFAULT_PROMPT_EXAMPLES;
    const localExamples = selectedTypeExamples.map((text) => ({
      text,
      isTrend: false,
    }));

    if (!isGarmentTrendType(selectedType)) return localExamples;

    const trendExamples = (trendData?.trends[selectedType] ?? []).map(
      ({ keyword, rank }) => ({
        text: buildTrendPrompt(keyword, selectedType),
        keyword,
        rank,
        isTrend: true,
      }),
    );

    return [...trendExamples, ...localExamples];
  }, [selectedType, trendData]);

  useEffect(() => {
    setExampleIndex(0);
  }, [promptExamples]);

  useEffect(() => {
    const rotationTimer = window.setInterval(() => {
      setExampleIndex((current) => (current + 1) % promptExamples.length);
    }, EXAMPLE_ROTATION_MS);

    return () => window.clearInterval(rotationTimer);
  }, [promptExamples]);

  const promptExample = promptExamples[exampleIndex] ?? promptExamples[0];
  const showNextExample = () => {
    setExampleIndex((current) => (current + 1) % promptExamples.length);
  };

  return (
    <Card className="overflow-hidden rounded-2xl border-stone-200 bg-white shadow-none">
      <div className="space-y-5 p-4 sm:p-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-brand">
            <WandSparkles className="h-4 w-4" aria-hidden="true" />
            <p className="text-sm font-bold">디자인 프롬프트</p>
          </div>
          <p className="text-[15px] leading-6 text-stone-600 sm:text-sm">
            원하는 색상, 핏, 프린트 위치와 분위기를 문장으로 자유롭게 적어주세요.
          </p>
          <textarea
            value={detailInput}
            onChange={onChange}
            placeholder="예: 네이비 컬러의 오버핏 맨투맨에 작은 레터링을 넣어주세요."
            className="min-h-40 w-full resize-y rounded-xl border border-stone-300 bg-[#fbfaf8] p-4 text-base leading-7 text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-brand focus:ring-4 focus:ring-brand/10 sm:min-h-44"
            data-tutorial="customize-prompt"
          />
        </div>

        <div
          className={`rounded-xl border p-4 transition-colors ${
            promptExample.isTrend
              ? "border-brand/25 bg-brand/5"
              : "border-amber-200 bg-amber-50/70"
          }`}
          data-tutorial="customize-example"
        >
          <div className="flex items-start gap-3">
            {promptExample.isTrend ? (
              <TrendingUp
                className="mt-0.5 h-4 w-4 shrink-0 text-brand"
                aria-hidden="true"
              />
            ) : (
              <Lightbulb
                className="mt-0.5 h-4 w-4 shrink-0 text-amber-700"
                aria-hidden="true"
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold text-stone-900">
                  {promptExample.isTrend
                    ? "지금 뜨는 디자인 트렌드"
                    : "선택 의류 맞춤 예시"}
                </p>
                <span
                  className={`shrink-0 text-[11px] font-semibold ${
                    promptExample.isTrend ? "text-brand" : "text-amber-700"
                  }`}
                >
                  {promptExample.isTrend
                    ? "30분 갱신 · 7초 전환"
                    : "7초마다 자동 변경"}
                </span>
              </div>
              {promptExample.isTrend && promptExample.keyword && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-brand px-2.5 py-1 text-[11px] font-bold text-white">
                    {promptExample.keyword}
                  </span>
                  {typeof promptExample.rank === "number" &&
                    promptExample.rank < 900 && (
                      <span className="text-[11px] font-semibold text-stone-500">
                        카테고리 랭킹 {promptExample.rank}위 기반
                      </span>
                    )}
                </div>
              )}
              <p className="mt-2 min-h-[4.5rem] text-sm leading-6 text-stone-600">
                {promptExample.text}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onExampleUse?.(promptExample.text)}
                  className={`h-9 rounded-full bg-white px-4 text-xs font-bold text-stone-700 ${
                    promptExample.isTrend
                      ? "border-brand/35 hover:bg-brand/10 hover:text-brand"
                      : "border-amber-300 hover:bg-amber-100 hover:text-stone-950"
                  }`}
                >
                  {promptExample.isTrend
                    ? "이 트렌드로 만들기"
                    : "예시 사용하기"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={showNextExample}
                  className={`h-9 rounded-full px-3 text-xs font-bold ${
                    promptExample.isTrend
                      ? "text-brand hover:bg-brand/10 hover:text-brand"
                      : "text-amber-800 hover:bg-amber-100 hover:text-amber-950"
                  }`}
                >
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                  {promptExample.isTrend ? "다른 트렌드" : "다른 예시"}
                </Button>
                {promptExample.isTrend && trendData?.sourceUrl && (
                  <a
                    href={trendData.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-9 items-center rounded-full px-2 text-[11px] font-semibold text-stone-500 transition hover:text-stone-900"
                  >
                    무신사 상품 랭킹 기반
                    <ExternalLink
                      className="ml-1 h-3 w-3"
                      aria-hidden="true"
                    />
                  </a>
                )}
                <span className="ml-auto text-[11px] tabular-nums text-stone-400">
                  {String(exampleIndex + 1).padStart(2, "0")} /{" "}
                  {String(promptExamples.length).padStart(2, "0")}
                </span>
              </div>
              {!promptExample.isTrend &&
                (isTrendLoading || trendLoadFailed) && (
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] text-stone-400">
                    {isTrendLoading && (
                      <LoaderCircle
                        className="h-3 w-3 animate-spin"
                        aria-hidden="true"
                      />
                    )}
                    {isTrendLoading
                      ? "실시간 의류 트렌드를 연결하고 있어요."
                      : "트렌드 연결이 지연되어 맞춤 예시를 보여드려요."}
                  </div>
                )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};
