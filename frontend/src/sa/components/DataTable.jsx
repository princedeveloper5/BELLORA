import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ChevronsUpDown, Inbox } from 'lucide-react'
import EmptyState from './EmptyState'

const readPath = (row, key) => key.split('.').reduce((acc, part) => (acc == null ? acc : acc[part]), row)

export default function DataTable({
  columns,
  rows = [],
  rowKey = 'id',
  loading = false,
  rowClickable = false,
  selectable = false,
  pageSize = 10,
  itemLabel = 'items',
  emptyTitle = 'No results found',
  emptyMessage = 'Try adjusting your search or filters.',
  emptyIcon = Inbox,
  defaultSort = '',
  defaultSortDir = 1,
  onRowClick,
  actions,
  bulk,
  emptyAction
}) {
  const [sortKey, setSortKey] = useState(defaultSort)
  const [sortDir, setSortDir] = useState(defaultSortDir)
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(pageSize)
  const [selectedKeys, setSelectedKeys] = useState(() => new Set())

  useEffect(() => {
    setPage(1)
    setSelectedKeys(new Set())
  }, [rows])

  useEffect(() => {
    setPage(1)
  }, [size])

  const keyOf = (row) => (typeof rowKey === 'function' ? rowKey(row) : row[rowKey])
  const isSelected = (row) => selectedKeys.has(keyOf(row))

  const toggleSelect = (row) => {
    const next = new Set(selectedKeys)
    if (next.has(keyOf(row))) next.delete(keyOf(row))
    else next.add(keyOf(row))
    setSelectedKeys(next)
  }

  const clearSelection = () => setSelectedKeys(new Set())

  const selectedRows = useMemo(() => rows.filter((row) => selectedKeys.has(keyOf(row))), [rows, selectedKeys, rowKey])

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((dir) => dir * -1)
    else {
      setSortKey(key)
      setSortDir(1)
    }
  }

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows
    return [...rows].sort((a, b) => {
      const va = readPath(a, sortKey) ?? ''
      const vb = readPath(b, sortKey) ?? ''
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * sortDir
      return String(va).localeCompare(String(vb)) * sortDir
    })
  }, [rows, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / size))
  const pageRows = sortedRows.slice((page - 1) * size, page * size)
  const rangeStart = (page - 1) * size + 1
  const rangeEnd = Math.min(sortedRows.length, page * size)
  const allPageSelected = pageRows.length > 0 && pageRows.every((row) => selectedKeys.has(keyOf(row)))

  const toggleSelectAll = () => {
    const next = new Set(selectedKeys)
    if (allPageSelected) pageRows.forEach((row) => next.delete(keyOf(row)))
    else pageRows.forEach((row) => next.add(keyOf(row)))
    setSelectedKeys(next)
  }

  const pageWindow = useMemo(() => {
    const total = totalPages
    const start = Math.max(1, Math.min(page - 2, total - 4))
    return Array.from({ length: Math.min(5, total) }, (_, index) => start + index).filter((p) => p <= total)
  }, [page, totalPages])

  const cellValue = (row, key) => {
    const value = readPath(row, key)
    return value == null || value === '' ? '—' : value
  }

  return (
    <div className="bg-white rounded-xl border border-[#DCE5F0] shadow-[0_1px_3px_rgba(15,37,73,0.05)] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[720px]">
          <thead>
            <tr className="border-b border-[#e9eff8] bg-[#f8fafd]">
              {selectable ? (
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    className="w-4 h-4 accent-[#1769E0]"
                    aria-label="Select all rows"
                    checked={allPageSelected}
                    onChange={toggleSelectAll}
                  />
                </th>
              ) : null}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-[11px] font-bold uppercase tracking-[0.06em] text-[#627D98] whitespace-nowrap select-none ${
                    col.sortable ? 'cursor-pointer hover:text-[#102A43]' : ''
                  } ${col.thClass || ''}`}
                  aria-sort={sortKey === col.key ? (sortDir === 1 ? 'ascending' : 'descending') : undefined}
                  onClick={() => col.sortable && toggleSort(col.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {col.sortable && sortKey === col.key && sortDir === 1 ? (
                      <ChevronUp size={13} className="text-[#1769E0]" />
                    ) : null}
                    {col.sortable && sortKey === col.key && sortDir === -1 ? (
                      <ChevronDown size={13} className="text-[#1769E0]" />
                    ) : null}
                    {col.sortable && sortKey !== col.key ? <ChevronsUpDown size={13} className="text-[#c3d0e2]" /> : null}
                  </span>
                </th>
              ))}
              {actions ? (
                <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-[0.06em] text-[#627D98]">Actions</th>
              ) : null}
            </tr>
          </thead>

          {!loading ? (
            <tbody>
              {pageRows.map((row) => (
                <tr
                  key={keyOf(row)}
                  className={`border-b border-[#f0f4fa] last:border-0 hover:bg-[#f7faff] transition-colors ${
                    rowClickable ? 'cursor-pointer' : ''
                  } ${isSelected(row) ? 'bg-[#eef6ff]' : ''}`}
                  onClick={() => rowClickable && onRowClick?.(row)}
                >
                  {selectable ? (
                    <td className="px-4 py-3 w-10" onClick={(event) => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-[#1769E0]"
                        aria-label="Select row"
                        checked={isSelected(row)}
                        onChange={() => toggleSelect(row)}
                      />
                    </td>
                  ) : null}
                  {columns.map((col) => (
                    <td key={col.key} className={`px-4 py-3 text-[13px] text-[#102A43] align-middle ${col.tdClass || ''}`}>
                      {col.render ? col.render(row) : cellValue(row, col.key)}
                    </td>
                  ))}
                  {actions ? (
                    <td className="px-4 py-2.5 text-right" onClick={(event) => event.stopPropagation()}>
                      {actions(row)}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          ) : null}
        </table>

        {loading ? (
          <div className="p-6 space-y-3" aria-busy="true">
            {Array.from({ length: size }, (_, index) => (
              <div key={index} className="h-9 rounded-lg bg-[#f1f5fb] animate-pulse" />
            ))}
          </div>
        ) : null}

        {!loading && !sortedRows.length ? (
          <EmptyState icon={emptyIcon} title={emptyTitle} message={emptyMessage}>
            {emptyAction}
          </EmptyState>
        ) : null}
      </div>

      {!loading && sortedRows.length ? (
        <footer className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between px-4 py-3 border-t border-[#eef2f9] bg-[#fbfcfe]">
          <div className="flex items-center gap-3">
            <p className="text-[12.5px] text-[#627D98]">
              Showing <span className="font-semibold text-[#102A43]">{rangeStart}</span>–
              <span className="font-semibold text-[#102A43]">{rangeEnd}</span> of{' '}
              <span className="font-semibold text-[#102A43]">{sortedRows.length}</span> {itemLabel}
            </p>
            <select
              value={size}
              onChange={(event) => setSize(Number(event.target.value))}
              className="h-[30px] rounded-lg border border-[#dde6f2] bg-white text-[12px] font-semibold text-[#102A43] px-2"
              aria-label="Rows per page"
            >
              <option value={10}>10 / page</option>
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
            </select>
            {bulk ? bulk(selectedRows, clearSelection) : null}
          </div>
          <div className="flex items-center gap-1.5">
            <button type="button" className="sa-page-btn" disabled={page === 1} aria-label="Previous page" onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft size={15} />
            </button>
            {pageWindow.map((p) => (
              <button
                key={p}
                type="button"
                className={`sa-page-btn min-w-[30px] px-1.5 ${p === page ? '!bg-[#1769E0] !text-white !border-[#1769E0]' : ''}`}
                onClick={() => setPage(p)}
              >
                {p}
              </button>
            ))}
            <button
              type="button"
              className="sa-page-btn"
              disabled={page === totalPages}
              aria-label="Next page"
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </footer>
      ) : null}
    </div>
  )
}
