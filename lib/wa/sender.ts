import "server-only";
import { env, waEnabled } from "@/lib/env";

export interface ReminderPayload {
  taskTitle: string;
  groupName: string;
  deadline: string; // ISO
  window: "h1" | "h0";
}

export interface DeliveryResult {
  ok: boolean;
  provider: "meta" | "openwa";
  error?: string;
}

/**
 * Abstraksi provider WhatsApp (PRD §4.3, ARCHITECTURE.md §6).
 * Swap provider via WA_PROVIDER tanpa ubah kode caller.
 */
export interface WASender {
  sendReminder(to: string, payload: ReminderPayload): Promise<DeliveryResult>;
}

export function getWASender(): WASender | null {
  if (!waEnabled) return null;
  if (env.WA_PROVIDER === "meta") {
    // TODO(agent): implementasi Meta Cloud API di ./meta-cloud.ts
    throw new Error("Meta Cloud API sender belum diimplementasi (v1.2)");
  }
  // TODO(agent): implementasi OpenWA di ./openwa.ts (v1.2, anti-ban pacing)
  throw new Error("OpenWA sender belum diimplementasi (v1.2)");
}
