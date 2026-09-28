import akrInternationalImage from "@/assets/enoedaColaborador1.png"
import deportivaPichinchaImage from "@/assets/enoedaColaborador2.png"
import fekEcuadorKarateImage from "@/assets/enoedaColaborador3.png"
import koruRehabilitationImage from "@/assets/enoedaColaborador4.png"

/**
 * Institutional collaborators shown in the marketing footer.
 *
 * Every logo already renders its own name as a wordmark inside the artwork, so
 * the visible UI prints only `role`. `name` is kept for the accessible label
 * and for tests, never as duplicated on-screen text.
 *
 * Order follows karate lineage first (federation, international organisation,
 * club) and then the health partner.
 */
export const MARKETING_COLLABORATORS = [
  {
    alt: "Logo de FEK Ecuador Karate",
    id: "fek-ecuador-karate",
    image: fekEcuadorKarateImage,
    name: "FEK Ecuador Karate",
    role: "Grados y competencia federada",
  },
  {
    alt: "Logo de AKR Internacional",
    id: "akr-internacional",
    image: akrInternationalImage,
    name: "AKR Internacional",
    role: "Organización internacional de karate-do",
  },
  {
    alt: "Logo de Concentración Deportiva de Pichincha",
    id: "concentracion-deportiva-pichincha",
    image: deportivaPichinchaImage,
    name: "Concentración Deportiva de Pichincha",
    role: "Club deportivo de respaldo",
  },
  {
    alt: "Logo de KORU Rehabilitación Física y Fisioterapia",
    id: "koru-fisioterapia",
    image: koruRehabilitationImage,
    name: "KORU Rehabilitación Física y Fisioterapia",
    role: "Rehabilitación física del practicante",
  },
] as const

export const MARKETING_COLLABORATORS_INTRO =
  "El dojo no entrena solo. Estas instituciones y profesionales respaldan y acompañan nuestra práctica."
