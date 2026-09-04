import type { Metadata } from "next"

import { MarketingElCamino } from "@/components/marketing/el-camino/el-camino"

export const metadata: Metadata = {
  title: "El camino | ENOEDA Dojo",
  description:
    "Conoce los principios de ENOEDA Dojo: Karate, Kickboxing y comunidad para entrenar con técnica, disciplina y respeto.",
}

export default function ElCaminoPage() {
  return <MarketingElCamino />
}
