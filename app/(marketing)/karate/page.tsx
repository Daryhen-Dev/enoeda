import type { Metadata } from "next"

import { MarketingKarate } from "@/components/marketing/karate/karate"

export const metadata: Metadata = {
  title: "Karate-do | ENOEDA Dojo",
  description:
    "Karate Shotokan en ENOEDA Dojo: kihon, kata y kumite, progresión por grados y competencia. Conoce el dojo, sus alumnos y cómo empezar.",
}

export default function KaratePage() {
  return <MarketingKarate />
}