import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";

interface DataTableLoadingProps {
  columnCount: number;
  rowCount: number;
}

export function DataTableLoading({
  columnCount,
  rowCount,
}: DataTableLoadingProps) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {Array(columnCount)
              .fill(null)
              .map((_, i) => (
                <TableHead key={i}>
                  <Skeleton className="h-4 w-[80px]" />
                </TableHead>
              ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array(rowCount)
            .fill(null)
            .map((_, i) => (
              <TableRow key={i}>
                {Array(columnCount)
                  .fill(null)
                  .map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-[80px]" />
                    </TableCell>
                  ))}
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </div>
  );
}
