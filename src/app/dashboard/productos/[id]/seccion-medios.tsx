"use client";

import { useCallback, useMemo, useState } from "react";
import MediaManager, { type Media } from "./media-manager";
import Publicador from "./publicador";
import EstudioIA from "./estudio-ia";
import Navegacion from "@/app/dashboard/edicion/navegacion";

// Une la carga de fotos/videos, el Estudio IA y el publicador, para que lo
// recién subido o generado aparezca enseguida en las otras secciones.
// En Edición se muestra de a un paso: 3 fotos, 4 a 7 Estudio IA, 8 publicar.
export default function SeccionMedios({
  productoId,
  producto,
  inicial,
  redes,
  iaActiva,
  falActivo,
  cfActivo,
  paso,
  irA,
}: {
  productoId: string;
  producto: string;
  inicial: Media[];
  redes: { instagram: string | null; facebook: string | null; tiktok: string | null };
  iaActiva: boolean;
  falActivo: boolean;
  cfActivo: boolean;
  paso: number;
  irA: (paso: number) => void;
}) {
  const [base, setBase] = useState<Media[]>(inicial);
  const [version, setVersion] = useState(0);
  const [media, setMedia] = useState<Media[]>(inicial);
  // Lo que se eligió en el Estudio IA para publicar (clave cambia en cada pedido).
  const [preseleccion, setPreseleccion] = useState<{
    ids: string[];
    tipo: "FOTO" | "VIDEO";
    clave: number;
  } | null>(null);

  // Vuelve a leer las fotos/videos (por ejemplo, cuando la IA termina algo).
  const recargar = useCallback(async () => {
    const r = await fetch(`/api/productos/${productoId}/media`, { cache: "no-store" });
    if (!r.ok) return;
    const data: Media[] = await r.json();
    setBase(data);
    setMedia(data);
    setVersion((v) => v + 1);
  }, [productoId]);

  const aprobados = useMemo(() => media.filter((m) => m.aprobado !== false), [media]);
  const fotosBase = useMemo(() => aprobados.filter((m) => m.tipo === "FOTO"), [aprobados]);

  return (
    <div className="flex flex-col gap-5">
      {paso === 3 && (
        <details open={fotosBase.length === 0} className="rounded-lg border border-gray-200">
          <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-navy">
            📤 Subir o cambiar fotos y videos del producto
          </summary>
          <div className="p-3 pt-0">
            <MediaManager key={version} productoId={productoId} inicial={base} onCambio={setMedia} />
          </div>
        </details>
      )}
      <EstudioIA
        productoId={productoId}
        producto={producto}
        fotos={fotosBase}
        falActivo={falActivo}
        cfActivo={cfActivo}
        paso={paso}
        irA={irA}
        onNuevos={recargar}
        onPublicar={(ids, tipo) => {
          setPreseleccion({ ids, tipo, clave: Date.now() });
          setTimeout(
            () => document.getElementById("publicar-redes")?.scrollIntoView({ behavior: "smooth" }),
            300
          );
        }}
      />
      {paso === 8 && (
        <div id="publicar-redes">
          <Publicador
            productoId={productoId}
            media={aprobados}
            redes={redes}
            iaActiva={iaActiva}
            preseleccion={preseleccion}
          />
          <div className="mt-4">
            <Navegacion onAtras={() => irA(7)} />
          </div>
        </div>
      )}
    </div>
  );
}
