"use client";

import { UserSelectionPage } from "@/components/user-selection-page";
import type { User } from "@/lib/inventory/types";

export function InventoryUserPage({ users }: { users: User[] }) {
  return (
    <UserSelectionPage
      users={users}
      title="Select user"
      description="Choose who is performing the stock-in operation before selecting items for the batch."
      basePath="inventory"
    />
  );
}
