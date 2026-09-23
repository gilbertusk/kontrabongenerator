# Kontrabon Generator — PT Berlian Artha Label

Website kecil untuk generate **kontrabon** (surat tanda terima faktur ke
customer) otomatis dari file **export ECOUNT (Sales List)**.

Alur pakai:

1. User membuka website, upload file hasil export ECOUNT (`.xlsx`).
2. Website membaca & menampilkan daftar invoice dari file itu (dengan
   checkbox untuk pilih invoice mana yang mau dimasukkan ke kontrabon ini).
3. User pilih **mata uang** (Rupiah atau USD), lalu isi No. Kontrabon,
   tanggal, dan nama customer (biasanya sudah terisi otomatis dari data).
4. Klik **Generate & Download Kontrabon** → file `.xlsx` kontrabon jadi,
   siap dikirim ke customer.

## Struktur project

```
app/
  page.tsx                -> tampilan utama (upload, pilih invoice, form)
  Intro.tsx               -> layar pembuka logo BAL 3D
  layout.tsx              -> layout dasar + font IBM Plex Sans/Mono
  globals.css             -> seluruh styling aplikasi
  api/generate/route.ts   -> endpoint yang generate file .xlsx (server-side)
public/
  logo-bal.png            -> logo perusahaan (dipakai di layar pembuka & kop)
lib/
  parseEcount.ts          -> baca & petakan kolom file export ECOUNT
  buildKontrabon.ts       -> isi template kontrabon dengan data invoice
  terbilang.ts            -> konversi nominal ke terbilang (Rupiah & USD)
  template/
    kontrabon-template.xlsx     -> template kontrabon Rupiah
    kontrabon-template-usd.xlsx -> template kontrabon USD
```

## Menjalankan di komputer sendiri

