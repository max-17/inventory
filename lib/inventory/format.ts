import type { Department, ItemWithRelations, MovementType, Unit } from "@/lib/inventory/types";

export function formatUnit(unit: Unit) {
  switch (unit) {
    case "count":
      return "pcs";
    case "kg":
      return "kg";
    case "litre":
      return "L";
  }
}

export function formatStock(value: number, unit: Unit) {
  return `${value} ${formatUnit(unit)}`;
}

export function formatDepartmentName(department: Department | null) {
  return department?.name ?? "Others";
}

export function formatMovementType(type: MovementType) {
  return type === "stock_in" ? "Stock-in" : "Checkout";
}

export function isLowStock(item: ItemWithRelations) {
  return item.current_stock <= item.minimum_stock;
}
