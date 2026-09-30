"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export type Red = "instagram" | "facebook" | "youtube" | "tiktok";

export function TarjetaRed({
  red,
  titulo,
  descripcion,
  color,
  cuenta,
  configurado,
  urlConectar,
  aviso,
  pasos,
  callback,
}: {
  red: Red;
  titulo: string;
  descripcion: string;
  color: string;
  cuenta: string | null;
  configurado: boolean;
  urlConectar: string;
  aviso?: string | null;
  pasos: string[];
  callback: string;
}) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [verPasos, setVerPasos] = useState(false);

  async function desconectar() {
    const extra = red === "facebook" ? " (también se desconecta Instagram)" : "";
    if (!confirm(`¿Desconectar ${titulo} del panel?${extra}`)) return;
    setOcupado(true);
    await fetch("/api/redes/desconectar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ red }),
    });
    setOcupado(false);
    router.refresh();
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
      <div className="h-1.5" style={{ background: color }} />
      <div className="p-5 flex flex-col gap-3 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-gray-900">{titulo}</p>
            <p className="text-xs text-gray-500">{descripcion}</p>
          </div>
          {cuenta ? (
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide bg-green-100 text-green-700 px-2 py-1 rounded">
              Conectada
            </span>
          ) : (
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide bg-gray-100 text-gray-500 px-2 py-1 rounded">
              Sin conectar
            </span>
          )}
        </div>

        {cuenta && <p className="text-sm font-medium text-gray-800">✓ {cuenta}</p>}
        {aviso && <p className="text-xs text-amber-700">{aviso}</p>}

        <div className="mt-auto flex flex-wrap gap-2 pt-1">
          {configurado ? (
            <>
              <a
                href={urlConectar}
                className="rounded-md bg-navy text-white text-sm font-semibold px-4 py-2 hover:opacity-90"
              >
                {cuenta ? "Volver a conectar" : "Conectar"}
              </a>
              {cuenta && (
                <button
                  type="button"
                  onClick={desconectar}
                  disabled={ocupado}
                  className="rounded-md border border-gray-300 text-sm px-3 py-2 hover:bg-gray-50 disabled:opacity-50"
                >
                  Desconectar
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={() => setVerPasos((v) => !v)}
              className="rounded-md border border-amber-300 bg-amber-50 text-amber-900 text-sm px-3 py-2 hover:bg-amber-100"
            >
              {verPasos ? "Ocultar configuración" : "Falta configurar (una sola vez)"}
            </button>
          )}
        </div>

        {!configurado && verPasos && (
          <div className="rounded-md bg-gray-50 border border-gray-200 p-3 text-xs text-gray-700 flex flex-col gap-2">
            <ol className="list-decimal pl-4 flex flex-col gap-1">
              {pasos.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ol>
            <div>
              <p className="text-gray-500">URL de redirección para cargar en esa plataforma:</p>
              <code className="block mt-1 bg-white border border-gray-200 rounded px-2 py-1 break-all">
                {callback}
              </code>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

type Pagina = { id: string; nombre: string; instagram: string | null };

export function ElegirPagina() {
  const router = useRouter();
  const [paginas, setPaginas] = useState<Pagina[] | null>(null);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/meta/paginas")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        setPaginas(data);
      })
      .catch((e) => setError(e.message || "No se pudieron cargar las páginas."));
  }, []);

  async function elegir(id: string) {
    setGuardando(id);
    const r = await fetch("/api/meta/paginas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paginaId: id }),
    });
    setGuardando(null);
    if (r.ok) {
      router.replace("/dashboard/redes?ok=meta");
      router.refresh();
    } else {
      const data = await r.json().catch(() => ({}));
      setError(data.error || "No se pudo guardar.");
    }
  }

  return (
    <div className="rounded-xl bg-white border border-navy/30 p-4">
      <p className="text-sm font-medium mb-2">¿Con qué página de Facebook querés publicar?</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!paginas && !error && <p className="text-sm text-gray-500">Cargando páginas...</p>}
      <div className="flex flex-col gap-2">
        {paginas?.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => elegir(p.id)}
            disabled={guardando !== null}
            className="flex items-center justify-between gap-3 rounded-md bg-white border border-gray-200 px-3 py-2 text-left hover:border-navy disabled:opacity-60"
          >
            <span className="text-sm font-medium">{p.nombre}</span>
            <span className="text-xs text-gray-500">
              {guardando === p.id
                ? "Guardando..."
                : p.instagram
                ? `Instagram: @${p.instagram}`
                : "Sin Instagram vinculado"}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
