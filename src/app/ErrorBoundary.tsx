import { Component, type ErrorInfo, type ReactNode } from 'react';
import i18n from '@/shared/i18n';
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
          summary={i18n.t('error.boundary', { ns: 'common' })}
          onRetry={() => window.location.reload()}
        />
      );
    }
    return this.props.children;
  }
}
