import { useEffect, useState } from "react";
import { isValidIsoDate } from "@/lib/internalUse";

function todayInputValue(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Isian Tanggal Input + PIC yang sama di menu Free Qty dan Reject. */
export function useInternalUseForm() {
  // Halaman di-prerender saat build, jadi tanggal hari ini baru diisi di
  // browser; kalau dihitung saat render, HTML-nya membawa tanggal build.
  const [tanggal, setTanggal] = useState("");
  const [picCode, setPicCode] = useState("");

  useEffect(() => {
    setTanggal((current) => current || todayInputValue());
  }, []);

  /** Syarat isian yang belum terpenuhi; kosong berarti sudah lengkap. */
  const formBlocker = !isValidIsoDate(tanggal)
    ? "Tanggal input belum diisi."
    : !picCode
    ? "PIC belum dipilih."
    : "";

  return { tanggal, setTanggal, picCode, setPicCode, formBlocker };
}
