"use client";

import {
  createContext,
  useContext,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { removeById, upsertById } from "@/lib/realtime/merge";
import type { Database } from "@/lib/supabase/types";
import type { CommentView } from "@/lib/data/comments";
import type { SubmissionView, TaskView } from "@/lib/data/groups";

type SubTaskRow = Database["public"]["Tables"]["sub_tasks"]["Row"];
type CommentRow = Database["public"]["Tables"]["comments"]["Row"];

export type RealtimeStatus = "connecting" | "connected" | "offline";

type RealtimeValue = {
  tasks: TaskView[];
  status: RealtimeStatus;
  patchTask: (id: string, patch: Partial<TaskView>) => void;
  comments: CommentView[] | null;
  addCommentLocally: (comment: CommentView) => void;
  removeCommentLocally: (id: string) => void;
  broadcastChange: (kind: "comments" | "tasks" | "members") => void;
};

const RealtimeContext = createContext<RealtimeValue | null>(null);

const STATUS_MAP: Record<string, RealtimeStatus> = {
  SUBSCRIBED: "connected",
  CHANNEL_ERROR: "offline",
  TIMED_OUT: "offline",
  CLOSED: "offline",
};

/**
 * Versi daftar untuk deteksi perubahan hasil server render (router.refresh).
 * Memakai panjang + id maksimum + timestamp maksimum, bukan referensi array,
 * agar refresh yang datanya sama tidak menimpa state.
 */
function listVersion<T extends { id: string }>(
  list: T[],
  stamp: (item: T) => string,
): string {
  let maxStamp = "";
  let maxId = "";
  for (const item of list) {
    const itemStamp = stamp(item);
    if (itemStamp > maxStamp) maxStamp = itemStamp;
    if (item.id > maxId) maxId = item.id;
  }
  return `${list.length}:${maxId}:${maxStamp}`;
}

function toTaskView(
  row: SubTaskRow,
  submission: SubmissionView | null,
): TaskView {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    assigneeId: row.assignee_id,
    status: row.status,
    deadline: row.deadline,
    updatedAt: row.updated_at,
    // Payload realtime sub_tasks tidak memuat relasi submissions; pertahankan
    // data submission yang sudah ada di state (di-refresh lewat router.refresh).
    submission,
  };
}

/**
 * Satu channel manager per grup (RULES.md §7). Tidak ada subscribe di komponen lain.
 * `live` mengaktifkan postgres_changes (butuh JWT, member saja).
 * `broadcast` mengaktifkan listener sinyal "data changed" dari server via
 * realtime.send() (tanpa JWT, dipakai guest untuk refetch via API).
 * `subTaskId` mengaktifkan realtime komentar untuk satu tugas.
 */
