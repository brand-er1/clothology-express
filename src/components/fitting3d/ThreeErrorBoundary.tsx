import { Component, type ReactNode } from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";

interface ThreeErrorBoundaryProps {
  children: ReactNode;
}

interface ThreeErrorBoundaryState {
  hasError: boolean;
}

/**
 * Catches render-time failures from the 3D viewer (WebGL unavailable, a Three.js render error) so
 * one failed mount never crashes the whole 가상피팅 page — shows a fallback with a retry button
 * instead (spec §17). Does not (and cannot) catch WebGL *context-loss* events after a successful
 * mount; `Mannequin3DViewer` listens for those separately.
 */
export class ThreeErrorBoundary extends Component<ThreeErrorBoundaryProps, ThreeErrorBoundaryState> {
  state: ThreeErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("3D mannequin viewer failed to render:", error);
  }

  private retry = () => this.setState({ hasError: false });

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full min-h-[320px] w-full flex-col items-center justify-center gap-3 rounded-[1.75rem] bg-gradient-to-b from-[#f4f0ea] to-[#ece5db] p-6 text-center">
          <TriangleAlert className="h-8 w-8 text-stone-400" />
          <p className="text-sm font-bold text-stone-700">3D 마네킹을 불러오지 못했어요</p>
          <p className="text-xs text-stone-500">
            기기의 3D 그래픽 지원 문제일 수 있어요. 다시 시도하거나 아래 2D 미리보기를 이용해주세요.
          </p>
          <button
            type="button"
            onClick={this.retry}
            className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-stone-900 px-4 py-2 text-xs font-bold text-white"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            다시 시도
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
