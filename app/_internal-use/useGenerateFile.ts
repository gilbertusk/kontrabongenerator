import { useState } from "react";
import { readApiError, saveResponseAsFile } from "../downloadFile";

/** POST ke endpoint pembuat file, lalu simpan hasilnya ke komputer user. */
export function useGenerateFile() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  function clearMessages() {
    setErrorMsg("");
    setSuccessMsg("");
  }

  async function generate(url: string, body: unknown, fallbackName: string) {
    clearMessages();
    setIsGenerating(true);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await readApiError(res));

      const filename = await saveResponseAsFile(res, fallbackName);
      setSuccessMsg(`"${filename}" dibuat. Periksa dulu sebelum di-upload ke ECOUNT.`);
    } catch (e) {
      console.error(e);
      setErrorMsg(e instanceof Error ? e.message : "Terjadi kesalahan.");
    } finally {
      setIsGenerating(false);
    }
  }

  return { isGenerating, errorMsg, successMsg, setErrorMsg, clearMessages, generate };
}
