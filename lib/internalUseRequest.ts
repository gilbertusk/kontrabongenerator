import {
  InternalUseKind,
  InternalUseLine,
  findPic,
  findRejectCategory,
  freeQtyLines,
  isValidIsoDate,
  rejectLines,
} from "./internalUse";

/**
 * Validasi body POST /api/internal-use. Browser hanya mengirim data item
 * (kode, qty, flight number, kategori reject); kode Usage Type ditentukan di
 * server supaya tidak bisa diisi sembarangan, Remark = flight number.
 */

/** Batas panjang Item Code di ECOUNT. */
export const ITEM_CODE_MAX_LENGTH = 20;
/** Batas panjang Remark di ECOUNT. */
export const REMARK_MAX_LENGTH = 200;
/** Qty ECOUNT: maksimal 12 digit bilangan bulat. */
const QTY_MAX = 999_999_999_999;
/** Pengaman supaya endpoint tidak diminta membuat file raksasa. */
export const MAX_LINES = 20_000;

export interface InternalUseRequest {
  kind: InternalUseKind;
  tanggal: string;
  picCode: string;
  lines: InternalUseLine[];
}

export type ValidationResult =
  | { ok: true; value: InternalUseRequest }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

interface ItemFields {
  itemCode: string;
  qty: number;
  /** jadi Remark; boleh kosong */
  flightNo: string;
}

/** Item Code, qty & Flight Number yang sama di kedua menu; string = pesan error. */
function validateItem(raw: unknown, label: string): ItemFields | string {
  if (!isRecord(raw)) return `${label}: data tidak valid.`;

  const itemCode = typeof raw.itemCode === "string" ? raw.itemCode.trim() : "";
  if (!itemCode || itemCode.length > ITEM_CODE_MAX_LENGTH) {
    return `${label}: Item Code wajib diisi (maks. ${ITEM_CODE_MAX_LENGTH} karakter).`;
  }

  const { qty } = raw;
  if (typeof qty !== "number" || !Number.isFinite(qty) || qty <= 0 || qty > QTY_MAX) {
    return `${label} (${itemCode}): Qty harus angka lebih dari 0.`;
  }

  const flightNo = typeof raw.flightNo === "string" ? raw.flightNo.trim() : "";
  if (flightNo.length > REMARK_MAX_LENGTH) {
    return `${label} (${itemCode}): Flight Number maks. ${REMARK_MAX_LENGTH} karakter.`;
  }
  return { itemCode, qty, flightNo };
}

function validateFreeRows(rows: readonly unknown[]) {
  const items: ItemFields[] = [];
  for (const [i, raw] of rows.entries()) {
    const item = validateItem(raw, `Baris ${i + 1}`);
    if (typeof item === "string") return item;
    items.push(item);
  }
  return freeQtyLines(items);
}

function validateRejectRows(rows: readonly unknown[]) {
  const lines = [];
  for (const [i, raw] of rows.entries()) {
    const label = `Baris ${i + 1}`;
    const item = validateItem(raw, label);
    if (typeof item === "string") return item;

    const category = findRejectCategory((raw as Record<string, unknown>).category);
    if (!category) return `${label} (${item.itemCode}): kategori reject harus 1-4.`;

    lines.push({ ...item, category: category.no });
  }
  return rejectLines(lines);
}

export function validateInternalUseRequest(body: unknown): ValidationResult {
  if (!isRecord(body)) return { ok: false, error: "Body permintaan tidak valid." };

  // permintaan lama (sebelum ada menu Reject) tidak mengirim `kind`
  const kind = body.kind ?? "free";
  if (kind !== "free" && kind !== "reject") {
    return { ok: false, error: "Jenis Internal Use tidak dikenal." };
  }

  const tanggal = typeof body.tanggal === "string" ? body.tanggal : "";
  if (!isValidIsoDate(tanggal)) return { ok: false, error: "Tanggal tidak valid." };

  const picCode = typeof body.picCode === "string" ? body.picCode : "";
  if (!findPic(picCode)) {
    return { ok: false, error: "PIC belum dipilih atau tidak terdaftar." };
  }

  if (!Array.isArray(body.rows) || body.rows.length === 0) {
    return { ok: false, error: "Pilih minimal 1 baris." };
  }
  if (body.rows.length > MAX_LINES) {
    return {
      ok: false,
      error: `Terlalu banyak baris (${body.rows.length}); maksimal ${MAX_LINES} per file.`,
    };
  }

  const lines = kind === "free" ? validateFreeRows(body.rows) : validateRejectRows(body.rows);
  if (typeof lines === "string") return { ok: false, error: lines };

  return { ok: true, value: { kind, tanggal, picCode, lines } };
}
