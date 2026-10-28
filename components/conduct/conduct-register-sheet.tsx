"use client"

import { useState } from "react"
import { PlusIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { ConductQuickEntry } from "@/components/conduct/conduct-quick-entry"
import { notifyConductRecordCreated } from "@/components/conduct/conduct-events"
import {
  CONDUCT_MESSAGES,
  CONDUCT_RECORDS_MESSAGES,
} from "@/lib/localization/es-ec"

interface ConductRegisterSheetProps {
  branchId: string
  /** Branch-timezone today (YYYY-MM-DD); default and max for the incident date. */
  todayDateOnly: string
}

/**
 * "Registrar" entry point of the Conducta page: the records list stays the
 * page's main surface and the quick-entry form opens in a side sheet. A
 * successful registration closes the sheet so the refreshed list is visible.
 */
export function ConductRegisterSheet({
  branchId,
  todayDateOnly,
}: ConductRegisterSheetProps) {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button />}>
        <PlusIcon className="size-4" />
        {CONDUCT_RECORDS_MESSAGES.REGISTER_TRIGGER}
      </SheetTrigger>
      <SheetContent side="right" size="content" className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{CONDUCT_MESSAGES.CREATE_TITLE}</SheetTitle>
          <SheetDescription>{CONDUCT_MESSAGES.CREATE_DESCRIPTION}</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-4">
          <ConductQuickEntry
            branchId={branchId}
            todayDateOnly={todayDateOnly}
            onSuccess={() => {
              setOpen(false)
              // The page's server refresh only rewrites the unfiltered list.
              notifyConductRecordCreated()
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
