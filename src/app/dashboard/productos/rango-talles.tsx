"use client";

import { useState } from "react";

type Opcion = { id: string; codigo: string; nombre: string };
type Variante = { colorId: string; talleId: string; stock: number };

// Carga de una sola vez todos los talles de un rango (ej. del 34 al 45), en uno
// o varios colores. Si algún talle todavía no existe en el menú Talles, lo crea.
export default function RangoTalles({
  talles,
  colores,
  admiteColor,
  onTalles,
  onAgregar,
}: {
  talles: Opcion[];
  colores: Opcion[];
  admiteColor: boolean;
  onTalles: (t: Opcion[]) => void;
  onAgregar: (v: Variante[]) => void;
}) {
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [stock, setStock] = useState("0");
  const [cargando, setCargando] = useState(false);
  const [aviso, setAviso] = useState("");

  const d = Number(desde);
  const h = Number(hasta);
  const valido = desde !== "" && hasta !== "" && Number.isInteger(d) && Number.isInteger(h) && h >= d && h - d <= 40;

  async function agregar() {
    if (!valido) return;
    setCargando(true);
    setAviso("");
    try {
      let lista = [...talles];
      const buscar = (n: string) =>
        lista.find((t) => t.nombre.trim() === n || t.codigo.trim() === n);
      for (let n = d; n <= h; n++) {
        const nombre = String(n);
        if (buscar(nombre)) continue;
        const r = await fetch("/api/talles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ codigo: nombre, nombre }),
        });
        if (r.ok) lista.push(await r.json());
      }
      // Por si alguno ya existía con otro nombre, volvemos a leer la lista.
      const r = await fetch("/api/talles", { cache: "no-store" });
      if (r.ok) {
        const data = await r.json();
        if (Array.isArray(data)) lista = data;
      }
      onTalles(lista);
      const ids: string[] = [];
      for (let n = d; n <= h; n++) {
        const t = buscar(String(n));
        if (t) ids.push(t.id);
      }
      const colorIds = admiteColor && elegidos.length ? elegidos : [""];
      const nuevas: Variante[] = [];
      for (const colorId of colorIds) {
        for (const talleId of ids) nuevas.push({ colorId, talleId, stock: Number(stock) || 0 });
      }
      onAgregar(nuevas);
      setAviso(`Listo: se agregaron ${nuevas.length} variantes (talles del ${d} al ${h}).`);
    } catch {
      setAviso("No se pudieron cargar los talles. Probá de nuevo.");
    }
    setCargando(false);
  }

  return (
    <div className="mt-3 rounded-lg border border-navy/30 bg-navy/5 p-3 flex flex-col gap-2">
      <p className="text-sm font-semibold text-navy">Cargar un rango de talles de una vez</p>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        Del
        <input
          type="number"
          value={desde}
          onChange={(e) => setDesde(e.target.value)}
          placeholder="34"
          className="input !w-20"
        />
        al
        <input
          type="number"
          value={hasta}
          onChange={(e) => setHasta(e.target.value)}
          placeholder="45"
          className="input !w-20"
        />
        <span className="ml-2">Stock por talle</span>
        <input
          type="number"
          value={stock}
          onChange={(e) => setStock(e.target.value)}
          className="input !w-20"
        />
      </div>
      {admiteColor && colores.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-gray-600">En los colores:</span>
          {colores.map((c) => {
            const activo = elegidos.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() =>
                  setElegidos((prev) => (activo ? prev.filter((x) => x !== c.id) : [...prev, c.id]))
                }
                className={`rounded-full border px-2.5 py-1 ${
                  activo ? "border-navy bg-navy text-white" : "border-gray-300 bg-white text-gray-700"
                }`}
              >
                {activo ? "✓ " : ""}
                {c.nombre}
              </button>
            );
          })}
        </div>
      )}
      <button
        type="button"
        onClick={agregar}
        disabled={!valido || cargando}
        className="self-start rounded-md bg-navy text-white text-sm font-semibold px-3 py-1.5 hover:opacity-90 disabled:opacity-50"
      >
        {cargando
          ? "Cargando talles..."
          : valido
          ? `Agregar talles del ${d} al ${h}${admiteColor && elegidos.length > 1 ? ` en ${elegidos.length} colores` : ""}`
          : "Agregar talles"}
      </button>
      {aviso && <p className="text-xs text-gray-700">{aviso}</p>}
      <p className="text-[11px] text-gray-500">
        Si un talle todavía no existe, se crea solo. Después podés cambiar el stock de cada uno.
      </p>
    </div>
  );
}
