import {
  Children,
  isValidElement,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode
} from 'react'

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const
const DEFAULT_PAGE_SIZE = 10
const PAGINATION_THRESHOLD = 10

interface DataTableProps {
  headers: string[]
  children: ReactNode
}

function isPlaceholderRow(row: ReactNode): boolean {
  if (!isValidElement(row)) return false
  const element = row as ReactElement<{ children?: ReactNode }>
  if (element.type !== 'tr') return false
  const cells = Children.toArray(element.props.children)
  if (cells.length !== 1) return false
  const cell = cells[0]
  if (!isValidElement(cell)) return false
  const colSpan = (cell.props as { colSpan?: number }).colSpan
  return colSpan != null && colSpan > 1
}

export function DataTable({ headers, children }: DataTableProps): React.JSX.Element {
  const rows = useMemo(() => Children.toArray(children), [children])
  const isPlaceholder = rows.length === 1 && isPlaceholderRow(rows[0])
  const showPagination = !isPlaceholder && rows.length > PAGINATION_THRESHOLD
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE)
  const [currentPage, setCurrentPage] = useState(1)

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const safeCurrentPage = Math.min(currentPage, totalPages)

  const visibleRows = useMemo(() => {
    if (isPlaceholder || !showPagination) return rows
    const start = (safeCurrentPage - 1) * pageSize
    return rows.slice(start, start + pageSize)
  }, [safeCurrentPage, isPlaceholder, pageSize, rows, showPagination])

  const rangeStart = showPagination ? (safeCurrentPage - 1) * pageSize + 1 : 1
  const rangeEnd = showPagination
    ? Math.min(safeCurrentPage * pageSize, rows.length)
    : rows.length

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>{visibleRows}</tbody>
      </table>
      {showPagination && (
        <div className="table-pagination">
          <label className="table-pagination-size">
            <span>Filas por página</span>
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.currentTarget.value))
                setCurrentPage(1)
              }}
            >
              {PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <span className="table-pagination-range">
            Mostrando {rangeStart}–{rangeEnd} de {rows.length}
          </span>
          <div className="table-pagination-nav">
            <button
              type="button"
              className="button-secondary"
              disabled={safeCurrentPage <= 1}
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            >
              Anterior
            </button>
            <span>
                Página {safeCurrentPage} de {totalPages}
              </span>
              <button
                type="button"
                className="button-secondary"
                disabled={safeCurrentPage >= totalPages}
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  )
}