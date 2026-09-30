import { prisma } from "@/lib/prisma";
import { metaConfigurado } from "@/lib/meta";
import { iaConfigurada } from "@/lib/ia";
import { tiktokConfigurado, youtubeConfigurado } from "@/lib/oauth";
import { headers } from "next/headers";
import { ElegirPagina, TarjetaRed } from "./acciones";

export const dynamic = "force-dynamic";

const ERRORES: Record<string, string> = {
  config: "Falta la configuración de Meta en Vercel.",
  config_youtube: "Falta la configuración de YouTube en Vercel.",
  config_tiktok: "Falta la configuración de TikTok en Vercel.",
  cancelado: "Cancelaste la conexión.",
  estado: "La conexión expiró o no es válida. Probá de nuevo.",
  sin_paginas:
    "Tu cuenta no administra ninguna página de Facebook, o no le diste permiso a la app para verla. Probá de nuevo y marcá tu página.",
  meta: "Meta rechazó la conexión.",
  red: "La red rechazó la conexión.",
};

const EXITO: Record<string, string> = {
  "1": "¡Listo! Instagram y Facebook quedaron conectados.",
  meta: "¡Listo! Instagram y Facebook quedaron conectados.",
  youtube: "¡Listo! Tu canal de YouTube quedó conectado.",
  tiktok: "¡Listo! Tu cuenta de TikTok quedó conectada.",
};

export default async function RedesPage({
  searchParams,
}: {
  searchParams: { error?: string; detalle?: string; ok?: string; elegir?: string };
}) {
  const integraciones = await prisma.integracionRed.findMany({
    select: { clave: true, nombre: true },
  });
  const cuenta = (clave: string) => integraciones.find((i) => i.clave === clave)?.nombre ?? null;
  const usuarioMeta = integraciones.some((i) => i.clave === "meta_usuario");
  const facebook = cuenta("facebook");
  const instagram = cuenta("instagram");

  const origen = `https://${headers().get("host")}`;
  const meta = metaConfigurado();

  const pasosMeta = [
    "Entrá a developers.facebook.com → tu app → Configuración de la app → Básica.",
    "Copiá el \"Identificador de la app\" y la \"Clave secreta de la app\".",
    "En Vercel → soloventas-ia → Settings → Environment Variables, cargalos como META_APP_ID y META_APP_SECRET, y hacé Redeploy.",
    "En tu app de Meta, en Inicio de sesión con Facebook → Configuración, cargá la URL de redirección de abajo.",
  ];

  return (
    <div className="max-w-3xl flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold text-navy mb-1">Redes sociales</h1>
        <p className="text-sm text-gray-500">
          Tocá <b>Conectar</b> en cada red: se abre su página oficial, ponés tu usuario y
          contraseña ahí, y el panel queda autorizado para publicar. Tu contraseña nunca se
          guarda en el panel.
        </p>
      </div>

      {searchParams.ok && EXITO[searchParams.ok] && (
        <div className="rounded-md bg-green-50 text-green-800 text-sm px-4 py-3">
          {EXITO[searchParams.ok]}
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

      {usuarioMeta && (searchParams.elegir || !facebook) && <ElegirPagina />}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TarjetaRed
          red="instagram"
          titulo="Instagram"
          descripcion="Fotos, carruseles y Reels. Se conecta con tu cuenta de Meta."
          color="linear-gradient(90deg,#f58529,#dd2a7b,#8134af)"
          cuenta={instagram}
          configurado={meta}
          urlConectar="/api/meta/login"
          aviso={
            facebook && !instagram
              ? "Tu página de Facebook no tiene un Instagram profesional vinculado. Vinculalo desde la configuración de la página y volvé a conectar."
              : null
          }
          pasos={pasosMeta}
          callback={`${origen}/api/meta/callback`}
        />
        <TarjetaRed
          red="facebook"
          titulo="Facebook"
          descripcion="Publicaciones en tu página. Se conecta con tu cuenta de Meta."
          color="#1877f2"
          cuenta={facebook}
          configurado={meta}
          urlConectar="/api/meta/login"
          pasos={pasosMeta}
          callback={`${origen}/api/meta/callback`}
        />
        <TarjetaRed
          red="youtube"
          titulo="YouTube"
          descripcion="Videos y Shorts en tu canal. Se conecta con tu cuenta de Google."
          color="#ff0000"
          cuenta={cuenta("youtube")}
          configurado={youtubeConfigurado()}
          urlConectar="/api/youtube/login"
          pasos={[
            "Entrá a console.cloud.google.com y creá un proyecto (gratis).",
            "Activá la \"YouTube Data API v3\" en APIs y servicios → Biblioteca.",
            "En Pantalla de consentimiento de OAuth elegí \"Externo\" y agregá tu correo como usuario de prueba.",
            "En Credenciales creá un \"ID de cliente de OAuth\" tipo \"Aplicación web\" con la URL de redirección de abajo.",
            "Cargá el ID y el secreto en Vercel como GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET, y hacé Redeploy.",
          ]}
          callback={`${origen}/api/youtube/callback`}
        />
        <TarjetaRed
          red="tiktok"
          titulo="TikTok"
          descripcion="Videos en tu cuenta. Se conecta con tu usuario de TikTok."
          color="linear-gradient(90deg,#25f4ee,#000000,#fe2c55)"
          cuenta={cuenta("tiktok")}
          configurado={tiktokConfigurado()}
          urlConectar="/api/tiktok/login"
          pasos={[
            "Entrá a developers.tiktok.com y creá una app.",
            "Agregale los productos \"Login Kit\" y \"Content Posting API\" (con permisos video.upload y video.publish).",
            "En Login Kit cargá la URL de redirección de abajo.",
            "Cargá el Client key y el Client secret en Vercel como TIKTOK_CLIENT_KEY y TIKTOK_CLIENT_SECRET, y hacé Redeploy.",
            "Para publicar videos públicos, TikTok revisa la app (puede tardar varios días). Mientras tanto se puede probar en privado.",
          ]}
          callback={`${origen}/api/tiktok/callback`}
        />
      </div>

      {/* IA */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold">Textos con IA</p>
          <p className="text-xs text-gray-500">
            Escribe el texto de cada publicación con el estilo de SOLO VENTAS.
          </p>
        </div>
        {iaConfigurada() ? (
          <span className="text-[10px] font-bold uppercase tracking-wide bg-green-100 text-green-700 px-2 py-1 rounded">
            Activa
          </span>
        ) : (
          <span className="text-xs text-amber-700 text-right">
            Falta <code>ANTHROPIC_API_KEY</code> en Vercel
          </span>
        )}
      </div>
    </div>
  );
}
