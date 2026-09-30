import fs from "fs/promises";
import path from "path";
import JSZip from "jszip";
import { terbilangUang, Currency } from "./terbilang";
import { orderRows } from "./orderRows";
import { DEFAULT_TEMPLATE, TemplateId } from "./templates";

/**
 * Kontrabon dibuat dengan cara MENGISI file template asli di `lib/template/`,
 * bukan menggambar ulang layout-nya dari nol. Template itu adalah file
 * kontrabon perusahaan yang sudah jadi, hanya data invoice & rumusnya yang
 * dikosongkan, jadi logo, kop "Contact Us", lebar kolom, kolom tersembunyi,
 * garis, dan pengaturan cetak persis sama seperti kontrabon yang selama ini
 * dipakai.
 *
 * Template dipilih lewat `template` + `currency`:
 *  - BAL    IDR -> kontrabon-template.xlsx        (total Rupiah, dari "Total Amount")
 *  - BAL    USD -> kontrabon-template-usd.xlsx    (total Dollar, dari
 *                  "Total Foreign Currency Amount", blok bank pakai Swift Code)
 *  - JOLIE  IDR -> kontrabon-template-jolie.xlsx  (Luminor, Rupiah saja)
 *  - JULIUS IDR -> kontrabon-template-julius.xlsx (Luminor, Rupiah saja)
 *
 * Template boleh masih berisi baris contoh di bawah header tabel, rumus, dan
 * calcChain: semuanya dibersihkan saat generate (lihat `cleanTemplateSheet`),
 * jadi file dari Excel bisa langsung ditaruh di `lib/template/`.
 *
 * Konsekuensinya: kalau ada yang mau diubah (rekening, nama penandatangan,
 * logo, ukuran kolom), ubah langsung file template-nya lewat Excel. Tidak ada
 * yang perlu diubah di kode ini.
 */

export type { Currency };

const SHEET_XML = "xl/worksheets/sheet1.xml";
const WORKBOOK_XML = "xl/workbook.xml";
const STYLES_XML = "xl/styles.xml";
const APP_XML = "docProps/app.xml";
const CALC_CHAIN_XML = "xl/calcChain.xml";
const CONTENT_TYPES_XML = "[Content_Types].xml";
const WORKBOOK_RELS_XML = "xl/_rels/workbook.xml.rels";

/**
 * Catatan pengingat yang ditulis DI BAWAH area cetak. Orang yang membuka file
 * pasti melihatnya di Excel, tapi baris ini tidak ikut saat dicetak atau
 * di-PDF-kan -- jadi tidak ikut terkirim ke customer.
 */
const WARNING_HEADING = "PERIKSA KEMBALI SEBELUM DIKIRIM";
const WARNING_LINES = [
  "File ini dibuat otomatis dari hasil export ECOUNT. Cocokkan dulu nomor invoice, tanggal, jumlah lembar, dan nominalnya",
  "dengan faktur asli. Jangan dipakai mentah-mentah tanpa diperiksa.",
  "Catatan ini berada di luar area cetak, jadi tidak ikut tercetak maupun ter-PDF.",
];
/** Merah logo BAL, dipakai untuk teks catatan supaya menonjol. */
const WARNING_ARGB = "FFBA131A";
/** Jarak baris kosong antara tabel invoice dan catatan. */
const WARNING_GAP = 2;

interface TemplateSpec {
  /** nama file di dalam `lib/template/` */
  file: string;
  /**
   * Baris pertama tabel rincian invoice (tepat di bawah baris header tabel).
   * Semua baris mulai dari sini di template dibuang sebelum diisi data.
   */
  firstDataRow: number;
  /** sel sisa template (mis. rumus #REF!) yang dikosongkan saat generate */
  clearCells?: readonly string[];
  /** sel-sel bagian kepala dokumen yang diisi generator */
  cell: {
    tanggal: string;
    kontrabonNo: string;
    customer: string;
    lembar: string;
    total: string;
    terbilang: string;
    kembaliTanggal: string;
    /** nama customer di atas garis "Tanda Terima," */
    customerTandaTerima: string;
  };
  /**
   * Style (index `cellXfs`) tiap kolom baris data, diambil dari template asli
   * supaya format angka, perataan, dan garis tabelnya identik.
   * `jumlahIdr` = kolom nilai Rupiah, `jumlahUsd` = kolom nilai Dollar.
   * Salah satu dari keduanya selalu berada di kolom yang disembunyikan.
   */
  style: {
    no: number;
    invoice: number;
    tanggal: number;
    jumlahIdr: number;
    jumlahUsd: number;
    po: number;
    keterangan: number;
    customer: number;
  };
}

