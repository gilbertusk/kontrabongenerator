import type { RejectCategoryNo } from "./internalUse";
import {
  buildColumnMap,
  normalizeHeader,
  parseNumberCell,
  readFirstSheetMatrix,
  textAt,
} from "./sheetParsing";

/**
 * Parser laporan ECOUNT "Goods Receipt Status" untuk menu Internal Use
 * Reject. Satu baris = satu item hasil produksi; qty reject-nya dirinci di
 * kolom "Reject 1 (Material/Setting/Sambungan)" .. "Reject 4 (Cut&Fold)".
 */

export interface RejectPart {
  category: RejectCategoryNo;
  qty: number;
}

export interface RejectBreakdown {
  /** reject per kategori yang qty-nya > 0, urut Reject 1..4 */
  parts: RejectPart[];
  /** qty yang tidak punya rincian kategori sehingga dianggap Reject 1 */
  assumedReject1: number;
  /**
   * Jumlah Reject 1..4 yang melebihi "Qty. Reject" (rincian tetap dipakai apa
   * adanya, tapi ditandai supaya dicek user sebelum upload).
   */
  excessDetail: number;
}

const CATEGORY_NOS: readonly RejectCategoryNo[] = [1, 2, 3, 4];

/**
 * Rincian reject satu baris. Kolom Reject 1..4 dipakai apa adanya; sisa
 * "Qty. Reject" yang belum dirinci (mis. Qty. Reject 1.440 tapi Reject 1..4
 * kosong) dimasukkan ke Reject 1 sesuai keputusan tim.
 */
export function rejectBreakdown(
  qtyReject: number,
  perCategory: readonly number[]
): RejectBreakdown {
  const detailed = CATEGORY_NOS.map((category, i) => ({
    category,
    qty: perCategory[i] > 0 ? perCategory[i] : 0,
  }));
  const detailedTotal = detailed.reduce((sum, p) => sum + p.qty, 0);
  const assumedReject1 = Math.max(0, qtyReject - detailedTotal);
  // Qty. Reject kosong (0) bukan berarti rinciannya berlebih
  const excessDetail = qtyReject > 0 ? Math.max(0, detailedTotal - qtyReject) : 0;

  const parts = detailed
    .map((p) => (p.category === 1 ? { ...p, qty: p.qty + assumedReject1 } : p))
    .filter((p) => p.qty > 0);
  return { parts, assumedReject1, excessDetail };
}

export interface GoodsReceiptRow extends RejectBreakdown {
  /** key unik untuk React list & seleksi (bukan data bisnis) */
  id: string;
  /** kolom "Date" apa adanya, mis. "21 Nov 2026" */
  dateStr: string;
  picName: string;
  flightNo: string;
  itemGroup: string;
  itemCode: string;
  itemName: string;
  qty: number;
  qtyReject: number;
}

export interface GoodsReceiptParseResult {
  rows: GoodsReceiptRow[];
  warnings: string[];
}

const HEADER_ALIASES = {
  date: ["date", "tanggal"],
  picName: ["pic name", "pic"],
  flightNo: ["flight number", "flight no.", "flight no"],
  itemGroup: ["item group i name", "item group"],
  itemCode: ["item code", "kode item", "kode barang"],
  itemName: ["item name [spec name]", "item name (spec)", "item name", "nama item"],
  qty: ["qty", "qty."],
  qtyReject: ["qty. reject", "qty reject"],
} as const;

/** "Reject 1 (Material/Setting/Sambungan)" -> 1; keterangan boleh berubah. */
const REJECT_COLUMN = /^reject\s*([1-4])\b/;

/** Posisi kolom Reject 1..4 (index 0 = Reject 1); undefined kalau tidak ada. */
function rejectColumns(headerRow: unknown[]): (number | undefined)[] {
  const normalized = headerRow.map(normalizeHeader);
  return CATEGORY_NOS.map((no) => {
    const idx = normalized.findIndex((h) => REJECT_COLUMN.exec(h)?.[1] === String(no));
    return idx === -1 ? undefined : idx;
  });
}

function findHeaderRow(matrix: unknown[][]): number {
  const maxScan = Math.min(matrix.length, 15);
  for (let r = 0; r < maxScan; r++) {
    const row = matrix[r] || [];
    const normalized = row.map(normalizeHeader);
    const hasItemCode = normalized.some((h) =>
      (HEADER_ALIASES.itemCode as readonly string[]).includes(h)
    );
    const hasReject =
      normalized.some((h) => (HEADER_ALIASES.qtyReject as readonly string[]).includes(h)) ||
      rejectColumns(row).some((i) => i !== undefined);
    if (hasItemCode && hasReject) return r;
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

function numberAt(row: unknown[], idx: number | undefined): number {
  return idx === undefined ? 0 : parseNumberCell(row[idx]);
}

const HEADER_NOT_FOUND =
  "Tidak menemukan baris header di file ini. Baris judul kolomnya harus punya " +
  '"Item Code" dan "Qty. Reject" / "Reject 1".."Reject 4". Pastikan ini file ' +
  'export "Goods Receipt Status" dari ECOUNT.';

export function parseGoodsReceiptWorkbook(
  buffer: ArrayBuffer | Buffer
): GoodsReceiptParseResult {
  const matrix = readFirstSheetMatrix(buffer);
  const headerRowIdx = findHeaderRow(matrix);
  if (headerRowIdx === -1) return { rows: [], warnings: [HEADER_NOT_FOUND] };

  const header = matrix[headerRowIdx] ?? [];
  const col = buildColumnMap(header, HEADER_ALIASES);
  const rejectCols = rejectColumns(header);
  const rows: GoodsReceiptRow[] = [];

  for (let r = headerRowIdx + 1; r < matrix.length; r++) {
    const row = matrix[r] || [];
    // baris subtotal / total / timestamp ECOUNT tidak punya Item Code
    const itemCode = textAt(row, col.itemCode);
    if (!itemCode) continue;

    const qtyReject = numberAt(row, col.qtyReject);
    const breakdown = rejectBreakdown(
      qtyReject,
      rejectCols.map((idx) => numberAt(row, idx))
    );
    rows.push({
      id: `${itemCode}-${r}`,
      dateStr: col.date === undefined ? "" : displayDate(row[col.date]),
      picName: textAt(row, col.picName),
      flightNo: textAt(row, col.flightNo),
      itemGroup: textAt(row, col.itemGroup),
      itemCode,
      itemName: textAt(row, col.itemName),
      qty: numberAt(row, col.qty),
      qtyReject,
      ...breakdown,
    });
  }

  return { rows, warnings: buildWarnings(rows) };
}

function buildWarnings(rows: readonly GoodsReceiptRow[]): string[] {
  if (rows.length === 0) return ["Tidak ada baris item yang terbaca dari file ini."];
  if (!rows.some((r) => r.parts.length > 0)) {
    return ["Tidak ada reject di file ini (Qty. Reject dan Reject 1-4 kosong semua)."];
  }
  const assumed = rows.filter((r) => r.assumedReject1 > 0).length;
  const excess = rows.filter((r) => r.excessDetail > 0).length;
  return [
    assumed > 0
      ? `${assumed} baris punya Qty. Reject tanpa rincian kategori, jadi dimasukkan ke Reject 1.`
      : "",
    excess > 0
      ? `${excess} baris punya rincian Reject 1-4 yang melebihi Qty. Reject; cek dulu sebelum upload.`
      : "",
  ].filter(Boolean);
}
