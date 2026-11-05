"use client";

import { PALETAS, type DatosFichaFoto } from "@/lib/ficha-foto";

// Textos de la "Foto detallada". Vienen cargados con los datos del catálogo y
// se pueden corregir antes de armarla (o después, para rehacerla).
const campo =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-navy";

export default function FichaForm({
  datos,
  onCambio,
}: {
  datos: DatosFichaFoto;
  onCambio: (d: DatosFichaFoto) => void;
}) {
  const poner = (cambios: Partial<DatosFichaFoto>) => onCambio({ ...datos, ...cambios });

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
      <p className="text-sm font-semibold text-navy">📋 Textos de la foto detallada</p>
      <p className="text-xs text-gray-500">
        Revisá que todo sea real: lo que escribas acá aparece tal cual en la foto. Si un dato no es
        cierto, corregilo o borralo.
      </p>

      <label className="text-xs font-medium text-gray-700">
        Título
        <input value={datos.titulo} onChange={(e) => poner({ titulo: e.target.value.slice(0, 60) })} className={`${campo} mt-1`} placeholder="Ej.: Plantillas Guapa" />
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="text-xs font-medium text-gray-700">
          Frase destacada
          <input value={datos.frase} onChange={(e) => poner({ frase: e.target.value.slice(0, 40) })} className={`${campo} mt-1`} placeholder="Ej.: ¡Un talle para cada pie!" />
        </label>
        <label className="text-xs font-medium text-gray-700">
          Talles / medidas
          <input value={datos.talles} onChange={(e) => poner({ talles: e.target.value.slice(0, 30) })} className={`${campo} mt-1`} placeholder="Ej.: Del 34 al 45" />
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-gray-700">Beneficios (hasta 4)</p>
        {datos.beneficios.map((b, i) => (
          <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_1.4fr_auto] gap-2">
            <input
              value={b.titulo}
              onChange={(e) => {
                const beneficios = [...datos.beneficios];
                beneficios[i] = { ...b, titulo: e.target.value.slice(0, 30) };
                poner({ beneficios });
              }}
              className={campo}
              placeholder="Título, ej.: Comodidad todo el día"
            />
            <input
              value={b.texto}
              onChange={(e) => {
                const beneficios = [...datos.beneficios];
                beneficios[i] = { ...b, texto: e.target.value.slice(0, 70) };
                poner({ beneficios });
              }}
              className={campo}
              placeholder="Detalle, ej.: Acolchonadas para más confort"
            />
            <button
              type="button"
              onClick={() => poner({ beneficios: datos.beneficios.filter((_, j) => j !== i) })}
              className="text-xs text-red-600 underline justify-self-start"
            >
              Quitar
            </button>
          </div>
        ))}
        {datos.beneficios.length < 4 && (
          <button
            type="button"
            onClick={() => poner({ beneficios: [...datos.beneficios, { titulo: "", texto: "" }] })}
            className="self-start text-xs font-semibold text-navy underline"
          >
            + Agregar beneficio
          </button>
        )}
      </div>

      <label className="text-xs font-medium text-gray-700">
        Colores o modelos (separados por coma)
        <input value={datos.colores} onChange={(e) => poner({ colores: e.target.value.slice(0, 80) })} className={`${campo} mt-1`} placeholder="Ej.: Negro, Blanco" />
        <span className="block text-[11px] font-normal text-gray-500 mt-0.5">
          Si marcaste más de una foto, la 2ª, 3ª y 4ª aparecen abajo con estos nombres.
        </span>
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="text-xs font-medium text-gray-700">
          Cuadro de venta · título (opcional)
          <input value={datos.cajaTitulo} onChange={(e) => poner({ cajaTitulo: e.target.value.slice(0, 40) })} className={`${campo} mt-1`} placeholder="Ej.: ¿Te parece caro?" />
        </label>
        <label className="text-xs font-medium text-gray-700">
          Cuadro de venta · texto
          <textarea value={datos.cajaTexto} onChange={(e) => poner({ cajaTexto: e.target.value.slice(0, 220) })} rows={2} className={`${campo} mt-1`} placeholder="Ej.: Calidad, durabilidad y confort en cada paso." />
        </label>
      </div>

      <label className="text-xs font-medium text-gray-700">
        Frase de abajo
        <input value={datos.cta} onChange={(e) => poner({ cta: e.target.value.slice(0, 50) })} className={`${campo} mt-1`} placeholder="Ej.: Elegí tu talle, elegí tu confort" />
      </label>

      <div>
        <p className="text-xs font-medium text-gray-700 mb-1.5">Colores de la foto</p>
        <div className="flex flex-wrap gap-2">
          {PALETAS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => poner({ paleta: p.id })}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs ${
                datos.paleta === p.id ? "border-navy bg-navy/5 font-semibold" : "border-gray-300 bg-white"
              }`}
            >
              <span className="w-3 h-3 rounded-full" style={{ background: p.fuerte }} />
              <span className="w-3 h-3 rounded-full" style={{ background: p.acento }} />
              {p.nombre}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
