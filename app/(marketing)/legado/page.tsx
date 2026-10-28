import type { Metadata } from "next"

import { MarketingLegado } from "@/components/marketing/legado/legado"

export const metadata: Metadata = {
  title: "El legado de Enoeda | ENOEDA Dojo",
  description:
    "Biografía, trayectoria y filosofía del Sensei Keinosuke Enoeda: 9º dan, campeón de Japón JKA e instructor jefe de la KUGB. Nuestro dojo lleva su nombre.",
}

export default function LegadoPage() {
  return <MarketingLegado />
}
