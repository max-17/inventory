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

  function clampToLimit(nextQuantity: number) {
    if (!enforceStockLimit || currentStock === undefined) {
      return nextQuantity;
    }

    return Math.min(nextQuantity, currentStock);
  }

  return (
    <div className="relative mt-3 flex items-end justify-between gap-3 rounded-2xl border border-border bg-muted/30 p-3">
      <Button
        variant="destructive"
        size="icon-xs"
        className="absolute -top-3 -right-3 z-2 rounded-full border border-border bg-background text-destructive shadow-sm hover:bg-destructive/14 hover:text-destructive"
        onClick={() => onQuantityChange(itemId, 0)}
      >
        <XIcon />
        <span className="sr-only">Remove</span>
      </Button>

      <div className="min-w-0 mb-auto">
        <p className="truncate text-lg">{name}</p>
        <p className="truncate text-sm text-muted-foreground">{itemId}</p>
      </div>

      <div className="flex flex-col items-stretch gap-4 rounded-3xl border border-border bg-background p-2">
        <div className="flex items-center justify-between">
          <Button
            variant="secondary"
            size="icon"
            className="size-9 rounded-full bg-red-200 text-bold text-lg hover:bg-red-400/50"
            onClick={() => onQuantityChange(itemId, quantity - 1)}
            aria-label="Decrease quantity"
          >
            -
          </Button>

          <div className="min-w-24 px-4 text-center text-sm font-medium">
            {formatStock(quantity, unit)}
          </div>

          <Button
            variant="secondary"
            size="icon"
            className="size-9 rounded-full bg-green-200 text-bold text-lg hover:bg-green-400/50"
            onClick={() => onQuantityChange(itemId, clampToLimit(quantity + 1))}
            disabled={isAtMax}
            aria-label="Increase quantity"
          >
            +
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Button
            type="button"
            variant="secondary"
            size="xs"
            className="rounded-full bg-muted px-3 hover:bg-muted/80"
            onClick={() => onQuantityChange(itemId, clampToLimit(quantity + 5))}
            disabled={isAtMax}
          >
            +5
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="xs"
            className="rounded-full bg-muted px-3 hover:bg-muted/80"
            onClick={() =>
              onQuantityChange(itemId, clampToLimit(quantity + 10))
            }
            disabled={isAtMax}
          >
            +10
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="xs"
            className="rounded-full bg-muted px-3 hover:bg-muted/80"
            onClick={() =>
              onQuantityChange(itemId, clampToLimit(quantity + 100))
            }
            disabled={isAtMax}
          >
            +100
          </Button>
        </div>
      </div>
    </div>
  );
}