export function RealtimeProvider({
  groupId,
  initialTasks,
  subTaskId,
  initialComments = null,
  live = true,
  broadcast = false,
  children,
}: {
  groupId: string;
  initialTasks: TaskView[];
  subTaskId?: string;
  initialComments?: CommentView[] | null;
  live?: boolean;
  broadcast?: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState<TaskView[]>(initialTasks);
  const [status, setStatus] = useState<RealtimeStatus>(
    live || broadcast ? "connecting" : "offline",
  );
  const [commentsState, setCommentsState] = useState<CommentView[] | null>(
    initialComments,
  );
  const firstSubscribe = useRef(true);
  const commentsRef = useRef<CommentView[] | null>(initialComments);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Sinkron hasil router.refresh(): server render ulang mengirim initialTasks/
  // initialComments baru, tetapi state client hanya di-seed sekali. Tanpa ini,
  // komentar/status dari orang lain tidak pernah tampil (harus F5).
  // Pola "adjusting state when props change": setState saat render.
  const tasksVersion = listVersion(initialTasks, (task) => task.updatedAt);
  const commentsVersion = initialComments
    ? listVersion(initialComments, (comment) => comment.createdAt)
    : null;
  const [seenTasksVersion, setSeenTasksVersion] = useState(tasksVersion);
  const [seenCommentsVersion, setSeenCommentsVersion] =
    useState(commentsVersion);

  if (tasksVersion !== seenTasksVersion) {
    setSeenTasksVersion(tasksVersion);
    setTasks(initialTasks);
  }
  if (initialComments && commentsVersion !== seenCommentsVersion) {
    setSeenCommentsVersion(commentsVersion);
    setCommentsState(initialComments);
  }

  // Ref dijaga sinkron di effect (bukan render) supaya handler realtime
  // selalu membaca daftar komentar terkini (advanced-use-latest).
  useEffect(() => {
    commentsRef.current = commentsState;
  }, [commentsState]);

  function setComments(next: CommentView[] | ((prev: CommentView[]) => CommentView[])) {
    const value =
      typeof next === "function" ? next(commentsRef.current ?? []) : next;
    commentsRef.current = value;
    setCommentsState(value);
  }

  function addCommentLocally(comment: CommentView) {
    if (!commentsRef.current) return;
    setComments((prev) => upsertById(prev, comment));
  }

  function removeCommentLocally(id: string) {
    setComments((prev) => removeById(prev, id));
  }

  /** Pemicu sinyal untuk klien lain (termasuk guest tanpa JWT). */
  function broadcastChange(kind: "comments" | "tasks" | "members") {
    const channel = channelRef.current;
    if (!channel) return;
    channel
      .send({
        type: "broadcast",
        event: "data_change",
        payload: { kind },
      })
      .catch(() => {
        // Channel belum join; klien lain tetap dapat postgres_changes.
      });
  }

  // Handler realtime dibaca terkini via useEffectEvent, jadi deps effect bersih
  // dan tidak ada resubscribe saat fungsi handler berubah (advanced-use-latest).
  const onSubTaskChange = useEffectEvent((payload: { eventType: string; new: unknown; old: unknown }) => {
    if (payload.eventType === "DELETE") {
      const oldId = (payload.old as { id?: string }).id;
      if (oldId) setTasks((prev) => removeById(prev, oldId));
      return;
    }
    const row = payload.new as SubTaskRow;
    setTasks((prev) => {
      const existing = prev.find((task) => task.id === row.id);
      const next = toTaskView(row, existing?.submission ?? null);
      return upsertById(prev, next, (task) => task.updatedAt);
    });
  });

  const onMembersChange = useEffectEvent(() => {
    // MemberView butuh join profil; cukup minta server render ulang.
    router.refresh();
  });

  async function refreshComments() {
    if (!subTaskId) return;
    try {
      const response = await fetch(
        `/api/comments?subTaskId=${encodeURIComponent(subTaskId)}`,
      );
      if (!response.ok) return;
      const body = (await response.json()) as {
        comments?: CommentView[] | null;
      };
      console.debug(
        "[kerlomp-rt]",
        new Date().toISOString().slice(11, 23),
        "refresh isi",
        JSON.stringify(body.comments)?.slice(0, 300),
      );
      if (Array.isArray(body.comments)) {
        setComments(body.comments);
      }
    } catch {
      // Jaringan gagal; realtime reconnect akan mencoba lagi.
    }
  }

  // Sinyal "data changed" dari server (realtime.send via trigger DB).
  const onDataChange = useEffectEvent((kind: string) => {
    if (kind === "comments" && subTaskId) {
      void refreshComments();
      return;
    }
    router.refresh();
  });

  const onCommentChange = useEffectEvent((payload: { eventType: string; new: unknown; old: unknown }) => {
    if (payload.eventType === "DELETE") {
      const oldId = (payload.old as { id?: string }).id;
      if (oldId) removeCommentLocally(oldId);
      return;
    }
    const row = payload.new as CommentRow;
    // Komentar baru dari orang lain tidak punya nama di payload, jadi ambil
    // daftar komentar terbaru via API (bukan router.refresh yang harus F5 dulu).
    // Echo milik sendiri sudah ada di state.
    const known = (commentsRef.current ?? []).some(
      (comment) => comment.id === row.id,
    );
    if (known) {
      setComments((prev) =>
        prev.map((comment) =>
          comment.id === row.id ? { ...comment, body: row.body } : comment,
        ),
      );
    } else {
      void refreshComments();
    }
  });

  const onSubscribeState = useEffectEvent((state: string) => {
    setStatus(STATUS_MAP[state] ?? "offline");
    if (state === "SUBSCRIBED") {
      if (firstSubscribe.current) {
        firstSubscribe.current = false;
      } else {
        // Reconnect: tarik ulang komentar via API, bukan reload halaman.
        void refreshComments();
      }
    }
  });

  useEffect(() => {
    if (!live && !broadcast) return;

    let cancelled = false;
    const supabase = createClient();

    // Token sesi WAJIB terpasang SEBELUM join: kalau channel join duluan,
    // dia masuk sebagai anon dan postgres_changes tidak pernah dikirim (RLS).
    (async () => {
      if (live) {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (token) supabase.realtime.setAuth(token);
      }
      if (cancelled) return;

      const next = supabase.channel(`group:${groupId}`);

      if (live) {
        next
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "sub_tasks",
              filter: `group_id=eq.${groupId}`,
            },
            (payload) => {
              onSubTaskChange(payload);
            },
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "members",
              filter: `group_id=eq.${groupId}`,
            },
            () => {
              onMembersChange();
            },
          );

        if (subTaskId) {
          next.on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "comments",
              filter: `sub_task_id=eq.${subTaskId}`,
            },
            (payload) => {
              onCommentChange(payload);
            },
          );
        }
      }

      // Listener broadcast: member lain yang beraksi menyiarkan sinyal via
      // channel yang sama; guest (tanpa JWT) refetch via API.
      next.on("broadcast", { event: "data_change" }, (message) => {
        const kind = (message.payload as { kind?: string } | null)?.kind;
        onDataChange(kind ?? "all");
      });

      channelRef.current = next;
      next.subscribe((state) => {
        onSubscribeState(state);
      });
    })();

    return () => {
      cancelled = true;
      channelRef.current = null;
      void supabase.removeChannel(supabase.channel(`group:${groupId}`));
    };
  }, [groupId, subTaskId, live, broadcast]);

  function patchTask(id: string, patch: Partial<TaskView>) {
    setTasks((prev) =>
      prev.map((task) => (task.id === id ? { ...task, ...patch } : task)),
    );
  }

  return (
    <RealtimeContext.Provider
      value={{
        tasks,
        status,
        patchTask,
        comments: commentsState,
        addCommentLocally,
        removeCommentLocally,
        broadcastChange,
      }}
    >
      {children}
    </RealtimeContext.Provider>
  );
}

export function useGroupRealtime(): RealtimeValue {
  const value = useContext(RealtimeContext);
  if (!value) {
    throw new Error("useGroupRealtime harus dipakai di dalam RealtimeProvider");
  }
  return value;
}
