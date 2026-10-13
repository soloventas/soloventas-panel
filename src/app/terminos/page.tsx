import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Términos y condiciones — SOLO VENTAS IA",
};

export default function TerminosPage() {
  return (
    <main className="max-w-2xl mx-auto px-4 py-10 flex flex-col gap-4 text-sm text-gray-800">
      <p className="text-xs font-bold tracking-wide uppercase text-gold">Solo Ventas IA</p>
      <h1 className="text-2xl font-semibold text-navy">Términos y condiciones</h1>
      <p className="text-gray-500">Última actualización: 12 de octubre de 2026</p>

      <h2 className="font-semibold text-navy mt-2">1. Qué es este servicio</h2>
      <p>
        SOLO VENTAS IA es un panel de uso interno de Solo Ventas (www.soloventas.com.ar) para cargar
        el catálogo de productos, preparar fotos, videos y textos, y publicarlos en las redes
        sociales del negocio (Instagram, Facebook, TikTok y YouTube).
      </p>

      <h2 className="font-semibold text-navy mt-2">2. Quién puede usarlo</h2>
      <p>
        Solo pueden ingresar las personas autorizadas por Solo Ventas, con el usuario y la
        contraseña que se les asigna. Cada usuario es responsable de cuidar su acceso.
      </p>

      <h2 className="font-semibold text-navy mt-2">3. Conexión con redes sociales</h2>
      <p>
        Para publicar, el usuario conecta sus cuentas desde la página oficial de cada red. El panel
        solo publica cuando el usuario lo pide expresamente, con el contenido, el texto y las
        opciones que el usuario elige. El usuario puede desconectar cada red desde el panel en
        cualquier momento, o quitar el permiso desde la configuración de la propia red.
      </p>

      <h2 className="font-semibold text-navy mt-2">4. Contenido</h2>
      <p>
        El usuario es responsable del contenido que publica y de contar con los derechos sobre las
        fotos, videos, música y textos. Todo lo que se publica en una red queda sujeto también a
        las reglas de esa red, como los Términos de servicio y las Normas de la comunidad de
        TikTok, Instagram, Facebook y YouTube.
      </p>

      <h2 className="font-semibold text-navy mt-2">5. Disponibilidad</h2>
      <p>
        Trabajamos para que el panel funcione siempre, pero puede haber interrupciones o cambios,
        incluidos los que dependen de las redes sociales. Solo Ventas puede modificar estos
        términos; la versión vigente es la publicada en esta página.
      </p>

      <h2 className="font-semibold text-navy mt-2">6. Contacto</h2>
      <p>
        Por consultas sobre estos términos, escribinos a través de www.soloventas.com.ar.
      </p>

      <p className="text-gray-500 mt-4">
        Ver también la <a href="/privacidad" className="underline">Política de privacidad</a>.
      </p>
    </main>
  );
}
