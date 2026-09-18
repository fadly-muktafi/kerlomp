import type { Metadata } from "next";
import { getMyGroups } from "@/lib/data/groups";
import { CreateGroupForm } from "@/components/features/groups/create-group-form";
import { GroupList } from "@/components/features/groups/group-list";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const groups = await getMyGroups();

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-3">
        <h1 className="font-display text-h1 font-bold text-ink">Grup kamu</h1>
        <GroupList groups={groups} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-h2 text-ink">Buat grup baru</h2>
        <CreateGroupForm />
      </section>
    </div>
  );
}