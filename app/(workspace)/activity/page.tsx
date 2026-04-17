import { ActivityPage } from "@/components/activity/activity-page";
import { listRecentMovements } from "@/lib/inventory/service";

export default async function ActivityRoute() {
  const [checkoutMovements, stockInMovements] = await Promise.all([
    listRecentMovements("checkout"),
    listRecentMovements("stock_in"),
  ]);

  return (
    <ActivityPage
      checkoutMovements={checkoutMovements}
      stockInMovements={stockInMovements}
    />
  );
}
