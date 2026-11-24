import { freeQtyFromRemark } from "./freeQty";
import {
  TIMESTAMP_ROW_RE,
  buildColumnMap,
  normalizeHeader,
  parseNumberCell,
  readFirstSheetMatrix,
  textAt,
} from "./sheetParsing";

/**
 * Parser laporan ECOUNT "Sales Status Details" untuk menu Internal Use Free
 * Qty. Satu baris = satu item di satu surat jalan; free qty-nya dihitung dari
 * kolom "Remarks/Ikatan" (lihat `freeQtyFromRemark`).
 */

export interface SalesStatusRow {
  /** key unik untuk React list & seleksi (bukan data bisnis) */
  id: string;
  /** tanggal SJ apa adanya, format dd/mm/yyyy bila bisa dideteksi */
  dateStr: string;
  sjNo: string;
  poCustomer: string;
  progressStatus: string;
  customerCode: string;
  customer: string;
  flightNo: string;
  pengiriman: string;
  itemCode: string;
  itemName: string;
  qty: number;
  remark: string;
  /** null = Remarks tidak punya penanda free */
  freeQty: number | null;
}

export interface SalesStatusParseResult {
  rows: SalesStatusRow[];
  warnings: string[];
}

const HEADER_ALIASES = {
  date: ["date", "tanggal"],
  sjNo: ["no. sj", "no sj", "no. surat jalan", "no surat jalan"],
  poCustomer: ["no. po customer", "no po customer", "po customer"],
  progressStatus: ["progress status"],
  customerCode: ["customer code", "cust. code", "kode customer"],
  customer: ["customer", "cust.", "customer name", "nama customer"],
  flightNo: ["flight no.", "flight no", "flight number"],
  pengiriman: ["pengiriman"],
  itemCode: ["item code", "kode item", "kode barang"],
  itemName: ["item name (spec)", "item name", "nama item", "nama barang"],
  qty: ["qty.", "qty", "quantity"],
  remark: ["remarks/ikatan", "remarks", "remark", "ikatan"],
} as const;

type Field = keyof typeof HEADER_ALIASES;

/** Kolom minimum supaya file bisa dipakai untuk free qty. */
const REQUIRED_FIELDS: readonly Field[] = ["itemCode", "qty", "remark"];

function hasField(normalized: string[], field: Field): boolean {
  const aliases: readonly string[] = HEADER_ALIASES[field];
  return normalized.some((c) => aliases.includes(c));
}

function findHeaderRow(matrix: unknown[][]): number {
  const maxScan = Math.min(matrix.length, 15);
  for (let r = 0; r < maxScan; r++) {
    const normalized = (matrix[r] || []).map(normalizeHeader);
    if (REQUIRED_FIELDS.every((f) => hasField(normalized, f))) return r;
  }
  return -1;
}

function displayDate(v: unknown): string {
  if (v instanceof Date && !isNaN(v.getTime())) {
    const dd = String(v.getDate()).padStart(2, "0");
    const mm = String(v.getMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}/${v.getFullYear()}`;
  }
  return String(v ?? "").trim();
}

const HEADER_NOT_FOUND =
  "Tidak menemukan baris header di file ini. Baris judul kolomnya harus punya " +
  '"Item Code", "Qty." dan "Remarks/Ikatan". Pastikan ini file export ' +
  '"Sales Status Details" dari ECOUNT.';

export function parseSalesStatusWorkbook(
  buffer: ArrayBuffer | Buffer
): SalesStatusParseResult {
  const matrix = readFirstSheetMatrix(buffer);
  const headerRowIdx = findHeaderRow(matrix);
  if (headerRowIdx === -1) return { rows: [], warnings: [HEADER_NOT_FOUND] };

  const col = buildColumnMap(matrix[headerRowIdx] ?? [], HEADER_ALIASES);
  const rows: SalesStatusRow[] = [];

  for (let r = headerRowIdx + 1; r < matrix.length; r++) {
    const row = matrix[r] || [];
    if (TIMESTAMP_ROW_RE.test(String(row[0] ?? "").trim())) break;

    // baris subtotal / grand total ECOUNT tidak punya Item Code
    const itemCode = textAt(row, col.itemCode);
    if (!itemCode) continue;

    const remark = textAt(row, col.remark);
    const sjNo = textAt(row, col.sjNo);
    rows.push({
      id: `${sjNo}-${itemCode}-${r}`,
      dateStr: col.date === undefined ? "" : displayDate(row[col.date]),
      sjNo,
      poCustomer: textAt(row, col.poCustomer),
      progressStatus: textAt(row, col.progressStatus),
      customerCode: textAt(row, col.customerCode),
      customer: textAt(row, col.customer),
      flightNo: textAt(row, col.flightNo),
      pengiriman: textAt(row, col.pengiriman),
      itemCode,
      itemName: textAt(row, col.itemName),
      qty: col.qty === undefined ? 0 : parseNumberCell(row[col.qty]),
      remark,
      freeQty: freeQtyFromRemark(remark),
    });
  }

  return { rows, warnings: buildWarnings(rows) };
}

function buildWarnings(rows: readonly SalesStatusRow[]): string[] {
  if (rows.length === 0) {
    return ["Tidak ada baris item yang terbaca dari file ini."];
  }
  const withoutFree = rows.filter((r) => r.freeQty === null).length;
  return withoutFree > 0
    ? [`${withoutFree} baris tidak punya free di Remarks/Ikatan, jadi tidak ikut.`]
    : [];
}
