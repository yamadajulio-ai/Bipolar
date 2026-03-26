"use client";
import { Component, type ReactNode } from "react";

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
      const Sentry = require("@sentry/nextjs");
      Sentry.captureException(error, {
        tags: { boundary: this.props.name || "unknown" },
      });
    } catch {}
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="rounded-[var(--radius-card)] border border-red-200 bg-red-50 p-4 text-center dark:border-red-800 dark:bg-red-950/50">
          <p className="text-red-700 text-sm">Algo deu errado nesta seção.</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="text-sm text-red-600 underline mt-2"
          >
            Tentar novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
