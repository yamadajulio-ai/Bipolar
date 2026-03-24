"use client";

export default function InsightsError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-sm w-full text-center space-y-4">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
          Erro ao carregar Insights
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Não foi possível processar seus dados de insights. Seus registros
          estão seguros.
        </p>
        {process.env.NODE_ENV === "development" && error?.message && (
          <pre className="text-xs text-left bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-auto max-h-32">
            {error.message}
          </pre>
        )}
        <div className="space-y-2">
          <button
            onClick={reset}
            className="w-full rounded-xl bg-emerald-600 text-white py-3 font-medium hover:bg-emerald-700 transition-colors"
          >
            Tentar novamente
          </button>
          <a
            href="/hoje"
            className="block w-full rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 py-3 font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Voltar ao painel
          </a>
          <a
            href="/sos"
            className="block w-full rounded-xl bg-red-600 text-white py-3 font-medium hover:bg-red-700 transition-colors"
          >
            SOS — Preciso de ajuda
          </a>
        </div>
      </div>
    </div>
  );
}
