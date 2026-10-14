"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Paso 1 de Edición: conectar las IAs una sola vez y quedan conectadas.
// - Cloudflare (gratis): obligatoria para hacer fotos con IA.
// - fal.ai (paga por uso): opcional, para videos con una persona y fotos premium.
type Proveedor = "cloudflare" | "fal";

function Campo(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-navy"
    />
  );
}

function Tarjeta({
  proveedor,
  titulo,
  etiqueta,
  descripcion,
  conectada,
  obligatoria,
  children,
  puedeGuardar,
  datos,
}: {
  proveedor: Proveedor;
  titulo: string;
  etiqueta: string;
  descripcion: string;
  conectada: boolean;
  obligatoria?: boolean;
  children: React.ReactNode;
  puedeGuardar: boolean;
  datos: Record<string, string>;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(!conectada && Boolean(obligatoria));
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  async function guardar() {
    setError("");
    setEnviando(true);
    const r = await fetch("/api/ia/conexiones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proveedor, ...datos }),
    });
    const data = await r.json().catch(() => ({}));
    setEnviando(false);
    if (!r.ok) {
      setError(data.error || "No se pudo conectar.");
      return;
    }
    setAbierto(false);
    router.refresh();
  }

  async function desconectar() {
    if (!confirm(`¿Desconectar ${titulo}? Vas a tener que volver a cargar la clave.`)) return;
    await fetch(`/api/ia/conexiones?proveedor=${proveedor}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div
      className={`rounded-lg border p-3 flex flex-col gap-2 bg-white ${
        conectada ? "border-green-300" : obligatoria ? "border-amber-400" : "border-gray-200"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-navy">
            {conectada ? "✓ " : ""}
            {titulo}{" "}
            <span
              className={`ml-1 text-[11px] font-semibold rounded-full px-2 py-0.5 ${
                obligatoria ? "bg-green-100 text-green-800" : "bg-violet-100 text-violet-800"
              }`}
            >
              {etiqueta}
            </span>
          </p>
          <p className="text-xs text-gray-600 mt-0.5">{descripcion}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {conectada ? (
            <>
              <button
                type="button"
                onClick={() => setAbierto((v) => !v)}
                className="text-xs font-semibold text-navy underline"
              >
                {abierto ? "Cerrar" : "Cambiar clave"}
              </button>
              <button type="button" onClick={desconectar} className="text-xs text-red-600 underline">
                Desconectar
              </button>
            </>
          ) : (
            !abierto && (
              <button
                type="button"
                onClick={() => setAbierto(true)}
                className="rounded-md bg-navy text-white text-xs font-semibold px-3 py-1.5 hover:opacity-90"
              >
                Conectar
              </button>
            )
          )}
        </div>
      </div>

      {abierto && (
        <div className="flex flex-col gap-2">
          {children}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={guardar}
              disabled={enviando || !puedeGuardar}
              className="rounded-md bg-navy text-white text-sm font-semibold px-4 py-2 hover:opacity-90 disabled:opacity-50"
            >
              {enviando ? "Probando la conexión..." : "Guardar conexión"}
            </button>
            <span className="text-[11px] text-gray-500">
              Queda guardada en tu panel y no se muestra a nadie.
            </span>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}

export default function ConectarIAs({ cf, fal }: { cf: boolean; fal: boolean }) {
  const [cuenta, setCuenta] = useState("");
  const [token, setToken] = useState("");
  const [claveFal, setClaveFal] = useState("");

  return (
    <div
      className={`rounded-xl border p-4 flex flex-col gap-3 ${
        cf ? "border-green-200 bg-green-50/60" : "border-amber-300 bg-amber-50"
      }`}
    >
      <div>
        <p className="text-sm font-semibold text-navy">Paso 1 · Conectar IAs</p>
        <p className="text-xs text-gray-600">
          Se hace una sola vez y quedan conectadas: después todo se usa desde acá, sin entrar a
          otras páginas.
        </p>
      </div>

      <Tarjeta
        proveedor="cloudflare"
        titulo="Cloudflare Workers AI"
        etiqueta="Gratis · obligatoria"
        descripcion="Hace las fotos con IA (modelos, estilos de publicidad, fondo blanco). Unas 50 fotos gratis por día."
        conectada={cf}
        obligatoria
        puedeGuardar={Boolean(cuenta.trim() && token.trim())}
        datos={{ cuenta, token }}
      >
        <ol className="text-xs text-gray-700 list-decimal pl-4 flex flex-col gap-1">
          <li>
            Entrá a{" "}
            <a href="https://dash.cloudflare.com/sign-up" target="_blank" rel="noreferrer" className="underline">
              Cloudflare
            </a>{" "}
            (cuenta gratis, no pide tarjeta).
          </li>
          <li>
            <b>Account ID</b>: el código largo que aparece en la dirección, después de{" "}
            <code>dash.cloudflare.com/</code>.
          </li>
          <li>
            <b>Token</b>: tu usuario (arriba a la derecha) → My Profile → API Tokens → Create Token →
            plantilla <b>Workers AI</b> → Continue to summary → Create Token.
          </li>
        </ol>
        <Campo
          value={cuenta}
          onChange={(e) => setCuenta(e.target.value)}
          placeholder="Account ID (32 letras y números)"
        />
        <Campo
          value={token}
          onChange={(e) => setToken(e.target.value)}
          type="password"
          autoComplete="off"
          placeholder="Token de Workers AI"
        />
      </Tarjeta>

      <Tarjeta
        proveedor="fal"
        titulo="fal.ai"
        etiqueta="Paga · opcional"
        descripcion="Para videos con una persona usando el artículo (UGC) y fotos premium. Pagás solo lo que generás (un video de 5 s ronda US$0,42)."
        conectada={fal}
        puedeGuardar={Boolean(claveFal.trim())}
        datos={{ token: claveFal }}
      >
        <ol className="text-xs text-gray-700 list-decimal pl-4 flex flex-col gap-1">
          <li>
            Creá la cuenta en{" "}
            <a href="https://fal.ai" target="_blank" rel="noreferrer" className="underline">
              fal.ai
            </a>{" "}
            y cargá saldo (Billing).
          </li>
          <li>
            Andá a{" "}
            <a href="https://fal.ai/dashboard/keys" target="_blank" rel="noreferrer" className="underline">
              Keys
            </a>{" "}
            → Add key, y copiá la clave.
          </li>
        </ol>
        <Campo
          value={claveFal}
          onChange={(e) => setClaveFal(e.target.value)}
          type="password"
          autoComplete="off"
          placeholder="Clave de fal.ai"
        />
      </Tarjeta>
    </div>
  );
}
