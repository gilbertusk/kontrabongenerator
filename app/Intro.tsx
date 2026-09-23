"use client";

import { useEffect, useState } from "react";

/** Jumlah salinan gambar yang ditumpuk untuk membentuk ketebalan logo. */
const DEPTH_LAYERS = 26;

/** Jarak antar lapisan pada sumbu Z (px). 26 x 1.7 = ketebalan ~44px. */
const LAYER_STEP = 1.7;

const HOLD_MS = 1900;
const FADE_MS = 420;
const SESSION_KEY = "bal-intro-seen";

type Phase = "playing" | "leaving" | "done";

/**
 * Keputusan tampil / tidak diambil SEKALI per pemuatan halaman dan disimpan di
 * level modul. Tanpa ini, React StrictMode (yang menjalankan effect dua kali di
 * mode development) akan membaca penanda yang baru saja ditulis dan langsung
 * mematikan intro-nya sendiri.
 */
let decision: "play" | "skip" | null = null;

function decideOnce(): "play" | "skip" {
  if (decision) return decision;
  let seen = false;
  try {
    seen = sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    // Mode privat / storage diblokir: anggap belum pernah dilihat.
  }
  decision = seen ? "skip" : "play";
  return decision;
}

/**
 * Layar pembuka: logo BAL dirender 3D dengan menumpuk beberapa salinan gambar
 * pada sumbu Z. Hanya muncul sekali per sesi browser supaya tidak mengganggu
 * pemakaian harian, dan bisa dilewati kapan saja dengan klik / tombol apa pun.
 *
 * Kalau ingin selalu muncul tiap buka halaman: hapus pemakaian `SESSION_KEY`
 * di file ini dan skrip kecil di `app/layout.tsx`.
 */
export default function Intro() {
  const [phase, setPhase] = useState<Phase>("playing");

  useEffect(() => {
    if (decideOnce() === "skip") {
      setPhase("done");
      return;
    }

    // Hanya simpan di sessionStorage. Atribut pada <html> sengaja TIDAK
    // disentuh di sini -- itu tugas skrip di layout saat halaman dibuka lagi.
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // abaikan; paling-paling intro tampil sekali lagi di sesi ini
    }

    let fadeTimer = 0;
    const leaveTimer = window.setTimeout(() => {
      setPhase("leaving");
      fadeTimer = window.setTimeout(() => setPhase("done"), FADE_MS);
    }, HOLD_MS);

    function skip() {
      setPhase("done");
    }
    window.addEventListener("keydown", skip);

    return () => {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(fadeTimer);
      window.removeEventListener("keydown", skip);
    };
  }, []);

  if (phase === "done") return null;

  return (
    <div
      className={`intro${phase === "leaving" ? " leaving" : ""}`}
      onClick={() => setPhase("done")}
      role="presentation"
      aria-hidden
    >
      <div className="intro-stage">
        <div className="intro-logo">
          {Array.from({ length: DEPTH_LAYERS }, (_, i) => {
            const depth = DEPTH_LAYERS - 1 - i;
            const brightness = 0.5 + (0.5 * i) / (DEPTH_LAYERS - 1);
            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src="/logo-bal.png"
                alt=""
                style={{
                  transform: `translateZ(${-depth * LAYER_STEP}px)`,
                  // Lapisan belakang digelapkan supaya sisi tebalnya terbaca.
                  filter: `brightness(${brightness.toFixed(3)})`,
                }}
              />
            );
          })}
        </div>
      </div>
      <div className="intro-shadow" />
      <p className="intro-caption">Kontrabon Generator</p>
    </div>
  );
}
