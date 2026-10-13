import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de privacidad — SOLO VENTAS IA",
};

export default function PrivacidadPage() {
  return (
    <main className="max-w-2xl mx-auto px-4 py-10 flex flex-col gap-4 text-sm text-gray-800">
      <p className="text-xs font-bold tracking-wide uppercase text-gold">Solo Ventas IA</p>
      <h1 className="text-2xl font-semibold text-navy">Política de privacidad</h1>
      <p className="text-gray-500">Última actualización: 12 de octubre de 2026</p>

      <h2 className="font-semibold text-navy mt-2">1. Qué datos guardamos</h2>
      <ul className="list-disc pl-5 flex flex-col gap-1">
        <li>Los datos de acceso de los usuarios del panel (email y contraseña cifrada).</li>
        <li>El catálogo de productos y las fotos, videos y textos que se cargan.</li>
        <li>
          Cuando se conecta una red social: el nombre visible y el identificador de la cuenta, y los
          permisos (tokens) que la red entrega para publicar. Nunca recibimos ni guardamos la
          contraseña de la red.
        </li>
        <li>El historial de publicaciones hechas desde el panel.</li>
      </ul>

      <h2 className="font-semibold text-navy mt-2">2. Para qué los usamos</h2>
      <p>
        Solo para que el panel funcione: mostrar la cuenta conectada y publicar en ella el
        contenido que el usuario elige, cuando el usuario lo pide. No vendemos ni compartimos estos
        datos con terceros, y no los usamos para publicidad.
      </p>

      <h2 className="font-semibold text-navy mt-2">3. Datos de TikTok</h2>
      <p>
        Al conectar TikTok, el panel recibe con tu autorización tu nombre visible, tu foto de
        perfil y tu identificador de TikTok, y un permiso para subir y publicar videos en tu
        cuenta. Usamos esos datos únicamente para mostrarte en qué cuenta se va a publicar y para
        publicar los videos que vos elegís, con las opciones de privacidad que vos indicás.
      </p>

      <h2 className="font-semibold text-navy mt-2">4. Dónde se guardan</h2>
      <p>
        Los datos se guardan en servidores de nuestros proveedores de infraestructura (Vercel y
        Neon), con conexiones cifradas y acceso restringido.
      </p>

      <h2 className="font-semibold text-navy mt-2">5. Cómo borrarlos</h2>
      <p>
        Podés desconectar cualquier red desde la sección Redes sociales del panel: se borran los
        permisos guardados de esa red. También podés quitar el acceso desde la configuración de la
        propia red (en TikTok: Configuración y privacidad → Seguridad → Apps y servicios). Para
        pedir que borremos todos tus datos, escribinos a través de www.soloventas.com.ar.
      </p>

      <h2 className="font-semibold text-navy mt-2">6. Cambios</h2>
      <p>
        Si cambiamos esta política, vamos a publicar la nueva versión en esta página con su fecha.
      </p>

      <p className="text-gray-500 mt-4">
        Ver también los <a href="/terminos" className="underline">Términos y condiciones</a>.
      </p>
    </main>
  );
}
