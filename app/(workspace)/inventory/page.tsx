import { InventoryUserPage } from "@/components/inventory/inventory-user-page";
import { getUsers } from "@/lib/inventory/service";

export default async function InventoryRoute() {
  const users = await getUsers();

  return <InventoryUserPage users={users} />;
}
