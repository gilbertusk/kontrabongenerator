"use client";

import { useEffect, useRef, useState } from "react";
import {
  HELP_TOPICS,
  HelpTopic,
  findTopics,
  CONFIDENT_SCORE,
} from "@/lib/helpTopics";

/**
 * Nomor WhatsApp tujuan laporan masalah. Diambil dari environment variable
 * supaya bisa diganti lewat pengaturan Vercel tanpa menyentuh kode. Nilai
 * cadangannya adalah nomor yang sudah tercetak di kop kontrabon.
 */
const WA_NUMBER =
  process.env.NEXT_PUBLIC_WA_NUMBER?.replace(/\D/g, "") || "6282258899903";

/** Jeda pura-pura mengetik, supaya jawaban tidak muncul sekaligus. */
const TYPING_MS = 340;

/** Keadaan aplikasi saat laporan dibuat, ikut dikirim untuk memudahkan cek. */
export interface HelpContext {
  currency: string;
  fileName: string;
  totalRows: number;
  selectedRows: number;
  lastError: string;
}

interface Message {
  id: number;
  from: "bot" | "user";
  text: string;
  /** Kalau ada, gelembung ini menampilkan tombol buka WhatsApp. */
  waUrl?: string;
}

/** Tombol pilihan cepat di bawah percakapan. */
interface Chip {
  id: string;
  label: string;
}

const CHIP_ALL = "__all__";
const CHIP_REPORT = "__report__";

const STARTER_TOPICS = ["file", "mata-uang", "tidak-bisa-dicentang", "tombol-mati"];

