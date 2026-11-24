const qtyFormat = new Intl.NumberFormat("id-ID");

/** 14021 -> "14.021" */
export function formatQty(n: number): string {
  return qtyFormat.format(n || 0);
}
