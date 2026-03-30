"use client";
import { Component, type ReactNode } from "react";
import * as Sentry from "@sentry/nextjs";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  name?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    try {
      Sentry.captureException(error, {
        tags: { boundary: this.props.name || "unknown" },
      });
    } catch {}
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="rounded-[var(--radius-card)] border border-danger-border bg-danger-bg-subtle p-4 text-center" role="alert" aria-live="assertive">
          <p className="text-danger-fg text-sm">Algo deu errado nesta seção.</p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
            className="text-sm text-danger-fg underline mt-2 min-h-[44px] inline-flex items-center"
          >
            Tentar novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
