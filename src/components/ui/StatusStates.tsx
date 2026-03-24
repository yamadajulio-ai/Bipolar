"use client";

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = "Carregando..." }: LoadingStateProps) {
  return (
    <div className="flex items-center justify-center py-8" role="status" aria-live="polite">
      <div className="animate-spin rounded-full h-6 w-6 border-2 border-emerald-600 border-t-transparent mr-3" aria-hidden="true" />
      <span className="text-gray-600 dark:text-gray-400 text-sm">{message}</span>
    </div>
  );
}

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message = "Algo deu errado.", onRetry }: ErrorStateProps) {
  return (
    <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 p-4 text-center space-y-2" role="alert">
      <p className="text-red-700 dark:text-red-300 text-sm font-medium">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-sm text-red-600 dark:text-red-400 underline hover:text-red-800 dark:hover:text-red-200 min-h-[44px]"
        >
          Tentar novamente
        </button>
      )}
    </div>
  );
}

interface EmptyStateProps {
  message: string;
  actionLabel?: string;
  actionHref?: string;
}

export function EmptyState({ message, actionLabel, actionHref }: EmptyStateProps) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-6 text-center space-y-2">
      <p className="text-gray-600 dark:text-gray-400 text-sm">{message}</p>
      {actionLabel && actionHref && (
        <a
          href={actionHref}
          className="inline-block text-sm text-emerald-700 dark:text-emerald-400 underline hover:text-emerald-900 dark:hover:text-emerald-200 min-h-[44px] leading-[44px]"
        >
          {actionLabel}
        </a>
      )}
    </div>
  );
}
