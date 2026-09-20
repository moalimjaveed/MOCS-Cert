import React from 'react';
import { clsx } from 'clsx';

export interface MocsColumn<TData> {
  id?: string;
  header: React.ReactNode | ((context: { column: MocsColumn<TData> }) => React.ReactNode);
  accessorKey?: keyof TData;
  accessorFn?: (row: TData, index: number) => any;
  cell?: (info: { getValue: () => any; row: { original: TData; id: string } }) => React.ReactNode;
  size?: number;
}

export interface MocsTableProps<TData> {
  data: TData[];
  columns: any[];
  /** Currently selected row key (the string value of getRowId) */
  selectedRowId?: string | number | null;
  /** Called when a row is clicked */
  onRowClick?: (row: TData, id: string) => void;
  /** Custom row id resolver. Default: uses row index */
  getRowId?: (row: TData) => string;
  /** Extra class on the outer scroll container */
  className?: string;
  testId?: string;
  /** Minimum width of the inner table (for horizontal scroll). Default: none */
  minWidth?: string;
}

/**
 * MocsTable — canonical MOCS-Cert data table component.
 *
 * Design:
 * - Accessible: role="grid", scope="col" on headers, aria-selected on rows
 * - Sticky header inside scrollable container
 * - Horizontal scroll for wide content
 * - Row selection highlight: bg-[#EFF6FF]
 * - Row hover: bg-[#F8FAFC]
 * - Column headers: uppercase, 10px, semibold, text-[#5C5C5C], whitespace-nowrap
 * - Cells: text-xs, text-[#1C1C1C], border-bottom divide-[#F1F5F9]
 * - No row = card. Rows are rows.
 */
export function MocsTable<TData>({
  data,
  columns,
  selectedRowId,
  onRowClick,
  getRowId,
  className = '',
  testId,
  minWidth,
}: MocsTableProps<TData>) {
  return (
    <div
      className={clsx('overflow-x-auto overflow-y-auto w-full scientific-scrollbar', className)}
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      <table
        data-testid={testId}
        role="grid"
        className={clsx('w-full text-left border-collapse', minWidth ? `min-w-[${minWidth}]` : '')}
        style={minWidth ? { minWidth } : undefined}
      >
        <thead className="sticky top-0 z-10 bg-[#FAFAFA]">
          <tr className="border-b border-[#E5E5E5] text-[10px] font-semibold text-[#5C5C5C] uppercase tracking-wider">
            {columns.map((col: any, idx: number) => {
              const colId = col.id ?? col.accessorKey ?? String(idx);
              const headerVal = typeof col.header === 'function' ? col.header({ column: col }) : col.header;
              const width = col.size !== undefined && col.size !== 150 ? col.size : undefined;

              return (
                <th
                  key={colId}
                  scope="col"
                  className="py-2 px-3 whitespace-nowrap"
                  style={width ? { width, minWidth: width } : undefined}
                >
                  {headerVal}
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody className="divide-y divide-[#F1F5F9] text-xs">
          {data.map((row: TData, rowIdx: number) => {
            const rowId = getRowId ? getRowId(row) : String(rowIdx);
            const isSelected =
              selectedRowId !== null &&
              selectedRowId !== undefined &&
              String(selectedRowId) === rowId;

            return (
              <tr
                key={rowId}
                aria-selected={isSelected || undefined}
                onClick={onRowClick ? () => onRowClick(row, rowId) : undefined}
                className={clsx(
                  'transition-colors',
                  onRowClick && 'cursor-pointer',
                  isSelected
                    ? 'bg-[#EFF6FF] font-semibold'
                    : onRowClick
                    ? 'hover:bg-[#F8FAFC]'
                    : '',
                )}
              >
                {columns.map((col: any, colIdx: number) => {
                  const colId = col.id ?? col.accessorKey ?? String(colIdx);
                  const width = col.size !== undefined && col.size !== 150 ? col.size : undefined;
                  const rawVal =
                    typeof col.accessorFn === 'function'
                      ? col.accessorFn(row, rowIdx)
                      : col.accessorKey
                      ? (row as any)[col.accessorKey]
                      : undefined;

                  const cellVal =
                    typeof col.cell === 'function'
                      ? col.cell({
                          getValue: () => rawVal,
                          row: { original: row, id: rowId },
                        })
                      : rawVal;

                  const isTimeCol = colId === 'timeRange' || colIdx === 1;
                  return (
                    <td
                      key={colId}
                      className={clsx(
                        'py-2.5 px-3 text-[#1C1C1C]',
                        isTimeCol && 'whitespace-nowrap tabular-nums',
                        col.cellClassName
                      )}
                      style={width ? { width, minWidth: width } : undefined}
                    >
                      {cellVal}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
