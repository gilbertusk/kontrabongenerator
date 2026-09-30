import type { Currency } from "./terbilang";

/**
 * Daftar template kontrabon yang bisa dipilih user. File ini sengaja tidak
 * mengimpor `fs` supaya bisa dipakai di halaman web (pilihan template) dan di
 * server (pembuat file Excel). Detail sel & style tiap file ada di
 * `buildKontrabon.ts`.
 */
export type TemplateId = "BAL" | "JOLIE" | "JULIUS";

export interface TemplateInfo {
  id: TemplateId;
  label: string;
  /** keterangan singkat di bawah pilihan template */
  description: string;
  /** mata uang yang punya file template-nya */
  currencies: readonly Currency[];
  /** contoh No. Kontrabon untuk placeholder input */
  numberExample: string;
}

export const TEMPLATE_LIST: readonly TemplateInfo[] = [
  {
    id: "BAL",
    label: "BAL",
    description: "PT Berlian Artha Label. Tersedia Rupiah & Dollar.",
    currencies: ["IDR", "USD"],
    numberExample: "BAL-2609027",
  },
  {
    id: "JOLIE",
    label: "JOLIE",
    description: "Luminor, rekening a.n. Jolie Yang & Julius Suripto. Rupiah saja.",
    currencies: ["IDR"],
    numberExample: "LMN-2609001",
  },
  {
    id: "JULIUS",
    label: "JULIUS",
    description: "Luminor, rekening a.n. Julius Suripto atau Liris Limar. Rupiah saja.",
    currencies: ["IDR"],
    numberExample: "LMN-2609001",
  },
];

export const DEFAULT_TEMPLATE: TemplateId = "BAL";

export function findTemplate(id: string | undefined): TemplateInfo | undefined {
  return TEMPLATE_LIST.find((t) => t.id === id);
}

export function supportsCurrency(id: TemplateId, currency: Currency): boolean {
  return findTemplate(id)?.currencies.includes(currency) ?? false;
}
