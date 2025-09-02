export function exportToCsv(
  baseName: string,
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][],
  opts: { timestamp?: boolean } = {}
) {
  const timestamp = opts.timestamp
    ? new Date().toISOString().replace(/[:.]/g, "-").slice(0, 16)
    : "";
  const filename = `${baseName}${timestamp ? `-${timestamp}` : ""}.csv`;

  const csv = [headers.join(","), ...rows.map(r => r.map(escape).join(","))].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function escape(val: any) {
  if (val == null) return "";
  const s = String(val);
  return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
}
