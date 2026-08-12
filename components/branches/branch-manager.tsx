"use client"

import {
  AlertCircleIcon,
  Building2Icon,
  Clock3Icon,
  MapPinIcon,
  PhoneIcon,
} from "lucide-react"

import type { BranchRecord } from "@/lib/domain/branches/actions"
import {
  ECUADOR_TIME_ZONES,
  type EcuadorTimeZone,
} from "@/lib/domain/branches/schema"
import { BranchFormDialog } from "@/components/branches/branch-form-dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

export const BRANCH_DIRECTORY_STATUS = {
  LOADING: "loading",
  READY: "ready",
  ERROR: "error",
} as const

const TIME_ZONE_LABELS = {
  [ECUADOR_TIME_ZONES.CONTINENTAL]:
    "Continental Ecuador — America/Guayaquil (UTC−5)",
  [ECUADOR_TIME_ZONES.GALAPAGOS]:
    "Galápagos — Pacific/Galapagos (UTC−6)",
} as const

type BranchDirectoryStatus =
  (typeof BRANCH_DIRECTORY_STATUS)[keyof typeof BRANCH_DIRECTORY_STATUS]

interface LoadingBranchDirectoryResult {
  status: Extract<
    BranchDirectoryStatus,
    typeof BRANCH_DIRECTORY_STATUS.LOADING
  >
}

interface ReadyBranchDirectoryResult {
  status: Extract<
    BranchDirectoryStatus,
    typeof BRANCH_DIRECTORY_STATUS.READY
  >
  branches: BranchRecord[]
}

interface ErrorBranchDirectoryResult {
  status: Extract<
    BranchDirectoryStatus,
    typeof BRANCH_DIRECTORY_STATUS.ERROR
  >
  error: string
}

export type BranchDirectoryResult =
  | LoadingBranchDirectoryResult
  | ReadyBranchDirectoryResult
  | ErrorBranchDirectoryResult

interface BranchManagerProps {
  result: BranchDirectoryResult
}

function getTimeZoneLabel(timeZone: EcuadorTimeZone): string {
  return TIME_ZONE_LABELS[timeZone]
}

export function BranchManager({ result }: BranchManagerProps) {
  const activeBranches =
    result.status === BRANCH_DIRECTORY_STATUS.READY
      ? result.branches.filter((branch) => branch.is_active)
      : []

  return (
    <section
      data-slot="branch-directory"
      className="flex flex-col gap-4"
      aria-labelledby="branches-title"
    >
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 id="branches-title" className="text-lg font-semibold">
            Branches
          </h1>
          <p className="text-sm text-muted-foreground">
            Active academy locations
          </p>
        </div>
        <BranchFormDialog />
      </header>

      {result.status === BRANCH_DIRECTORY_STATUS.LOADING && (
        <Empty role="status" aria-live="polite">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Building2Icon />
            </EmptyMedia>
            <EmptyTitle>Loading branches</EmptyTitle>
            <EmptyDescription>
              Please wait while branch locations are loaded.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {result.status === BRANCH_DIRECTORY_STATUS.ERROR && (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>Unable to load branches</AlertTitle>
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      )}

      {result.status === BRANCH_DIRECTORY_STATUS.READY &&
        activeBranches.length === 0 && (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Building2Icon />
              </EmptyMedia>
              <EmptyTitle>No active branches</EmptyTitle>
              <EmptyDescription>
                There are no active branch locations to display.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}

      {result.status === BRANCH_DIRECTORY_STATUS.READY &&
        activeBranches.length > 0 && (
          <ul
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            aria-label="Active branches"
          >
            {activeBranches.map((branch) => (
              <li key={branch.id}>
                <Card aria-label={branch.name}>
                  <CardHeader className="flex-row items-start justify-between gap-3">
                    <h2 className="font-heading text-base leading-snug font-medium">
                      {branch.name}
                    </h2>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">Active</Badge>
                      <BranchFormDialog branch={branch} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <dl className="grid gap-3 text-sm">
                      <div>
                        <dt className="sr-only">Address</dt>
                        <dd className="flex gap-2 text-muted-foreground">
                          <MapPinIcon
                            className="mt-0.5 size-4 shrink-0"
                            aria-hidden="true"
                          />
                          {branch.address ?? "Address unavailable"}
                        </dd>
                      </div>
                      <div>
                        <dt className="sr-only">Phone</dt>
                        <dd className="flex gap-2 text-muted-foreground">
                          <PhoneIcon
                            className="mt-0.5 size-4 shrink-0"
                            aria-hidden="true"
                          />
                          {branch.phone ?? "Phone unavailable"}
                        </dd>
                      </div>
                      <div>
                        <dt className="sr-only">Time zone</dt>
                        <dd className="flex gap-2 text-muted-foreground">
                          <Clock3Icon
                            className="mt-0.5 size-4 shrink-0"
                            aria-hidden="true"
                          />
                          {getTimeZoneLabel(branch.time_zone)}
                        </dd>
                      </div>
                    </dl>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
    </section>
  )
}
