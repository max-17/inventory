import { XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatStock } from "@/lib/inventory/format";
import type { Unit } from "@/lib/inventory/types";

type BatchListItemProps = {
  itemId: string;
  name: string;
  unit: Unit;
  quantity: number;
  currentStock?: number;
  enforceStockLimit?: boolean;
  onQuantityChange: (itemId: string, quantity: number) => void;
};

export function BatchListItem({
  itemId,
  name,
  unit,
  quantity,
  currentStock,
  enforceStockLimit = true,
  onQuantityChange,
}: BatchListItemProps) {
  const isAtMax =
    enforceStockLimit && currentStock !== undefined
      ? quantity >= currentStock
      : false;

  return (
    <div className="relative mt-3 flex items-end justify-between gap-3 rounded-2xl border border-border bg-muted/30 p-4">
      <Button
        variant="destructive"
        size="icon-xs"
        className="absolute -top-3 -right-3 z-10 rounded-full border border-border bg-background text-destructive shadow-sm hover:bg-destructive/14 hover:text-destructive"
        onClick={() => onQuantityChange(itemId, 0)}
      >
        <XIcon />
        <span className="sr-only">Remove</span>
      </Button>

      <div className="min-w-0">
        <p className="truncate font-medium">{name}</p>
        <p className="truncate text-sm text-muted-foreground">{itemId}</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center rounded-full border border-border bg-background p-1">
          <Button
            variant="secondary"
            size="icon"
            className="size-9 rounded-full bg-muted hover:bg-muted/80"
            onClick={() => onQuantityChange(itemId, quantity - 1)}
          >
            -
          </Button>
          <div className="min-w-24 px-4 text-center text-sm font-medium">
            {formatStock(quantity, unit)}
          </div>
          <Button
            variant="secondary"
            size="icon"
            className="size-9 rounded-full bg-muted hover:bg-muted/80"
            onClick={() => onQuantityChange(itemId, quantity + 1)}
            disabled={isAtMax}
          >
            +
          </Button>
        </div>
      </div>
    </div>
  );
}
