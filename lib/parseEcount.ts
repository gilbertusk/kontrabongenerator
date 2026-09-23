import * as XLSX from "xlsx";

export interface EcountRow {
  /** key unik untuk React list & seleksi (bukan data bisnis) */
  id: string;
  number?: string;
  invoiceNo: string;
  /** tanggal apa adanya untuk ditampilkan, format dd/mm/yyyy bila bisa dideteksi */
  dateStr: string;
  /** timestamp (ms) untuk keperluan sorting, NaN jika tidak terbaca */
  dateValue: number;
  amount: number;
  foreignAmount: number | null;
  poCustomer: string;
  flightNumber: string;
  customer: string;
}

export interface ParseResult {
  rows: EcountRow[];
  customers: string[];
  warnings: string[];
}

// Alias nama kolom yang dikenali dari file export ECOUNT ("Sales List" dsb).
// Cocokkan secara longgar (lowercase, tanpa titik/spasi ganda) supaya tahan
// terhadap variasi kecil nama kolom antar jenis laporan ECOUNT.
const HEADER_ALIASES: Record<string, string[]> = {
  number: ["number", "no"],
  invoiceNo: ["invoice", "invoice no", "invoice no.", "no invoice"],
  date: ["date", "tanggal"],
  amount: ["total amount", "amount", "jumlah", "total"],
  foreignAmount: [
    "total foreign currency amount",
    "foreign currency amount",
    "foreign amount",
  ],
  poCustomer: [
    "no. po customer",
    "no po customer",
    "po customer",
    "no. po",
    "no po",
  ],
  flightNumber: ["flight number", "flight no", "flight no.", "no flight"],
  customer: ["cust.", "cust", "customer", "customer name", "nama customer"],
};

function normalizeHeader(v: unknown): string {
  return String(v ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function findHeaderRow(matrix: unknown[][]): number {
  const maxScan = Math.min(matrix.length, 15);
  for (let r = 0; r < maxScan; r++) {
    const row = matrix[r] || [];
    const normalized = row.map(normalizeHeader);
    const hasInvoice = normalized.some((c) =>
      HEADER_ALIASES.invoiceNo.includes(c)
    );
    const hasDate = normalized.some((c) => HEADER_ALIASES.date.includes(c));
    const hasAmount = normalized.some((c) =>
      HEADER_ALIASES.amount.includes(c)
    );
    if (hasInvoice && hasDate && hasAmount) return r;
  }
  return -1;
}

function buildColumnMap(headerRow: unknown[]): Record<string, number> {
  const map: Record<string, number> = {};
  const normalized = headerRow.map(normalizeHeader);
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    const idx = normalized.findIndex((h) => aliases.includes(h));
    if (idx !== -1) map[field] = idx;
  }
  return map;
}

// Baris footer ECOUNT biasanya berupa timestamp cetak, misal:
// "23/09/2026 (Wed) 9:24:04" -- ini bukan baris data, jadi jadi sinyal berhenti.
const TIMESTAMP_ROW_RE = /^\d{1,2}\/\d{1,2}\/\d{2,4}\s*\(\w+\)/;

function parseDateCell(v: unknown): { str: string; value: number } {
  if (v instanceof Date && !isNaN(v.getTime())) {
    const dd = String(v.getDate()).padStart(2, "0");
    const mm = String(v.getMonth() + 1).padStart(2, "0");
    const yyyy = v.getFullYear();
    return { str: `${dd}/${mm}/${yyyy}`, value: v.getTime() };
  }
  const s = String(v ?? "").trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const dd = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10);
    const yyyy = parseInt(m[3], 10) + (m[3].length === 2 ? 2000 : 0);
    const d = new Date(yyyy, mm - 1, dd);
    return {
      str: `${String(dd).padStart(2, "0")}/${String(mm).padStart(2, "0")}/${yyyy}`,
      value: d.getTime(),
    };
  }
  const parsed = Date.parse(s);
  return { str: s, value: isNaN(parsed) ? NaN : parsed };
}

function parseNumberCell(v: unknown): number {
  if (typeof v === "number") return v;
  if (v == null || v === "") return 0;
  const cleaned = String(v).replace(/[^0-9.\-]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

/**
 * Parse file export ECOUNT (xlsx) jadi daftar invoice terstruktur.
 * `buffer` boleh ArrayBuffer (browser) atau Buffer (Node/serverless).
 */
export function parseEcountWorkbook(buffer: ArrayBuffer | Buffer): ParseResult {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    raw: true,
    defval: null,
  });

  const warnings: string[] = [];
  const headerRowIdx = findHeaderRow(matrix);
  if (headerRowIdx === -1) {
    return {
      rows: [],
      customers: [],
      warnings: [
        "Tidak menemukan baris header (kolom 'Invoice', 'Date', 'Total Amount') di file ini. Pastikan ini adalah file export 'Sales List' dari ECOUNT.",
      ],
    };
  }

  const colMap = buildColumnMap(matrix[headerRowIdx] as unknown[]);
  const requiredFields = ["invoiceNo", "date", "amount"];
  for (const f of requiredFields) {
    if (!(f in colMap)) {
      warnings.push(`Kolom untuk '${f}' tidak ditemukan di header.`);
    }
  }

  const rows: EcountRow[] = [];
  for (let r = headerRowIdx + 1; r < matrix.length; r++) {
    const row = matrix[r] || [];
    const firstCell = String(row[0] ?? "").trim();

    if (row.every((c) => c === null || c === "")) continue; // baris kosong
    if (TIMESTAMP_ROW_RE.test(firstCell)) break; // baris timestamp footer -> selesai

    const invoiceNo = String(row[colMap.invoiceNo] ?? "").trim();
    if (!invoiceNo) continue; // tidak ada nomor invoice -> skip (bukan baris data)

    const { str: dateStr, value: dateValue } = parseDateCell(row[colMap.date]);
    const amount = parseNumberCell(row[colMap.amount]);
    const foreignAmount =
      colMap.foreignAmount !== undefined
        ? (() => {
            const v = row[colMap.foreignAmount];
            return v === null || v === "" ? null : parseNumberCell(v);
          })()
        : null;

    rows.push({
      id: `${invoiceNo}-${r}`,
      number:
        colMap.number !== undefined
          ? String(row[colMap.number] ?? "").trim()
          : undefined,
      invoiceNo,
      dateStr,
      dateValue,
      amount,
      foreignAmount,
      poCustomer:
        colMap.poCustomer !== undefined
          ? String(row[colMap.poCustomer] ?? "").trim()
          : "",
      flightNumber:
        colMap.flightNumber !== undefined
          ? String(row[colMap.flightNumber] ?? "").trim()
          : "",
      customer:
        colMap.customer !== undefined
          ? String(row[colMap.customer] ?? "").trim()
          : "",
    });
  }

  const customers = Array.from(
    new Set(rows.map((r) => r.customer).filter(Boolean))
  ).sort();

  if (rows.length === 0) {
    warnings.push("Tidak ada baris data invoice yang terbaca dari file ini.");
  }

  return { rows, customers, warnings };
}
