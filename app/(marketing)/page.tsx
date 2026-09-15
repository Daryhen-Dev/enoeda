import type { Metadata } from "next"

import { MarketingDojoStories } from "@/components/marketing/home/sections/dojo-stories"
import { MarketingHero } from "@/components/marketing/home/sections/hero"
import { MarketingHistory } from "@/components/marketing/home/sections/history"
import { MarketingJourney } from "@/components/marketing/home/sections/journey"
import { MarketingLocations } from "@/components/marketing/home/sections/locations"
import { MarketingMasters } from "@/components/marketing/home/sections/masters"

export const metadata: Metadata = {
  title: "ENOEDA Dojo | Karate y Kickboxing",
  description:
    "Conoce ENOEDA Dojo, un espacio para practicar Karate y Kickboxing con técnica, constancia e intención.",
}

export default function Home() {
  return (
    <main>
      <MarketingHero />
      <MarketingDojoStories />
      <MarketingJourney />
      <MarketingHistory />
      <MarketingMasters />
      <MarketingLocations />
    </main>
  )
}
