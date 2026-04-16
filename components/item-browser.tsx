"use client";

import { SearchIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatDepartmentName, formatStock } from "@/lib/inventory/format";
import type { ItemWithRelations } from "@/lib/inventory/types";
import { cn } from "@/lib/utils";

type BrowserTab = {
  id: string;
  label: string;
  count: number;
};

export function ItemBrowser({
  query,
  onQueryChange,
  items,
  selectedItemId,
  onSelectItem,
  getBatchQuantity,
  headerAction,
  tabs,
  activeTab,
  onTabChange,
  disabled,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  items: ItemWithRelations[];
  selectedItemId: string | null;
  onSelectItem: (itemId: string) => void;
  getBatchQuantity: (itemId: string) => number;
  headerAction?: React.ReactNode;
  tabs?: BrowserTab[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  disabled?: boolean;
}) {
  return (
    <>
      <div className="flex items-center gap-3 border-b border-border px-4 py-4 sm:px-5">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search items"
            className="pl-9"
          />
        </div>
        {headerAction}
      </div>

      {tabs && activeTab && onTabChange ? (
        <div className="flex flex-wrap gap-2 border-b border-border px-4 py-3 sm:px-5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
                activeTab === tab.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:bg-muted",
              )}
            >
              <span>{tab.label}</span>
              <span className="rounded-full bg-black/8 px-2 py-0.5 text-xs">
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto p-4 sm:p-5">
        <div className="flex flex-col gap-3">
          {items.map((item) => {
            const pendingQuantity = getBatchQuantity(item.id);

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => !disabled && onSelectItem(item.id)}
                disabled={disabled}
                className={cn(
                  "flex w-full flex-col gap-3 rounded-2xl border p-4 text-left transition-colors",
                  disabled
                    ? "cursor-not-allowed opacity-70"
                    : "hover:bg-muted/60",
                  selectedItemId === item.id
                    ? "border-primary bg-primary/6"
                    : "border-border bg-background",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{item.name}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {item.id}
                    </p>
                  </div>
                  <Badge variant={item.low_stock ? "warning" : "success"}>
                    {formatStock(item.current_stock, item.unit)}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">
                    {formatDepartmentName(item.department)}
                  </Badge>
                  <Badge variant="outline">
                    Min {formatStock(item.minimum_stock, item.unit)}
                  </Badge>
                  {pendingQuantity > 0 ? (
                    <Badge variant="outline">
                      In batch {formatStock(pendingQuantity, item.unit)}
                    </Badge>
                  ) : null}
                </div>
              </button>
            );
          })}
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No items match this search.
            </p>
          ) : null}
        </div>
      </div>
    </>
  );
}
