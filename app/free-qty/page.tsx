"use client";

import { useEffect, useState } from "react";
import {
  parseSalesStatusWorkbook,
  SalesStatusParseResult,
  SalesStatusRow,
} from "@/lib/parseSalesStatus";
import {
  GROSS_WEIGHT,
  KOLI,
  LOCATION_OUT,
  PIC_LIST,
  PO_CUSTOMER_PLACEHOLDER,
  ROWS_PER_SLIP,
  USAGE_TYPE,
  freeQtyRemark,
  isValidIsoDate,
  slipSeqNo,
} from "@/lib/internalUse";
import Intro from "../Intro";
import TopNav from "../TopNav";
import FileDrop from "../FileDrop";
import { readApiError, saveResponseAsFile } from "../downloadFile";
import FreeQtyTable, { formatQty } from "./FreeQtyTable";

function todayInputValue(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function hasFree(row: SalesStatusRow): boolean {
  return row.freeQty !== null;
}

/** Syarat yang belum terpenuhi untuk generate; kosong berarti sudah siap. */
function findBlocker(
  totalRows: number,
  selectedCount: number,
  tanggal: string,
  picCode: string
): string {
  if (totalRows === 0) return "Belum ada file Sales Status Details yang dibaca.";
  if (selectedCount === 0) return "Belum ada baris free yang dicentang.";
  if (!isValidIsoDate(tanggal)) return "Tanggal input belum diisi.";
  if (!picCode) return "PIC belum dipilih.";
  return "";
}

export default function FreeQtyPage() {
  const [fileName, setFileName] = useState("");
  const [parseResult, setParseResult] = useState<SalesStatusParseResult | null>(null);
  const [parseError, setParseError] = useState("");
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());

  // Halaman ini di-prerender saat build, jadi tanggal hari ini baru diisi di
  // browser; kalau dihitung saat render, HTML-nya membawa tanggal build.
  const [tanggal, setTanggal] = useState("");
  const [picCode, setPicCode] = useState("");

  useEffect(() => {
    setTanggal((current) => current || todayInputValue());
  }, []);

  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const rows = parseResult?.rows ?? [];
  const freeRows = rows.filter(hasFree);
  const noFreeCount = rows.length - freeRows.length;

  /** Baris yang ikut ke file, dalam urutan file ECOUNT. */
  const selectedRows = freeRows.filter((r) => selectedIds.has(r.id));
  const exportIndex = new Map(selectedRows.map((r, i) => [r.id, i] as const));
  const totalFree = selectedRows.reduce((sum, r) => sum + (r.freeQty ?? 0), 0);
  const slipCount = selectedRows.length ? slipSeqNo(selectedRows.length - 1) : 0;
  const isAllSelected = freeRows.length > 0 && selectedRows.length === freeRows.length;

  const blocker = findBlocker(rows.length, selectedRows.length, tanggal, picCode);
  const remarkPreview = isValidIsoDate(tanggal) ? freeQtyRemark(tanggal) : "-";

  function selectRows(next: readonly SalesStatusRow[]) {
    setSelectedIds(new Set(next.map((r) => r.id)));
  }

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleFile(file: File) {
    setErrorMsg("");
    setSuccessMsg("");
    setParseError("");
    setFileName(file.name);
    try {
      const result = parseSalesStatusWorkbook(await file.arrayBuffer());
      setParseResult(result);
      selectRows(result.rows.filter(hasFree));
      if (result.rows.length === 0) {
        setParseError(result.warnings[0] || "Tidak ada baris item yang terbaca.");
      }
    } catch (e) {
      console.error(e);
      setParseResult(null);
      selectRows([]);
      setParseError(
        'Gagal membaca file. Pastikan ini file .xlsx export "Sales Status Details" dari ECOUNT.'
      );
    }
  }

  async function handleGenerate() {
    setErrorMsg("");
    setSuccessMsg("");
    if (blocker) {
      setErrorMsg(blocker);
      return;
    }

    setIsGenerating(true);
    try {
      const res = await fetch("/api/internal-use", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tanggal,
          picCode,
          rows: selectedRows.map((r) => ({ itemCode: r.itemCode, qty: r.freeQty })),
        }),
      });
      if (!res.ok) throw new Error(await readApiError(res));

      const filename = await saveResponseAsFile(res, "Internal Use Free Qty.xlsx");
      setSuccessMsg(`"${filename}" dibuat. Periksa dulu sebelum di-upload ke ECOUNT.`);
    } catch (e) {
      console.error(e);
      setErrorMsg(e instanceof Error ? e.message : "Terjadi kesalahan.");
    } finally {
      setIsGenerating(false);
    }
  }

  const sidebarMessage = parseError || parseResult?.warnings.join(" ") || "";

  return (
    <>
      <Intro />
      <div className="app">
        <header className="topbar">
          <span className="brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-bal.png" alt="PT Berlian Artha Label" />
            Kontrabon Generator
          </span>
          <TopNav active="free-qty" />
          <span className="company">PT Berlian Artha Label</span>
        </header>

        <div className="workspace">
          <aside className="sidebar">
            <section>
              <FileDrop
                title="Sales Status Details"
                fileName={fileName}
                onFile={handleFile}
              />
              {sidebarMessage && <p className="helper">{sidebarMessage}</p>}
            </section>

            <section>
              <div className="block-head">
                <h2 className="block-title">Detail Internal Use</h2>
              </div>
              <div className="form">
                <div>
                  <label className="field-label" htmlFor="f-tgl">
                    Tanggal Input
                  </label>
                  <input
                    id="f-tgl"
                    type="date"
                    value={tanggal}
                    onChange={(e) => setTanggal(e.target.value)}
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="f-pic">
                    PIC
                  </label>
                  <select
                    id="f-pic"
                    value={picCode}
                    onChange={(e) => setPicCode(e.target.value)}
                    className={picCode ? "" : "unset"}
                  >
                    <option value="">Pilih yang input...</option>
                    {PIC_LIST.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.name} ({p.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            <section>
              <div className="block-head">
                <h2 className="block-title">Nilai Tetap di File</h2>
              </div>
              <dl className="kv">
                <dt>Location-Out</dt>
                <dd className="mono">{LOCATION_OUT}</dd>
                <dt>Usage Type</dt>
                <dd className="mono">{USAGE_TYPE}</dd>
                <dt>Gross weight / Koli</dt>
                <dd className="mono">
                  {GROSS_WEIGHT} / {KOLI}
                </dd>
                <dt>No. PO Customer</dt>
                <dd className="mono">{PO_CUSTOMER_PLACEHOLDER}</dd>
                <dt>Seq. No.</dt>
                <dd className="mono">1 per {formatQty(ROWS_PER_SLIP)} baris</dd>
                <dt>Remark</dt>
                <dd className="mono">{remarkPreview}</dd>
              </dl>
            </section>

            <div className={`callout${blocker ? "" : " ready"}`}>
              <div className="callout-head">
                <span className="label">Ringkasan</span>
                <span className="status">{blocker ? "Belum lengkap" : "Siap"}</span>
              </div>
              <p>
                {blocker ||
                  `${selectedRows.length} baris · ${slipCount} slip · total free ${formatQty(totalFree)}`}
              </p>
            </div>
          </aside>

          <main className="content">
            {noFreeCount > 0 && (
              <p className="notice">
                <b>{noFreeCount} baris</b> tidak punya penanda free (F / L1F) di
                Remarks/Ikatan, jadi tidak bisa dicentang. Free layer 2 (L2F) memang
                tidak dihitung.
              </p>
            )}

            <div className="content-head">
              <h1>
                Free Qty
                <span className="tag mono">[ECOUNT : INTERNAL USE]</span>
              </h1>
              <div className="head-actions">
                <button
                  className="linkbtn strong"
                  onClick={() => selectRows(freeRows)}
                  disabled={freeRows.length === 0 || isAllSelected}
                >
                  Pilih semua
                </button>
                <button
                  className="linkbtn"
                  onClick={() => selectRows([])}
                  disabled={selectedRows.length === 0}
                >
                  Batalkan semua
                </button>
              </div>
            </div>

            {rows.length > 0 ? (
              <FreeQtyTable
                rows={rows}
                selectedIds={selectedIds}
                exportIndex={exportIndex}
                isAllSelected={isAllSelected}
                onToggle={toggleRow}
                onToggleAll={() => selectRows(isAllSelected ? [] : freeRows)}
              />
            ) : (
              <div className="placeholder">
                Upload file export &quot;Sales Status Details&quot; dari ECOUNT untuk
                melihat free qty.
              </div>
            )}
          </main>
        </div>

        <footer className="actionbar">
          <div className="stats">
            <div>
              <span className="k">Terpilih</span>
              <span className="v mono">
                {selectedRows.length} / {freeRows.length} baris
              </span>
            </div>
            <div>
              <span className="k">Slip</span>
              <span className="v mono">{slipCount}</span>
            </div>
            <div>
              <span className="k">Total free qty</span>
              <span className="v total mono">{formatQty(totalFree)}</span>
            </div>
          </div>

          <div className="bar-right">
            {errorMsg && <span className="inline-msg error">{errorMsg}</span>}
            {!errorMsg && successMsg && (
              <span className="inline-msg ok">{successMsg}</span>
            )}
            {!errorMsg && !successMsg && (
              <span className="inline-msg">
                Free diambil dari F pertama di Remarks/Ikatan (L1F ikut, L2F tidak).
              </span>
            )}
            <button
              className="btn-primary"
              onClick={handleGenerate}
              disabled={isGenerating || !!blocker}
            >
              {isGenerating ? "Membuat file..." : "Generate & Download Internal Use"}
            </button>
          </div>
        </footer>
      </div>
    </>
  );
}
