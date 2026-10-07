"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldError } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  clearBranchLevelRequirement,
  setBranchLevelRequirement,
  type BranchLevelRequirementView,
  type DisciplineBranchLevelRequirements,
} from "@/lib/domain/levels/actions"
import {
  BRANCH_LEVEL_MESSAGES,
  COMMON_MESSAGES,
  formatDate,
} from "@/lib/localization/es-ec"

interface BranchLevelRequirementsListProps {
  branchId: string
  disciplines: DisciplineBranchLevelRequirements[]
}

const MAX_REQUIRED_SESSIONS = 1000

/** Returns the parsed session count, or null when the raw input is invalid. */
function parseRequiredSessions(raw: string): number | null {
  const trimmed = raw.trim()
  if (trimmed === "") return null
  const parsed = Number(trimmed)
  if (
    !Number.isInteger(parsed) ||
    parsed < 0 ||
    parsed > MAX_REQUIRED_SESSIONS
  ) {
    return null
  }
  return parsed
}

/**
 * Cinturones section — per-branch promotion requirements. One row per level:
 * the read-only name/color and general value are owner-managed; the branch
 * input edits only this branch's override ("Personalizado"). "Usar valor
 * general" removes the override so the general value applies again.
 */
export function BranchLevelRequirementsList({
  branchId,
  disciplines,
}: BranchLevelRequirementsListProps) {
  const disciplinesWithLevels = disciplines.filter(
    (discipline) => discipline.levels.length > 0
  )

  if (disciplinesWithLevels.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {BRANCH_LEVEL_MESSAGES.NO_LEVELS}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        {BRANCH_LEVEL_MESSAGES.OWNER_MANAGED_NOTE}
      </p>
      {disciplinesWithLevels.map((discipline) => (
        <section key={discipline.discipline_id} className="flex flex-col gap-2">
          <h3 className="text-base font-semibold">{discipline.discipline_name}</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{BRANCH_LEVEL_MESSAGES.PAGE_TITLE}</TableHead>
                <TableHead>{BRANCH_LEVEL_MESSAGES.GENERAL_LABEL}</TableHead>
                <TableHead>{BRANCH_LEVEL_MESSAGES.BRANCH_LABEL}</TableHead>
                <TableHead>{COMMON_MESSAGES.LAST_UPDATED}</TableHead>
                <TableHead className="sr-only">
                  {COMMON_MESSAGES.SAVE}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {discipline.levels.map((level) => (
                <BranchLevelRow
                  key={`${level.id}:${level.effective_required}`}
                  branchId={branchId}
                  level={level}
                />
              ))}
            </TableBody>
          </Table>
        </section>
      ))}
    </div>
  )
}

function BranchLevelRow({
  branchId,
  level,
}: {
  branchId: string
  level: BranchLevelRequirementView
}) {
  const router = useRouter()
  const [value, setValue] = useState(String(level.effective_required))
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const hasOverride = level.branch_required !== null
  const parsedValue = parseRequiredSessions(value)
  const isDirty = parsedValue !== null && parsedValue !== level.effective_required
  const canSave = isDirty && !isPending

  /**
   * The input edits the effective value; while dirty it stops tracking the
   * server date so the row keeps the pre-edit state until saved.
   */
  const shownUpdatedAt = isDirty ? null : level.updated_at

  function handleSave() {
    if (parsedValue === null) {
      setError(BRANCH_LEVEL_MESSAGES.REQUIRED_SESSIONS_INVALID)
      return
    }

    startTransition(async () => {
      const result = await setBranchLevelRequirement({
        branch_id: branchId,
        level_id: level.id,
        required_attended_sessions: parsedValue,
      })
      if (result.success) {
        setError(null)
        toast.success(BRANCH_LEVEL_MESSAGES.SAVE_SUCCESS)
        router.refresh()
      } else {
        setError(result.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR)
      }
    })
  }

  function handleUseGeneral() {
    startTransition(async () => {
      const result = await clearBranchLevelRequirement({
        branch_id: branchId,
        level_id: level.id,
      })
      if (result.success) {
        setError(null)
        toast.success(BRANCH_LEVEL_MESSAGES.RESET_SUCCESS)
        router.refresh()
      } else {
        setError(result.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR)
      }
    })
  }

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2">
          {level.color && (
            <span
              aria-hidden="true"
              className="inline-block size-3 shrink-0 rounded-full"
              style={{ backgroundColor: level.color }}
            />
          )}
          <span className="font-medium">{level.name}</span>
          {hasOverride && (
            <Badge variant="secondary">
              {BRANCH_LEVEL_MESSAGES.CUSTOM_BADGE}
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell>{level.general_required}</TableCell>
      <TableCell>
        <Field data-invalid={error ? true : undefined}>
          <Input
            type="number"
            min={0}
            max={MAX_REQUIRED_SESSIONS}
            step={1}
            value={value}
            aria-label={`${BRANCH_LEVEL_MESSAGES.BRANCH_LABEL}: ${level.name}`}
            aria-invalid={error ? true : undefined}
            onChange={(event) => {
              setValue(event.target.value)
              if (error) setError(null)
            }}
            disabled={isPending}
            className="w-24"
          />
          {error && <FieldError>{error}</FieldError>}
        </Field>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {shownUpdatedAt ? formatDate(shownUpdatedAt) : "—"}
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap justify-end gap-2">
          <Button size="xs" disabled={!canSave} onClick={handleSave}>
            {isPending ? COMMON_MESSAGES.LOADING : COMMON_MESSAGES.SAVE}
          </Button>
          {hasOverride && (
            <Button
              variant="outline"
              size="xs"
              disabled={isPending}
              onClick={handleUseGeneral}
            >
              {BRANCH_LEVEL_MESSAGES.USE_GENERAL_ACTION}
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  )
}
