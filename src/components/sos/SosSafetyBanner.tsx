"use client";

interface SosSafetyBannerProps {
  waitingMode: boolean;
  sttDisclosureShown: boolean;
  onDismissSttDisclosure: () => void;
  handsFree: boolean;
  listening: boolean;
  speaking: boolean;
}

export function SosSafetyBanner({
  waitingMode,
  sttDisclosureShown,
  onDismissSttDisclosure,
  handsFree,
  listening,
  speaking,
}: SosSafetyBannerProps) {
  return (
    <>
      {/* Emergency banner — always visible */}
      <div
        className="bg-red-900/60 px-4 py-2 text-center text-xs text-red-200"
        role="alert"
        aria-live="polite"
      >
        Risco imediato? Ligue{" "}
        <a
          href="tel:192"
          aria-label="Ligar para SAMU 192"
          className="font-bold text-white underline"
        >
          192
        </a>{" "}
        (SAMU). Conversar:{" "}
        <a
          href="tel:188"
          aria-label="Ligar para CVV 188"
          className="font-bold text-white underline"
        >
          188
        </a>{" "}
        (CVV)
      </div>

      {/* STT privacy disclosure — shown once on first mic use */}
      {sttDisclosureShown && (
        <div className="bg-amber-900/60 px-4 py-3 text-xs text-amber-200">
          <p className="mb-2">
            <strong>Aviso de privacidade:</strong> o reconhecimento de voz
            do navegador pode enviar áudio para servidores externos (Google,
            Apple) para transcrição. Nenhum áudio é armazenado pelo app.
          </p>
          <p className="mb-2">
            Se preferir privacidade total, use o teclado.
          </p>
          <button
            onClick={onDismissSttDisclosure}
            aria-label="Aceitar aviso de privacidade e ativar reconhecimento de voz"
            className="rounded-lg bg-amber-700 px-4 py-1.5 min-h-[44px] text-sm font-medium text-white hover:bg-amber-600"
          >
            Entendi, ativar voz
          </button>
        </div>
      )}

      {/* Hands-free mode indicator */}
      {handsFree && (
        <div className="bg-green-900/40 px-4 py-2 text-center text-xs text-green-300">
          Modo voz (experimental) — fale naturalmente, o app ouve e responde
          em voz alta
          {listening && (
            <span className="ml-2 animate-pulse text-green-200">
              Ouvindo...
            </span>
          )}
          {speaking && (
            <span className="ml-2 text-blue-300">Falando...</span>
          )}
        </div>
      )}
    </>
  );
}
