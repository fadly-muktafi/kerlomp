"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { removeById, upsertById } from "@/lib/realtime/merge";
import type { Database } from "@/lib/supabase/types";
import type { SubmissionView, TaskView } from "@/lib/data/groups";

type SubTaskRow = Database["public"]["Tables"]["sub_tasks"]["Row"];

export type RealtimeStatus = "connecting" | "connected" | "offline";

type RealtimeValue = {
  tasks: TaskView[];
  status: RealtimeStatus;
  patchTask: (id: string, patch: Partial<TaskView>) => void;
};

const RealtimeContext = createContext<RealtimeValue | null>(null);

const STATUS_MAP: Record<string, RealtimeStatus> = {
  SUBSCRIBED: "connected",
  CHANNEL_ERROR: "offline",
  TIMED_OUT: "offline",
  CLOSED: "offline",
};

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
 * `live=false` untuk guest (tanpa JWT) supaya tidak mencoba realtime.
 */
export function RealtimeProvider({
  groupId,
  initialTasks,
  live = true,
  children,
}: {
  groupId: string;
  initialTasks: TaskView[];
  live?: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState<TaskView[]>(initialTasks);
  const [status, setStatus] = useState<RealtimeStatus>(
    live ? "connecting" : "offline",
  );
  const firstSubscribe = useRef(true);

  useEffect(() => {
    if (!live) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`group:${groupId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sub_tasks",
          filter: `group_id=eq.${groupId}`,
        },
        (payload) => {
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
          // MemberView butuh join profil; cukup minta server render ulang.
          router.refresh();
        },
      )
      .subscribe((state) => {
        setStatus(STATUS_MAP[state] ?? "offline");
        if (state === "SUBSCRIBED") {
          if (firstSubscribe.current) {
            firstSubscribe.current = false;
          } else {
            router.refresh();
          }
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [groupId, live, router]);

  function patchTask(id: string, patch: Partial<TaskView>) {
    setTasks((prev) =>
      prev.map((task) => (task.id === id ? { ...task, ...patch } : task)),
    );
  }

  return (
    <RealtimeContext.Provider value={{ tasks, status, patchTask }}>
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