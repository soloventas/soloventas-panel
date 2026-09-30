"use client";

import { useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import {
  MAX_FOTOS,
  MAX_VIDEOS,
  TIPOS_FOTO,
  TIPOS_VIDEO,
  tipoDeArchivo,
  maximoPorTipo,
  bytesMaximosPorTipo,
  type TipoMedia,
} from "@/lib/media";

export type Media = {
  id: string;
  tipo: TipoMedia;
  url: string;
  nombre: string | null;
};

type Subida = {
  clave: string;
  nombre: string;
  tipo: TipoMedia | null;
  porcentaje: number;
  estado: "esperando" | "subiendo" | "listo" | "error";
  error?: string;
};

function mb(bytes: number) {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

// Instagram solo acepta fotos JPG de hasta 8 MB. Si la foto es PNG/WEBP o
// pesa más de 8 MB, la convertimos a JPG (máx. 2400 px) antes de subirla.
const LIMITE_JPG_INSTAGRAM = 8 * 1024 * 1024;

async function prepararFoto(archivo: File): Promise<File> {
  if (archivo.type === "image/jpeg" && archivo.size <= LIMITE_JPG_INSTAGRAM) return archivo;
  try {
    const imagen = await createImageBitmap(archivo);
    const escala = Math.min(1, 2400 / Math.max(imagen.width, imagen.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(imagen.width * escala);
    canvas.height = Math.round(imagen.height * escala);
    const ctx = canvas.getContext("2d");
    if (!ctx) return archivo;
    ctx.fillStyle = "#ffffff"; // fondo blanco para PNG con transparencia
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imagen, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.9));
    if (!blob) return archivo;
    const nombre = archivo.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], nombre, { type: "image/jpeg" });
  } catch {
    return archivo;
  }
}

function nombreSeguro(nombre: string) {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .slice(-80);
}

