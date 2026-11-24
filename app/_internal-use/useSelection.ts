import { useState } from "react";

/** Daftar id baris yang dicentang. */
export function useSelection() {
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectOnly(ids: Iterable<string>) {
    setSelectedIds(new Set(ids));
  }

  return { selectedIds, toggle, selectOnly };
}
