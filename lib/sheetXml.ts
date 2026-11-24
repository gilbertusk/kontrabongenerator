/**
 * Pembantu menulis XML sheet .xlsx secara langsung (tanpa library spreadsheet),
 * dipakai bersama oleh pembuat kontrabon dan pembuat file Internal Use.
 */

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function unescapeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Sel teks inline (tanpa sharedStrings). */
export function textCell(ref: string, style: number, value: string): string {
  if (!value) return `<c r="${ref}" s="${style}"/>`;
  return (
    `<c r="${ref}" s="${style}" t="inlineStr">` +
    `<is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`
  );
}

export function numberCell(
  ref: string,
  style: number,
  value: number | null
): string {
  if (value === null) return `<c r="${ref}" s="${style}"/>`;
  return `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
}

/** Sel teks yang menunjuk ke entri sharedStrings nomor `index`. */
export function sharedStringCell(ref: string, style: number, index: number): string {
  return `<c r="${ref}" s="${style}" t="s"><v>${index}</v></c>`;
}

/** Isi teks tiap entri <si> di sharedStrings.xml, sesuai urutan index-nya. */
export function readSharedStrings(xml: string): string[] {
  const items = xml.match(/<si>[\s\S]*?<\/si>/g) ?? [];
  return items.map((si) =>
    unescapeXml(
      (si.match(/<t(?:\s[^>]*)?>[\s\S]*?<\/t>/g) ?? [])
        .map((t) => t.replace(/^<t[^>]*>/, "").replace(/<\/t>$/, ""))
        .join("")
    )
  );
}

/**
 * Tabel sharedStrings yang bisa ditambah: teks yang sama dipakai ulang
 * (index-nya sama), teks baru ditambahkan di belakang entri template.
 */
export class SharedStringTable {
  private readonly indexOf = new Map<string, number>();
  private readonly added: string[] = [];
  private references = 0;

  constructor(private readonly existing: readonly string[]) {
    existing.forEach((text, i) => {
      if (!this.indexOf.has(text)) this.indexOf.set(text, i);
    });
  }

  /** Index entri untuk `text`, ditambahkan kalau belum ada. */
  ref(text: string): number {
    this.references++;
    const found = this.indexOf.get(text);
    if (found !== undefined) return found;
    const index = this.existing.length + this.added.length;
    this.added.push(text);
    this.indexOf.set(text, index);
    return index;
  }

  /** sharedStrings.xml template + entri baru, dengan count yang diperbarui. */
  apply(xml: string): string {
    const sst = /<sst\b[^>]*>/.exec(xml);
    if (!sst) throw new Error("Template rusak: sharedStrings.xml tidak punya <sst>.");

    const oldCount = Number(/\bcount="(\d+)"/.exec(sst[0])?.[1] ?? this.existing.length);
    const uniqueCount = this.existing.length + this.added.length;
    const openTag = sst[0]
      .replace(/\s(?:count|uniqueCount)="\d+"/g, "")
      .replace(/>$/, ` count="${oldCount + this.references}" uniqueCount="${uniqueCount}">`);

    const newItems = this.added
      .map((t) => `<si><t xml:space="preserve">${escapeXml(t)}</t></si>`)
      .join("");
    // replacer berupa fungsi: teks data yang berisi "$&", "$`", "$$" dsb.
    // tidak boleh ditafsirkan sebagai pola pengganti oleh String.replace
    return xml
      .replace(sst[0], () => openTag)
      .replace("</sst>", () => `${newItems}</sst>`);
  }
}
