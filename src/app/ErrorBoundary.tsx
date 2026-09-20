import { Component, type ErrorInfo, type ReactNode } from 'react';
import { captureError } from '@/shared/monitoring';
import { ErrorState } from '@/shared/ui/states/ErrorState';

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
}

/** 앱 전역 에러 바운더리 (DEVELOPMENT_PLAN.md §6 저장소 구조: app/ "에러바운더리") */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    captureError(error, { componentStack: info.componentStack ?? undefined });
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorState
          summary="문제가 발생했어요. 화면을 새로고침해 주세요."
          onRetry={() => window.location.reload()}
        />
      );
    }
    return this.props.children;
  }
}
