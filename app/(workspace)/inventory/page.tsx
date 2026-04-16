import { InventoryPage } from "@/components/inventory/inventory-page";
import { getInventorySnapshot, getUsers } from "@/lib/inventory/service";

export default async function InventoryRoute() {
  const [snapshot, users] = await Promise.all([getInventorySnapshot(), getUsers()]);

  return <InventoryPage initialSnapshot={snapshot} users={users} />;
}
