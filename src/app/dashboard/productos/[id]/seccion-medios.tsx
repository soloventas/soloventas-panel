"use client";

import { useState } from "react";
import MediaManager, { type Media } from "./media-manager";
import Publicador from "./publicador";

// Une la carga de fotos/videos con el publicador, para que las fotos
// recién subidas aparezcan enseguida para publicar.
export default function SeccionMedios({
  productoId,
  inicial,
  redes,
  iaActiva,
}: {
  productoId: string;
  inicial: Media[];
  redes: { instagram: string | null; facebook: string | null };
  iaActiva: boolean;
}) {
  const [media, setMedia] = useState<Media[]>(inicial);

  return (
    <div className="flex flex-col gap-5">
      <MediaManager productoId={productoId} inicial={inicial} onCambio={setMedia} />
      <Publicador productoId={productoId} media={media} redes={redes} iaActiva={iaActiva} />
    </div>
  );
}
