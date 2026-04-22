import { notFound } from "next/navigation";

import { InventoryPage } from "@/components/inventory/inventory-page";
import { getInventorySnapshot, getUsers } from "@/lib/inventory/service";

export default async function InventoryUserRoute({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const [snapshot, users] = await Promise.all([
    getInventorySnapshot(),
    getUsers(),
  ]);

  const selectedUser = users.find((user) => user.id === userId) ?? null;

  if (!selectedUser) {
    notFound();
  }

  return <InventoryPage initialSnapshot={snapshot} selectedUser={selectedUser} />;
}
