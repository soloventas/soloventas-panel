"use client";

// Botones de abajo de cada paso de Edición: Atrás y Siguiente.
export default function Navegacion({
  onAtras,
  onSiguiente,
  siguiente = "Siguiente →",
  deshabilitado,
  aviso,
}: {
  onAtras?: () => void;
  onSiguiente?: () => void;
  siguiente?: string;
  deshabilitado?: boolean;
  // Por qué todavía no se puede seguir.
  aviso?: string | null;
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-gray-100 pt-4">
      {aviso && <p className="text-sm text-amber-700 text-right">{aviso}</p>}
      <div className="flex items-center justify-between gap-3">
        {onAtras ? (
          <button
            type="button"
            onClick={onAtras}
            className="rounded-md border border-gray-300 text-gray-700 text-sm font-semibold px-4 py-2 hover:border-navy"
          >
            ← Atrás
          </button>
        ) : (
          <span />
        )}
        {onSiguiente && (
          <button
            type="button"
            onClick={onSiguiente}
            disabled={deshabilitado}
            className="rounded-md bg-navy text-white text-sm font-semibold px-5 py-2 hover:opacity-90 disabled:opacity-50"
          >
            {siguiente}
          </button>
        )}
      </div>
    </div>
  );
}
