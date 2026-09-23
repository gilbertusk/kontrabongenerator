"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { parseEcountWorkbook, EcountRow, ParseResult } from "@/lib/parseEcount";
import Intro from "./Intro";
import Help from "./Help";

type Currency = "IDR" | "USD";

const CURRENCY_PREFIX: Record<Currency, string> = { IDR: "Rp", USD: "$" };

const CURRENCY_HELP: Record<Currency, string> = {
  IDR: 'Nilai diambil dari kolom "Total Amount".',
  USD: 'Nilai diambil dari kolom "Total Foreign Currency Amount".',
};

function formatAmount(n: number): string {
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n || 0);
}

/** Nilai yang dipakai sebagai "Jumlah", sesuai mata uang kontrabon. */
function amountOf(row: EcountRow, currency: Currency): number | null {
  return currency === "USD" ? row.foreignAmount : row.amount || 0;
}

function todayInputValue(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** "2026-09-25" -> "25/09/2026" (format yang dipakai di dokumen kontrabon). */
function toDocumentDate(inputValue: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(inputValue);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : inputValue;
}

function FileGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M9.5 1.5H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5l-3.5-3.5Z"
        stroke="currentColor"
        strokeWidth="1"
      />
      <path d="M9.5 1.5V5H13" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

export default function Page() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string>("");
  const [dragging, setDragging] = useState(false);

  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [parseError, setParseError] = useState<string>("");

  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [currency, setCurrency] = useState<Currency>("IDR");
  const [kontrabonNo, setKontrabonNo] = useState("");
  const [tanggal, setTanggal] = useState(todayInputValue());
  const [kembaliTanggal, setKembaliTanggal] = useState("");
  const [customerNameOverride, setCustomerNameOverride] = useState("");

  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const rowsForCustomer: EcountRow[] = useMemo(() => {
    if (!parseResult) return [];
    if (!selectedCustomer) return parseResult.rows;
    return parseResult.rows.filter((r) => r.customer === selectedCustomer);
  }, [parseResult, selectedCustomer]);

  /** File ECOUNT ini punya kolom "Total Foreign Currency Amount" yang terisi? */
  const hasForeignAmount = useMemo(
    () => (parseResult?.rows ?? []).some((r) => r.foreignAmount != null),
    [parseResult]
  );

  /** Invoice tanpa nilai USD tidak bisa masuk kontrabon USD. */
  function isSelectable(row: EcountRow): boolean {
    if (currency !== "USD") return true;
    return row.foreignAmount != null && row.foreignAmount !== 0;
  }

  const selectableRows = rowsForCustomer.filter(isSelectable);

  // Saat customer / mata uang dipilih (atau file baru diparse), default-nya
  // semua invoice yang memang bisa dipakai untuk mata uang itu tercentang.
  useEffect(() => {
    setSelectedIds(new Set(selectableRows.map((r) => r.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCustomer, parseResult, currency]);

  useEffect(() => {
    if (selectedCustomer) setCustomerNameOverride(selectedCustomer);
  }, [selectedCustomer]);

  async function handleFile(file: File) {
    setErrorMsg("");
    setSuccessMsg("");
    setParseError("");
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const result = parseEcountWorkbook(buf);
      setParseResult(result);
      if (result.rows.length === 0) {
        setParseError(
          result.warnings[0] ||
            "Tidak ada data invoice yang terbaca dari file ini."
        );
      }
      const customers = result.customers;
      setSelectedCustomer(customers.length > 0 ? customers[0] : "");
    } catch (e) {
      console.error(e);
      setParseResult(null);
      setParseError(
        "Gagal membaca file. Pastikan ini adalah file .xlsx hasil export ECOUNT."
      );
    }
  }

  function onFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allSelected =
    selectableRows.length > 0 && selectedIds.size === selectableRows.length;

  const selectedRows = rowsForCustomer.filter((r) => selectedIds.has(r.id));
  const totalSelected = selectedRows.reduce(
    (s, r) => s + (amountOf(r, currency) || 0),
    0
  );
  const skippedForUsd = rowsForCustomer.length - selectableRows.length;
  const hasRows = rowsForCustomer.length > 0;

  /** Syarat yang belum terpenuhi untuk generate; kosong berarti sudah siap. */
  const blocker = !hasRows
    ? "Belum ada file ECOUNT yang dibaca."
    : selectedRows.length === 0
    ? "Belum ada invoice yang dicentang."
    : !kontrabonNo.trim()
    ? "No. Kontrabon belum diisi."
    : !customerNameOverride.trim()
    ? 'Kolom "Kepada" belum diisi.'
    : "";

  const dateRange = useMemo(() => {
    const dates = selectedRows
      .filter((r) => !isNaN(r.dateValue))
      .sort((a, b) => a.dateValue - b.dateValue);
    if (dates.length === 0) return "";
    const first = dates[0].dateStr;
    const last = dates[dates.length - 1].dateStr;
    return first === last ? first : `${first} - ${last}`;
  }, [selectedRows]);

  async function handleGenerate() {
    setErrorMsg("");
    setSuccessMsg("");
    if (blocker) {
      setErrorMsg(blocker);
      return;
    }

    setIsGenerating(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kontrabonNo: kontrabonNo.trim(),
          tanggal: new Date(`${tanggal}T00:00:00`).toISOString(),
          kembaliTanggal: kembaliTanggal
            ? toDocumentDate(kembaliTanggal)
            : undefined,
          customer: customerNameOverride.trim(),
          currency,
          rows: selectedRows.map((r) => ({
            invoiceNo: r.invoiceNo,
            dateStr: r.dateStr,
            dateValue: r.dateValue,
            amount: r.amount,
            foreignAmount: r.foreignAmount,
            poCustomer: r.poCustomer,
            flightNumber: r.flightNumber,
            customer: r.customer || customerNameOverride.trim(),
          })),
        }),
      });

      if (!res.ok) {
        const body: { error?: string } = await res
          .json()
          .catch(() => ({} as { error?: string }));
        throw new Error(body.error || `Gagal generate (status ${res.status}).`);
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="?([^"]+)"?/);
      const filename = match ? match[1] : `${kontrabonNo}.xlsx`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setSuccessMsg(
        `Kontrabon "${filename}" dibuat. Periksa dulu isinya sebelum dikirim.`
      );
    } catch (e) {
      console.error(e);
      setErrorMsg(e instanceof Error ? e.message : "Terjadi kesalahan.");
    } finally {
      setIsGenerating(false);
    }
  }

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
        <Help
          context={{
            currency,
            fileName,
            totalRows: rowsForCustomer.length,
            selectedRows: selectedRows.length,
            lastError: errorMsg || parseError,
          }}
        />
        <span className="company">PT Berlian Artha Label</span>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          <section>
            <div className="block-head">
              <h2 className="block-title">Sumber Data Excel</h2>
              {fileName && (
                <button
                  className="linkbtn accent"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Ganti
                </button>
              )}
            </div>

            <div
              className={fileName ? "filebox" : `dropzone${dragging ? " dragging" : ""}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              {fileName ? (
                <>
                  <FileGlyph />
                  <span className="name mono">{fileName}</span>
                </>
              ) : (
                <>Klik atau drag file .xlsx ke sini</>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={onFileInputChange}
              />
            </div>

            {parseError && <p className="helper">{parseError}</p>}
            {!parseError && parseResult && parseResult.warnings.length > 0 && (
              <p className="helper">{parseResult.warnings.join(" ")}</p>
            )}
          </section>

          <section>
            <div className="block-head">
              <h2 className="block-title">Mata Uang</h2>
            </div>
            <div className="segmented">
              <button
                className={currency === "IDR" ? "on" : ""}
                onClick={() => setCurrency("IDR")}
              >
                Rupiah (Rp)
              </button>
              <button
                className={currency === "USD" ? "on" : ""}
                onClick={() => setCurrency("USD")}
              >
                Dollar (USD)
              </button>
            </div>
            <p className="helper">{CURRENCY_HELP[currency]}</p>
          </section>

          <section>
            <div className="block-head">
              <h2 className="block-title">Detail Kontrabon</h2>
            </div>
            <div className="form">
              <div>
                <label className="field-label" htmlFor="f-customer">
                  Customer
                </label>
                <select
                  id="f-customer"
                  value={selectedCustomer}
                  onChange={(e) => setSelectedCustomer(e.target.value)}
                  disabled={!parseResult || parseResult.customers.length === 0}
                >
                  {parseResult?.customers.length ? (
                    parseResult.customers.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))
                  ) : (
                    <option value="">Belum ada data</option>
                  )}
                </select>
              </div>

              <div className="two-up">
                <div>
                  <label className="field-label" htmlFor="f-no">
                    No. Kontrabon
                  </label>
                  <input
                    id="f-no"
                    type="text"
                    placeholder="BAL-2609027"
                    value={kontrabonNo}
                    onChange={(e) => setKontrabonNo(e.target.value)}
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="f-tgl">
                    Tanggal
                  </label>
                  <input
                    id="f-tgl"
                    type="date"
                    value={tanggal}
                    onChange={(e) => setTanggal(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="field-label" htmlFor="f-kepada">
                  Kepada
                </label>
                <input
                  id="f-kepada"
                  type="text"
                  value={customerNameOverride}
                  onChange={(e) => setCustomerNameOverride(e.target.value)}
                />
              </div>

              <div>
                <label className="field-label" htmlFor="f-kembali">
                  Kembali Tanggal <span className="optional">(opsional)</span>
                </label>
                <input
                  id="f-kembali"
                  type="date"
                  value={kembaliTanggal}
                  onChange={(e) => setKembaliTanggal(e.target.value)}
                />
              </div>
            </div>
          </section>

          <div className={`callout${blocker ? "" : " ready"}`}>
            <div className="callout-head">
              <span className="label">Ringkasan</span>
              <span className="status">{blocker ? "Belum lengkap" : "Siap"}</span>
            </div>
            <p>
              {blocker ||
                `${selectedRows.length} invoice terpilih${
                  dateRange ? ` · ${dateRange}` : ""
                }`}
            </p>
          </div>
        </aside>

        <main className="content">
          {currency === "USD" && skippedForUsd > 0 && (
            <p className="notice">
              <b>{skippedForUsd} invoice</b> tidak punya nilai USD dan tidak
              bisa dicentang.
            </p>
          )}

          <div className="content-head">
            <h1>
              Invoice
              <span className="tag mono">[SET_CURRENCY : {currency}]</span>
            </h1>
            <div className="head-actions">
              <button
                className="linkbtn strong"
                onClick={() =>
                  setSelectedIds(new Set(selectableRows.map((r) => r.id)))
                }
                disabled={!hasRows || allSelected}
              >
                Pilih semua{skippedForUsd > 0 ? " valid" : ""}
              </button>
              <button
                className="linkbtn"
                onClick={() => setSelectedIds(new Set())}
                disabled={selectedIds.size === 0}
              >
                Batalkan semua
              </button>
            </div>
          </div>

          {hasRows ? (
            <div className="table-wrap">
              <table className="invoices">
                <thead>
                  <tr>
                    <th className="cb">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={() =>
                          setSelectedIds(
                            allSelected
                              ? new Set()
                              : new Set(selectableRows.map((r) => r.id))
                          )
                        }
                        aria-label="Pilih semua invoice"
                      />
                    </th>
                    <th>Invoice</th>
                    <th>Tanggal</th>
                    <th
                      className={`num${currency === "IDR" ? " active" : ""}`}
                    >
                      Jumlah (Rp)
                    </th>
                    {hasForeignAmount && (
                      <th
                        className={`num${currency === "USD" ? " active" : ""}`}
                      >
                        Jumlah (USD)
                      </th>
                    )}
                    <th>No. PO</th>
                    <th>Keterangan</th>
                  </tr>
                </thead>
                <tbody>
                  {rowsForCustomer.map((r) => {
                    const selectable = isSelectable(r);
                    return (
                      <tr key={r.id} className={selectable ? "" : "off"}>
                        <td className="cb">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(r.id)}
                            disabled={!selectable}
                            onChange={() => toggleRow(r.id)}
                            aria-label={`Pilih invoice ${r.invoiceNo}`}
                          />
                        </td>
                        <td className="mono">{r.invoiceNo}</td>
                        <td className="mono">{r.dateStr}</td>
                        <td
                          className={`num mono${
                            currency === "IDR" ? " active" : ""
                          }`}
                        >
                          {formatAmount(r.amount)}
                        </td>
                        {hasForeignAmount && (
                          <td
                            className={`num mono${
                              currency === "USD" ? " active" : ""
                            }`}
                          >
                            {r.foreignAmount == null
                              ? "-"
                              : formatAmount(r.foreignAmount)}
                          </td>
                        )}
                        <td className="mono">{r.poCustomer}</td>
                        <td className="desc">{r.flightNumber}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="placeholder">
              Upload file ECOUNT untuk melihat daftar invoice.
            </div>
          )}
        </main>
      </div>

      <footer className="actionbar">
        <div className="stats">
          <div>
            <span className="k">Terpilih</span>
            <span className="v mono">
              {selectedRows.length} / {rowsForCustomer.length} invoice
            </span>
          </div>
          <div>
            <span className="k">Total nilai</span>
            <span className="v total mono">
              {CURRENCY_PREFIX[currency]} {formatAmount(totalSelected)}
            </span>
          </div>
        </div>

        <div className="bar-right">
          {errorMsg && <span className="inline-msg error">{errorMsg}</span>}
          {!errorMsg && successMsg && (
            <span className="inline-msg ok">{successMsg}</span>
          )}
          {!errorMsg && !successMsg && (
            <span className="inline-msg">
              Invoice diurutkan otomatis dari tanggal lama ke baru.
            </span>
          )}
          <button
            className="btn-primary"
            onClick={handleGenerate}
            disabled={isGenerating || !!blocker}
          >
            {isGenerating ? "Membuat file..." : "Generate & Download Kontrabon"}
          </button>
        </div>
      </footer>
      </div>
    </>
  );
}
