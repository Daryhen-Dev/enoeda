import type { Metadata } from "next"

import { MarketingFooter } from "@/components/marketing/footer"
import { MarketingHeader } from "@/components/marketing/header"
import { MarketingHero } from "@/components/marketing/hero"
import { MarketingHistory } from "@/components/marketing/history"
import { MarketingJourney } from "@/components/marketing/journey"
import { MarketingLocations } from "@/components/marketing/locations"
import { MarketingMasters } from "@/components/marketing/masters"
import styles from "@/components/marketing/marketing.module.css"

export const metadata: Metadata = {
  title: "ENOEDA Dojo | Karate y Kickboxing",
  description:
    "Conocé ENOEDA Dojo, un espacio para practicar Karate y Kickboxing con técnica, constancia e intención.",
}

export default function Home() {
  return (
    <div className={styles.landing} data-marketing-page>
      <MarketingHeader />
      <main>
        <MarketingHero />
        <MarketingJourney />
        <MarketingHistory />
        <MarketingMasters />
        <MarketingLocations />
      </main>
      <MarketingFooter />
    </div>
  )
}
