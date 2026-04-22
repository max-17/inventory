import { ActivityPage } from "@/components/activity/activity-page";
import {
  getInventorySnapshot,
  listRecentMovements,
} from "@/lib/inventory/service";

export default async function ActivityRoute() {
  const [checkoutMovements, stockInMovements, snapshot] = await Promise.all([
    listRecentMovements("checkout"),
    listRecentMovements("stock_in"),
    getInventorySnapshot(),
  ]);

  return (
    <ActivityPage
      checkoutMovements={checkoutMovements}
      stockInMovements={stockInMovements}
      snapshot={snapshot}
    />
  );
}
