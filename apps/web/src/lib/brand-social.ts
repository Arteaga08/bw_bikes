import type { SocialNetwork } from "@/components/ui/SocialButton";

export interface BrandSocialLink {
  network: SocialNetwork;
  href: string;
}

/**
 * URLs públicas de la marca. Viven aquí y no en variables de entorno a
 * propósito: no son secretos, no cambian por ambiente, y meterlas en
 * `NEXT_PUBLIC_*` solo agregaría ceremonia de despliegue a tres strings que
 * son tan públicos como el propio HTML que los renderiza.
 *
 * TODO(marca): reemplazar los handles placeholder por las cuentas reales.
 */
const BRAND_SOCIAL_LINKS: readonly BrandSocialLink[] = [
  { network: "facebook", href: "https://facebook.com/blackandwhitebikes" },
  { network: "instagram", href: "https://instagram.com/blackandwhitebikes" },
  { network: "tiktok", href: "https://tiktok.com/@blackandwhitebikes" },
];

/**
 * Asesoría de compra por WhatsApp. El mensaje pre-cargado le ahorra al
 * visitante escribir el primer turno y le da a quien atiende el contexto de
 * dónde salió el chat, que es lo que distingue una asesoría de una consulta
 * en frío.
 *
 * TODO(marca): reemplazar el número placeholder por la línea real (formato
 * internacional sin signos: 52 + 10 dígitos para México).
 */
const WHATSAPP_ADVISORY_NUMBER = "5215500000000";

const WHATSAPP_ADVISORY_URL = `https://wa.me/${WHATSAPP_ADVISORY_NUMBER}?text=${encodeURIComponent(
  "Hola, me gustaría recibir asesoría para elegir una bicicleta.",
)}`;

export { BRAND_SOCIAL_LINKS, WHATSAPP_ADVISORY_URL };
