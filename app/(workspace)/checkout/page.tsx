import { CheckoutPage } from "@/components/checkout/checkout-page";
import { getInventorySnapshot, getUsers } from "@/lib/inventory/service";

export default async function CheckoutRoute() {
  const [snapshot, users] = await Promise.all([getInventorySnapshot(), getUsers()]);

  return <CheckoutPage initialSnapshot={snapshot} users={users} />;
}
