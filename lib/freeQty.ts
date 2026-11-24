/**
 * Free qty diambil dari kolom "Remarks/Ikatan" laporan ECOUNT "Sales Status
 * Details", misalnya:
 *
 *   300-1 F200 (28X500+1X21)                  -> 200
 *   300-15 F25 (1X300) L2F125 (2X500+1X420)   -> 25   (pakai F yang pertama)
 *   400-1 L1F176 L2F176(1X500+1X324)          -> 176  (layer 1 saja)
 *
 * Aturannya sama dengan rumus Excel yang selama ini dipakai di kolom
 * "Quantity Free":
 * - pakai penanda F<angka> yang PERTAMA;
 * - L1F<angka> (free layer 1) ikut dihitung, L2F/L3F/... tidak;
 * - F harus berdiri di awal kata (atau tepat setelah L<n>), jadi huruf F di
 *   tengah kata ("OFF5") dan "FR20" tidak dianggap free;
 * - tidak ada penanda free, atau nilainya 0 -> null.
 */

/**
 * group 1: nomor layer (opsional), group 2: angka free.
 * Angka boleh memakai pemisah ribuan koma ("F1,200").
 */
const FREE_TOKEN = /(?:^|[^A-Z])(?:L(\d+))?F(\d{1,3}(?:,\d{3})+|\d+)/gi;

export function freeQtyFromRemark(remark: unknown): number | null {
  const text = typeof remark === "string" ? remark : String(remark ?? "");

  for (const match of text.matchAll(FREE_TOKEN)) {
    const layer = match[1];
    if (layer !== undefined && layer !== "1") continue;

    const qty = Number(match[2].replace(/,/g, ""));
    return qty > 0 ? qty : null;
  }
  return null;
}