function browserLabel(): string {
  if (typeof navigator === "undefined") return "-";
  const ua = navigator.userAgent;
  const known: [string, RegExp][] = [
    ["Edge", /Edg\/([\d.]+)/],
    ["Opera", /OPR\/([\d.]+)/],
    ["Chrome", /Chrome\/([\d.]+)/],
    ["Firefox", /Firefox\/([\d.]+)/],
    ["Safari", /Version\/([\d.]+).*Safari/],
  ];
  for (const [name, re] of known) {
    const m = re.exec(ua);
    if (m) return `${name} ${m[1].split(".")[0]}`;
  }
  return "lainnya";
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Susun pesan WhatsApp. Sengaja TIDAK menyertakan nama customer maupun nilai
 * rupiah/dollar - itu data bisnis yang tidak perlu keluar hanya untuk
 * melaporkan bug.
 */
function buildReport(text: string, ctx: HelpContext): string {
  const now = new Date();
  const waktu = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return [
    "Halo, saya menemukan masalah di Kontrabon Generator.",
    "",
    "Masalahnya:",
    text.trim() || "(belum diisi)",
    "",
    "--- Data teknis ---",
    `Waktu       : ${waktu}`,
    `Mata uang   : ${ctx.currency}`,
    `File ECOUNT : ${ctx.fileName || "(belum ada)"}`,
    `Invoice     : ${ctx.selectedRows} dari ${ctx.totalRows} tercentang`,
    `Pesan error : ${ctx.lastError || "(tidak ada)"}`,
    `Browser     : ${browserLabel()}`,
    `Layar       : ${typeof window === "undefined" ? "-" : `${window.innerWidth}x${window.innerHeight}`}`,
  ].join("\n");
}

function topicChips(topics: HelpTopic[]): Chip[] {
  return topics.map((t) => ({ id: t.id, label: t.question }));
}

const DEFAULT_CHIPS: Chip[] = [
  ...topicChips(
    STARTER_TOPICS.map((id) => HELP_TOPICS.find((t) => t.id === id)!).filter(Boolean)
  ),
  { id: CHIP_ALL, label: "Lihat semua pertanyaan" },
  { id: CHIP_REPORT, label: "Lapor masalah ke WhatsApp" },
];

export default function Help({ context }: { context: HelpContext }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chips, setChips] = useState<Chip[]>(DEFAULT_CHIPS);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [awaitingReport, setAwaitingReport] = useState(false);

  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(0);
  const alive = useRef(true);

  /** Percakapan dimulai ulang tiap kali laci dibuka. */
  useEffect(() => {
    if (!open) return;
    alive.current = true;
    nextId.current = 0;
    setMessages([
      {
        id: nextId.current++,
        from: "bot",
        text: "Halo. Saya bisa bantu soal pemakaian Kontrabon Generator. Pilih pertanyaan di bawah, atau ketik langsung apa yang mau ditanyakan.",
      },
    ]);
    setChips(DEFAULT_CHIPS);
    setInput("");
    setAwaitingReport(false);
    inputRef.current?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      alive.current = false;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  /** Selalu gulung ke pesan terbaru. */
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, typing, chips]);

  function push(msg: Omit<Message, "id">) {
    setMessages((prev) => [...prev, { ...msg, id: nextId.current++ }]);
  }

  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  /** Kirim beberapa gelembung dari bot, satu per satu dengan jeda mengetik. */
  async function botSay(lines: string[], waUrl?: string) {
    for (let i = 0; i < lines.length; i++) {
      if (!alive.current) return;
      setTyping(true);
      await new Promise((r) => setTimeout(r, reduceMotion ? 0 : TYPING_MS));
      if (!alive.current) return;
      setTyping(false);
      push({
        from: "bot",
        text: lines[i],
        waUrl: i === lines.length - 1 ? waUrl : undefined,
      });
    }
  }

  async function answerTopic(topic: HelpTopic) {
    setChips([]);
    await botSay(topic.answer);
    if (!alive.current) return;
    setChips(DEFAULT_CHIPS);
  }

  async function startReport() {
    setChips([]);
    setAwaitingReport(true);
    await botSay([
      "Baik. Ceritakan masalahnya dengan kalimat sendiri - misalnya \"total di Excel beda dengan yang di layar\".",
      "Nanti saya siapkan pesannya lengkap dengan data teknis, dan nama customer serta nominalnya tidak ikut dikirim.",
    ]);
    inputRef.current?.focus();
  }

  async function finishReport(text: string) {
    setAwaitingReport(false);
    const message = buildReport(text, context);
    const waUrl = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(message)}`;
    await botSay(
      [
        "Ini pesan yang akan dikirim. Tekan tombolnya untuk membuka WhatsApp - pesannya sudah terisi, tinggal ditekan kirim.",
        message,
      ],
      waUrl
    );
    if (!alive.current) return;
    setChips(DEFAULT_CHIPS);
  }

  async function handleChip(chip: Chip) {
    push({ from: "user", text: chip.label });
    if (chip.id === CHIP_ALL) {
      setChips([]);
      await botSay(["Ini semua yang bisa saya jawab:"]);
      if (!alive.current) return;
      setChips([
        ...topicChips(HELP_TOPICS),
        { id: CHIP_REPORT, label: "Lapor masalah ke WhatsApp" },
      ]);
      return;
    }
    if (chip.id === CHIP_REPORT) {
      await startReport();
      return;
    }
    const topic = HELP_TOPICS.find((t) => t.id === chip.id);
    if (topic) await answerTopic(topic);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || typing) return;
    setInput("");
    push({ from: "user", text });

    if (awaitingReport) {
      await finishReport(text);
      return;
    }

    const found = findTopics(text);
    setChips([]);

    if (found.length === 0) {
      await botSay([
        "Maaf, saya belum punya jawaban untuk itu.",
        "Coba pilih salah satu pertanyaan di bawah, atau laporkan langsung ke WhatsApp supaya bisa dicek.",
      ]);
      if (!alive.current) return;
      setChips(DEFAULT_CHIPS);
      return;
    }

    // Hanya jawab langsung kalau kecocokannya meyakinkan. Kalau ragu, lebih
    // baik menawarkan pilihan daripada memberi jawaban yang salah.
    if (found[0].score >= CONFIDENT_SCORE) {
      await answerTopic(found[0].topic);
      return;
    }

    await botSay(["Saya kurang yakin. Mungkin salah satu ini yang dimaksud?"]);
    if (!alive.current) return;
    setChips([
      ...topicChips(found.map((f) => f.topic)),
      { id: CHIP_REPORT, label: "Bukan semuanya, lapor saja" },
    ]);
  }

  return (
    <>
      <button className="linkbtn help-open" onClick={() => setOpen(true)}>
        Bantuan
      </button>

      {open && (
        <>
          <div className="help-scrim" onClick={() => setOpen(false)} />
          <aside
            className="help"
            role="dialog"
            aria-modal="true"
            aria-label="Bantuan"
          >
            <header className="help-head">
              <h2>Asisten Kontrabon</h2>
              <button className="linkbtn" onClick={() => setOpen(false)}>
                Tutup
              </button>
            </header>

            <div className="chat-log" ref={logRef}>
              {messages.map((m) => (
                <div key={m.id} className={`bubble-row ${m.from}`}>
                  <div className={`bubble ${m.from}`}>
                    {m.waUrl ? (
                      <>
                        <pre className="bubble-pre mono">{m.text}</pre>
                        <a
                          className="btn-primary bubble-wa"
                          href={m.waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Buka WhatsApp
                        </a>
                      </>
                    ) : (
                      m.text
                    )}
                  </div>
                </div>
              ))}

              {typing && (
                <div className="bubble-row bot">
                  <div className="bubble bot typing" aria-label="sedang mengetik">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              )}

              {chips.length > 0 && !typing && (
                <div className="chips">
                  {chips.map((c) => (
                    <button
                      key={c.id}
                      className="chip"
                      onClick={() => handleChip(c)}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <form className="chat-composer" onSubmit={handleSubmit}>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  awaitingReport ? "Tulis masalahnya..." : "Ketik pertanyaan..."
                }
                aria-label="Ketik pertanyaan"
              />
              <button
                type="submit"
                className="btn-primary chat-send"
                disabled={!input.trim() || typing}
              >
                Kirim
              </button>
            </form>
          </aside>
        </>
      )}
    </>
  );
}
