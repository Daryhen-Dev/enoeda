import { LoaderCircleIcon } from "lucide-react"

import { Card, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const SUMMARY_CARD_COUNT = 3
const TABLE_SKELETON_ROW_COUNT = 5
const TABLE_SKELETON_COLUMN_COUNT = 3

export default function DashboardLoading() {
  return (
    <main
      aria-busy="true"
      aria-labelledby="dashboard-loading-heading"
      className="flex flex-col gap-4 p-4 md:gap-6 md:p-6"
    >
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-muted-foreground" role="status">
          <LoaderCircleIcon aria-hidden="true" className="size-4 animate-spin" />
          <span className="text-sm font-medium">Cargando el panel de control...</span>
        </div>
        <h1 id="dashboard-loading-heading" className="text-lg font-semibold">
          Panel de control
        </h1>
        <Skeleton className="h-4 w-full max-w-sm" />
      </header>

      <section aria-label="Resumen del panel de control" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: SUMMARY_CARD_COUNT }, (_, index) => (
          <Card key={`summary-skeleton-${index}`} aria-hidden="true">
            <CardHeader className="gap-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-4 w-full" />
            </CardHeader>
          </Card>
        ))}
      </section>

      <section aria-label="Tabla del panel de control" className="rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50 text-left text-muted-foreground">
            <TableRow aria-hidden="true">
              {Array.from({ length: TABLE_SKELETON_COLUMN_COUNT }, (_, index) => (
                <TableHead key={`table-heading-${index}`} className="px-4 py-3">
                  <Skeleton className="h-4 w-24" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody aria-busy="true">
            {Array.from({ length: TABLE_SKELETON_ROW_COUNT }, (_, rowIndex) => (
              <TableRow key={`table-row-${rowIndex}`} aria-hidden="true">
                {Array.from({ length: TABLE_SKELETON_COLUMN_COUNT }, (_, columnIndex) => (
                  <TableCell
                    key={`table-cell-${rowIndex}-${columnIndex}`}
                    className="px-4 py-3"
                  >
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </main>
  )
}
