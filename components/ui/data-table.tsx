"use client"

import type { ReactNode } from "react"

import {
  FlexRender,
  tableFeatures,
  useTable,
  type ColumnDef,
  type RowData,
  type TableFeatures,
} from "@tanstack/react-table"

import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const DEFAULT_SKELETON_ROW_COUNT = 5

interface DataTableProps<TData extends RowData> {
  columns: ColumnDef<TableFeatures, TData>[]
  data: TData[]
  caption: string
  emptyState: ReactNode
  isLoading?: boolean
  skeletonRowCount?: number
}

export function DataTable<TData extends RowData>({
  columns,
  data,
  caption,
  emptyState,
  isLoading = false,
  skeletonRowCount = DEFAULT_SKELETON_ROW_COUNT,
}: DataTableProps<TData>) {
  const table = useTable({
    features: tableFeatures({}),
    columns,
    data,
  })
  const rows = table.getRowModel().rows
  const visibleColumnCount = Math.max(1, columns.length)
  const safeSkeletonRowCount = Number.isFinite(skeletonRowCount)
    ? Math.max(1, Math.floor(skeletonRowCount))
    : DEFAULT_SKELETON_ROW_COUNT

  return (
    <div className="rounded-lg border">
      <Table>
        <TableCaption className="sr-only">{caption}</TableCaption>
        <TableHeader className="bg-muted/50 text-left text-muted-foreground">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} scope="col" className="px-4 py-3">
                  {header.isPlaceholder ? null : <FlexRender header={header} />}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody aria-busy={isLoading}>
          {isLoading ? (
            Array.from({ length: safeSkeletonRowCount }, (_, rowIndex) => (
              <TableRow key={`skeleton-row-${rowIndex}`} aria-hidden="true">
                {Array.from({ length: visibleColumnCount }, (_, columnIndex) => (
                  <TableCell
                    key={`skeleton-cell-${rowIndex}-${columnIndex}`}
                    className="px-4 py-3"
                  >
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="px-4 py-8 text-center text-sm text-muted-foreground"
              >
                <span role="status" aria-live="polite">
                  {emptyState}
                </span>
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.id}>
                {row.getAllCells().map((cell) => (
                  <TableCell key={cell.id} className="px-4 py-3">
                    <FlexRender cell={cell} />
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      {isLoading && (
        <span role="status" aria-live="polite" className="sr-only">
          Cargando datos de la tabla.
        </span>
      )}
    </div>
  )
}
