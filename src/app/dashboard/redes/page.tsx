import { prisma } from "@/lib/prisma";
import { metaConfigurado } from "@/lib/meta";
import { iaConfigurada } from "@/lib/ia";
import { headers } from "next/headers";
import { AccionesMeta, ElegirPagina } from "./acciones";

export const dynamic = "force-dynamic";

const ERRORES: Record<string, string> = {
  config: "Falta cargar META_APP_ID y META_APP_SECRET en Vercel.",
  cancelado: "Cancelaste la conexión en Facebook.",
  estado: "La conexión expiró o no es válida. Probá de nuevo.",
  sin_paginas:
    "Tu cuenta no administra ninguna página de Facebook, o no le diste permiso a la app para verla. Probá de nuevo y marcá tu página.",
  meta: "Meta rechazó la conexión.",
};

export default async function RedesPage({
  searchParams,
}: {
  searchParams: { error?: string; detalle?: string; ok?: string; elegir?: string };
}) {
  const integraciones = await prisma.integracionRed.findMany();
  const usuario = integraciones.find((i) => i.clave === "meta_usuario");
  const facebook = integraciones.find((i) => i.clave === "facebook");
  const instagram = integraciones.find((i) => i.clave === "instagram");

  const host = headers().get("host");
  const callback = `https://${host}/api/meta/callback`;

  return (
    <div className="max-w-2xl flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold text-navy mb-1">Redes sociales</h1>
        <p className="text-sm text-gray-500">
          Conectá las cuentas donde el panel va a publicar tus productos.
        </p>
      </div>

      {searchParams.ok && (
        <div className="rounded-md bg-green-50 text-green-800 text-sm px-4 py-3">
          ¡Listo! Tus cuentas de Meta quedaron conectadas.
        </div>
      )}
      {searchParams.error && (
        <div className="rounded-md bg-red-50 text-red-700 text-sm px-4 py-3">
          {ERRORES[searchParams.error] || "No se pudo conectar."}
          {searchParams.detalle && (
            <span className="block text-xs mt-1 opacity-80">Detalle: {searchParams.detalle}</span>
          )}
        </div>
      )}

      {/* Meta: Instagram + Facebook */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold">Instagram y Facebook</p>
            <p className="text-xs text-gray-500">Se conectan juntas a través de tu cuenta de Meta.</p>
          </div>
          {metaConfigurado() && <AccionesMeta conectado={Boolean(usuario)} />}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Estado
            red="Instagram"
            valor={instagram?.nombre}
            vacio={
              facebook
                ? "La página no tiene un Instagram profesional vinculado"
                : "Sin conectar"
            }
          />
          <Estado red="Página de Facebook" valor={facebook?.nombre} vacio="Sin conectar" />
        </div>

        {usuario && (searchParams.elegir || !facebook) && <ElegirPagina />}

        {!metaConfigurado() && (
          <div className="rounded-md bg-amber-50 text-amber-900 text-sm px-4 py-3 flex flex-col gap-2">
            <p className="font-medium">Falta un paso de configuración</p>
            <p>
              En Vercel → soloventas-ia → Settings → Environment Variables, cargá{" "}
              <code className="bg-white/60 px-1 rounded">META_APP_ID</code> y{" "}
              <code className="bg-white/60 px-1 rounded">META_APP_SECRET</code> (los ves en tu app
              de Meta, en Configuración de la app → Básica). Después volvé a publicar el panel.
            </p>
          </div>
        )}

        <div className="text-xs text-gray-500 border-t border-gray-100 pt-3">
          URL de redirección para cargar en tu app de Meta (Inicio de sesión con Facebook →
          Configuración → URI de redireccionamiento de OAuth válidos):
          <code className="block mt-1 bg-gray-50 border border-gray-200 rounded px-2 py-1 break-all text-gray-700">
            {callback}
          </code>
        </div>
      </div>

      {/* IA */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold">Textos con IA</p>
          <p className="text-xs text-gray-500">Genera el texto de cada publicación con el estilo de SOLO VENTAS.</p>
        </div>
        {iaConfigurada() ? (
          <span className="text-xs font-bold uppercase tracking-wide bg-green-100 text-green-700 px-2 py-1 rounded">
            Activa
          </span>
        ) : (
          <span className="text-xs text-amber-700 text-right">
            Falta <code>ANTHROPIC_API_KEY</code> en Vercel
          </span>
        )}
      </div>

      {/* Próximas redes */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Estado red="YouTube" valor={null} vacio="Próximamente" />
        <Estado red="TikTok" valor={null} vacio="Próximamente" />
      </div>
    </div>
  );
}

function Estado({ red, valor, vacio }: { red: string; valor?: string | null; vacio: string }) {
  return (
    <div className="rounded-lg border border-gray-200 px-3 py-2.5">
      <p className="text-xs text-gray-500">{red}</p>
      {valor ? (
        <p className="text-sm font-medium text-green-700">✓ {valor}</p>
      ) : (
        <p className="text-sm text-gray-400">{vacio}</p>
      )}
    </div>
  );
}
