import { notFound } from "next/navigation";

import { CheckoutPage } from "@/components/checkout/checkout-page";
import { getInventorySnapshot, getUsers } from "@/lib/inventory/service";

export default async function CheckoutUserRoute({
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

  return <CheckoutPage initialSnapshot={snapshot} selectedUser={selectedUser} />;
}