/**
 * Template Luminor (JOLIE & JULIUS) berlayout sama: header tabel di baris 30,
 * data mulai 31. F8 & F29 berisi rumus lama yang sudah #REF!.
 */
function luminorSpec(file: string): TemplateSpec {
  return {
    file,
    firstDataRow: 31,
    clearCells: ["F8", "F29"],
    cell: {
      tanggal: "C2",
      kontrabonNo: "C3",
      customer: "C5",
      lembar: "E7",
      total: "E8",
      terbilang: "B11",
      kembaliTanggal: "B13",
      customerTandaTerima: "E25",
    },
    // Kolom: B No. | C INVOICE | D TANGGAL | E Jumlah (Rp) | F JUMLAH (valas,
    // disembunyikan) | G NO. PO | H Keterangan | I customer (disembunyikan)
    style: {
      no: 37,
      invoice: 38,
      tanggal: 39,
      jumlahIdr: 41,
      jumlahUsd: 37,
      po: 40,
      keterangan: 37,
      customer: 35,
    },
  };
}

const TEMPLATES: Record<TemplateId, Partial<Record<Currency, TemplateSpec>>> = {
  BAL: {
    IDR: {
      file: "kontrabon-template.xlsx",
      firstDataRow: 32,
      cell: {
        tanggal: "C2",
        kontrabonNo: "C3",
        customer: "C5",
        lembar: "E7",
        total: "E8",
        terbilang: "B11",
        kembaliTanggal: "B13",
        customerTandaTerima: "E26",
      },
      // Kolom: B No. | C INVOICE | D TANGGAL | E Jumlah (Rp) | F JUMLAH (valas,
      // disembunyikan) | G NO. PO | H Keterangan | I customer (disembunyikan)
      style: {
        no: 40,
        invoice: 43,
        tanggal: 46,
        jumlahIdr: 45,
        jumlahUsd: 44,
        po: 43,
        keterangan: 43,
        customer: 43,
      },
    },
    USD: {
      file: "kontrabon-template-usd.xlsx",
      firstDataRow: 32,
      cell: {
        tanggal: "C2",
        kontrabonNo: "C3",
        customer: "C5",
        lembar: "F7",
        total: "F8",
        terbilang: "B11",
        kembaliTanggal: "B13",
        customerTandaTerima: "F25",
      },
      // Kolom: B No. | C INVOICE | D TANGGAL | E nilai Rupiah (disembunyikan) |
      // F JUMLAH ($) | G NO. PO | H Keterangan | I customer (disembunyikan)
      style: {
        no: 35,
        invoice: 31,
        tanggal: 36,
        jumlahIdr: 32,
        jumlahUsd: 34,
        po: 31,
        keterangan: 31,
        customer: 31,
      },
    },
  },
  JOLIE: { IDR: luminorSpec("kontrabon-template-jolie.xlsx") },
  JULIUS: { IDR: luminorSpec("kontrabon-template-julius.xlsx") },
};

/** Spec untuk kombinasi template + mata uang; error kalau tidak tersedia. */
export function resolveTemplate(
  template: TemplateId,
  currency: Currency
): TemplateSpec {
  const spec = TEMPLATES[template]?.[currency];
  if (!spec) {
    throw new TemplateUnavailableError(template, currency);
  }
  return spec;
}

export class TemplateUnavailableError extends Error {
  constructor(template: string, currency: Currency) {
    super(
      `Template ${template} tidak tersedia untuk mata uang ` +
        `${currency === "USD" ? "Dollar (USD)" : "Rupiah"}.`
    );
    this.name = "TemplateUnavailableError";
  }
}

export interface KontrabonRowInput {
  invoiceNo: string;
  /** Ditampilkan apa adanya, format dd/mm/yyyy */
  dateStr: string;
  /** epoch ms, untuk sorting kronologis; boleh NaN */
  dateValue: number;
  /** nilai Rupiah, dari kolom "Total Amount" ECOUNT */
  amount: number;
  /** nilai valas, dari kolom "Total Foreign Currency Amount" ECOUNT */
  foreignAmount?: number | null;
  poCustomer: string;
  /** dipetakan dari kolom "Flight Number" ECOUNT -> kolom "Keterangan" */
  flightNumber: string;
  customer: string;
}

