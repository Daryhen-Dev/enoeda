import kick1Image from "@/assets/kickboxing/kick1.jpeg"
import kick2Image from "@/assets/kickboxing/kick2.jpeg"
import kick3Image from "@/assets/kickboxing/kick3.jpeg"
import kick4Image from "@/assets/kickboxing/kick4.jpeg"
import kick5Image from "@/assets/kickboxing/kick5.jpeg"

export const KICKBOXING_WHATSAPP_MESSAGE =
  "Hola, quiero conocer las clases de Kickboxing de ENOEDA Dojo."

export const KICKBOXING_TIMELINE = [
  {
    text: "En la antigua Grecia, el Pankration ya permitía puños y patadas. En Tailandia, el Muay Thai se pulía generación tras generación. En India, el musti-yuddha combinaba puños, rodillas y cabezazos. La idea estaba ahí; faltaba que alguien la ordenara.",
    title: "El golpe antes del nombre",
    year: "SIGLOS ATRÁS",
  },
  {
    text: "El karateka Tatsuo Yamada propone algo que muchos consideraban impensable: karate de contacto completo. Lo llama \"karate-boxing\". La semilla está plantada.",
    title: "Karate sin freno",
    year: "1959",
  },
  {
    text: "Tres karatecas japoneses viajan a Bangkok para medirse con tres peleadores de Muay Thai. Japón gana 2 a 1, pero la lección llega en la derrota: Kenji Kurosaki cae noqueado por un codazo, un golpe que el karate no había previsto. Desde esa noche, nada vuelve a ser igual.",
    title: "La noche de Lumpinee",
    year: "1963",
  },
  {
    text: "El promotor Osamu Noguchi toma lo aprendido, prohíbe codos y cabezazos para marcar distancia con el Muay Thai y le da un nombre propio al deporte. Funda la Asociación de Kickboxing y, el 11 de abril, organiza en Osaka el primer evento oficial.",
    title: "Nace el kickboxing",
    year: "1966",
  },
  {
    text: "Tres canales japoneses transmiten peleas cada semana y Tadashi Sawamura se convierte en la primera estrella. Pero la fama es frágil: hacia 1980 el kickboxing desaparece de las pantallas.",
    title: "Fiebre en televisión",
    year: "1970",
  },
  {
    text: "En Estados Unidos, karatecas cansados de los combates sin contacto real crean su propio formato. La PKA celebra sus primeros mundiales con nombres como Joe Lewis, Bill \"Superfoot\" Wallace y Benny \"The Jet\" Urquidez. Su regla clave: patadas solo de la cintura hacia arriba.",
    title: "América pelea a su manera",
    year: "1974",
  },
  {
    text: "En Holanda, peleadores formados en karate y boxeo absorben el Muay Thai que llega a Europa. El resultado es una máquina de presión: jab, cross, gancho y, sin pausa, una patada baja al muslo. Rob Kaman marca el camino; gimnasios como Mejiro, Vos y Chakuriki lo perfeccionan.",
    title: "La escuela holandesa",
    year: "70s — 80s",
  },
  {
    text: "Kazuyoshi Ishii reúne bajo un mismo reglamento a karatecas, tailandeses, holandeses y boxeadores. Una sola regla —un golpe en el clinch y separación— obliga a decidir las peleas a distancia y llena estadios con más de 70 000 personas.",
    title: "K-1 cambia las reglas",
    year: "1993",
  },
  {
    text: "Tras la caída financiera de K-1 después de 2011, GLORY toma el relevo, ONE Championship suma divisiones de kickboxing y K-1 vuelve a Japón. En el plano amateur, la WAKO es el organismo reconocido por el Comité Olímpico Internacional.",
    title: "La herencia sigue viva",
    year: "HOY",
  },
] as const

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
