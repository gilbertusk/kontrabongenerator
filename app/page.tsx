"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { parseEcountWorkbook, EcountRow, ParseResult } from "@/lib/parseEcount";
import {
  orderRows,
  duplicatePoGroups,
  poKey,
  orderManually,
  numberRows,
  duplicateManualNumbers,
  ManualNumbers,
} from "@/lib/orderRows";
import Intro from "./Intro";
import Help from "./Help";
import {
  TEMPLATE_LIST,
  DEFAULT_TEMPLATE,
  TemplateId,
  findTemplate,
  supportsCurrency,
} from "@/lib/templates";

type Currency = "IDR" | "USD";

/** Otomatis: urut tanggal + blok No. PO. Manual: user mengetik nomor urutnya. */
type OrderMode = "auto" | "manual";

const ORDER_HELP: Record<OrderMode, string> = {
  auto: "Urut tanggal lama ke baru; No. PO sama dijadikan satu blok.",
  manual:
    "Ketik nomor urut di kolom kiri. Yang dikosongkan tidak ikut di-export.",
};

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
  const [orderMode, setOrderMode] = useState<OrderMode>("auto");
  const [manualNo, setManualNo] = useState<ManualNumbers>({});

  const [currency, setCurrency] = useState<Currency>("IDR");
  const [templateId, setTemplateId] = useState<TemplateId>(DEFAULT_TEMPLATE);
  const template = findTemplate(templateId) ?? TEMPLATE_LIST[0];

  function changeTemplate(id: TemplateId) {
    setTemplateId(id);
    // template Luminor hanya punya versi Rupiah
    if (!supportsCurrency(id, currency)) setCurrency("IDR");
  }
  const [kontrabonNo, setKontrabonNo] = useState("");
  const [tanggal, setTanggal] = useState(todayInputValue());
  const [kembaliTanggal, setKembaliTanggal] = useState("");
  const [customerNameOverride, setCustomerNameOverride] = useState("");

  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const rowsForCustomer: EcountRow[] = useMemo(() => {
    if (!parseResult) return [];
    const rows = selectedCustomer
      ? parseResult.rows.filter((r) => r.customer === selectedCustomer)
      : parseResult.rows;
    // urutan tampil = urutan di Excel: kronologis, No. PO sama jadi satu blok
    return orderRows(rows);
  }, [parseResult, selectedCustomer]);

  /** No. PO yang dipakai >1 invoice -> nomor grup, untuk menyorot barisnya. */
  const poGroups = useMemo(
    () => duplicatePoGroups(rowsForCustomer),
    [rowsForCustomer]
  );

  /** File ECOUNT ini punya kolom "Total Foreign Currency Amount" yang terisi? */
  const hasForeignAmount = useMemo(
    () => (parseResult?.rows ?? []).some((r) => r.foreignAmount != null),
    [parseResult]
  );

  /** Kolom "Progress Status" / "No. Kontra Bon" hanya ada di export format baru. */
  const showStatusColumn = parseResult?.available.progressStatus ?? false;
  const showKontrabonColumn =
    parseResult?.available.existingKontrabonNo ?? false;

  /**
   * Kontrabon USD: invoice yang kolom "Total Foreign Currency Amount"-nya
   * kosong/0. Tetap boleh dicentang manual (nilai $-nya ditulis 0), tapi
   * tidak ikut dicentang otomatis.
   */
  function lacksUsdAmount(row: EcountRow): boolean {
    if (currency !== "USD") return false;
    return row.foreignAmount == null || row.foreignAmount === 0;
  }

  /** Semua invoice bisa dipilih; yang "bermasalah" hanya tidak dipilih otomatis. */
  const selectableRows = rowsForCustomer;

  /**
   * Baris yang dicentang otomatis saat file dibuka: belum pernah masuk
   * kontrabon lain DAN (untuk USD) punya nilai USD. Sisanya tetap tampil dan
   * tetap bisa dicentang manual.
   */
  const autoSelectableRows = selectableRows.filter(
    (r) => !r.alreadyBilled && !lacksUsdAmount(r)
  );

  /** Baris yang tampil tapi sengaja tidak dicentang karena sudah ditagih. */
  const billedRows = selectableRows.filter((r) => r.alreadyBilled);

  /** Kontrabon USD: baris tanpa nilai USD (tidak dicentang otomatis). */
  const noUsdRows = selectableRows.filter(lacksUsdAmount);

  /** Pilih `rows` di kedua mode sekaligus: dicentang & dinomori 1..n. */
  function selectRows(rows: EcountRow[]) {
    setSelectedIds(new Set(rows.map((r) => r.id)));
    setManualNo(numberRows(orderRows(rows)));
  }

  useEffect(() => {
    selectRows(autoSelectableRows);
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

  function setRowNumber(id: string, value: string) {
    setManualNo((prev) => ({ ...prev, [id]: value.replace(/\D/g, "") }));
  }

  /** Invoice yang ikut di-export, SUDAH dalam urutan final di file Excel. */
  const selectedRows =
    orderMode === "manual"
      ? orderManually(selectableRows, manualNo)
      : orderRows(rowsForCustomer.filter((r) => selectedIds.has(r.id)));

  function changeOrderMode(mode: OrderMode) {
    if (mode === orderMode) return;
    // bawa pilihan & urutan saat ini ke mode berikutnya
    setSelectedIds(new Set(selectedRows.map((r) => r.id)));
    setManualNo(numberRows(selectedRows));
    setOrderMode(mode);
  }

  const allSelected =
    selectableRows.length > 0 && selectedRows.length === selectableRows.length;

  /** Nomor urut tiap invoice terpilih di file Excel (kolom "No."). */
  const exportNo = new Map(selectedRows.map((r, i) => [r.id, i + 1] as const));

  /** Mode manual: nomor yang diketik untuk lebih dari satu invoice. */
  const duplicateNumbers =
    orderMode === "manual"
      ? duplicateManualNumbers(
          selectableRows.map((r) => r.id),
          manualNo
        )
      : new Set<number>();
  const totalSelected = selectedRows.reduce(
    (s, r) => s + (amountOf(r, currency) || 0),
    0
  );
  const selectedNoUsd = selectedRows.filter(lacksUsdAmount).length;
  const hasRows = rowsForCustomer.length > 0;

  /** Syarat yang belum terpenuhi untuk generate; kosong berarti sudah siap. */
  const blocker = !hasRows
    ? "Belum ada file ECOUNT yang dibaca."
    : selectedRows.length === 0
    ? orderMode === "manual"
      ? "Belum ada invoice yang diberi nomor urut."
      : "Belum ada invoice yang dicentang."
    : duplicateNumbers.size > 0
    ? `Nomor urut ${[...duplicateNumbers]
        .sort((a, b) => a - b)
        .join(", ")} dipakai lebih dari satu invoice.`
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
          // kirim "YYYY-MM-DD" apa adanya: toISOString() menggeser ke UTC
          // sehingga di WIB tanggalnya mundur satu hari di server.
          tanggal,
          kembaliTanggal: kembaliTanggal
            ? toDocumentDate(kembaliTanggal)
            : undefined,
          customer: customerNameOverride.trim(),
          currency,
          template: templateId,
          // mode manual: server wajib memakai urutan kiriman apa adanya
          keepOrder: orderMode === "manual",
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
              <h2 className="block-title">Template Kontrabon</h2>
            </div>
            <div className="segmented three">
              {TEMPLATE_LIST.map((t) => (
                <button
                  key={t.id}
                  className={templateId === t.id ? "on" : ""}
                  onClick={() => changeTemplate(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <p className="helper">{template.description}</p>
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
                disabled={!supportsCurrency(templateId, "USD")}
                title={
                  supportsCurrency(templateId, "USD")
                    ? undefined
                    : `Template ${template.label} hanya tersedia untuk Rupiah`
                }
              >
                Dollar (USD)
              </button>
            </div>
            <p className="helper">{CURRENCY_HELP[currency]}</p>
          </section>

          <section>
            <div className="block-head">
              <h2 className="block-title">Urutan Invoice</h2>
            </div>
            <div className="segmented">
              <button
                className={orderMode === "auto" ? "on" : ""}
                onClick={() => changeOrderMode("auto")}
              >
                Otomatis
              </button>
              <button
                className={orderMode === "manual" ? "on" : ""}
                onClick={() => changeOrderMode("manual")}
              >
                Manual (nomor)
              </button>
            </div>
            <p className="helper">{ORDER_HELP[orderMode]}</p>
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
                    placeholder={template.numberExample}
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
          {noUsdRows.length > 0 && (
            <p className="notice">
              <b>{noUsdRows.length} invoice</b> tidak punya nilai USD, jadi
              tidak dicentang otomatis. Centang manual kalau memang perlu ikut;
              kolom JUMLAH ($)-nya akan ditulis 0.
              {selectedNoUsd > 0 && (
                <>
                  {" "}
                  Saat ini <b>{selectedNoUsd}</b> di antaranya ikut dicentang.
                </>
              )}
            </p>
          )}

          {billedRows.length > 0 && (
            <p className="notice">
              <b>{billedRows.length} invoice</b> sudah punya No. Kontra Bon di
              file ECOUNT, jadi tidak dicentang otomatis supaya tidak tertagih
              dua kali. Centang manual kalau memang perlu ditagih ulang.
            </p>
          )}

          <div className="content-head">
            <h1>
              Invoice
              <span className="tag mono">[SET_CURRENCY : {currency}]</span>
            </h1>
            <div className="head-actions">
              {(billedRows.length > 0 || noUsdRows.length > 0) && (
                <button
                  className="linkbtn"
                  onClick={() => selectRows(autoSelectableRows)}
                  disabled={!hasRows}
                >
                  {noUsdRows.length === 0
                    ? "Pilih yang belum ditagih"
                    : billedRows.length === 0
                    ? "Pilih yang punya nilai USD"
                    : "Pilih yang disarankan"}
                </button>
              )}
              <button
                className="linkbtn strong"
                onClick={() => selectRows(selectableRows)}
                disabled={!hasRows || allSelected}
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

          {hasRows ? (
            <div className="table-wrap">
              <table className="invoices">
                <thead>
                  <tr>
                    <th className={orderMode === "manual" ? "order" : "cb"}>
                      {orderMode === "manual" ? (
                        "Urut"
                      ) : (
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={() =>
                            selectRows(allSelected ? [] : selectableRows)
                          }
                          aria-label="Pilih semua invoice"
                        />
                      )}
                    </th>
                    <th className="no">No.</th>
                    <th>{parseResult?.available.sjNo ? "Invoice / No. SJ" : "Invoice"}</th>
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
                    {showStatusColumn && <th>Status</th>}
                    {showKontrabonColumn && <th>No. Kontrabon</th>}
                  </tr>
                </thead>
                <tbody>
                  {rowsForCustomer.map((r, i) => {
                    const noUsd = lacksUsdAmount(r);
                    const key = poKey(r.poCustomer);
                    const group = poGroups.get(key);
                    const inGroup = group !== undefined;
                    const prevKey = poKey(rowsForCustomer[i - 1]?.poCustomer ?? "");
                    const nextKey = poKey(rowsForCustomer[i + 1]?.poCustomer ?? "");
                    const cls = [
                      // tanpa nilai USD: redup selama belum dipilih
                      noUsd && !exportNo.has(r.id) ? "off" : "",
                      r.alreadyBilled ? "billed" : "",
                      inGroup ? `po-group po-group-${group % 2}` : "",
                      inGroup && prevKey !== key ? "po-first" : "",
                      inGroup && nextKey !== key ? "po-last" : "",
                    ]
                      .filter(Boolean)
                      .join(" ");
                    return (
                      <tr
                        key={r.id}
                        className={cls}
                        title={
                          noUsd
                            ? "Tidak punya nilai USD; kalau dicentang, JUMLAH ($) ditulis 0"
                            : undefined
                        }
                      >
                        {orderMode === "manual" ? (
                          <td className="order">
                            <input
                              type="text"
                              inputMode="numeric"
                              className={`order-input mono${
                                duplicateNumbers.has(Number(manualNo[r.id]))
                                  ? " dup"
                                  : ""
                              }`}
                              value={manualNo[r.id] ?? ""}
                              onChange={(e) =>
                                setRowNumber(r.id, e.target.value)
                              }
                              aria-label={`Nomor urut invoice ${r.invoiceNo}`}
                            />
                          </td>
                        ) : (
                          <td className="cb">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(r.id)}
                              onChange={() => toggleRow(r.id)}
                              aria-label={`Pilih invoice ${r.invoiceNo}`}
                            />
                          </td>
                        )}
                        <td className="no mono">{exportNo.get(r.id) ?? ""}</td>
                        <td className="mono">
                          {r.invoiceNo}
                          {r.invoiceNoSource === "sj" && (
                            <span
                              className="badge"
                              title="Belum ada Receivable No. di ECOUNT, jadi yang dipakai nomor surat jalan"
                            >
                              SJ
                            </span>
                          )}
                        </td>
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
                        <td className="mono">
                          {r.poCustomer}
                          {inGroup && (
                            <span
                              className="badge po"
                              title="No. PO ini dipakai beberapa invoice, jadi di Excel ditaruh berurutan"
                            >
                              PO SAMA
                            </span>
                          )}
                        </td>
                        <td className="desc">{r.flightNumber}</td>
                        {showStatusColumn && (
                          <td className="status-col">
                            {r.progressStatus || "-"}
                          </td>
                        )}
                        {showKontrabonColumn && (
                          <td className="mono">
                            {r.existingKontrabonNo || "-"}
                          </td>
                        )}
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
            <span className="inline-msg">{ORDER_HELP[orderMode]}</span>
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
