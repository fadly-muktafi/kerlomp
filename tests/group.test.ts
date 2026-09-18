import { describe, expect, it } from "vitest";
import { formatDate } from "@/lib/format";
import { createGroupSchema, guestNameSchema } from "@/lib/validation/group";

describe("createGroupSchema", () => {
  it("menerima input minimal dan mengosongkan opsional", () => {
    const result = createGroupSchema.safeParse({
      name: "Grup A",
      description: "",
      deadline: "",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Grup A");
      expect(result.data.description).toBeUndefined();
      expect(result.data.deadline).toBeUndefined();
    }
  });

  it("menolak nama kosong", () => {
    const result = createGroupSchema.safeParse({
      name: "   ",
      description: "",
      deadline: "",
    });
    expect(result.success).toBe(false);
  });

  it("menolak deadline yang tidak bisa diparse", () => {
    const result = createGroupSchema.safeParse({
      name: "Grup",
      description: "",
      deadline: "bukan-tanggal",
    });
    expect(result.success).toBe(false);
  });
});

describe("guestNameSchema", () => {
  it("memangkas spasi di ujung", () => {
    expect(guestNameSchema.parse("  Rani ")).toBe("Rani");
  });

  it("menolak nama kosong", () => {
    expect(guestNameSchema.safeParse("   ").success).toBe(false);
    expect(guestNameSchema.safeParse("").success).toBe(false);
  });
});

describe("formatDate", () => {
  it("menghasilkan tanggal berisi tahun", () => {
    expect(formatDate("2026-09-18T12:00:00.000Z")).toContain("2026");
  });
});