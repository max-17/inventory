"use client";

import { MinusIcon, PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatUnit } from "@/lib/inventory/format";
import type { Unit } from "@/lib/inventory/types";
import { cn } from "@/lib/utils";

export function QuantityStepper({
  value,
  unit,
  min = 0,
  max,
  step = 1,
  onChange,
  className,
}: {
  value: number;
  unit: Unit;
  min?: number;
  max?: number;
  step?: number;
  onChange: (nextValue: number) => void;
  className?: string;
}) {
  const nextDown = Math.max(min, value - step);
  const nextUp = Math.min(max ?? Number.POSITIVE_INFINITY, value + step);
  const downDisabled = value <= min;
  const upDisabled = typeof max === "number" ? value >= max : false;

  return (
    <div
      className={cn(
        "inline-flex h-16 w-full items-center justify-between rounded-[1.75rem] border border-border bg-background px-3 shadow-xs",
        className,
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-lg"
        className="rounded-full"
        onClick={() => onChange(nextDown)}
        disabled={downDisabled}
        aria-label="Decrease quantity"
      >
        <MinusIcon />
      </Button>
      <div className="flex min-w-0 items-baseline justify-center gap-2 px-4 text-center">
        <span className="text-4xl font-medium tracking-tight">{value}</span>
        <span className="text-sm text-muted-foreground">{formatUnit(unit)}</span>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-lg"
        className="rounded-full"
        onClick={() => onChange(nextUp)}
        disabled={upDisabled}
        aria-label="Increase quantity"
      >
        <PlusIcon />
      </Button>
    </div>
  );
}
