import { describe, expect, test } from "bun:test";

import {
  applyCheckoutCore,
  applyStockInCore,
  createDepartmentCore,
  createInventorySnapshot,
  createItemCore,
  InventoryError,
} from "@/lib/inventory/core";
import { filterItems, getItemsForTab, getRemainingStock } from "@/lib/inventory/selectors";
import type { InventoryDatabase } from "@/lib/inventory/types";

function makeDb(): InventoryDatabase {
  const now = "2026-04-16T08:00:00.000Z";

  return {
    departments: [
      { id: "dept-1", name: "Mechanical", code: "MEC", created_at: now, updated_at: now },
    ],
    users: [
      {
        id: "user-1",
        full_name: "Operator",
        role: "operator",
        badge_code: "B1",
        department_id: "dept-1",
        created_at: now,
        updated_at: now,
      },
    ],
    items: [
      {
        id: "ITEM-1",
        name: "Bearing",
        unit: "count",
        current_stock: 5,
        minimum_stock: 2,
        department_id: "dept-1",
        description: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: "ITEM-2",
        name: "Bolt set",
        unit: "count",
        current_stock: 3,
        minimum_stock: 1,
        department_id: null,
        description: null,
        created_at: now,
        updated_at: now,
      },
    ],
    stock_movements: [],
  };
}

describe("inventory core", () => {
  test("creates a department", () => {
    const db = makeDb();
    const department = createDepartmentCore(db, { name: "Electrical", code: "ELC" });

    expect(department.name).toBe("Electrical");
    expect(db.departments).toHaveLength(2);
  });

  test("rejects duplicate item id", () => {
    const db = makeDb();

    expect(() =>
      createItemCore(db, {
        id: "ITEM-1",
        name: "Duplicate",
        unit: "count",
        current_stock: 0,
        minimum_stock: 0,
      }),
    ).toThrow(InventoryError);
  });

  test("others logic works for null department_id", () => {
    const db = makeDb();
    const snapshot = createInventorySnapshot(db);
    const otherItems = getItemsForTab(snapshot.items, "others");

    expect(otherItems).toHaveLength(1);
    expect(otherItems[0]?.id).toBe("ITEM-2");
  });

  test("search filters by name and id", () => {
    const db = makeDb();
    const snapshot = createInventorySnapshot(db);

    expect(filterItems(snapshot.items, "bearing")).toHaveLength(1);
    expect(filterItems(snapshot.items, "item-2")).toHaveLength(1);
  });

  test("stock-in increases current stock by delta", () => {
    const db = makeDb();
    applyStockInCore(db, { item_id: "ITEM-1", quantity: 4, performed_by_user_id: "user-1" });

    expect(db.items[0]?.current_stock).toBe(9);
    expect(db.stock_movements.at(-1)?.movement_type).toBe("stock_in");
  });

  test("checkout decreases current stock", () => {
    const db = makeDb();
    applyCheckoutCore(db, {
      performed_by_user_id: "user-1",
      lines: [{ item_id: "ITEM-1", quantity: 2 }],
    });

    expect(db.items[0]?.current_stock).toBe(3);
    expect(db.stock_movements.at(-1)?.movement_type).toBe("checkout");
  });

  test("checkout rejects overselling", () => {
    const db = makeDb();

    expect(() =>
      applyCheckoutCore(db, {
        performed_by_user_id: "user-1",
        lines: [{ item_id: "ITEM-1", quantity: 7 }],
      }),
    ).toThrow(InventoryError);
  });

  test("remaining stock for checkout respects cart quantity", () => {
    expect(getRemainingStock(10, 4)).toBe(6);
    expect(getRemainingStock(10, 12)).toBe(0);
  });
});
