export const MARKETING_WHATSAPP_NUMBER = "593995205357"
export const MARKETING_WHATSAPP_DISPLAY_NUMBER = "099 520 53 57"
export const MARKETING_EMAIL = "enoedaKaratedo@hotmail.com"

export function getMarketingWhatsAppUrl(message: string) {
  return `https://wa.me/${MARKETING_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`
}

export const MARKETING_WHATSAPP_URL = getMarketingWhatsAppUrl(
  "Hola, quiero conocer las clases de Karate y Kickboxing de ENOEDA Dojo."
)
