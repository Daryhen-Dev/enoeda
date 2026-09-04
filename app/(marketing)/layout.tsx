import type { ReactNode } from "react"

import { MarketingFooter } from "@/components/marketing/shell/footer"
import { MarketingHeader } from "@/components/marketing/shell/header"
import styles from "@/components/marketing/marketing.module.css"

interface MarketingLayoutProps {
  children: ReactNode
}

export default function MarketingLayout({ children }: MarketingLayoutProps) {
  return (
    <div className={styles.landing} data-marketing-page>
      <MarketingHeader />
      {children}
      <MarketingFooter />
    </div>
  )
}
