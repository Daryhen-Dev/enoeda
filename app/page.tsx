import type { Metadata } from "next"

import { MarketingFooter } from "@/components/marketing/footer"
import { MarketingHeader } from "@/components/marketing/header"
import { MarketingHero } from "@/components/marketing/hero"
import { MarketingHistory } from "@/components/marketing/history"
import { MarketingMasters } from "@/components/marketing/masters"
import styles from "@/components/marketing/marketing.module.css"

export const metadata: Metadata = {
  title: "ENOEDA Dojo | Disciplina, poder y fuerza",
  description:
    "Conocé la propuesta de ENOEDA Dojo, un espacio de práctica, disciplina y entrenamiento marcial.",
}

export default function Home() {
  return (
    <div className={styles.landing} data-marketing-page>
      <MarketingHeader />
      <main>
        <MarketingHero />
        <MarketingHistory />
        <MarketingMasters />
      </main>
      <MarketingFooter />
    </div>
  )
}
