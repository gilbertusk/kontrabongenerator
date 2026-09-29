import { NextRequest, NextResponse } from "next/server";
import {
  buildKontrabonFile,
  invoicesWithoutUsdAmount,
  Currency,
  KontrabonRowInput,
} from "@/lib/buildKontrabon";

export const runtime = "nodejs";

interface GenerateBody {
  kontrabonNo: string;
  tanggal: string; // "YYYY-MM-DD" dari input date
  kembaliTanggal?: string;
  customer: string;
  currency?: string;
  /** true = urutan manual dari user; `rows` dipakai apa adanya */
  keepOrder?: boolean;
  rows: KontrabonRowInput[];
}

/** Buang karakter yang tidak boleh ada di nama file, spasi tetap dipertahankan. */
function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|\r\n]+/g, "_").slice(0, 150);
}

/**
 * "YYYY-MM-DD" -> Date tengah malam waktu lokal server, tanpa konversi zona
 * waktu, supaya tanggal di Excel sama persis dengan yang dipilih di web.
 */
function parseDocumentDate(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return new Date(NaN);
  const [, yyyy, mm, dd] = m;
  const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  return date.getDate() === Number(dd) ? date : new Date(NaN);
}

export async function POST(req: NextRequest) {
  let body: GenerateBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body bukan JSON valid." }, { status: 400 });
  }

  if (!body.kontrabonNo || !body.customer) {
    return NextResponse.json(
      { error: "kontrabonNo dan customer wajib diisi." },
      { status: 400 }
    );
  }
  if (!Array.isArray(body.rows) || body.rows.length === 0) {
    return NextResponse.json(
      { error: "Pilih minimal 1 invoice untuk digenerate." },
      { status: 400 }
    );
  }

  const currency: Currency = body.currency === "USD" ? "USD" : "IDR";

  // Kontrabon USD memakai kolom "Total Foreign Currency Amount" dari ECOUNT.
  // Invoice yang kolom itu kosong hampir pasti invoice Rupiah yang salah pilih,
  // jadi lebih baik ditolak dengan pesan jelas daripada dicetak sebagai 0.
  if (currency === "USD") {
    const invalid = invoicesWithoutUsdAmount(body.rows);
    if (invalid.length > 0) {
      const sample = invalid
        .slice(0, 5)
        .map((r) => r.invoiceNo)
        .join(", ");
      const more = invalid.length > 5 ? `, dan ${invalid.length - 5} lainnya` : "";
      return NextResponse.json(
        {
          error:
            `${invalid.length} invoice tidak punya nilai USD ` +
            `(kolom "Total Foreign Currency Amount" kosong di file ECOUNT): ` +
            `${sample}${more}. Hilangkan centangnya, atau pilih mata uang Rupiah.`,
        },
        { status: 400 }
      );
    }
  }

  const tanggal = body.tanggal ? parseDocumentDate(body.tanggal) : new Date();
  if (isNaN(tanggal.getTime())) {
    return NextResponse.json({ error: "Tanggal tidak valid." }, { status: 400 });
  }

  try {
    const { buffer, filename } = await buildKontrabonFile({
      kontrabonNo: body.kontrabonNo,
      tanggal,
      kembaliTanggal: body.kembaliTanggal,
      customer: body.customer,
      currency,
      keepOrder: body.keepOrder === true,
      rows: body.rows,
    });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${sanitizeFilename(
          filename
        )}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  } catch (err) {
    console.error("Gagal generate kontrabon:", err);
    return NextResponse.json(
      { error: "Gagal generate file kontrabon. Coba lagi." },
      { status: 500 }
    );
  }
}
