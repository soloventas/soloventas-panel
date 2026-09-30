// Conexión con la API de Meta (Facebook + Instagram).
// Necesita en Vercel: META_APP_ID y META_APP_SECRET.
// Opcional: META_CONFIG_ID (si la app usa "Inicio de sesión con Facebook para empresas").

import { prisma } from "@/lib/prisma";

export const GRAPH_VERSION = "v25.0";
export const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

export const META_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "publish_video",
  "instagram_basic",
  "instagram_content_publish",
  "business_management",
];

export function metaConfigurado() {
  return Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET);
}

export function urlCallback(origen: string) {
  return `${origen}/api/meta/callback`;
}

export class ErrorMeta extends Error {}

type Params = Record<string, string | number | boolean | undefined>;

function aFormulario(params: Params) {
  const f = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) f.set(k, String(v));
  }
  return f;
}

async function leer(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    const e = data.error || {};
    const detalle = e.error_user_msg || e.message || `Error ${res.status} de Meta`;
    throw new ErrorMeta(detalle);
  }
  return data;
}

export async function graphGet(ruta: string, params: Params) {
  const url = `${GRAPH}/${ruta.replace(/^\//, "")}?${aFormulario(params).toString()}`;
  return leer(await fetch(url, { cache: "no-store" }));
}

export async function graphPost(ruta: string, params: Params) {
  return leer(
    await fetch(`${GRAPH}/${ruta.replace(/^\//, "")}`, {
      method: "POST",
      body: aFormulario(params),
      cache: "no-store",
    })
  );
}

export type PaginaMeta = {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: { id: string; username?: string };
};

export async function listarPaginas(tokenUsuario: string): Promise<PaginaMeta[]> {
  const data = await graphGet("me/accounts", {
    fields: "id,name,access_token,instagram_business_account{id,username}",
    limit: 100,
    access_token: tokenUsuario,
  });
  return (data.data || []) as PaginaMeta[];
}

// Guarda la página de Facebook elegida y su Instagram vinculado.
export async function guardarPagina(pagina: PaginaMeta) {
  await prisma.integracionRed.upsert({
    where: { clave: "facebook" },
    create: {
      clave: "facebook",
      nombre: pagina.name,
      externalId: pagina.id,
      accessToken: pagina.access_token,
    },
    update: {
      nombre: pagina.name,
      externalId: pagina.id,
      accessToken: pagina.access_token,
    },
  });

  const ig = pagina.instagram_business_account;
  if (ig?.id) {
    await prisma.integracionRed.upsert({
      where: { clave: "instagram" },
      create: {
        clave: "instagram",
        nombre: ig.username ? `@${ig.username}` : "Instagram",
        externalId: ig.id,
        accessToken: pagina.access_token,
      },
      update: {
        nombre: ig.username ? `@${ig.username}` : "Instagram",
        externalId: ig.id,
        accessToken: pagina.access_token,
      },
    });
  } else {
    await prisma.integracionRed.deleteMany({ where: { clave: "instagram" } });
  }
}

export async function obtenerIntegracion(clave: "facebook" | "instagram") {
  return prisma.integracionRed.findUnique({ where: { clave } });
}
