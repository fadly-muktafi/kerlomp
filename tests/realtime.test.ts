import { describe, expect, it } from "vitest";
import { removeById, upsertById } from "@/lib/realtime/merge";

type Row = { id: string; updated_at: string; value: number };

const stamp = (row: Row) => row.updated_at;

describe("upsertById", () => {
  const base: Row[] = [{ id: "a", updated_at: "2026-01-01T00:00:00Z", value: 1 }];

  it("menambah baris baru", () => {
    const next = upsertById(base, {
      id: "b",
      updated_at: "2026-01-02T00:00:00Z",
      value: 2,
    });
    expect(next).toHaveLength(2);
    expect(next[1].id).toBe("b");
  });

  it("mengganti baris dengan watermark lebih baru", () => {
    const next = upsertById(
      base,
      { id: "a", updated_at: "2026-02-01T00:00:00Z", value: 9 },
      stamp,
    );
    expect(next[0].value).toBe(9);
  });

  it("mengabaikan update yang lebih lama (balik-urut)", () => {
    const next = upsertById(
      base,
      { id: "a", updated_at: "2025-12-01T00:00:00Z", value: 5 },
      stamp,
    );
    expect(next).toBe(base);
  });

  it("tidak memutasi array asal", () => {
    const copy = [...base];
    upsertById(base, { id: "a", updated_at: "2026-02-01T00:00:00Z", value: 9 }, stamp);
    expect(base).toEqual(copy);
  });
});

describe("removeById", () => {
  it("menghapus berdasarkan id", () => {
    const list: Row[] = [
      { id: "a", updated_at: "x", value: 1 },
      { id: "b", updated_at: "x", value: 2 },
    ];
    expect(removeById(list, "a")).toEqual([
      { id: "b", updated_at: "x", value: 2 },
    ]);
  });
});