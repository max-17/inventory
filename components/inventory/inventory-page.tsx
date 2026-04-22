"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, ScanLineIcon } from "lucide-react";
import type { Result } from "@zxing/library";

import {
  createItemAction,
  getItemHistoryAction,
  stockInBatchAction,
  updateItemAction,
} from "@/app/actions";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { BatchListItem } from "@/components/batch-list-item";
import { ItemBrowser } from "@/components/item-browser";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Textarea } from "@/components/ui/textarea";
import { formatMovementType, formatStock } from "@/lib/inventory/format";
import { filterItems, getItemsForTab } from "@/lib/inventory/selectors";
import type {
  InventorySnapshot,
  ItemMovementRecord,
  ItemWithRelations,
  Unit,
  User,
} from "@/lib/inventory/types";

type ItemFormState = {
  id: string;
  name: string;
  unit: Unit;
  minimum_stock: number;
  current_stock: number;
  department_id: string;
  description: string;
};

type BatchLine = {
  item_id: string;
  name: string;
  unit: Unit;
  quantity: number;
};

const emptyItemForm: ItemFormState = {
  id: "",
  name: "",
  unit: "count",
  minimum_stock: 0,
  current_stock: 0,
  department_id: "",
  description: "",
};

export function InventoryPage({
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
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [scanDialogOpen, setScanDialogOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(
    initialSnapshot.items[0]?.id ?? null,
  );
  const [history, setHistory] = useState<ItemMovementRecord[]>([]);
  const [itemForm, setItemForm] = useState<ItemFormState>(emptyItemForm);
  const [batch, setBatch] = useState<BatchLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isHistoryPending, startHistoryTransition] = useTransition();
  const performedByUserId = selectedUser.id;

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

  function getBatchQuantity(itemId: string) {
    return batch.find((line) => line.item_id === itemId)?.quantity ?? 0;
  }

  function setBatchLineQuantity(itemId: string, quantity: number) {
    const item = snapshot.items.find((entry) => entry.id === itemId);
    if (!item) {
      return;
    }

    const nextQuantity = Math.max(0, quantity);
    setBatch((current) => {
      const existingIndex = current.findIndex(
        (line) => line.item_id === itemId,
      );
      if (nextQuantity === 0) {
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
            quantity: nextQuantity,
          },
        ];
      }

      const next = [...current];
      next[existingIndex] = {
        ...next[existingIndex],
        quantity: nextQuantity,
      };
      return next;
    });
  }

  function addItemToBatch(itemId: string) {
    const item = snapshot.items.find((entry) => entry.id === itemId);
    if (!item) {
      return;
    }

    setSelectedItemId(itemId);
    setBatchLineQuantity(itemId, getBatchQuantity(itemId) + 1);
    setBatchError(null);
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

    setActiveTab("all");
    setQuery("");
    setSelectedItemId(matchedItem.id);
    setBatchLineQuantity(matchedItem.id, getBatchQuantity(matchedItem.id) + 1);
    setBatchError(null);
    setScanError(null);
    setScanDialogOpen(false);
  }

  function openCreateDialog(prefill?: Partial<ItemFormState>) {
    setItemForm({
      ...emptyItemForm,
      id: prefill?.id ?? "",
      name: prefill?.name ?? "",
      unit: prefill?.unit ?? "count",
      minimum_stock: prefill?.minimum_stock ?? 0,
      current_stock: prefill?.current_stock ?? 0,
      department_id: prefill?.department_id ?? "",
      description: prefill?.description ?? "",
    });
    setError(null);
    setCreateDialogOpen(true);
  }

  function submitCreateItem() {
    startTransition(async () => {
      const result = await createItemAction({
        name: itemForm.name,
        unit: itemForm.unit,
        current_stock: itemForm.current_stock,
        minimum_stock: itemForm.minimum_stock,
        department_id: itemForm.department_id || null,
        description: itemForm.description,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setSnapshot(result.data.snapshot);
      setSelectedItemId(result.data.itemId);
      setCreateDialogOpen(false);
      setError(null);
    });
  }

  function submitUpdateItem() {
    startTransition(async () => {
      const result = await updateItemAction({
        id: itemForm.id,
        name: itemForm.name,
        unit: itemForm.unit,
        minimum_stock: itemForm.minimum_stock,
        department_id: itemForm.department_id || null,
        description: itemForm.description,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setSnapshot(result.data.snapshot);
      setSelectedItemId(result.data.itemId);
      setItemDialogOpen(false);
      setError(null);
    });
  }

  function submitBatchStockIn() {
    startTransition(async () => {
      const result = await stockInBatchAction({
        lines: batch.map((line) => ({
          item_id: line.item_id,
          quantity: line.quantity,
        })),
        performed_by_user_id: performedByUserId,
      });

      if (!result.ok) {
        setBatchError(result.error);
        return;
      }

      setSnapshot(result.data.snapshot);
      setBatch([]);
      setBatchError(null);
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
              onSelectItem={addItemToBatch}
              getBatchQuantity={getBatchQuantity}
              headerAction={
                <div className="flex items-center gap-2">
                  <Button onClick={() => setScanDialogOpen(true)}>
                    <ScanLineIcon data-icon="inline-start" />
                    Scan
                  </Button>
                  <Button onClick={() => openCreateDialog()}>
                    <PlusIcon data-icon="inline-start" />
                    New item
                  </Button>
                </div>
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
                  <p className="text-sm font-semibold">Stock-in batch</p>
                  <p className="text-sm text-muted-foreground">
                    User: {selectedUser.full_name}
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => router.push("/inventory")}
                >
                  Change user
                </Button>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                <div className="flex flex-col gap-4">
                  {batchError ? (
                    <p className="text-sm text-destructive">{batchError}</p>
                  ) : null}

                  <div className="flex flex-col gap-3">
                    {batch.map((line) => (
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
                        enforceStockLimit={false}
                        onQuantityChange={setBatchLineQuantity}
                      />
                    ))}

                    {batch.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Click items on the left to add them to the stock-in
                        batch.
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="border-t border-border bg-background p-4 sm:p-6">
                <Button
                  size="lg"
                  className="w-full"
                  onClick={submitBatchStockIn}
                  disabled={isPending || batch.length === 0}
                >
                  Submit stock-in
                </Button>
              </div>
            </div>
          </Card>
        </ResizablePanel>
      </ResizablePanelGroup>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create item</DialogTitle>
          </DialogHeader>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Item name</label>
              <Input
                value={itemForm.name}
                onChange={(event) =>
                  setItemForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="6312 bearing"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Department</label>
              <select
                value={itemForm.department_id}
                onChange={(event) =>
                  setItemForm((current) => ({
                    ...current,
                    department_id: event.target.value,
                  }))
                }
                className="flex h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
              >
                <option value="">Others</option>
                {snapshot.departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Unit</label>
              <select
                value={itemForm.unit}
                onChange={(event) =>
                  setItemForm((current) => ({
                    ...current,
                    unit: event.target.value as Unit,
                  }))
                }
                className="flex h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
              >
                <option value="count">Count</option>
                <option value="kg">kg</option>
                <option value="litre">Litre</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Opening stock</label>
              <Input
                type="number"
                min={0}
                value={itemForm.current_stock}
                onChange={(event) =>
                  setItemForm((current) => ({
                    ...current,
                    current_stock: Number(event.target.value),
                  }))
                }
                placeholder="0"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Minimum stock</label>
              <Input
                type="number"
                min={0}
                value={itemForm.minimum_stock}
                onChange={(event) =>
                  setItemForm((current) => ({
                    ...current,
                    minimum_stock: Number(event.target.value),
                  }))
                }
                placeholder="0"
              />
            </div>
            <div className="flex flex-col gap-2 md:col-span-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={itemForm.description}
                onChange={(event) =>
                  setItemForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="Description"
              />
            </div>
            {error ? (
              <p className="text-sm text-destructive md:col-span-2">{error}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={submitCreateItem} disabled={isPending}>
              Save item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{itemForm.name || "Item details"}</DialogTitle>
          </DialogHeader>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Item ID</label>
              <Input value={itemForm.id} disabled />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Item name</label>
              <Input
                value={itemForm.name}
                onChange={(event) =>
                  setItemForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Current stock</label>
              <Input
                value={formatStock(itemForm.current_stock, itemForm.unit)}
                disabled
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Minimum stock</label>
              <Input
                type="number"
                min={0}
                value={itemForm.minimum_stock}
                onChange={(event) =>
                  setItemForm((current) => ({
                    ...current,
                    minimum_stock: Number(event.target.value),
                  }))
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Unit</label>
              <select
                value={itemForm.unit}
                onChange={(event) =>
                  setItemForm((current) => ({
                    ...current,
                    unit: event.target.value as Unit,
                  }))
                }
                className="flex h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
              >
                <option value="count">Count</option>
                <option value="kg">kg</option>
                <option value="litre">Litre</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Department</label>
              <select
                value={itemForm.department_id}
                onChange={(event) =>
                  setItemForm((current) => ({
                    ...current,
                    department_id: event.target.value,
                  }))
                }
                className="flex h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
              >
                <option value="">Others</option>
                {snapshot.departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2 md:col-span-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={itemForm.description}
                onChange={(event) =>
                  setItemForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
              />
            </div>
            {error ? (
              <p className="text-sm text-destructive md:col-span-2">{error}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitUpdateItem} disabled={isPending}>
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Item history</DialogTitle>
          </DialogHeader>
          <div className="mt-6 flex flex-col gap-3">
            {isHistoryPending ? (
              <p className="text-sm text-muted-foreground">
                Loading history...
              </p>
            ) : null}
            {historyError ? (
              <p className="text-sm text-destructive">{historyError}</p>
            ) : null}
            {history.map((movement) => (
              <div
                key={movement.id}
                className="rounded-2xl border border-border bg-muted/30 p-4"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-medium">
                      {formatMovementType(movement.movement_type)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {movement.performer?.full_name ?? "Unknown operator"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        movement.movement_type === "stock_in"
                          ? "success"
                          : "outline"
                      }
                    >
                      {formatStock(movement.quantity, movement.unit)}
                    </Badge>
                    <Badge variant="outline">
                      {new Date(movement.created_at).toLocaleString("en-GB")}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
            {!isHistoryPending && history.length === 0 && !historyError ? (
              <p className="text-sm text-muted-foreground">
                No movement records yet.
              </p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

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
              the matching item ID to the stock-in batch.
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
