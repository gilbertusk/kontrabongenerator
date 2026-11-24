/**
 * Pembantu di browser untuk endpoint yang mengembalikan file .xlsx.
 */

/** Pesan error dari respons API yang gagal (body `{ error }`). */
export async function readApiError(res: Response): Promise<string> {
  const body: { error?: string } = await res
    .json()
    .catch(() => ({} as { error?: string }));
  return body.error || `Gagal generate (status ${res.status}).`;
}

/** Simpan respons file ke komputer user; kembalikan nama file yang dipakai. */
export async function saveResponseAsFile(
  res: Response,
  fallbackName: string
): Promise<string> {
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match ? match[1] : fallbackName;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return filename;
}
