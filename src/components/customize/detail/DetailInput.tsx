
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lightbulb, WandSparkles } from "lucide-react";

interface DetailInputProps {
  detailInput: string;
  onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onExampleUse?: (value: string) => void;
}

const PROMPT_EXAMPLE =
  "차콜 컬러의 여유 있는 오버핏으로 만들어주세요. 앞면 왼쪽 가슴에는 작은 흰색 레터링, 뒷면 중앙에는 큰 빈티지 그래픽을 넣고 자연스러운 워싱과 두꺼운 질감으로 가을·겨울에 어울리게 표현해주세요.";

export const DetailInput = ({
  detailInput,
  onChange,
  onExampleUse,
}: DetailInputProps) => {
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
              <p className="text-sm font-bold text-stone-900">프롬프트 작성 예시</p>
              <p className="mt-2 text-sm leading-6 text-stone-600">
                {PROMPT_EXAMPLE}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onExampleUse?.(PROMPT_EXAMPLE)}
                className="mt-3 h-9 rounded-full border-amber-300 bg-white px-4 text-xs font-bold text-stone-700 hover:bg-amber-100 hover:text-stone-950"
              >
                예시 사용하기
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};
