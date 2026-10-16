import type { Metadata } from "next"

import { MarketingKickboxing } from "@/components/marketing/kickboxing/kickboxing"

export const metadata: Metadata = {
  title: "Kickboxing | ENOEDA Dojo",
  description:
    "Del ring japonés de los años sesenta al tatami de ENOEDA: descubre la historia del kickboxing y entrena con técnica, combinaciones y respeto.",
}

export default function KickboxingPage() {
  return <MarketingKickboxing />
}
