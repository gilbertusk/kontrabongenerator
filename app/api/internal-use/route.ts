import { NextRequest, NextResponse } from "next/server";
import { buildInternalUseFile } from "@/lib/buildInternalUse";
import { validateInternalUseRequest } from "@/lib/internalUse";

export const runtime = "nodejs";

/** Buang karakter yang tidak boleh ada di nama file, spasi tetap dipertahankan. */
function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|\r\n]+/g, "_").slice(0, 150);
}

/**
 * POST { tanggal: "YYYY-MM-DD", picCode, rows: [{ itemCode, qty }] }
 * -> file .xlsx template upload ECOUNT "Internal Use" yang sudah terisi.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body bukan JSON valid." }, { status: 400 });
  }

  const checked = validateInternalUseRequest(body);
  if (!checked.ok) {
    return NextResponse.json({ error: checked.error }, { status: 400 });
  }

  try {
    const { buffer, filename } = await buildInternalUseFile(checked.value);
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
    console.error("Gagal generate Internal Use free qty:", err);
    return NextResponse.json(
      { error: "Gagal membuat file Internal Use. Coba lagi." },
      { status: 500 }
    );
  }
}
