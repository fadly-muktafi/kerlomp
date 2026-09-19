import type { Metadata } from "next";
import { getMyGroups } from "@/lib/data/groups";
import { getMyTasks } from "@/lib/data/tasks";
import { CreateGroupForm } from "@/components/features/groups/create-group-form";
import { GroupList } from "@/components/features/groups/group-list";
import { MyTaskList } from "@/components/features/tasks/my-task-list";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const [groups, myTasks] = await Promise.all([getMyGroups(), getMyTasks()]);

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-3">
        <h1 className="font-display text-h1 font-bold text-ink">Tugasku</h1>
        <MyTaskList tasks={myTasks} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-h2 text-ink">Grup kamu</h2>
        <GroupList groups={groups} />
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="font-display text-h2 text-ink">Buat grup baru</h3>
        <CreateGroupForm />
      </section>
    </div>
  );
}