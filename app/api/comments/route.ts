import { NextResponse } from "next/server";
import { getTaskComments } from "@/lib/data/comments";

/** Komentar satu tugas untuk subscriber realtime (member via RLS, guest via cookie). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const subTaskId = url.searchParams.get("subTaskId") ?? "";

  const comments = await getTaskComments(subTaskId);
  if (comments === null) {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  return NextResponse.json({ comments });
}