/**
 * Isi panel Bantuan. Sengaja dipisah dari komponennya supaya kalau ada
 * pertanyaan baru yang sering ditanyakan, cukup tambah satu entri di sini
 * tanpa menyentuh kode tampilan.
 *
 * `keywords` dipakai supaya pencarian tetap ketemu walau user mengetik kata
 * yang tidak persis sama dengan judulnya (mis. "gabisa" untuk "tidak bisa").
 */
export interface HelpTopic {
  id: string;
  question: string;
  answer: string[];
  keywords?: string[];
}

export const HELP_TOPICS: HelpTopic[] = [
  {
    id: "file",
    question: "File apa yang harus di-upload?",
    answer: [
      'File hasil export ECOUNT berjudul "Sales List", format .xlsx.',
      "Ambil dari ECOUNT seperti biasa, lalu drag file-nya ke kotak di kiri atas, atau klik kotak itu untuk memilih file.",
      "Tidak perlu dirapikan dulu. Website ini mencari sendiri baris judul kolomnya, dan mengabaikan baris nama perusahaan di atas maupun baris jam cetak di bawah.",
      'Dua bentuk export ECOUNT sama-sama diterima: yang memakai kolom "Invoice", maupun yang lebih baru dengan kolom "Receivable No.", "No. SJ", "Progress Status", dan "No. Kontra Bon".',
    ],
    keywords: [
      "upload",
      "ecount",
      "excel",
      "xlsx",
      "sales list",
      "tarikan",
      "format baru",
      "receivable",
      "no. sj",
    ],
  },
  {
    id: "mata-uang",
    question: "Bedanya pilihan Rupiah dan Dollar (USD) apa?",
    answer: [
      'Rupiah memakai kolom "Total Amount" dari ECOUNT. Hasilnya memakai template Rupiah: total ditulis Rp, terbilang berakhiran "Rupiah dan ... Sen".',
      'Dollar (USD) memakai kolom "Total Foreign Currency Amount". Hasilnya memakai template USD: total ditulis $, terbilang berakhiran "U.S Dollar dan ... Cents", dan blok rekening memakai rekening USD lengkap dengan Swift Code.',
      "Pilih sesuai kesepakatan pembayaran dengan customer-nya, bukan sesuai isi file.",
    ],
    keywords: ["dollar", "rupiah", "usd", "idr", "valas", "mata uang", "swift"],
  },
  {
    id: "tidak-bisa-dicentang",
    question: "Kenapa ada invoice yang tidak bisa dicentang?",
    answer: [
      "Itu terjadi saat mata uang dipilih Dollar (USD), dan invoice tersebut tidak punya nilai USD di file ECOUNT (kolom Total Foreign Currency Amount-nya kosong).",
      "Invoice seperti itu adalah invoice Rupiah, jadi tidak bisa ikut ke kontrabon USD. Barisnya sengaja diredupkan supaya kelihatan, bukan disembunyikan.",
      "Kalau invoice itu memang harus ikut, berarti mata uangnya yang salah pilih - ganti ke Rupiah (Rp).",
    ],
    keywords: ["redup", "abu", "disabled", "usd kosong", "gabisa", "tidak aktif"],
  },
  {
    id: "sudah-kontrabon",
    question: 'Kenapa ada invoice yang tidak dicentang otomatis?',
    answer: [
      'Kalau file ECOUNT-nya punya kolom "No. Kontra Bon", invoice yang nomornya sudah terisi berarti sudah pernah masuk kontrabon lain. Barisnya tetap ditampilkan, tapi tidak dicentang otomatis supaya tidak tertagih dua kali.',
      'Nomor kontrabon lamanya bisa dilihat di kolom "No. Kontrabon" paling kanan, dan statusnya di kolom "Status".',
      'Kalau memang perlu ditagih ulang, centang saja barisnya secara manual. Tombol "Pilih semua" juga ikut mencentang baris seperti ini, sedangkan "Pilih yang belum ditagih" hanya yang belum pernah masuk kontrabon.',
    ],
    keywords: [
      "kontra bon",
      "sudah ditagih",
      "dobel",
      "tidak dicentang",
      "status",
      "progress status",
    ],
  },
  {
    id: "penanda-sj",
    question: 'Ada label "SJ" kecil di sebelah nomor invoice, itu apa?',
    answer: [
      'Artinya baris itu belum punya nomor faktur ("Receivable No." di ECOUNT masih kosong), jadi yang dipakai adalah nomor surat jalannya ("No. SJ").',
      "Biasanya ini SJ yang statusnya masih Confirmed dan belum dibuat fakturnya. Barisnya tetap bisa ditagih, tapi periksa dulu apakah memang sudah boleh masuk kontrabon.",
      "Di file hasilnya, nomor yang tercetak di kolom INVOICE adalah nomor tersebut.",
    ],
    keywords: ["sj", "surat jalan", "receivable", "label", "badge", "faktur"],
  },
  {
    id: "tombol-mati",
    question: "Tombol Generate-nya mati / tidak bisa diklik",
    answer: [
      'Lihat kotak "Ringkasan" di bagian bawah kolom kiri. Di situ tertulis persis apa yang masih kurang.',
      "Empat syarat yang harus lengkap: file ECOUNT sudah dibaca, minimal satu invoice dicentang, No. Kontrabon sudah diisi, dan kolom Kepada sudah diisi.",
      'Kalau kotak itu sudah menulis "Siap" berwarna hijau, tombolnya pasti aktif.',
    ],
    keywords: ["generate", "tombol", "disabled", "abu", "belum lengkap", "ringkasan"],
  },
  {
    id: "file-tidak-terbaca",
    question: "File saya tidak terbaca / tidak ada invoice yang muncul",
    answer: [
      'Pastikan yang di-upload benar-benar export ECOUNT "Sales List", bukan jenis laporan lain dan bukan file kontrabon yang sudah jadi.',
      'Baris judul kolomnya minimal harus punya "Date", "Total Amount", dan salah satu dari "Invoice" / "Receivable No." / "No. SJ".',
      "Kalau ECOUNT-nya baru berganti nama kolom, website ini perlu disesuaikan. Laporkan lewat tombol WhatsApp di bawah, sertakan file ECOUNT-nya.",
    ],
    keywords: ["kosong", "error", "gagal baca", "tidak terbaca", "header"],
  },
  {
    id: "urutan",
    question: "Urutan invoice di file hasilnya bagaimana?",
    answer: [
      "Diurutkan otomatis berdasarkan tanggal, dari yang paling lama ke yang paling baru.",
      'Invoice dengan No. PO yang sama dikumpulkan jadi satu blok berurutan, ditaruh di posisi invoice PO itu yang paling lama. Di layar barisnya disorot dan diberi tanda "PO SAMA".',
      'Kolom "No." di tabel menunjukkan nomor urut invoice itu di file Excel.',
      'Mau atur sendiri? Pilih "Manual (nomor)" di bagian Urutan Invoice. Checklist berubah jadi kotak nomor: isi 1, 2, 3, ... sesuai urutan yang diinginkan. Invoice yang kotaknya dikosongkan tidak ikut di-export, dan nomor yang sama tidak boleh dipakai dua kali.',
    ],
    keywords: ["urut", "sort", "tanggal", "nomor urut", "po", "po sama", "grup", "manual"],
  },
  {
    id: "nama-file",
    question: "Nama file hasilnya jadi apa?",
    answer: [
      "Mengikuti kebiasaan arsip lama: tahun.tanggalbulan, lalu No. Kontrabon, lalu nama customer.",
      "Contoh: 26.0911 BAL-2609027 PT SANSAN SAUDARATEX JAYA.xlsx",
      'Tanggal yang dipakai adalah "Tanggal Dokumen" yang diisi di kolom kiri, bukan tanggal hari ini.',
    ],
    keywords: ["nama file", "filename", "judul", "simpan"],
  },
  {
    id: "catatan-merah",
    question: 'Di Excel ada tulisan merah "PERIKSA KEMBALI", itu apa?',
    answer: [
      "Itu pengingat yang sengaja ditaruh di bawah tabel invoice: file ini dibuat otomatis, jadi cocokkan dulu nomor invoice, tanggal, jumlah lembar, dan nominalnya dengan faktur asli.",
      "Catatan itu berada di luar area cetak. Jadi saat dicetak atau dijadikan PDF, catatan itu tidak ikut - kontrabon yang sampai ke customer tetap bersih.",
      "Jangan dihapus. Kalau ragu, coba Print Preview di Excel, catatan itu tidak akan kelihatan.",
    ],
    keywords: ["merah", "peringatan", "warning", "periksa kembali", "cetak", "print"],
  },
  {
    id: "kembali-tanggal",
    question: "Kolom Kembali Tanggal wajib diisi?",
    answer: [
      "Tidak wajib. Kosongkan saja kalau belum tahu kapan dokumennya kembali.",
      'Kalau diisi, tanggalnya muncul di dokumen sebagai "Kembali Tanggal : 25/09/2026".',
    ],
    keywords: ["kembali", "opsional", "wajib"],
  },
  {
    id: "ubah-template",
    question: "Mau ganti rekening / nama penandatangan / logo",
    answer: [
      "Semua itu tidak diatur dari website ini, melainkan dari file template Excel-nya.",
      "Perubahan template harus dilakukan oleh yang mengelola aplikasi ini, lalu di-deploy ulang supaya ikut terpakai.",
      "Hubungi lewat tombol WhatsApp di bawah, sebutkan apa yang mau diubah.",
    ],
    keywords: ["rekening", "bank", "herlina", "tanda tangan", "logo", "template", "ubah"],
  },
  {
    id: "keamanan",
    question: "File ECOUNT saya ikut terkirim ke internet?",
    answer: [
      "Tidak. File ECOUNT dibaca langsung di dalam browser Bapak/Ibu, tidak pernah diunggah ke server.",
      "Yang dikirim ke server hanya baris invoice yang dicentang, untuk diisikan ke template. Daftar penjualan selebihnya tidak ikut ke mana-mana.",
    ],
    keywords: ["aman", "privasi", "data", "server", "upload", "internet"],
  },
];

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Kata-kata yang terlalu umum untuk dijadikan penentu kecocokan. Tanpa daftar
 * ini, pertanyaan di luar topik seperti "bagaimana cuaca besok" akan dijawab
 * percaya diri hanya karena kata "bagaimana" kebetulan ada di salah satu judul.
 */
