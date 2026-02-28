"use client";

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="text-center">
        <div className="mb-4 text-5xl">📡</div>
        <h1 className="mb-2 text-2xl font-bold text-gray-900">Sem conexão</h1>
        <p className="mb-6 text-gray-600">
          Verifique sua internet e tente novamente.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-lg bg-green-700 px-6 py-2 text-white hover:bg-green-800"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
}
