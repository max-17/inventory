import { ArrowDownLeftIcon, ArrowUpRightIcon, Clock3Icon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatMovementType, formatStock } from "@/lib/inventory/format";
import type { ItemMovementRecord } from "@/lib/inventory/types";

function ActivityList({
  title,
  description,
  movements,
}: {
  title: string;
  description: string;
  movements: ItemMovementRecord[];
}) {
  return (
    <Card className="rounded-[2rem]">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {movements.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-muted/20 px-5 py-10 text-center text-sm text-muted-foreground">
            No activity yet.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {movements.map((movement) => {
              const isStockIn = movement.movement_type === "stock_in";
              const MovementIcon = isStockIn
                ? ArrowDownLeftIcon
                : ArrowUpRightIcon;

              return (
                <div
                  key={movement.id}
                  className="flex flex-col gap-4 rounded-3xl border border-border bg-background px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-start gap-4">
                    <div
                      className={
                        isStockIn
                          ? "flex size-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700"
                          : "flex size-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700"
                      }
                    >
                      <MovementIcon className="size-5" />
                    </div>
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium">{movement.item.name}</p>
                        <Badge
                          variant={isStockIn ? "success" : "warning"}
                          className="rounded-full"
                        >
                          {formatMovementType(movement.movement_type)}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span>{movement.item_id}</span>
                        <span>{movement.performer?.full_name ?? "Unknown operator"}</span>
                        <span>{new Date(movement.created_at).toLocaleString("en-GB")}</span>
                      </div>
                      {movement.note ? (
                        <p className="text-sm text-muted-foreground">{movement.note}</p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <Badge variant="outline" className="rounded-full px-3 py-1">
                      {formatStock(movement.quantity, movement.unit)}
                    </Badge>
                    {movement.reference ? (
                      <Badge variant="outline" className="rounded-full px-3 py-1">
                        Ref {movement.reference}
                      </Badge>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ActivityPage({
  checkoutMovements,
  stockInMovements,
}: {
  checkoutMovements: ItemMovementRecord[];
  stockInMovements: ItemMovementRecord[];
}) {
  const allMovements = [...checkoutMovements, ...stockInMovements].sort(
    (left, right) =>
      new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
  );

  return (
    <div className="space-y-6">
      <Card className="rounded-[2rem] border-border/80 bg-background/90">
        <CardHeader className="gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <Badge variant="outline" className="w-fit rounded-full">
              Activity
            </Badge>
            <CardTitle className="text-2xl">Stock movement history</CardTitle>
            <CardDescription>
              Review recent checkout and stock-in activity across the workspace.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="rounded-2xl border border-border bg-muted/20 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Total events
              </p>
              <p className="mt-1 text-2xl font-semibold">{allMovements.length}</p>
            </div>
            <div className="rounded-2xl border border-border bg-muted/20 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Checkouts
              </p>
              <p className="mt-1 text-2xl font-semibold">{checkoutMovements.length}</p>
            </div>
            <div className="rounded-2xl border border-border bg-muted/20 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Stock-ins
              </p>
              <p className="mt-1 text-2xl font-semibold">{stockInMovements.length}</p>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <ActivityList
          title="All activity"
          description="Newest stock movements first."
          movements={allMovements}
        />

        <Card className="rounded-[2rem]">
          <CardHeader>
            <CardTitle>Latest event</CardTitle>
            <CardDescription>
              The most recent stock movement recorded in the system.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {allMovements[0] ? (
              <div className="rounded-3xl border border-border bg-muted/20 p-5">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-2xl bg-background">
                    <Clock3Icon className="size-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">{allMovements[0].item.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatMovementType(allMovements[0].movement_type)} by{" "}
                      {allMovements[0].performer?.full_name ?? "Unknown operator"}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant="outline" className="rounded-full px-3 py-1">
                    {formatStock(allMovements[0].quantity, allMovements[0].unit)}
                  </Badge>
                  <Badge variant="outline" className="rounded-full px-3 py-1">
                    {new Date(allMovements[0].created_at).toLocaleString("en-GB")}
                  </Badge>
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-border bg-muted/20 px-5 py-10 text-center text-sm text-muted-foreground">
                No activity yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
