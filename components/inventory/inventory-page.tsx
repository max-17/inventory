"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Clock3Icon, Edit3Icon, PlusIcon, Trash2Icon } from "lucide-react";

import {
  createItemAction,
  getItemHistoryAction,
  stockInBatchAction,
  updateItemAction,
} from "@/app/actions";
import { ItemBrowser } from "@/components/item-browser";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
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
  users,
}: {
  initialSnapshot: InventorySnapshot;
  users: User[];
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "others" | string>("all");
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(
    initialSnapshot.items[0]?.id ?? null,
  );
  const [history, setHistory] = useState<ItemMovementRecord[]>([]);
  const [itemForm, setItemForm] = useState<ItemFormState>(emptyItemForm);
  const [batch, setBatch] = useState<BatchLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isHistoryPending, startHistoryTransition] = useTransition();
  const performedByUserId = users[0]?.id ?? "";

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
      const others = current.filter((line) => line.item_id !== itemId);
      if (nextQuantity === 0) {
        return others;
      }

      return [
        ...others,
        {
          item_id: item.id,
          name: item.name,
          unit: item.unit,
          quantity: nextQuantity,
        },
      ];
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

  function openItemDialog(item: ItemWithRelations) {
    setSelectedItemId(item.id);
    setItemForm({
      id: item.id,
      name: item.name,
      unit: item.unit,
      minimum_stock: item.minimum_stock,
      current_stock: item.current_stock,
      department_id: item.department_id ?? "",
      description: item.description ?? "",
    });
    setError(null);
    setItemDialogOpen(true);
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

  function openHistoryDialog(itemId: string) {
    setHistory([]);
    setHistoryError(null);
    setHistoryDialogOpen(true);

    startHistoryTransition(async () => {
      const result = await getItemHistoryAction(itemId);
      if (!result.ok) {
        setHistoryError(result.error);
        return;
      }

      setHistory(result.data.movements);
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
                <Button onClick={() => openCreateDialog()}>
                  <PlusIcon data-icon="inline-start" />
                  New item
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
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                <div className="flex flex-col gap-4">
                  {batchError ? (
                    <p className="text-sm text-destructive">{batchError}</p>
                  ) : null}

                  <div className="flex flex-col gap-3">
                    {batch.map((line) => {
                      const item = snapshot.items.find(
                        (entry) => entry.id === line.item_id,
                      );

                      return (
                        <div
                          key={line.item_id}
                          className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-muted/30 p-4"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate font-medium">
                                {line.name}
                              </p>
                              {item ? (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openItemDialog(item)}
                                  >
                                    <Edit3Icon data-icon="inline-start" />
                                    Details
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      openHistoryDialog(line.item_id)
                                    }
                                  >
                                    <Clock3Icon data-icon="inline-start" />
                                    History
                                  </Button>
                                </>
                              ) : null}
                            </div>
                            <p className="truncate text-sm text-muted-foreground">
                              {line.item_id}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() =>
                                setBatchLineQuantity(
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
                                setBatchLineQuantity(
                                  line.item_id,
                                  line.quantity + 1,
                                )
                              }
                            >
                              +
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                setBatchLineQuantity(line.item_id, 0)
                              }
                            >
                              <Trash2Icon />
                              <span className="sr-only">Remove</span>
                            </Button>
                          </div>
                        </div>
                      );
                    })}

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
    </div>
  );
}