export default function MediaManager({
  productoId,
  inicial,
  onCambio,
}: {
  productoId: string;
  inicial: Media[];
  onCambio?: (media: Media[]) => void;
}) {
  const [media, setMedia] = useState<Media[]>(inicial);

  useEffect(() => {
    onCambio?.(media);
  }, [media, onCambio]);
  const [subidas, setSubidas] = useState<Subida[]>([]);
  const [arrastrando, setArrastrando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const fotos = media.filter((m) => m.tipo === "FOTO");
  const videos = media.filter((m) => m.tipo === "VIDEO");

  function actualizarSubida(clave: string, cambios: Partial<Subida>) {
    setSubidas((prev) => prev.map((s) => (s.clave === clave ? { ...s, ...cambios } : s)));
  }

  async function procesarArchivos(lista: FileList | File[]) {
    const archivos = Array.from(lista);
    if (archivos.length === 0) return;

    // Cuántos lugares quedan de cada tipo, contando los que ya están.
    const libres: Record<TipoMedia, number> = {
      FOTO: MAX_FOTOS - fotos.length,
      VIDEO: MAX_VIDEOS - videos.length,
    };

    const nuevas: Subida[] = [];
    const aSubir: { archivo: File; tipo: TipoMedia; clave: string }[] = [];

    for (const archivo of archivos) {
      const clave = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const tipo = tipoDeArchivo(archivo.type);
      const base: Subida = { clave, nombre: archivo.name, tipo, porcentaje: 0, estado: "esperando" };

      if (!tipo) {
        nuevas.push({
          ...base,
          estado: "error",
          error: "Formato no admitido. Fotos: JPG, PNG o WEBP. Videos: MP4, MOV o WEBM.",
        });
        continue;
      }
      if (archivo.size > bytesMaximosPorTipo(tipo)) {
        nuevas.push({
          ...base,
          estado: "error",
          error: `Pesa ${mb(archivo.size)}. El máximo es ${mb(bytesMaximosPorTipo(tipo))} por ${
            tipo === "FOTO" ? "foto" : "video"
          }.`,
        });
        continue;
      }
      if (libres[tipo] <= 0) {
        nuevas.push({
          ...base,
          estado: "error",
          error:
            tipo === "FOTO"
              ? `Ya llegaste al máximo de ${MAX_FOTOS} fotos.`
              : `Ya llegaste al máximo de ${MAX_VIDEOS} videos.`,
        });
        continue;
      }
      libres[tipo] -= 1;
      nuevas.push(base);
      aSubir.push({ archivo, tipo, clave });
    }

    setSubidas((prev) => [...nuevas, ...prev.filter((s) => s.estado !== "listo")]);
    if (aSubir.length === 0) return;

    setOcupado(true);
    // De a una, para respetar los límites y no saturar la conexión.
    for (const { archivo: original, tipo, clave } of aSubir) {
      actualizarSubida(clave, { estado: "subiendo" });
      try {
        const archivo = tipo === "FOTO" ? await prepararFoto(original) : original;
        const blob = await upload(
          `productos/${productoId}/${tipo === "FOTO" ? "fotos" : "videos"}/${nombreSeguro(archivo.name)}`,
          archivo,
          {
            access: "public",
            handleUploadUrl: "/api/media/upload",
            clientPayload: JSON.stringify({ productoId, tipo }),
            contentType: archivo.type,
            multipart: archivo.size > 8 * 1024 * 1024,
            onUploadProgress: ({ percentage }) =>
              actualizarSubida(clave, { porcentaje: Math.round(percentage) }),
          }
        );

        const res = await fetch(`/api/productos/${productoId}/media`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: blob.url,
            pathname: blob.pathname,
            tipo,
            nombre: archivo.name,
            tamano: archivo.size,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "No se pudo guardar el archivo.");

        setMedia((prev) => [...prev, data as Media]);
        actualizarSubida(clave, { estado: "listo", porcentaje: 100 });
      } catch (e) {
        actualizarSubida(clave, {
          estado: "error",
          error: e instanceof Error ? e.message : "No se pudo subir el archivo.",
        });
      }
    }
    setOcupado(false);
  }

  async function eliminar(m: Media) {
    if (!confirm(`¿Eliminar ${m.tipo === "FOTO" ? "esta foto" : "este video"}?`)) return;
    const res = await fetch(`/api/productos/${productoId}/media/${m.id}`, { method: "DELETE" });
    if (res.ok) {
      setMedia((prev) => prev.filter((x) => x.id !== m.id));
    } else {
      alert("No se pudo eliminar. Probá de nuevo.");
    }
  }

  async function hacerPortada(m: Media) {
    const res = await fetch(`/api/productos/${productoId}/media/${m.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion: "portada" }),
    });
    if (res.ok) {
      setMedia((prev) => [m, ...prev.filter((x) => x.id !== m.id)]);
    }
  }

  const lleno = fotos.length >= MAX_FOTOS && videos.length >= MAX_VIDEOS;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-gold">Fotos y videos</p>
        <p className="text-xs text-gray-500">
          {fotos.length}/{MAX_FOTOS} fotos · {videos.length}/{MAX_VIDEOS} videos
        </p>
      </div>

      {/* Zona para soltar o elegir archivos */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setArrastrando(true);
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastrando(false);
          if (!lleno) procesarArchivos(e.dataTransfer.files);
        }}
        className={`rounded-lg border-2 border-dashed px-4 py-6 text-center transition ${
          arrastrando ? "border-navy bg-navy/5" : "border-gray-300 bg-gray-50"
        } ${lleno ? "opacity-60" : ""}`}
      >
        <p className="text-sm text-gray-700">
          {lleno
            ? "Llegaste al máximo de fotos y videos para este producto."
            : "Arrastrá fotos y videos acá, o"}
        </p>
        {!lleno && (
          <button
            type="button"
            disabled={ocupado}
            onClick={() => inputRef.current?.click()}
            className="mt-2 rounded-md bg-navy text-white text-sm font-semibold px-4 py-2 hover:opacity-90 disabled:opacity-60"
          >
            {ocupado ? "Subiendo..." : "Elegir archivos"}
          </button>
        )}
        <p className="text-xs text-gray-400 mt-2">
          Fotos JPG, PNG o WEBP hasta 15 MB · Videos MP4, MOV o WEBM hasta 100 MB
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={[...TIPOS_FOTO, ...TIPOS_VIDEO].join(",")}
          className="hidden"
          onChange={(e) => {
            if (e.target.files) procesarArchivos(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {/* Estado de las subidas */}
      {subidas.length > 0 && (
        <ul className="flex flex-col gap-2">
          {subidas.map((s) => (
            <li key={s.clave} className="text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-gray-700">{s.nombre}</span>
                <span
                  className={`shrink-0 text-xs font-medium ${
                    s.estado === "error"
                      ? "text-red-600"
                      : s.estado === "listo"
                      ? "text-green-700"
                      : "text-gray-500"
                  }`}
                >
                  {s.estado === "error"
                    ? "No se subió"
                    : s.estado === "listo"
                    ? "Listo"
                    : s.estado === "subiendo"
                    ? `${s.porcentaje}%`
                    : "En espera"}
                </span>
              </div>
              {(s.estado === "subiendo" || s.estado === "esperando") && (
                <div className="mt-1 h-1.5 rounded bg-gray-100 overflow-hidden">
                  <div
                    className="h-full bg-navy transition-all"
                    style={{ width: `${s.porcentaje}%` }}
                  />
                </div>
              )}
              {s.error && <p className="text-xs text-red-600 mt-0.5">{s.error}</p>}
            </li>
          ))}
        </ul>
      )}

      {/* Fotos */}
      <div>
        <p className="text-sm font-medium mb-2">
          Fotos <span className="text-gray-400 font-normal">({fotos.length}/{MAX_FOTOS})</span>
        </p>
        {fotos.length === 0 ? (
          <p className="text-sm text-gray-400">Todavía no hay fotos.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {fotos.map((m, i) => (
              <div key={m.id} className="group relative rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={m.url}
                  alt={m.nombre ?? "Foto del producto"}
                  loading="lazy"
                  className="w-full aspect-square object-cover"
                />
                {i === 0 && (
                  <span className="absolute top-1.5 left-1.5 text-[10px] font-bold uppercase tracking-wide bg-gold text-white px-1.5 py-0.5 rounded">
                    Portada
                  </span>
                )}
                <div className="flex text-xs border-t border-gray-200 bg-white">
                  {i !== 0 && (
                    <button
                      type="button"
                      onClick={() => hacerPortada(m)}
                      className="flex-1 py-1.5 text-navy hover:bg-gray-50"
                    >
                      Portada
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => eliminar(m)}
                    className="flex-1 py-1.5 text-red-600 hover:bg-red-50"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Videos */}
      <div>
        <p className="text-sm font-medium mb-2">
          Videos <span className="text-gray-400 font-normal">({videos.length}/{MAX_VIDEOS})</span>
        </p>
        {videos.length === 0 ? (
          <p className="text-sm text-gray-400">Todavía no hay videos.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {videos.map((m) => (
              <div key={m.id} className="rounded-lg overflow-hidden border border-gray-200 bg-black">
                <video
                  src={m.url}
                  controls
                  preload="metadata"
                  playsInline
                  className="w-full aspect-video object-contain bg-black"
                />
                <div className="flex items-center justify-between gap-2 px-2 py-1.5 bg-white text-xs">
                  <span className="truncate text-gray-600">{m.nombre ?? "Video"}</span>
                  <button
                    type="button"
                    onClick={() => eliminar(m)}
                    className="shrink-0 text-red-600 hover:underline"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
