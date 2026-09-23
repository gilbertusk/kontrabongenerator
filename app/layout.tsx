import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

// IBM Plex: grotesk untuk teks UI, mono untuk SEMUA angka (nominal, tanggal,
// nomor invoice/PO) supaya titik desimalnya lurus ke bawah di tabel.
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Kontrabon Generator - PT Berlian Artha Label",
  description:
    "Generate kontrabon otomatis dari file export ECOUNT (Sales List).",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={`${plexSans.variable} ${plexMono.variable}`}>
      <head>
        {/* Tandai lebih dulu kalau intro sudah pernah tampil di sesi ini,
            supaya halaman tidak sempat berkedip menampilkannya lagi. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              'try{if(sessionStorage.getItem("bal-intro-seen")==="1")' +
              'document.documentElement.dataset.intro="seen"}catch(e){}',
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
