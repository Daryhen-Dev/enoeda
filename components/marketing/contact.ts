export const MARKETING_WHATSAPP_NUMBER = "593995205357"
export const MARKETING_WHATSAPP_DISPLAY_NUMBER = "099 520 53 57"
export const MARKETING_EMAIL = "enoedaKaratedo@hotmail.com"
export const MARKETING_INSTAGRAM_URL =
  "https://www.instagram.com/enoedakaratedo/?hl=es-la"
export const MARKETING_FACEBOOK_URL = "https://www.facebook.com/ENOEDAKARATE"
export const MARKETING_TIKTOK_URL = "https://www.tiktok.com/@enoedakaratedo"

export function getMarketingWhatsAppUrl(message: string) {
  return `https://wa.me/${MARKETING_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`
}

export const MARKETING_WHATSAPP_URL = getMarketingWhatsAppUrl(
  "Hola, quiero conocer las clases de Karate y Kickboxing de ENOEDA Dojo."
)
