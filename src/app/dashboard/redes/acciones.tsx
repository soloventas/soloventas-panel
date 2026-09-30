"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function AccionesMeta({ conectado }: { conectado: boolean }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);

  async function desconectar() {
    if (!confirm("¿Desconectar Instagram y Facebook del panel?")) return;
    setOcupado(true);
    await fetch("/api/meta/paginas", { method: "DELETE" });
    setOcupado(false);
    router.refresh();
  }

  return (
    <div className="flex gap-2">
      <a
        href="/api/meta/login"
        className="rounded-md bg-navy text-white text-sm font-semibold px-4 py-2 hover:opacity-90"
      >
        {conectado ? "Volver a conectar" : "Conectar con Meta"}
      </a>
      {conectado && (
        <button
          type="button"
          onClick={desconectar}
          disabled={ocupado}
          className="rounded-md border border-gray-300 text-sm px-3 py-2 hover:bg-gray-50 disabled:opacity-50"
        >
          Desconectar
        </button>
      )}
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
      router.replace("/dashboard/redes?ok=1");
      router.refresh();
    } else {
      const data = await r.json().catch(() => ({}));
      setError(data.error || "No se pudo guardar.");
    }
  }

  return (
    <div className="rounded-lg bg-gray-50 border border-gray-200 p-4">
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
