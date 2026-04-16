import type { DepartmentWithCount, ItemWithRelations } from "@/lib/inventory/types";

export type DepartmentTab = "all" | "others" | string;

export function getItemsForTab(items: ItemWithRelations[], activeTab: DepartmentTab) {
  if (activeTab === "all") {
    return items;
  }

  if (activeTab === "others") {
    return items.filter((item) => item.department_id === null);
  }

  return items.filter((item) => item.department_id === activeTab);
}

export function filterItems(items: ItemWithRelations[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return items;
  }

  return items.filter((item) => {
    return (
      item.name.toLowerCase().includes(normalizedQuery) ||
      item.id.toLowerCase().includes(normalizedQuery) ||
      item.description?.toLowerCase().includes(normalizedQuery)
    );
  });
}

export function getDepartmentTabs(departments: DepartmentWithCount[]) {
  return [
    { id: "all", label: "All", count: departments.reduce((sum, department) => sum + department.item_count, 0) },
    ...departments.map((department) => ({
      id: department.id,
      label: department.name,
      count: department.item_count,
    })),
    {
      id: "others",
      label: "Others",
      count: 0,
    },
  ];
}

export function getRemainingStock(currentStock: number, quantityAlreadyAdded: number) {
  return Math.max(0, currentStock - quantityAlreadyAdded);
}
