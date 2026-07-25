import { supabase } from "@/lib/supabase";
import type {
  TrademarkScreeningResult,
  TrademarkScreeningSource,
} from "@/types/trademark";

type ScreenTrademarkImageParams = {
  imageBase64?: string;
  imageUrl?: string;
  mimeType?: string;
  source: TrademarkScreeningSource;
  selectedType?: string;
  selectedMaterial?: string;
};

const readFunctionError = async (error: unknown) => {
  if (!error || typeof error !== "object") {
    return "상표 검수를 완료하지 못했습니다.";
  }

  const functionError = error as {
    message?: string;
    context?: Response;
  };
  if (functionError.context && typeof functionError.context.json === "function") {
    try {
      const payload = await functionError.context.json();
      if (typeof payload?.error === "string") return payload.error;
    } catch {
      // Supabase의 기본 오류 메시지를 사용합니다.
    }
  }

  return functionError.message || "상표 검수를 완료하지 못했습니다.";
};

export const screenTrademarkImage = async ({
  imageBase64,
  imageUrl,
  mimeType,
  source,
  selectedType = "",
  selectedMaterial = "",
}: ScreenTrademarkImageParams): Promise<TrademarkScreeningResult> => {
  if (!imageBase64 && !imageUrl) {
    throw new Error("검수할 이미지가 없습니다.");
  }

  const { data, error } = await supabase.functions.invoke(
    "screen-trademark-image",
    {
      body: {
        imageBase64,
        imageUrl,
        mimeType,
        source,
        selectedType,
        selectedMaterial,
      },
    },
  );

  if (error) {
    throw new Error(await readFunctionError(error));
  }
  if (!data?.screening?.id) {
    throw new Error(data?.error || "상표 검수 결과를 저장하지 못했습니다.");
  }

  return data.screening as TrademarkScreeningResult;
};
