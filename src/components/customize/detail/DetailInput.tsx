
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lightbulb, RefreshCw, WandSparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

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
};

const EXAMPLE_ROTATION_MS = 7000;

export const DetailInput = ({
  detailInput,
  selectedType = "",
  onChange,
  onExampleUse,
}: DetailInputProps) => {
  const promptExamples = useMemo(
    () => TYPE_PROMPT_EXAMPLES[selectedType] ?? DEFAULT_PROMPT_EXAMPLES,
    [selectedType],
  );
  const [exampleIndex, setExampleIndex] = useState(0);

  useEffect(() => {
    setExampleIndex(Math.floor(Math.random() * promptExamples.length));
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
          />
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
          <div className="flex items-start gap-3">
            <Lightbulb
              className="mt-0.5 h-4 w-4 shrink-0 text-amber-700"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-bold text-stone-900">
                  선택 의류 맞춤 예시
                </p>
                <span className="shrink-0 text-[11px] font-semibold text-amber-700">
                  7초마다 자동 변경
                </span>
              </div>
              <p className="mt-2 min-h-[4.5rem] text-sm leading-6 text-stone-600">
                {promptExample}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onExampleUse?.(promptExample)}
                  className="h-9 rounded-full border-amber-300 bg-white px-4 text-xs font-bold text-stone-700 hover:bg-amber-100 hover:text-stone-950"
                >
                  예시 사용하기
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={showNextExample}
                  className="h-9 rounded-full px-3 text-xs font-bold text-amber-800 hover:bg-amber-100 hover:text-amber-950"
                >
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                  다른 예시
                </Button>
                <span className="ml-auto text-[11px] tabular-nums text-stone-400">
                  {String(exampleIndex + 1).padStart(2, "0")} /{" "}
                  {String(promptExamples.length).padStart(2, "0")}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};