Butuh [Node.js](https://nodejs.org) versi 18 atau lebih baru.

```bash
npm install
npm run dev
```

Buka `http://localhost:3000` di browser.

## Deploy ke Vercel

Cara paling mudah (tanpa command line):

1. Push folder project ini ke repo GitHub (bisa lewat GitHub Desktop atau
   upload manual di github.com/new).
2. Buka [vercel.com](https://vercel.com) → **Add New Project** → pilih
   repo tersebut → klik **Deploy**. Vercel otomatis mendeteksi ini project
   Next.js, tidak perlu setting tambahan.
3. Setelah selesai (1-2 menit), Vercel memberi URL seperti
   `https://kontrabon-generator-xxxx.vercel.app` yang bisa langsung dibuka
   dan dipakai.

Atau lewat terminal, dari dalam folder project:

```bash
npm install -g vercel
vercel login
vercel --prod
```

## Tampilan

Satu layar kerja, tanpa menu navigasi:

- **Baris atas** — nama aplikasi & nama perusahaan.
- **Kolom kiri (330px)** — sumber file Excel, pilihan mata uang, form detail
  kontrabon, dan kotak **Ringkasan** di bawah yang menunjukkan status
  "Siap" / "Belum lengkap" beserta alasannya.
- **Kolom kanan** — tabel invoice setinggi layar dengan scroll sendiri.
  Kolom nilai yang sedang dipakai (Rp atau USD) diberi kotak di headernya.
- **Baris bawah** — jumlah invoice terpilih, total nilai, dan tombol generate.

Arah desainnya Swiss/utilitarian: struktur dibentuk garis rambut 1px dan
perataan, bukan bayangan atau gradasi. Semua angka (nominal, tanggal, no.
invoice, no. PO) memakai IBM Plex Mono dengan angka tabular supaya titik
desimalnya lurus ke bawah. Merah aksen (`#BA131A`, diambil langsung dari
logo BAL) hanya dipakai di 3 tempat: tombol utama, segmen mata uang aktif,
dan checkbox tercentang.

### Layar pembuka

`app/Intro.tsx` menampilkan logo BAL dengan efek 3D: gambar logo ditumpuk
26 lapis pada sumbu Z (± 44px ketebalan), lapisan belakang digelapkan, lalu
diputar perlahan. Tidak memakai library 3D apa pun — hanya CSS.

- Muncul **sekali per sesi browser**, supaya tidak mengganggu pemakaian
  harian. Untuk memunculkannya lagi, tutup tab lalu buka baru.
- Bisa dilewati kapan saja: klik di mana saja atau tekan tombol apa pun.
- Otomatis jadi fade biasa kalau OS diset "kurangi animasi".
- Kalau ingin selalu muncul tiap buka halaman: hapus pemakaian
  `SESSION_KEY` di `app/Intro.tsx` dan skrip kecil di `app/layout.tsx`.

## Bagaimana file kontrabon dibuat

Website ini **tidak menggambar ulang** layout kontrabon dari nol. Yang
dilakukan: file template di `lib/template/` dibuka, lalu data invoice
dan nilai-nilainya diisikan ke sel yang sudah disediakan.

Template-nya adalah file kontrabon yang sudah dipakai selama ini, hanya
data invoice dan rumusnya yang dikosongkan. Jadi logo, kop "Contact Us",
lebar kolom, kolom tersembunyi, garis tabel, tinggi baris, sampai
pengaturan cetak (A4, margin, skala) persis sama seperti aslinya.

## Dua template: Rupiah & USD

Pilihan **Mata Uang / Template** di website menentukan file template
mana yang dipakai:

| Pilihan      | Template                      | Diambil dari kolom ECOUNT       | Dari contoh                            |
| ------------ | ----------------------------- | ------------------------------- | -------------------------------------- |
| Rupiah (Rp)  | `kontrabon-template.xlsx`     | `Total Amount`                  | `26.0911 BAL-2609027 PT SANSAN ...`    |
| Dollar (USD) | `kontrabon-template-usd.xlsx` | `Total Foreign Currency Amount` | `26.0911 BAL-2609050 PT MULIA ...`     |

Beda isi kedua template (mengikuti dokumen aslinya):

- **Rupiah** — total ditulis `Rp 101,759,543.04`, terbilang berakhiran
  "... Rupiah dan ... Sen", blok rekening tanpa Swift Code.
- **USD** — total ditulis `$ 3,958.04`, terbilang berakhiran
  "... U.S Dollar dan ... Cents", blok rekening pakai rekening USD
  (8650890885) + baris **Swift Code : CENAIDJA** + **Mata Uang : USD**.

Invoice yang kolom `Total Foreign Currency Amount`-nya kosong otomatis
tidak bisa dicentang saat mode USD (ditampilkan redup + ada peringatan),
supaya tidak ada invoice Rupiah yang nyasar ke kontrabon USD.

Sel yang diisi otomatis oleh website:

| Isi                                    | Rupiah | USD  |
| -------------------------------------- | ------ | ---- |
| tanggal kontrabon                      | C2     | C2   |
| No. kontrabon                          | C3     | C3   |
| nama customer                          | C5     | C5   |
| jumlah lembar faktur                   | E7     | F7   |
| total nilai                            | E8     | F8   |
| terbilang                              | B11    | B11  |
| Kembali Tanggal (bila diisi)           | B13    | B13  |
| nama customer (di atas "Tanda Terima") | E26    | F25  |
| tabel rincian invoice                  | mulai baris 32 | mulai baris 32 |

### Catatan pengingat di file hasil

Dua baris di bawah tabel invoice, file hasil selalu berisi catatan merah:

> **PERIKSA KEMBALI SEBELUM DIKIRIM**
> File ini dibuat otomatis dari hasil export ECOUNT. Cocokkan dulu nomor
> invoice, tanggal, jumlah lembar, dan nominalnya dengan faktur asli.
> Jangan dipakai mentah-mentah tanpa diperiksa.

Catatan ini sengaja ditaruh **di luar area cetak**. Jadi orang yang membuka
filenya pasti melihatnya di Excel, tapi baris itu tidak ikut saat dicetak
maupun di-PDF-kan — kontrabon yang sampai ke customer tetap bersih. Teksnya
ada di konstanta `WARNING_HEADING` / `WARNING_LINES` pada
`lib/buildKontrabon.ts`.

## Yang perlu disesuaikan bila ada perubahan

Kalau ada perubahan rekening bank, nama penandatangan "Hormat Kami",
nomor WhatsApp, logo, lebar kolom, atau apa pun soal tampilan:

1. Buka file template yang bersangkutan di `lib/template/` **langsung
   di Excel** (yang Rupiah dan yang USD terpisah, ubah keduanya bila
   perlu).
2. Ubah seperlunya, lalu **Save** (tetap format `.xlsx`).
3. Selesai. Tidak ada kode yang perlu diubah.

Syarat yang harus dijaga supaya generator tetap jalan:

- Sel yang ada di tabel "diisi otomatis" di atas harus tetap ada dan
  tetap di posisi itu (isinya boleh kosong).
- Baris header tabel tetap di baris 31, data invoice mulai baris 32.
- Jangan menambah sheet baru; template hanya boleh punya 1 sheet.
- Jangan menaruh angka hasil ketik tangan di dalam text box — angka
  seperti itu tidak ikut ter-update dan akan salah di kontrabon
  berikutnya. (Dua text box semacam itu sudah dibuang dari template USD
  saat dibuat.)

## Catatan tentang pemetaan kolom

File export ECOUNT ("Sales List") dipetakan ke kolom kontrabon seperti ini:

| Kolom ECOUNT                  | Kolom Kontrabon      |
| ------------------------------ | --------------------- |
| Invoice                        | INVOICE                |
| Date                            | TANGGAL                |
| Total Amount                    | Jumlah (template Rupiah) |
| Total Foreign Currency Amount   | JUMLAH (template USD)  |
| No. PO Customer                 | NO. PO                 |
| Flight Number                   | Keterangan              |
| CUST.                           | Kepada / nama customer |

Kedua nilai (Rupiah & USD) selalu ditulis ke file hasil; yang tidak
sesuai mata uang yang dipilih masuk ke kolom yang disembunyikan, persis
seperti dokumen aslinya. Kolom "Number" dari ECOUNT tidak dipakai.
Parser di
`lib/parseEcount.ts` mendeteksi baris header secara otomatis (mencari
kolom "Invoice", "Date", "Total Amount"), jadi cukup tahan kalau ada
sedikit perbedaan format export ECOUNT. Kalau suatu saat ECOUNT
mengganti nama kolom dan parser gagal mendeteksi, tambahkan alias nama
kolom itu di `HEADER_ALIASES` pada file yang sama.

## Catatan tentang terbilang

Fungsi `terbilangUang` di `lib/terbilang.ts` menghasilkan gaya
penulisan yang sama dengan template kontrabon lama:

- Rupiah: "Empat Puluh-Empat Juta ... Rupiah dan Dua Puluh-Enam Sen"
- USD: "Tiga Ribu Sembilan Ratus Lima Puluh-Delapan U.S Dollar dan
  Empat Cents" (tepat 1 sen ditulis "Satu Cent", sesuai formula lama)

Dua bug kecil di formula Excel lama sudah diperbaiki:

- kata "Sen" yang dulu hilang di akhir kalimat saat nilainya punya sen,
- typo "sebeleas" → "sebelas".

Kalau ternyata perlu 100% sama seperti dokumen-dokumen lama (termasuk
bug-nya), tinggal bilang saja dan bagian itu bisa disesuaikan.

## Validasi yang sudah dilakukan

Logika pemetaan kolom & perhitungan total sudah diuji terhadap 2 file
contoh (`26.0911 BAL-2609027 ...xlsx` sebagai contoh output, dan
`I8FCD0GEDFFVF6U.xlsx` sebagai contoh tarikan ECOUNT): ke-20 invoice yang
ada di kontrabon contoh berhasil ditemukan & dicocokkan persis dari data
ECOUNT (nominal, No. PO, Flight Number sama semua), dan totalnya persis
sama dengan total di kontrabon contoh (Rp 44.587.552,26). Fungsi
terbilang juga sudah dites langsung dengan Node/TypeScript dan hasilnya
sesuai.

Hasil generate juga sudah dicek langsung di Microsoft Excel: file dari
41 invoice `I8FCD0GEDFFVF6U.xlsx` dibuka tanpa peringatan "repair",
dan tampilannya sama dengan template (logo, kop kontak, format
`Rp 101,759,543.04`, terbilang, kotak keterangan bank, tabel rincian
bergaris rapi sampai baris terakhir, kolom F dan I tetap tersembunyi,
area cetak ikut menyesuaikan jumlah baris). `npm run build` juga sudah
dijalankan dan lolos.

Template USD diuji dengan cara yang sama memakai ke-32 invoice dari
kontrabon contoh `26.0911 BAL-2609050 PT MULIA ...xlsx`: hasilnya
totalnya persis `$ 3,958.04`, terbilangnya persis "Tiga Ribu Sembilan
Ratus Lima Puluh-Delapan U.S Dollar dan Empat Cents", dan tampilannya
sama persis dengan dokumen aslinya saat dibuka di Excel.

Catatan "PERIKSA KEMBALI" sudah dites dua arah: ada di sheet Excel (merah,
baris 65 pada contoh USD) dan **tidak ada** di hasil PDF/cetak — dicek
dengan mengekspor file ke PDF lewat Excel lalu membaca teksnya.

Alur pilih mata uang di website juga sudah dites langsung di browser
memakai file ECOUNT campuran (32 invoice USD + 3 invoice Rupiah):
saat mode USD, 3 invoice Rupiah otomatis non-aktif, total berubah jadi
`$ 3.958,04`, dan tombol generate menghasilkan file dengan nama
`26.0911 BAL-2609050 PT MULIA CEMERLANG ABADI MULTI INDUSTRY.xlsx`.
