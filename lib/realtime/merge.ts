/**
 * Merge event Realtime ke daftar lokal.
 * `getStamp` dipakai sebagai watermark: update lama tidak boleh menimpa yang lebih baru.
 */
export function upsertById<T extends { id: string }>(
  list: T[],
  row: T,
  getStamp?: (item: T) => string,
): T[] {
  const index = list.findIndex((item) => item.id === row.id);
  if (index === -1) {
    return [...list, row];
  }
  if (getStamp && getStamp(row) <= getStamp(list[index])) {
    return list;
  }
  const next = list.slice();
  next[index] = row;
  return next;
}

export function removeById<T extends { id: string }>(list: T[], id: string): T[] {
  return list.filter((item) => item.id !== id);
}