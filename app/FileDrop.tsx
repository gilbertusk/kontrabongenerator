"use client";

import { useRef, useState } from "react";

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

type Props = {
  title: string;
  /** nama file yang sedang dipakai; kosong = belum ada file */
  fileName: string;
  onFile: (file: File) => void;
};

/** Judul blok + kotak upload/drag file .xlsx di kolom kiri. */
export default function FileDrop({ title, fileName, onFile }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onFile(file);
    // boleh memilih file yang sama lagi (mis. setelah diperbaiki di Excel)
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  }

  const boxClass = fileName
    ? "filebox"
    : `dropzone${isDragging ? " dragging" : ""}`;

  return (
    <>
      <div className="block-head">
        <h2 className="block-title">{title}</h2>
        {fileName && (
          <button
            className="linkbtn accent"
            onClick={() => inputRef.current?.click()}
          >
            Ganti
          </button>
        )}
      </div>

      <div
        className={boxClass}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
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
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleInputChange}
        />
      </div>
    </>
  );
}
