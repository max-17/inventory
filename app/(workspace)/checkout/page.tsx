import { CheckoutUserPage } from "@/components/checkout/checkout-user-page";
import { getUsers } from "@/lib/inventory/service";

export default async function CheckoutRoute() {
  const users = await getUsers();

  return <CheckoutUserPage users={users} />;
}
