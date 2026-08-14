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
import { BranchDeactivateDialog } from "@/components/branches/branch-deactivate-dialog"
import { BranchFormDialog } from "@/components/branches/branch-form-dialog"
import { BranchReactivateDialog } from "@/components/branches/branch-reactivate-dialog"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { COMMON_MESSAGES } from "@/lib/localization/es-ec"

export const BRANCH_DIRECTORY_STATUS = {
  LOADING: "loading",
  READY: "ready",
  ERROR: "error",
} as const

const TIME_ZONE_LABELS = {
  [ECUADOR_TIME_ZONES.CONTINENTAL]:
    "Ecuador continental — America/Guayaquil (UTC−5)",
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
  activeResult: BranchDirectoryResult
  historyResult: BranchDirectoryResult
}

function getTimeZoneLabel(timeZone: EcuadorTimeZone): string {
  return TIME_ZONE_LABELS[timeZone]
}

export function BranchManager({
  activeResult,
  historyResult,
}: BranchManagerProps) {
  const activeBranches =
    activeResult.status === BRANCH_DIRECTORY_STATUS.READY
      ? activeResult.branches.filter((branch) => branch.is_active)
      : []
  const inactiveBranches =
    historyResult.status === BRANCH_DIRECTORY_STATUS.READY
      ? historyResult.branches.filter((branch) => !branch.is_active)
      : []

  return (
    <section
      data-slot="branch-directory"
      className="flex flex-col gap-4"
      aria-labelledby="branches-title"
    >
      <header>
        <h1 id="branches-title" className="text-lg font-semibold">
          Sucursales
        </h1>
        <p className="text-sm text-muted-foreground">
          Administre las ubicaciones de la academia y el historial de sucursales
        </p>
      </header>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Activas</TabsTrigger>
          <TabsTrigger value="history">Historial</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">Ubicaciones activas de la academia</p>
          </div>

          {activeResult.status === BRANCH_DIRECTORY_STATUS.LOADING && (
          <Empty role="status" aria-live="polite">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Building2Icon />
              </EmptyMedia>
              <EmptyTitle>{COMMON_MESSAGES.LOADING}</EmptyTitle>
              <EmptyDescription>
                Espere mientras se cargan las sucursales.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
          )}

          {activeResult.status === BRANCH_DIRECTORY_STATUS.ERROR && (
          <Alert variant="destructive">
            <AlertCircleIcon />
            <AlertTitle>No se pudieron cargar las sucursales</AlertTitle>
            <AlertDescription>{activeResult.error}</AlertDescription>
          </Alert>
          )}

          {activeResult.status === BRANCH_DIRECTORY_STATUS.READY &&
            activeBranches.length === 0 && (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Building2Icon />
              </EmptyMedia>
              <EmptyTitle>No hay sucursales activas</EmptyTitle>
              <EmptyDescription>
                No hay ubicaciones de sucursales activas para mostrar.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
          )}

          {activeResult.status === BRANCH_DIRECTORY_STATUS.READY &&
            activeBranches.length > 0 && (
          <ul
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            aria-label="Sucursales activas"
          >
            {activeBranches.map((branch) => (
              <li key={branch.id}>
                <Card aria-label={branch.name}>
                  <CardHeader className="flex-row items-start justify-between gap-3">
                    <h2 className="font-heading text-base leading-snug font-medium">
                      {branch.name}
                    </h2>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">Activa</Badge>
                      <BranchFormDialog branch={branch} />
                      <BranchDeactivateDialog branch={branch} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <dl className="grid gap-3 text-sm">
                      <div>
                        <dt className="sr-only">Dirección</dt>
                        <dd className="flex gap-2 text-muted-foreground">
                          <MapPinIcon
                            className="mt-0.5 size-4 shrink-0"
                            aria-hidden="true"
                          />
                          {branch.address ?? "Dirección no disponible"}
                        </dd>
                      </div>
                      <div>
                        <dt className="sr-only">Teléfono</dt>
                        <dd className="flex gap-2 text-muted-foreground">
                          <PhoneIcon
                            className="mt-0.5 size-4 shrink-0"
                            aria-hidden="true"
                          />
                          {branch.phone ?? "Teléfono no disponible"}
                        </dd>
                      </div>
                      <div>
                        <dt className="sr-only">Zona horaria</dt>
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
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <p className="text-sm text-muted-foreground">Ubicaciones de sucursales inactivas</p>

          {historyResult.status === BRANCH_DIRECTORY_STATUS.LOADING && (
          <Empty role="status" aria-live="polite">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Building2Icon />
              </EmptyMedia>
              <EmptyTitle>{COMMON_MESSAGES.LOADING}</EmptyTitle>
              <EmptyDescription>
                Espere mientras se cargan las sucursales.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
          )}

          {historyResult.status === BRANCH_DIRECTORY_STATUS.ERROR && (
          <Alert variant="destructive">
            <AlertCircleIcon />
            <AlertTitle>No se pudieron cargar las sucursales</AlertTitle>
            <AlertDescription>{historyResult.error}</AlertDescription>
          </Alert>
          )}

          {historyResult.status === BRANCH_DIRECTORY_STATUS.READY &&
            inactiveBranches.length === 0 && (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Building2Icon />
              </EmptyMedia>
              <EmptyTitle>No hay sucursales inactivas</EmptyTitle>
              <EmptyDescription>
                No hay ubicaciones de sucursales inactivas en el historial.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
          )}

          {historyResult.status === BRANCH_DIRECTORY_STATUS.READY &&
            inactiveBranches.length > 0 && (
          <ul
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            aria-label="Sucursales inactivas"
          >
            {inactiveBranches.map((branch) => (
              <li key={branch.id}>
                <Card aria-label={branch.name}>
                  <CardHeader className="flex-row items-start justify-between gap-3">
                    <h2 className="font-heading text-base leading-snug font-medium">
                      {branch.name}
                    </h2>
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive">Inactiva</Badge>
                      <BranchReactivateDialog branch={branch} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <dl className="grid gap-3 text-sm">
                      <div>
                        <dt className="sr-only">Dirección</dt>
                        <dd className="flex gap-2 text-muted-foreground">
                          <MapPinIcon
                            className="mt-0.5 size-4 shrink-0"
                            aria-hidden="true"
                          />
                          {branch.address ?? "Dirección no disponible"}
                        </dd>
                      </div>
                      <div>
                        <dt className="sr-only">Teléfono</dt>
                        <dd className="flex gap-2 text-muted-foreground">
                          <PhoneIcon
                            className="mt-0.5 size-4 shrink-0"
                            aria-hidden="true"
                          />
                          {branch.phone ?? "Teléfono no disponible"}
                        </dd>
                      </div>
                      <div>
                        <dt className="sr-only">Zona horaria</dt>
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
        </TabsContent>
      </Tabs>
    </section>
  )
}
