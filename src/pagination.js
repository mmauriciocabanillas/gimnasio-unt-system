export function paginate(rows, requestedPage = 0, size = 100) {
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const page = Math.max(0, Math.min(pages - 1, Number.isInteger(requestedPage) ? requestedPage : 0));
  return { rows: rows.slice(page * size, (page + 1) * size), page, pages, total: rows.length };
}
