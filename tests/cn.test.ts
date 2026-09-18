import { describe, expect, it } from "vitest";
import { cn } from "@/lib/cn";

describe("cn", () => {
  it("menggabungkan kelas truthy dan mengabaikan nilai falsy", () => {
    expect(cn("a", false, undefined, "b", null)).toBe("a b");
  });

  it("mengembalikan string kosong bila semua nilai falsy", () => {
    expect(cn()).toBe("");
  });
});