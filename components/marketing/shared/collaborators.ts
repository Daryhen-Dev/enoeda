import type { StaticImageData } from "next/image"

import akrInternationalImage from "@/assets/enoedaColaborador1.png"
import deportivaPichinchaImage from "@/assets/enoedaColaborador2.png"
import fekEcuadorKarateImage from "@/assets/enoedaColaborador3.png"
import koruRehabilitationImage from "@/assets/enoedaConvenio3.png"
import asociacionKarateDoImage from "@/assets/enoedaColaborador5.png"
import confederacionMundialImage from "@/assets/enoedaColaborador6.png"
import aquaBonsailImage from "@/assets/enoedaConvenio.jpeg"
import ludiLandImage from "@/assets/enoedaConvenio2.png"

export interface MarketingPartner {
  alt: string
  id: string
  image: StaticImageData
  name: string
  role?: string
}

/**
 * Institutional collaborators shown in the marketing footer.
 *
 * Every logo already renders its own name as a wordmark inside the artwork, so
 * the visible UI prints only `role`. `name` is kept for the accessible label
 * and for tests, never as duplicated on-screen text.
 *
 * Order follows karate lineage first (federation, international organisation,
 * club) and then institutional partners.
 *
 * `role` is optional: existing collaborators carry a role line, while newly
 * added institutional entries and all convenios currently show none.
 */
export const MARKETING_COLLABORATORS: readonly MarketingPartner[] = [
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
    alt: "Logo de Asociación de Karate-Do de Pichincha",
    id: "asociacion-karate-do-pichincha",
    image: asociacionKarateDoImage,
    name: "Asociación de Karate-Do de Pichincha",
  },
  {
    alt: "Logo de Confederación Mundial de Artes Marciales y Deportes de Contacto",
    id: "confederacion-mundial-artes-marciales",
    image: confederacionMundialImage,
    name: "Confederación Mundial de Artes Marciales y Deportes de Contacto",
  },
]

/**
 * Convenios / allied partners shown in the marketing footer.
 *
 * Convenios do not carry role lines yet — `role` is pending for future
 * entries. The same alt pattern and display conventions apply.
 */
export const MARKETING_AGREEMENTS: readonly MarketingPartner[] = [
  {
    alt: "Logo de Aqua Bonsail",
    id: "aqua-bonsail",
    image: aquaBonsailImage,
    name: "Aqua Bonsail",
  },
  {
    alt: "Logo de Ludi Land",
    id: "ludi-land",
    image: ludiLandImage,
    name: "Ludi Land",
  },
  {
    alt: "Logo de KORU Rehabilitación Física y Fisioterapia",
    id: "koru-fisioterapia",
    image: koruRehabilitationImage,
    name: "KORU Rehabilitación Física y Fisioterapia",
  },
]

export const MARKETING_COLLABORATORS_INTRO =
  "El dojo no entrena solo. Estas instituciones respaldan y acompañan nuestra práctica."

export const MARKETING_AGREEMENTS_INTRO =
  "Aliados que suman salud, bienestar y recreación para alumnos y familias del dojo."

