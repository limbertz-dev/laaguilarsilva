interface DataTableProps {
  headers: string[]
  children: React.ReactNode
}

export function DataTable({ headers, children }: DataTableProps): React.JSX.Element {
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
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}
