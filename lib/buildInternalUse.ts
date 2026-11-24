import fs from "fs/promises";
import path from "path";
import JSZip from "jszip";
import {
  InternalUseKind,
  InternalUseLine,
  InternalUseRow,
  KIND_TITLE,
  fileNameDate,
  toInternalUseRows,
} from "./internalUse";
import {
  SharedStringTable,
  numberCell,
  readSharedStrings,
  sharedStringCell,
} from "./sheetXml";

/**
 * File upload ECOUNT "Internal Use" dibuat dengan MENGISI template asli dari
 * ECOUNT (`lib/template/internal-use-template.xlsx`, sheet "1_New Int. Use"):
 * header, komentar petunjuk tiap kolom, lebar kolom, dan format teks kolomnya
 * tetap seperti file dari ECOUNT. Generator hanya menambah baris data mulai
 * baris 2.
 *
 * Kolom yang tidak tercantum di `COLUMNS` sengaja dibiarkan kosong (ECOUNT
 * mengisi Item Name dsb. sendiri dari Item Code).
 */

const TEMPLATE_FILE = "internal-use-template.xlsx";
const SHEET_XML = "xl/worksheets/sheet1.xml";
const SHARED_STRINGS_XML = "xl/sharedStrings.xml";
const LAST_COLUMN = "X";
const FIRST_DATA_ROW = 2;

interface ColumnSpec {
  col: string;
  /** judul kolom di template; dicek supaya urutan kolom template tidak bergeser */
  header: string;
  key: keyof InternalUseRow;
  kind: "text" | "number";
}

const COLUMNS: readonly ColumnSpec[] = [
  { col: "A", header: "Date", key: "date", kind: "text" },
  { col: "B", header: "Seq. No.", key: "seqNo", kind: "text" },
  { col: "F", header: "Location-Out", key: "locationOut", kind: "text" },
  { col: "G", header: "PIC", key: "pic", kind: "text" },
  { col: "M", header: "Gross weight", key: "grossWeight", kind: "number" },
  { col: "N", header: "Koli Barang", key: "koli", kind: "number" },
  { col: "O", header: "No. PO Customer", key: "poCustomer", kind: "text" },
  { col: "R", header: "Item Code", key: "itemCode", kind: "text" },
  { col: "U", header: "Qty", key: "qty", kind: "number" },
  { col: "W", header: "Usage Type", key: "usageType", kind: "text" },
  { col: "X", header: "Remark", key: "remark", kind: "text" },
];

export interface InternalUseFileInput {
  /** menentukan nama file: Free Qty / Reject */
  kind: InternalUseKind;
  /** tanggal input ke ECOUNT, "YYYY-MM-DD" */
  tanggal: string;
  picCode: string;
  /** baris yang Usage Type & Remark-nya sudah ditentukan */
  lines: readonly InternalUseLine[];
}

export interface InternalUseFileResult {
  buffer: Buffer;
  filename: string;
}

function columnNumber(col: string): number {
  return [...col].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
}

/** Style bawaan kolom dari `<cols>` template (format teks / angka + garis). */
function columnStyle(sheetXml: string, col: string): number {
  const n = columnNumber(col);
  for (const m of sheetXml.matchAll(/<col\b[^>]*>/g)) {
    const min = Number(/\bmin="(\d+)"/.exec(m[0])?.[1]);
    const max = Number(/\bmax="(\d+)"/.exec(m[0])?.[1]);
    const style = /\bstyle="(\d+)"/.exec(m[0])?.[1];
    if (n >= min && n <= max && style !== undefined) return Number(style);
  }
  return 0;
}

/** Judul tiap kolom di baris 1 template. */
function headerTexts(sheetXml: string, strings: readonly string[]): Map<string, string> {
  const row1 = /<row r="1"[^>]*>([\s\S]*?)<\/row>/.exec(sheetXml)?.[1] ?? "";
  const headers = new Map<string, string>();
  for (const m of row1.matchAll(/<c r="([A-Z]+)1"([^>]*)>\s*<v>(\d+)<\/v>/g)) {
    if (/\bt="s"/.test(m[2])) headers.set(m[1], strings[Number(m[3])] ?? "");
  }
  return headers;
}

function assertTemplateColumns(headers: Map<string, string>): void {
  const wrong = COLUMNS.filter(
    (c) => headers.get(c.col)?.trim().toLowerCase() !== c.header.toLowerCase()
  );
  if (wrong.length > 0) {
    const detail = wrong
      .map((c) => `${c.col}1 harus "${c.header}" (isinya "${headers.get(c.col) ?? ""}")`)
      .join(", ");
    throw new Error(`Template Internal Use tidak sesuai: ${detail}.`);
  }
}

function buildDataRows(
  rows: readonly InternalUseRow[],
  styles: ReadonlyMap<string, number>,
  strings: SharedStringTable
): string {
  return rows
    .map((row, i) => {
      const r = FIRST_DATA_ROW + i;
      const cells = COLUMNS.map(({ col, key, kind }) => {
        const ref = `${col}${r}`;
        const style = styles.get(col) ?? 0;
        const value = row[key];
        return kind === "number"
          ? numberCell(ref, style, Number(value))
          : sharedStringCell(ref, style, strings.ref(String(value)));
      }).join("");
      return `<row r="${r}" spans="1:${columnNumber(LAST_COLUMN)}">${cells}</row>`;
    })
    .join("");
}

export async function buildInternalUseFile(
  input: InternalUseFileInput
): Promise<InternalUseFileResult> {
  const rows = toInternalUseRows(input.lines, {
    date: input.tanggal,
    picCode: input.picCode,
  });

  const template = await fs.readFile(
    path.join(process.cwd(), "lib", "template", TEMPLATE_FILE)
  );
  const zip = await JSZip.loadAsync(template);
  const sheetFile = zip.file(SHEET_XML);
  const stringsFile = zip.file(SHARED_STRINGS_XML);
  if (!sheetFile || !stringsFile) {
    throw new Error("Template Internal Use tidak lengkap (sheet/sharedStrings).");
  }

  const sheetXml = await sheetFile.async("string");
  const stringsXml = await stringsFile.async("string");
  const existing = readSharedStrings(stringsXml);
  assertTemplateColumns(headerTexts(sheetXml, existing));

  const styles = new Map(COLUMNS.map(({ col }) => [col, columnStyle(sheetXml, col)]));
  const strings = new SharedStringTable(existing);
  const dataRows = buildDataRows(rows, styles, strings);
  const lastRow = FIRST_DATA_ROW + rows.length - 1;

  // replacer fungsi supaya isi data tidak ditafsirkan sebagai pola "$"
  const filledSheet = sheetXml
    .replace("</sheetData>", () => `${dataRows}</sheetData>`)
    .replace(/<dimension ref="[^"]*"\/>/, () => `<dimension ref="A1:${LAST_COLUMN}${lastRow}"/>`);

  zip.file(SHEET_XML, filledSheet);
  zip.file(SHARED_STRINGS_XML, strings.apply(stringsXml));

  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  return {
    buffer,
    filename: `Internal Use ${KIND_TITLE[input.kind]} ${fileNameDate(input.tanggal)}.xlsx`,
  };
}
