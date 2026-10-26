"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { buildQuery } from "@/components/payments/monthly-payment-validation-format"
import { buttonVariants } from "@/components/ui/button"
import { PAYMENT_SECTION_NAV_MESSAGES } from "@/lib/localization/es-ec"
import { cn } from "@/lib/utils"

const PAYMENT_SECTIONS = [
  {
    href: "/dashboard/payments",
    label: PAYMENT_SECTION_NAV_MESSAGES.SUMMARY,
  },
  {
    href: "/dashboard/payments/validation",
    label: PAYMENT_SECTION_NAV_MESSAGES.VALIDATION,
  },
  {
    href: "/dashboard/payments/settings",
    label: PAYMENT_SECTION_NAV_MESSAGES.SETTINGS,
  },
] as const

interface PaymentsSectionNavProps {
  branchId: string
}

/**
 * Sub-navigation shared by the three payments screens. The tabs are real links
 * between the existing routes, so deep links and bookmarks keep working, and
 * every link carries the active branch.
 */
export function PaymentsSectionNav({ branchId }: PaymentsSectionNavProps) {
  const pathname = usePathname()
  const branchQuery = buildQuery(branchId)

  return (
    <nav
      aria-label={PAYMENT_SECTION_NAV_MESSAGES.LABEL}
      className="flex flex-wrap items-center gap-1"
    >
      {PAYMENT_SECTIONS.map((section) => {
        const isCurrent = pathname === section.href

        return (
          <Link
            key={section.href}
            href={`${section.href}?${branchQuery}`}
            aria-current={isCurrent ? "page" : undefined}
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              isCurrent
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {section.label}
          </Link>
        )
      })}
    </nav>
  )
}
