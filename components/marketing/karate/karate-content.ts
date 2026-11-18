import bandImage from "@/assets/karate/banda.jpg"
import calleImage from "@/assets/karate/calle.jpg"
import equipoImage from "@/assets/karate/equipo.jpg"
import heroImage from "@/assets/karate/hero.jpg"
import kataImage from "@/assets/karate/kata.jpg"
import reiImage from "@/assets/karate/rei.jpg"
import sparringImage from "@/assets/karate/sparring.jpg"

export const KARATE_HERO_IMAGE = {
  alt: "Clase de karate de ENOEDA Dojo en el tatami: alumnos en fila ejecutando una técnica mientras el sensei corrige",
  image: heroImage,
  sizes: "(min-width: 1024px) 40vw, 100vw",
} as const

export const KARATE_VIDEO = {
  caption: "Demostración de karate ENOEDA en la calle",
  label: "Video de la demostración de karate de ENOEDA Dojo en Carapungo",
  poster: "/media/karate/demostracion.webp",
  src: "/media/karate/demostracion.mp4",
} as const

export const KARATE_CALLE_IMAGE = {
  alt: "Alumnos de ENOEDA Dojo formados en la calle junto al tatami y el banner del club durante una demostración",
  image: calleImage,
  sizes: "(min-width: 1024px) 26vw, 90vw",
} as const

export const KARATE_GALLERY = [
  {
    alt: "Alumnos de karate de ENOEDA Dojo formados en el tatami antes del saludo inicial",
    image: reiImage,
    sizes: "(min-width: 1024px) 40vw, 100vw",
  },
  {
    alt: "Alumna de karate ejecutando un kata en el tatami de ENOEDA Dojo",
    image: kataImage,
    sizes: "(min-width: 1024px) 22vw, 100vw",
  },
  {
    alt: "Dos alumnos de karate con guantes durante un ejercicio de kumite en clase",
    image: sparringImage,
    sizes: "(min-width: 1024px) 40vw, 100vw",
  },
  {
    alt: "Equipo infantil de karate de ENOEDA Dojo con sus medallas después de una competencia",
    image: equipoImage,
    sizes: "(min-width: 1024px) 20vw, 90vw",
  },
] as const

export const KARATE_PILLARS = [
  {
    description:
      "La base: postura, guardia, desplazamiento y el golpe que se repite hasta que sale solo. Sin kihon no hay kata ni kumite, sólo movimientos sueltos.",
    name: "KIHON",
  },
  {
    description:
      "La forma. Un combate contra un rival que no está, con sus tiempos, sus distancias y su respiración. Cada kata guarda una decisión táctica.",
    name: "KATA",
  },
  {
    description:
      "El combate. Distancia, timing y control del contacto: se aprende a golpear de verdad sin lastimar a un compañero.",
    name: "KUMITE",
  },
] as const

export const KARATE_TRAINING_OPTIONS = [
  {
    badge: null,
    description:
      "Para niños y adultos que empiezan de cero: disciplina, coordinación y confianza, con progresión por grados y sin apuro. Kata y kumite controlado desde la primera clase.",
    highlight: false,
    title: "KARATE FORMATIVO",
  },
  {
    badge: "EN ENOEDA COMPETIMOS",
    description:
      "Para quien quiere medirse: preparación física, trabajo técnico por categoría y preparación de torneo. Nuestros alumnos compiten en copas locales y torneos abiertos.",
    highlight: true,
    title: "KARATE DE COMPETENCIA",
  },
] as const

export const KARATE_BAND_IMAGE = {
  alt: "Equipo de ENOEDA Dojo reunido bajo el arco del torneo Open Shito Ryu",
  image: bandImage,
  sizes: "100vw",
} as const