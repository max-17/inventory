"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Trash2Icon } from "lucide-react";

import { checkoutAction } from "@/app/actions";
import { ItemBrowser } from "@/components/item-browser";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { formatStock } from "@/lib/inventory/format";
import { filterItems } from "@/lib/inventory/selectors";
import type { InventorySnapshot, Unit, User } from "@/lib/inventory/types";

type CartLine = {
  item_id: string;
  name: string;
  unit: Unit;
  quantity: number;
};

export function CheckoutPage({
  initialSnapshot,
  users,
}: {
  initialSnapshot: InventorySnapshot;
  users: User[];
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [query, setQuery] = useState("");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(
    initialSnapshot.items[0]?.id ?? null,
  );
  const [cart, setCart] = useState<CartLine[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const performedByUserId = selectedUserId ?? "";

  useEffect(() => {
    setSnapshot(initialSnapshot);
  }, [initialSnapshot]);

  const visibleItems = useMemo(
    () => filterItems(snapshot.items, query),
    [query, snapshot.items],
  );

  useEffect(() => {
    if (visibleItems.length === 0) {
      setSelectedItemId(null);
      return;
    }

    const stillVisible = visibleItems.some(
      (item) => item.id === selectedItemId,
    );
    if (!stillVisible) {
      setSelectedItemId(visibleItems[0]?.id ?? null);
    }
  }, [selectedItemId, visibleItems]);

  function getCartQuantity(itemId: string) {
    return cart.find((line) => line.item_id === itemId)?.quantity ?? 0;
  }

  function setCartLineQuantity(itemId: string, quantity: number) {
    const item = snapshot.items.find((entry) => entry.id === itemId);
    if (!item) {
      return;
    }

    const clampedQuantity = Math.max(0, Math.min(quantity, item.current_stock));
    setCart((current) => {
      const others = current.filter((line) => line.item_id !== itemId);
      if (clampedQuantity === 0) {
        return others;
      }

      return [
        ...others,
        {
          item_id: item.id,
          name: item.name,
          unit: item.unit,
          quantity: clampedQuantity,
        },
      ];
    });
  }

  function addItemToCart(itemId: string) {
    if (!selectedUserId) {
      setError("Please select a user before adding items to the batch.");
      return;
    }

    const item = snapshot.items.find((entry) => entry.id === itemId);
    if (!item) {
      return;
    }

    setSelectedItemId(itemId);
    setCartLineQuantity(itemId, getCartQuantity(itemId) + 1);
    setError(null);
  }

  function syncSnapshot(nextSnapshot: InventorySnapshot) {
    setSnapshot(nextSnapshot);

    if (selectedItemId) {
      const nextSelected =
        nextSnapshot.items.find((item) => item.id === selectedItemId) ?? null;
      if (!nextSelected) {
        setSelectedItemId(nextSnapshot.items[0]?.id ?? null);
      }
    }
  }

  function submitCheckout() {
    startTransition(async () => {
      const result = await checkoutAction({
        lines: cart.map((line) => ({
          item_id: line.item_id,
          quantity: line.quantity,
        })),
        performed_by_user_id: performedByUserId,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      syncSnapshot(result.data.snapshot);
      setCart([]);
      setError(null);
    });
  }

  return (
    <div className="min-h-[72vh]">
      <ResizablePanelGroup
        orientation="horizontal"
        className="min-h-[72vh] w-full"
      >
        <ResizablePanel defaultSize="50%" minSize="30%" className="min-w-0">
          <Card className="flex h-full w-full min-w-0 flex-col overflow-hidden">
            <ItemBrowser
              query={query}
              onQueryChange={setQuery}
              items={visibleItems}
              selectedItemId={selectedItemId}
              onSelectItem={addItemToCart}
              getBatchQuantity={getCartQuantity}
              disabled={!selectedUserId}
            />
          </Card>
        </ResizablePanel>

        <ResizableHandle />

        <ResizablePanel minSize="30%" className="min-w-0">
          <Card className="flex h-full w-full min-w-0 flex-col overflow-hidden">
            <div className="border-b border-border bg-card px-4 py-4 sm:px-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm font-semibold">Select user</p>
                </div>
                <select
                  value={selectedUserId ?? ""}
                  onChange={(event) =>
                    setSelectedUserId(event.target.value || null)
                  }
                  className="flex h-11 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
                >
                  <option value="">Choose a user</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name}
                    </option>
                  ))}
                </select>
                {!selectedUserId ? (
                  <p className="text-sm text-muted-foreground">
                    Select a user before adding items to the batch or submitting
                    the checkout.
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                <div className="flex flex-col gap-4">
                  {error ? (
                    <p className="text-sm text-destructive">{error}</p>
                  ) : null}

                  <div className="flex flex-col gap-3">
                    {cart.map((line) => (
                      <div
                        key={line.item_id}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-muted/30 p-4"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">{line.name}</p>
                          <p className="truncate text-sm text-muted-foreground">
                            {line.item_id}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() =>
                              setCartLineQuantity(
                                line.item_id,
                                line.quantity - 1,
                              )
                            }
                          >
                            -
                          </Button>
                          <Badge variant="outline">
                            {formatStock(line.quantity, line.unit)}
                          </Badge>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() =>
                              setCartLineQuantity(
                                line.item_id,
                                line.quantity + 1,
                              )
                            }
                            disabled={
                              line.quantity >=
                              (snapshot.items.find(
                                (item) => item.id === line.item_id,
                              )?.current_stock ?? 0)
                            }
                          >
                            +
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setCartLineQuantity(line.item_id, 0)}
                          >
                            <Trash2Icon />
                            <span className="sr-only">Remove</span>
                          </Button>
                        </div>
                      </div>
                    ))}

                    {cart.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Click items on the left to add them to the batch.
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="border-t border-border bg-card p-4 sm:p-6">
                <Button
                  size="lg"
                  className="w-full"
                  onClick={submitCheckout}
                  disabled={isPending || cart.length === 0 || !selectedUserId}
                >
                  Submit checkout
                </Button>
              </div>
            </div>
          </Card>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
