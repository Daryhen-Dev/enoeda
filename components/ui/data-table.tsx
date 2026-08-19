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

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface DataTableProps<TData extends RowData> {
  columns: ColumnDef<TableFeatures, TData>[]
  data: TData[]
  caption: string
  emptyState: ReactNode
}

export function DataTable<TData extends RowData>({
  columns,
  data,
  caption,
  emptyState,
}: DataTableProps<TData>) {
  const table = useTable({
    features: tableFeatures({}),
    columns,
    data,
  })
  const rows = table.getRowModel().rows

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
        <TableBody>
          {rows.length === 0 ? (
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
    </div>
  )
}
