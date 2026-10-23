import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  /** 로그에 남길 영역 이름 (예: "funding-checkout") */
  scope: string;
  /** 오류가 났을 때 대신 보여줄 화면. 없으면 아무것도 그리지 않는다. */
  fallback?: ReactNode | ((reset: () => void) => ReactNode);
  /** 이 값이 바뀌면 오류 상태를 풀고 다시 그린다 (예: 경로). */
  resetKey?: unknown;
  children: ReactNode;
};

type State = { failed: boolean; resetKey: unknown };

/**
 * 하위 영역의 렌더링 오류가 페이지 전체를 흰 화면으로 만들지 않도록 가둔다.
 * 결제처럼 외부 모듈에 의존하는 영역을 감싸서, 그 영역만 실패하고 상품 페이지 · 판매자 화면은 계속 동작하게 한다.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false, resetKey: this.props.resetKey };

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (props.resetKey !== state.resetKey) return { failed: false, resetKey: props.resetKey };
    return null;
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[${this.props.scope}] render error`, error, info.componentStack);
  }

  private reset = () => this.setState({ failed: false });

  render() {
    if (!this.state.failed) return this.props.children;
    const { fallback } = this.props;
    return typeof fallback === "function" ? fallback(this.reset) : fallback ?? null;
  }
}

/** 페이지 단위 기본 오류 화면 */
export const PageErrorFallback = ({ onRetry }: { onRetry?: () => void }) => (
  <div className="flex min-h-[50vh] items-center justify-center px-4">
    <div className="max-w-md rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm">
      <h2 className="text-lg font-extrabold text-stone-900">화면을 불러오지 못했습니다</h2>
      <p className="mt-2 text-sm text-stone-500">일시적인 오류입니다. 잠시 후 다시 시도해주세요. 문제가 계속되면 고객센터로 알려주세요.</p>
      <div className="mt-5 flex justify-center gap-2">
        {onRetry && (
          <button type="button" onClick={onRetry} className="rounded-xl border border-stone-200 px-4 py-2 text-sm font-bold text-stone-700 hover:bg-stone-50">
            다시 시도
          </button>
        )}
        <a href={import.meta.env.BASE_URL} className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white hover:bg-brand-dark">홈으로</a>
      </div>
    </div>
  </div>
);
