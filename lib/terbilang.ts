/**
 * Konversi angka uang (termasuk desimal) ke terbilang Bahasa Indonesia,
 * untuk Rupiah maupun USD.
 *
 * Gaya penulisan (huruf besar di awal kata, tanda "-" antara puluhan dan
 * satuan, misal "Empat Puluh-Empat") sengaja dipertahankan supaya konsisten
 * dengan gaya template kontrabon PT Berlian Artha Label yang sudah dipakai
 * selama ini (formula Excel lama).
 *
 * Beberapa bug kecil pada formula Excel lama SUDAH DIPERBAIKI di sini:
 *  - typo "sebeleas" -> "sebelas"
 *  - kata "Sen" yang sebelumnya hilang di akhir kalimat saat ada nilai desimal
 *  - "seribu" (bukan "satu ribu") untuk kelompok ribuan bernilai tepat 1,
 *    sesuai kaidah baku Bahasa Indonesia
 */

const SATUAN = [
  "", "satu", "dua", "tiga", "empat", "lima",
  "enam", "tujuh", "delapan", "sembilan",
];

const BELASAN = [
  "sepuluh", "sebelas", "dua belas", "tiga belas", "empat belas",
  "lima belas", "enam belas", "tujuh belas", "delapan belas", "sembilan belas",
];

const PULUHAN = [
  "", "", "dua puluh", "tiga puluh", "empat puluh", "lima puluh",
  "enam puluh", "tujuh puluh", "delapan puluh", "sembilan puluh",
];

const SKALA = ["", " ribu", " juta", " milyar", " triliun"];

function twoDigitWords(tens: number, ones: number): string {
  if (tens === 0) return SATUAN[ones];
  if (tens === 1) return BELASAN[ones];
  return PULUHAN[tens] + (ones > 0 ? "-" + SATUAN[ones] : "");
}

/** Kelompok 3 digit (0-999) -> kata, TANPA skala (ribu/juta/dst). */
function threeDigitWords(n: number): string {
  if (n === 0) return "";
  const h = Math.floor(n / 100);
  const rem = n % 100;
  const t = Math.floor(rem / 10);
  const o = rem % 10;

  let s = "";
  if (h === 1) s += "seratus";
  else if (h > 1) s += SATUAN[h] + " ratus";

  const to = twoDigitWords(t, o);
  if (to) s += (s ? " " : "") + to;

  return s;
}

/** Bilangan bulat non-negatif (0 s.d. < 10^15) -> kata, tanpa "Rupiah". */
function integerToWords(value: number): string {
  const n = Math.floor(value);
  if (n === 0) return "nol";

  // Pecah menjadi kelompok 3 digit dari kanan (satuan, ribuan, jutaan, ...).
  const groups: number[] = [];
  let rest = n;
  while (rest > 0) {
    groups.push(rest % 1000);
    rest = Math.floor(rest / 1000);
  }

  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    if (g === 0) continue;

    if (i === 1 && g === 1) {
      // Kasus khusus: 1.000 -> "seribu", bukan "satu ribu".
      parts.push("seribu");
      continue;
    }

    parts.push(threeDigitWords(g) + SKALA[i]);
  }

  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/** Meniru PROPER() Excel: kapital di awal setiap kata (spasi & "-" jadi batas kata). */
function properCase(s: string): string {
  return s.replace(/(^|[\s-])([a-z])/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}

export type Currency = "IDR" | "USD";

/** Nama satuan mata uang, mengikuti tulisan di template kontrabon lama. */
const CURRENCY_WORDS: Record<
  Currency,
  { unit: string; fraction: string; fractionSingular: string }
> = {
  IDR: { unit: "Rupiah", fraction: "Sen", fractionSingular: "Sen" },
  // Template USD menulis "U.S Dollar" (tanpa titik setelah S) dan "Cents",
  // kecuali tepat 1 sen yang ditulis "Satu Cent".
  USD: { unit: "U.S Dollar", fraction: "Cents", fractionSingular: "Cent" },
};

/**
 * Konversi nominal uang (boleh mengandung desimal) ke terbilang.
 *
 * IDR: 44587552.26 -> "Empat Puluh-Empat Juta Lima Ratus Delapan Puluh-Tujuh
 *      Ribu Lima Ratus Lima Puluh-Dua Rupiah dan Dua Puluh-Enam Sen"
 * USD: 3958.04 -> "Tiga Ribu Sembilan Ratus Lima Puluh-Delapan U.S Dollar
 *      dan Empat Cents"
 */
export function terbilangUang(
  amount: number,
  currency: Currency = "IDR"
): string {
  const words = CURRENCY_WORDS[currency];
  const safe = Math.max(0, amount || 0);
  const whole = Math.floor(safe);
  // Bulatkan pecahan ke 2 desimal untuk hindari floating point drift.
  const fraction = Math.round((safe - whole) * 100);

  const wholeWords = `${properCase(integerToWords(whole))} ${words.unit}`;
  if (fraction <= 0) return wholeWords;

  const unit = fraction === 1 ? words.fractionSingular : words.fraction;
  const fractionWords = `${properCase(integerToWords(fraction))} ${unit}`;
  return `${wholeWords} dan ${fractionWords}`;
}