const STOPWORDS = new Set([
  "apa", "apakah", "bagaimana", "gimana", "kenapa", "mengapa", "kok", "yang",
  "untuk", "dari", "dengan", "saya", "aku", "kami", "itu", "ini", "bisa",
  "tidak", "tak", "gak", "nggak", "ada", "dan", "atau", "pada", "jika",
  "kalau", "saat", "sudah", "belum", "mau", "ingin", "tolong", "mohon",
  "cara", "harus", "akan", "juga", "saja", "lagi", "dong", "nya", "kah",
]);

export interface TopicMatch {
  topic: HelpTopic;
  score: number;
}

/**
 * Skor minimal supaya sebuah topik langsung dijawab tanpa bertanya balik.
 * Di bawah ini, kandidatnya hanya ditawarkan sebagai pilihan.
 */
export const CONFIDENT_SCORE = 6;

/**
 * Cari topik yang paling cocok dengan apa yang diketik user.
 *
 * Judul dan kata kunci diberi bobot lebih besar daripada isi jawaban, supaya
 * ketikan seperti "usd" tidak kalah oleh topik lain yang kebetulan menyebut
 * kata itu di tengah penjelasan. Hasilnya dibatasi 3 teratas, terurut dari
 * yang paling cocok.
 */
export function findTopics(query: string): TopicMatch[] {
  const q = normalize(query);
  if (!q) return [];
  const words = q
    .split(" ")
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));

  // Bonus "seluruh kalimat cocok" hanya berlaku untuk ketikan dengan minimal
  // dua kata berarti. Kalau tidak, satu kata umum seperti "invoice" akan
  // dijawab percaya diri padahal cocok untuk banyak topik sekaligus.
  const phraseBonus = words.length >= 2;

  return HELP_TOPICS.map((topic) => {
    const head = normalize([topic.question, ...(topic.keywords ?? [])].join(" "));
    const body = normalize(topic.answer.join(" "));
    let score = 0;
    if (phraseBonus && head.includes(q)) score += 10;
    if (phraseBonus && body.includes(q)) score += 4;
    for (const w of words) {
      if (head.includes(w)) score += 3;
      if (body.includes(w)) score += 1;
    }
    return { topic, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}