export interface KontrabonInput {
  kontrabonNo: string;
  /** tanggal dokumen kontrabon ("Jakarta, ...") */
  tanggal: Date;
  kembaliTanggal?: string;
  customer: string;
  /** IDR (default) atau USD; menentukan template & kolom nilai yang dipakai */
  currency?: Currency;
  /** BAL (default), JOLIE, atau JULIUS */
  template?: TemplateId;
  rows: KontrabonRowInput[];
  /** true = `rows` sudah diurutkan manual oleh user, jangan diurut ulang */
  keepOrder?: boolean;
}

export interface KontrabonResult {
  buffer: Buffer;
  /** nama file mengikuti kebiasaan lama: "26.0911 BAL-2609027 PT SANSAN ...xlsx" */
  filename: string;
}

/** Nilai yang dipakai sebagai "Jumlah" di kontrabon, sesuai mata uangnya. */
export function rowAmount(row: KontrabonRowInput, currency: Currency): number {
  if (currency === "USD") return row.foreignAmount ?? 0;
  return row.amount || 0;
}

function templatePath(spec: TemplateSpec): string {
  return path.join(process.cwd(), "lib", "template", spec.file);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Serial tanggal Excel (hari sejak 1899-12-30). */
function excelSerial(date: Date): number {
  const midnight = Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
  return Math.round((midnight - Date.UTC(1899, 11, 30)) / 86400000);
}

/** Cari sel `ref` di XML sheet dan kembalikan posisi + style-nya. */
function findCell(sheetXml: string, ref: string) {
  const re = new RegExp(`<c r="${ref}"((?:(?!/>|>).)*)(?:/>|>[\\s\\S]*?</c>)`);
  const match = re.exec(sheetXml);
  if (!match) {
    throw new Error(`Template rusak: sel ${ref} tidak ada di sheet.`);
  }
  const styleMatch = /\ss="\d+"/.exec(match[1]);
  return {
    start: match.index,
    end: match.index + match[0].length,
    style: styleMatch ? styleMatch[0] : "",
  };
}

/** Tulis nilai ke sel template; style bawaan template dipertahankan. */
function setCell(
  sheetXml: string,
  ref: string,
  value: string | number | null
): string {
  const { start, end, style } = findCell(sheetXml, ref);
  let cell: string;
  if (value === null || value === "") {
    cell = `<c r="${ref}"${style}/>`;
  } else if (typeof value === "number") {
    cell = `<c r="${ref}"${style}><v>${value}</v></c>`;
  } else {
    cell =
      `<c r="${ref}"${style} t="inlineStr">` +
      `<is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
  }
  return sheetXml.slice(0, start) + cell + sheetXml.slice(end);
}

function textCell(ref: string, style: number, value: string): string {
  if (!value) return `<c r="${ref}" s="${style}"/>`;
  return (
    `<c r="${ref}" s="${style}" t="inlineStr">` +
    `<is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`
  );
}

function numberCell(
  ref: string,
  style: number,
  value: number | null
): string {
  if (value === null) return `<c r="${ref}" s="${style}"/>`;
  return `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
}

/**
 * Kolom F (valas). Di kontrabon USD, invoice tanpa nilai USD yang sengaja
 * dicentang user ditulis 0 supaya barisnya tidak tampak datanya hilang.
 */
function usdCellValue(row: KontrabonRowInput, currency: Currency): number | null {
  if (currency === "USD") return row.foreignAmount ?? 0;
  return row.foreignAmount ?? null;
}

function buildDataRows(
  rows: KontrabonRowInput[],
  customer: string,
  spec: TemplateSpec,
  currency: Currency
): string {
  return rows
    .map((row, i) => {
      const r = spec.firstDataRow + i;
      return (
        `<row r="${r}" spans="2:9">` +
        numberCell(`B${r}`, spec.style.no, i + 1) +
        textCell(`C${r}`, spec.style.invoice, row.invoiceNo) +
        textCell(`D${r}`, spec.style.tanggal, row.dateStr) +
        numberCell(`E${r}`, spec.style.jumlahIdr, row.amount || 0) +
        numberCell(`F${r}`, spec.style.jumlahUsd, usdCellValue(row, currency)) +
        textCell(`G${r}`, spec.style.po, row.poCustomer) +
        textCell(`H${r}`, spec.style.keterangan, row.flightNumber) +
        textCell(`I${r}`, spec.style.customer, row.customer || customer) +
        `</row>`
      );
    })
    .join("");
}

/**
 * Tambahkan 2 font merah + 2 style ke styles.xml template, lalu kembalikan
 * index style-nya untuk dipakai baris catatan pengingat.
 */
function appendWarningStyles(stylesXml: string) {
  const fonts = /<fonts count="(\d+)"([^>]*)>/.exec(stylesXml);
  const cellXfs = /<cellXfs count="(\d+)">/.exec(stylesXml);
  if (!fonts || !cellXfs) {
    throw new Error("Template rusak: styles.xml tidak punya fonts/cellXfs.");
  }

  const firstFontId = parseInt(fonts[1], 10);
  const firstXfId = parseInt(cellXfs[1], 10);

  const xml = stylesXml
    .replace(fonts[0], `<fonts count="${firstFontId + 2}"${fonts[2]}>`)
    .replace(
      "</fonts>",
      `<font><b/><sz val="10"/><color rgb="${WARNING_ARGB}"/><name val="Calibri"/><family val="2"/></font>` +
        `<font><sz val="9"/><color rgb="${WARNING_ARGB}"/><name val="Calibri"/><family val="2"/></font>` +
        "</fonts>"
    )
    .replace(cellXfs[0], `<cellXfs count="${firstXfId + 2}">`)
    .replace(
      "</cellXfs>",
      `<xf numFmtId="0" fontId="${firstFontId}" fillId="0" borderId="0" xfId="0" applyFont="1"/>` +
        `<xf numFmtId="0" fontId="${firstFontId + 1}" fillId="0" borderId="0" xfId="0" applyFont="1"/>` +
        "</cellXfs>"
    );

  return { xml, headingStyle: firstXfId, bodyStyle: firstXfId + 1 };
}

/** Baris catatan pengingat, ditaruh di bawah area cetak. */
function buildWarningRows(
  firstRow: number,
  headingStyle: number,
  bodyStyle: number
): string {
  const lines = [
    { text: WARNING_HEADING, style: headingStyle },
    ...WARNING_LINES.map((text) => ({ text, style: bodyStyle })),
  ];
  return lines
    .map(({ text, style }, i) => {
      const r = firstRow + i;
      return `<row r="${r}" spans="2:9">${textCell(`B${r}`, style, text)}</row>`;
    })
    .join("");
}

/**
 * Buang sisa isi template: semua baris mulai `firstDataRow` (baris contoh /
 * data lama) dan sel di `clearCells`. Sel kepala dokumen yang masih berupa
 * rumus tidak perlu diurus di sini karena ditimpa `setCell`.
 */
function cleanTemplateSheet(sheetXml: string, spec: TemplateSpec): string {
  let xml = sheetXml.replace(
    /<row r="(\d+)"[^>]*?(?:\/>|>[\s\S]*?<\/row>)/g,
    (row, r: string) => (Number(r) >= spec.firstDataRow ? "" : row)
  );
  for (const ref of spec.clearCells ?? []) {
    xml = setCell(xml, ref, null);
  }
  return xml;
}

/**
 * calcChain mencatat sel mana saja yang berumus. Karena rumus template
 * ditimpa nilai biasa, daftar itu jadi basi dan Excel akan minta "repair"
 * saat file dibuka -- jadi dibuang saja; Excel membuatnya ulang sendiri.
 */
async function removeCalcChain(zip: JSZip): Promise<void> {
  if (!zip.file(CALC_CHAIN_XML)) return;
  zip.remove(CALC_CHAIN_XML);

  const types = zip.file(CONTENT_TYPES_XML);
  if (types) {
    const xml = (await types.async("string")).replace(
      /<Override PartName="\/xl\/calcChain\.xml"[^>]*\/>/,
      ""
    );
    zip.file(CONTENT_TYPES_XML, xml);
  }

  const rels = zip.file(WORKBOOK_RELS_XML);
  if (rels) {
    const xml = (await rels.async("string")).replace(
      /<Relationship [^>]*Target="calcChain\.xml"[^>]*\/>/,
      ""
    );
    zip.file(WORKBOOK_RELS_XML, xml);
  }
}

/** Nama sheet Excel: maksimal 31 karakter, tanpa karakter terlarang. */
function sanitizeSheetName(name: string): string {
  const cleaned = name
    .replace(/[\\/*?:[\]']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, 31).trim() || "KONTRABON";
}

/** Judul dokumen ala arsip lama: "26.0911 BAL-2609027 PT SANSAN SAUDARATEX JAYA". */
function documentTitle(input: KontrabonInput): string {
  const yy = String(input.tanggal.getFullYear()).slice(-2);
  const mm = String(input.tanggal.getMonth() + 1).padStart(2, "0");
  const dd = String(input.tanggal.getDate()).padStart(2, "0");
  return `${yy}.${mm}${dd} ${input.kontrabonNo} ${input.customer}`.trim();
}

export async function buildKontrabonFile(
  input: KontrabonInput
): Promise<KontrabonResult> {
  const currency: Currency = input.currency === "USD" ? "USD" : "IDR";
  const spec = resolveTemplate(input.template ?? DEFAULT_TEMPLATE, currency);

  const template = await fs.readFile(templatePath(spec));
  const zip = await JSZip.loadAsync(template);

  const sheetFile = zip.file(SHEET_XML);
  const workbookFile = zip.file(WORKBOOK_XML);
  const stylesFile = zip.file(STYLES_XML);
  if (!sheetFile || !workbookFile || !stylesFile) {
    throw new Error("Template kontrabon tidak lengkap (sheet/workbook/styles).");
  }

  // otomatis: kronologis, invoice ber-No. PO sama dikumpulkan jadi satu blok
  const rows = input.keepOrder ? [...input.rows] : orderRows(input.rows);
  const total = rows.reduce((sum, r) => sum + rowAmount(r, currency), 0);
  const lastRow = spec.firstDataRow + rows.length - 1;

  // ---- isi bagian kepala dokumen ----
  let sheetXml = cleanTemplateSheet(await sheetFile.async("string"), spec);
  await removeCalcChain(zip);
  sheetXml = setCell(sheetXml, spec.cell.tanggal, excelSerial(input.tanggal));
  sheetXml = setCell(sheetXml, spec.cell.kontrabonNo, input.kontrabonNo);
  sheetXml = setCell(sheetXml, spec.cell.customer, input.customer);
  sheetXml = setCell(sheetXml, spec.cell.lembar, rows.length);
  sheetXml = setCell(sheetXml, spec.cell.total, total);
  sheetXml = setCell(
    sheetXml,
    spec.cell.terbilang,
    terbilangUang(total, currency)
  );
  sheetXml = setCell(
    sheetXml,
    spec.cell.customerTandaTerima,
    input.customer
  );
  if (input.kembaliTanggal) {
    sheetXml = setCell(
      sheetXml,
      spec.cell.kembaliTanggal,
      `Kembali Tanggal : ${input.kembaliTanggal}`
    );
  }

  // ---- sisipkan tabel rincian invoice + catatan pengingat ----
  const styles = appendWarningStyles(await stylesFile.async("string"));
  zip.file(STYLES_XML, styles.xml);

  const warningRow = lastRow + WARNING_GAP;
  const lastUsedRow = warningRow + WARNING_LINES.length;

  sheetXml = sheetXml.replace(
    "</sheetData>",
    buildDataRows(rows, input.customer, spec, currency) +
      buildWarningRows(warningRow, styles.headingStyle, styles.bodyStyle) +
      "</sheetData>"
  );
  sheetXml = sheetXml.replace(
    /<dimension ref="[^"]*"\/>/,
    `<dimension ref="A1:J${lastUsedRow}"/>`
  );
  zip.file(SHEET_XML, sheetXml);

  // ---- samakan nama sheet & area cetak dengan isi dokumen ----
  const title = documentTitle(input);
  const sheetName = sanitizeSheetName(title);
  let workbookXml = await workbookFile.async("string");
  const currentName = /<sheet name="([^"]*)"/.exec(workbookXml)?.[1];
  if (currentName) {
    workbookXml = workbookXml.split(currentName).join(escapeXml(sheetName));
  }
  // Area cetak berhenti di baris data terakhir -- catatan pengingat di
  // bawahnya sengaja TIDAK ikut tercetak / ter-PDF ke customer. Kolomnya
  // mengikuti template (BAL: A..J, Luminor: B..H).
  workbookXml = workbookXml.replace(
    /(<definedName name="_xlnm\.Print_Area"[^>]*>[^<]*!\$[A-Z]+\$1:\$[A-Z]+\$)\d+/,
    `$1${lastRow}`
  );
  zip.file(WORKBOOK_XML, workbookXml);

  const appFile = zip.file(APP_XML);
  if (appFile && currentName) {
    const appXml = (await appFile.async("string"))
      .split(currentName)
      .join(escapeXml(sheetName));
    zip.file(APP_XML, appXml);
  }

  const buffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
  });

  return { buffer, filename: `${title}.xlsx` };
}
