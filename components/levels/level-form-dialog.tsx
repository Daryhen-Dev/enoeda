"use client"

import { useState, useTransition } from "react"
import type { FormEvent } from "react"
import { useRouter } from "next/navigation"
import { PlusIcon, PencilIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { createLevel, updateLevel } from "@/lib/domain/levels/actions"
import type { LevelRecord } from "@/lib/domain/levels/actions"
import {
  COMMON_MESSAGES,
  TOAST_MESSAGES,
  LEVEL_MESSAGES,
} from "@/lib/localization/es-ec"

interface LevelFormDialogProps {
  disciplineId: string
  mode: "create" | "edit"
  level?: LevelRecord
}

export function LevelFormDialog({
  disciplineId,
  mode,
  level,
}: LevelFormDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(level?.name ?? "")
  const [color, setColor] = useState(level?.color ?? "")
  const [sortOrder, setSortOrder] = useState(
    level?.sort_order?.toString() ?? ""
  )
  const [requiredSessions, setRequiredSessions] = useState(
    level?.required_attended_sessions?.toString() ?? "0"
  )
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function resetForm() {
    if (mode === "create") {
      setName("")
      setColor("")
      setSortOrder("")
      setRequiredSessions("0")
    } else if (level) {
      setName(level.name)
      setColor(level.color ?? "")
      setSortOrder(level.sort_order.toString())
      setRequiredSessions(level.required_attended_sessions.toString())
    }
    setError(null)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      if (mode === "create") {
        const result = await createLevel({
          discipline_id: disciplineId,
          name,
          color: color || null,
          sort_order: Number(sortOrder),
          required_attended_sessions: Number(requiredSessions),
        })
        if (result.success) {
          setOpen(false)
          resetForm()
          toast.success(TOAST_MESSAGES.LEVEL_CREATED)
          router.refresh()
        } else {
          setError(result.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR)
        }
      } else if (level) {
        const result = await updateLevel({
          id: level.id,
          name,
          color: color || null,
          sort_order: Number(sortOrder),
          required_attended_sessions: Number(requiredSessions),
        })
        if (result.success) {
          setOpen(false)
          resetForm()
          toast.success(TOAST_MESSAGES.LEVEL_UPDATED)
          router.refresh()
        } else {
          setError(result.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR)
        }
      }
    })
  }

  const isCreate = mode === "create"

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) resetForm()
      }}
    >
      <SheetTrigger
        render={
          isCreate ? (
            <Button variant="default" size="default" />
          ) : (
            <Button variant="ghost" size="icon-sm" />
          )
        }
      >
        {isCreate ? (
          <>
            <PlusIcon data-icon="inline-start" />
            {LEVEL_MESSAGES.CREATE_LEVEL}
          </>
        ) : (
          <PencilIcon className="size-4" />
        )}
      </SheetTrigger>
      <SheetContent side="right" size="content">
        <SheetHeader>
          <SheetTitle>
            {isCreate ? LEVEL_MESSAGES.CREATE_LEVEL : LEVEL_MESSAGES.EDIT_LEVEL}
          </SheetTitle>
          <SheetDescription>
            {LEVEL_MESSAGES.PAGE_DESCRIPTION}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-4"
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="level-name">
                {LEVEL_MESSAGES.NAME_LABEL}
              </FieldLabel>
              <Input
                id="level-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="level-color">
                {LEVEL_MESSAGES.COLOR_LABEL}
              </FieldLabel>
              <Input
                id="level-color"
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="#FFD700"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="level-sort-order">
                {LEVEL_MESSAGES.SORT_ORDER_LABEL}
              </FieldLabel>
              <Input
                id="level-sort-order"
                type="number"
                min={0}
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="level-required-sessions">
                {LEVEL_MESSAGES.REQUIRED_SESSIONS_LABEL}
              </FieldLabel>
              <Input
                id="level-required-sessions"
                type="number"
                min={0}
                value={requiredSessions}
                onChange={(e) => setRequiredSessions(e.target.value)}
                required
              />
            </Field>
            {error && <FieldError>{error}</FieldError>}
          </FieldGroup>

          <Button
            type="submit"
            disabled={isPending || !name || sortOrder === ""}
            className="self-start"
          >
            {isPending ? LEVEL_MESSAGES.SAVING : COMMON_MESSAGES.SAVE}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
