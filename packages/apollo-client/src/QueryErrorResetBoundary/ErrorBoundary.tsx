import { Component, type ReactNode } from "react";

export declare namespace ErrorBoundary {
  export type Props = {
    children: ReactNode;
    onReset?: VoidFunction;
    fallbackRender: ({
      error,
      resetErrorBoundary,
    }: {
      error: unknown;
      resetErrorBoundary: VoidFunction;
    }) => ReactNode;
  };

  export type State = { didCatch: false; error: null } | { didCatch: true; error: unknown };
}

const initialState: ErrorBoundary.State = { didCatch: false, error: null };

export class ErrorBoundary extends Component<ErrorBoundary.Props, ErrorBoundary.State> {
  state: ErrorBoundary.State = initialState;

  static getDerivedStateFromError(error: unknown): ErrorBoundary.State {
    return { didCatch: true, error };
  }

  resetErrorBoundary = () => {
    this.props.onReset?.();
    this.setState(initialState);
  };

  render(): ReactNode {
    if (this.state.didCatch) {
      return this.props.fallbackRender({
        error: this.state.error,
        resetErrorBoundary: this.resetErrorBoundary,
      });
    }
    return this.props.children;
  }
}
