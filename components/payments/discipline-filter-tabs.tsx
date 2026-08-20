"use client"

import { useRouter, useSearchParams } from "next/navigation"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { DisciplineFilterOption } from "@/lib/domain/disciplines/actions"
import { PAYMENT_CONSOLE_MESSAGES } from "@/lib/localization/es-ec"

const ALL_DISCIPLINES_TAB = "all"

interface DisciplineFilterTabsProps {
  branchId: string
  disciplines: DisciplineFilterOption[]
  selectedDisciplineId?: string
}

export function DisciplineFilterTabs({
  branchId,
  disciplines,
  selectedDisciplineId,
}: DisciplineFilterTabsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function handleValueChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("branch", branchId)

    if (value === ALL_DISCIPLINES_TAB) {
      params.delete("discipline")
    } else {
      params.set("discipline", value)
    }

    router.push(`/dashboard/payments?${params.toString()}`)
  }

  return (
    <Tabs
      value={selectedDisciplineId ?? ALL_DISCIPLINES_TAB}
      onValueChange={handleValueChange}
    >
      <TabsList aria-label={PAYMENT_CONSOLE_MESSAGES.DISCIPLINE_FILTER_LABEL}>
        <TabsTrigger value={ALL_DISCIPLINES_TAB}>
          {PAYMENT_CONSOLE_MESSAGES.ALL_DISCIPLINES}
        </TabsTrigger>
        {disciplines.map((discipline) => (
          <TabsTrigger key={discipline.id} value={discipline.id}>
            {discipline.name}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
