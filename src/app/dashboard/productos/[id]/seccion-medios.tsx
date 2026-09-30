"use client";

import { useCallback, useMemo, useState } from "react";
import MediaManager, { type Media } from "./media-manager";
import Publicador from "./publicador";
import EstudioIA from "./estudio-ia";

// Une la carga de fotos/videos, el Estudio IA y el publicador, para que lo
// recién subido o generado aparezca enseguida en las otras secciones.
export default function SeccionMedios({
  productoId,
  producto,
  inicial,
  redes,
  iaActiva,
  falActivo,
}: {
  productoId: string;
  producto: string;
  inicial: Media[];
  redes: { instagram: string | null; facebook: string | null };
  iaActiva: boolean;
  falActivo: boolean;
}) {
  const [base, setBase] = useState<Media[]>(inicial);
  const [version, setVersion] = useState(0);
  const [media, setMedia] = useState<Media[]>(inicial);

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
      <MediaManager key={version} productoId={productoId} inicial={base} onCambio={setMedia} />
      <EstudioIA
        productoId={productoId}
        producto={producto}
        fotos={fotosBase}
        falActivo={falActivo}
        onNuevos={recargar}
      />
      <Publicador productoId={productoId} media={aprobados} redes={redes} iaActiva={iaActiva} />
    </div>
  );
}
