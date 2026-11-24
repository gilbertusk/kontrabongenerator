import { slipSeqNo } from "@/lib/internalUse";

/**
 * Kelas CSS untuk baris pertama tiap slip baru (Seq. No. 2, 3, ...), supaya
 * batas 1000 baris terlihat di tabel. `index` = urutan baris di file.
 */
export function slipStartClass(index: number | undefined): string {
  return index !== undefined && index > 0 && slipSeqNo(index) !== slipSeqNo(index - 1)
    ? "slip-start"
    : "";
}
