import kick1Image from "@/assets/kickboxing/kick1.jpeg"
import kick2Image from "@/assets/kickboxing/kick2.jpeg"
import kick3Image from "@/assets/kickboxing/kick3.jpeg"
import kick4Image from "@/assets/kickboxing/kick4.jpeg"
import kick5Image from "@/assets/kickboxing/kick5.jpeg"

export const KICKBOXING_WHATSAPP_MESSAGE =
  "Hola, quiero conocer las clases de Kickboxing de ENOEDA Dojo."

export const KICKBOXING_STYLES = [
  {
    description:
      "El formato original. Contacto completo con puños, patadas y rodillas; las reglas de K-1 nacen de aquí.",
    name: "JAPONÉS",
  },
  {
    description:
      "Puños y patadas solo por encima de la cintura. Sin patadas bajas, el boxeo manda.",
    name: "AMERICANO",
  },
  {
    description:
      "Reglas completas, combinaciones de boxeo y castigo constante a las piernas. Presión sin descanso.",
    name: "HOLANDÉS",
  },
  {
    description:
      "La vía amateur más organizada: desde contacto ligero por puntos hasta contacto completo, low kick y estilo K-1.",
    name: "WAKO",
  },
  {
    description:
      "La herencia francesa del siglo XIX. Se golpea con el zapato, no con la espinilla: precisión y distancia.",
    name: "SAVATE",
  },
  {
    description:
      "El estilo chino que suma derribos, barridos y proyecciones sobre una plataforma elevada.",
    name: "SANDA",
  },
] as const

export const KICKBOXING_TRAINING_OPTIONS = [
  {
    badge: null,
    description:
      "Movimientos inspirados en el kickboxing para quemar calorías y mejorar tu condición. Funciona como entrenamiento, pero no enseña guardia, distancia, trabajo de pies ni a leer a un compañero.",
    highlight: false,
    title: "KICKBOXING CARDIO",
  },
  {
    badge: "LO QUE HACEMOS EN ENOEDA",
    description:
      "Técnica progresiva, defensa, combinaciones, trabajo en pareja y sparring controlado. Te pones en forma, sí, pero sobre todo aprendes a moverte, a defenderte y a mantener la calma bajo presión.",
    highlight: true,
    title: "KICKBOXING TÉCNICO",
  },
] as const

export const KICKBOXING_GALLERY = [
  {
    alt: "Equipo de kickboxing de ENOEDA Dojo reunido en el dojo junto a sus entrenadores",
    image: kick2Image,
    sizes: "(min-width: 1024px) 40vw, 100vw",
  },
  {
    alt: "Kickboxeras de ENOEDA Dojo en el podio de un torneo con el banner del equipo",
    image: kick3Image,
    sizes: "(min-width: 1024px) 22vw, 100vw",
  },
  {
    alt: "Estudiantes de kickboxing de ENOEDA Dojo en guardia durante la clase en el dojo",
    image: kick4Image,
    sizes: "(min-width: 1024px) 40vw, 100vw",
  },
  {
    alt: "Kickboxera de ENOEDA Dojo celebrando con su entrenador tras una competencia",
    image: kick5Image,
    sizes: "(min-width: 1024px) 20vw, 90vw",
  },
] as const

export const KICKBOXING_HERO_IMAGE = {
  alt: "Equipo de kickboxing de ENOEDA Dojo con sus medallas en una competencia",
  image: kick1Image,
  sizes: "(min-width: 1024px) 40vw, 100vw",
} as const
