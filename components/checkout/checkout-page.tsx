"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ScanLineIcon } from "lucide-react";
import type { Result } from "@zxing/library";

import { checkoutAction } from "@/app/actions";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { BatchListItem } from "@/components/batch-list-item";
import { ItemBrowser } from "@/components/item-browser";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { filterItems, getItemsForTab } from "@/lib/inventory/selectors";
import type { InventorySnapshot, Unit, User } from "@/lib/inventory/types";

type CartLine = {
  item_id: string;
  name: string;
  unit: Unit;
  quantity: number;
};

export function CheckoutPage({
  initialSnapshot,
  selectedUser,
}: {
  initialSnapshot: InventorySnapshot;
  selectedUser: User;
}) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "others" | string>("all");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(
    initialSnapshot.items[0]?.id ?? null,
  );
  const [cart, setCart] = useState<CartLine[]>([]);
  const [scanDialogOpen, setScanDialogOpen] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setSnapshot(initialSnapshot);
  }, [initialSnapshot]);

  const filteredItems = useMemo(
    () => filterItems(snapshot.items, query),
    [query, snapshot.items],
  );

  const visibleItems = useMemo(
    () => getItemsForTab(filteredItems, activeTab),
    [activeTab, filteredItems],
  );

  const otherCount = snapshot.items.filter(
    (item) => item.department_id === null,
  ).length;

  const tabs = [
    { id: "all", label: "All", count: snapshot.items.length },
    ...snapshot.departments.map((department) => ({
      id: department.id,
      label: department.name,
      count: department.item_count,
    })),
    { id: "others", label: "Others", count: otherCount },
  ];

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
      const existingIndex = current.findIndex(
        (line) => line.item_id === itemId,
      );

      if (clampedQuantity === 0) {
        if (existingIndex === -1) {
          return current;
        }

        return current.filter((_, index) => index !== existingIndex);
      }

      if (existingIndex === -1) {
        return [
          ...current,
          {
            item_id: item.id,
            name: item.name,
            unit: item.unit,
            quantity: clampedQuantity,
          },
        ];
      }

      const next = [...current];
      next[existingIndex] = {
        ...next[existingIndex],
        quantity: clampedQuantity,
      };
      return next;
    });
  }

  function addItemToCart(itemId: string) {
    const item = snapshot.items.find((entry) => entry.id === itemId);
    if (!item) {
      return;
    }

    setSelectedItemId(itemId);
    setCartLineQuantity(itemId, getCartQuantity(itemId) + 1);
    setError(null);
  }

  function handleScanResult(result: Result) {
    const normalizedValue = result.getText().trim();
    if (!normalizedValue) {
      return;
    }

    const matchedItem =
      snapshot.items.find(
        (item) => item.id.toLowerCase() === normalizedValue.toLowerCase(),
      ) ?? null;

    if (!matchedItem) {
      setScanError(`No item found for code "${normalizedValue}".`);
      return;
    }

    if (matchedItem.current_stock <= 0) {
      setScanError(`"${matchedItem.name}" is out of stock.`);
      setSelectedItemId(matchedItem.id);
      return;
    }

    setActiveTab("all");
    setQuery("");
    setSelectedItemId(matchedItem.id);
    setCartLineQuantity(matchedItem.id, getCartQuantity(matchedItem.id) + 1);
    setError(null);
    setScanError(null);
    setScanDialogOpen(false);
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
        performed_by_user_id: selectedUser.id,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      syncSnapshot(result.data.snapshot);
      setCart([]);
      setQuery("");
      setActiveTab("all");
      setError(null);
      router.push("/checkout");
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
              headerAction={
                <Button
                  aria-label="Scan item barcode"
                  onClick={() => setScanDialogOpen(true)}
                >
                  <ScanLineIcon data-icon="inline-start" />
                  Scan
                </Button>
              }
              tabs={tabs}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />
          </Card>
        </ResizablePanel>

        <ResizableHandle />

        <ResizablePanel minSize="30%" className="min-w-0">
          <Card className="flex h-full w-full min-w-0 flex-col overflow-hidden">
            <div className="border-b border-border bg-card px-4 py-4 sm:px-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold">Checkout batch</p>
                  <p className="text-sm text-muted-foreground">
                    User: {selectedUser.full_name}
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => router.push("/checkout")}
                >
                  Change user
                </Button>
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
                      <BatchListItem
                        key={line.item_id}
                        itemId={line.item_id}
                        name={line.name}
                        unit={line.unit}
                        quantity={line.quantity}
                        currentStock={
                          snapshot.items.find(
                            (item) => item.id === line.item_id,
                          )?.current_stock
                        }
                        onQuantityChange={setCartLineQuantity}
                      />
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
                  disabled={isPending || cart.length === 0}
                >
                  Submit checkout
                </Button>
              </div>
            </div>
          </Card>
        </ResizablePanel>
      </ResizablePanelGroup>

      <Dialog
        open={scanDialogOpen}
        onOpenChange={(open) => {
          setScanDialogOpen(open);
          if (open) {
            setScanError(null);
          }
        }}
      >
        <DialogContent className="w-[min(92vw,44rem)]">
          <DialogHeader className="space-y-2">
            <DialogTitle>Scan item</DialogTitle>
            <DialogDescription>
              Chrome will use your camera to read a QR code or barcode and add
              the matching item ID to the batch.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            {scanError ? (
              <p className="text-sm text-destructive">{scanError}</p>
            ) : null}

            <BarcodeScanner
              scanLabel="Add to batch"
              onScan={handleScanResult}
            />

            <p className="text-sm text-muted-foreground">
              Match is checked against the item{" "}
              <span className="font-mono">id</span> in inventory.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
