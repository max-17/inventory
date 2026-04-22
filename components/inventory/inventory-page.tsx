"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  PlusIcon,
  ScanLineIcon,
} from "lucide-react";

import {
  createItemAction,
  getItemHistoryAction,
  stockInBatchAction,
  updateItemAction,
} from "@/app/actions";
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
import { cn } from "@/lib/utils";

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

type DetectedBarcode = {
  rawValue?: string;
};

type BarcodeDetectorInstance = {
  detect(source: ImageBitmapSource): Promise<DetectedBarcode[]>;
};

type BarcodeDetectorConstructor = {
  new (options?: { formats?: string[] }): BarcodeDetectorInstance;
  getSupportedFormats?: () => Promise<string[]>;
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

const preferredBarcodeFormats = [
  "qr_code",
  "code_128",
  "code_39",
  "code_93",
  "codabar",
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "itf",
  "data_matrix",
  "pdf417",
  "aztec",
];

const unsupportedScannerMessage =
  "Scanner requires BarcodeDetector support in a Chromium-based browser.";

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
  const [scanStatus, setScanStatus] = useState(
    "Point your camera at an item QR code or barcode.",
  );
  const [isPending, startTransition] = useTransition();
  const [isHistoryPending, startHistoryTransition] = useTransition();
  const performedByUserId = selectedUser.id;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanFrameRef = useRef<number | null>(null);
  const detectorRef = useRef<BarcodeDetectorInstance | null>(null);
  const isDetectingRef = useRef(false);
  const lastScanTimestampRef = useRef(0);
  const recentScanValueRef = useRef("");

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

  function stopScanner() {
    if (scanFrameRef.current !== null) {
      window.cancelAnimationFrame(scanFrameRef.current);
      scanFrameRef.current = null;
    }

    const stream = streamRef.current;
    if (stream) {
      for (const track of stream.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    detectorRef.current = null;
    isDetectingRef.current = false;
  }

  function handleDetectedCode(rawValue: string) {
    const normalizedValue = rawValue.trim();
    if (!normalizedValue) {
      return;
    }

    const now = Date.now();
    if (
      recentScanValueRef.current === normalizedValue &&
      now - lastScanTimestampRef.current < 1500
    ) {
      return;
    }

    recentScanValueRef.current = normalizedValue;
    lastScanTimestampRef.current = now;

    const matchedItem =
      snapshot.items.find(
        (item) => item.id.toLowerCase() === normalizedValue.toLowerCase(),
      ) ?? null;

    if (!matchedItem) {
      setScanError(`No item found for code "${normalizedValue}".`);
      setScanStatus("Try another code or scan a different label.");
      return;
    }

    if (getBatchQuantity(matchedItem.id) > 0) {
      setScanError(`"${matchedItem.name}" is already in the batch.`);
      setSelectedItemId(matchedItem.id);
      setScanStatus("Scan another item to continue.");
      return;
    }

    setActiveTab("all");
    setQuery("");
    setSelectedItemId(matchedItem.id);
    setBatchLineQuantity(matchedItem.id, 1);
    setBatchError(null);
    setScanError(null);
    setScanStatus(`Added "${matchedItem.name}" to the batch.`);
    setScanDialogOpen(false);
  }

  useEffect(() => {
    if (!scanDialogOpen) {
      stopScanner();
      setScanError(null);
      setScanStatus("Point your camera at an item QR code or barcode.");
      recentScanValueRef.current = "";
      return;
    }

    let cancelled = false;

    async function startScanner() {
      setScanError(null);
      setScanStatus("Requesting camera access...");

      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        setScanError(unsupportedScannerMessage);
        setScanStatus(unsupportedScannerMessage);
        return;
      }

      const barcodeDetectorApi = (
        globalThis as typeof globalThis & {
          BarcodeDetector?: BarcodeDetectorConstructor;
        }
      ).BarcodeDetector;

      if (!barcodeDetectorApi) {
        setScanError(unsupportedScannerMessage);
        setScanStatus(unsupportedScannerMessage);
        return;
      }

      try {
        const supportedFormats =
          (await barcodeDetectorApi.getSupportedFormats?.()) ?? [];
        const formats = supportedFormats.filter((format) =>
          preferredBarcodeFormats.includes(format),
        );

        detectorRef.current = formats.length
          ? new barcodeDetectorApi({ formats })
          : new barcodeDetectorApi();

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
          },
          audio: false,
        });

        if (cancelled) {
          for (const track of stream.getTracks()) {
            track.stop();
          }
          return;
        }

        streamRef.current = stream;

        const video = videoRef.current;
        if (!video) {
          throw new Error("Video preview is not ready.");
        }

        video.srcObject = stream;
        await video.play();
        setScanStatus("Scanning for QR codes and barcodes...");

        const scanFrame = async () => {
          if (cancelled) {
            return;
          }

          const activeVideo = videoRef.current;
          const detector = detectorRef.current;

          if (!activeVideo || !detector) {
            scanFrameRef.current = window.requestAnimationFrame(scanFrame);
            return;
          }

          if (
            activeVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
            !isDetectingRef.current
          ) {
            isDetectingRef.current = true;

            try {
              const detectedCodes = await detector.detect(activeVideo);
              const nextCode = detectedCodes.find((entry) => entry.rawValue);

              if (nextCode?.rawValue) {
                handleDetectedCode(nextCode.rawValue);
              }
            } catch {
              // Ignore frame-level detector failures and keep scanning.
            } finally {
              isDetectingRef.current = false;
            }
          }

          scanFrameRef.current = window.requestAnimationFrame(scanFrame);
        };

        scanFrameRef.current = window.requestAnimationFrame(scanFrame);
      } catch (scanStartError) {
        const message =
          scanStartError instanceof Error
            ? scanStartError.message
            : "Camera access was blocked.";

        setScanError(message);
        setScanStatus("Allow camera access and try again.");
        stopScanner();
      }
    }

    startScanner();

    return () => {
      cancelled = true;
      stopScanner();
    };
  }, [scanDialogOpen, snapshot.items]);

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
                <Button variant="outline" onClick={() => router.push("/inventory")}>
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

      <Dialog open={scanDialogOpen} onOpenChange={setScanDialogOpen}>
        <DialogContent className="w-[min(92vw,44rem)]">
          <DialogHeader className="space-y-2">
            <DialogTitle>Scan item</DialogTitle>
            <DialogDescription>
              Chrome will use your camera to read a QR code or barcode and add
              the matching item ID to the stock-in batch.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            <div className="relative overflow-hidden rounded-[2rem] border border-border bg-muted/30">
              <video
                ref={videoRef}
                className="aspect-[4/3] w-full bg-black object-cover"
                autoPlay
                muted
                playsInline
              />
              {scanError === unsupportedScannerMessage ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 p-6 text-center">
                  <p className="max-w-xs text-base font-medium text-white">
                    {unsupportedScannerMessage}
                  </p>
                </div>
              ) : (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
                  <div className="h-48 w-full max-w-xs rounded-[2rem] border-2 border-white/80 shadow-[0_0_0_999px_rgba(0,0,0,0.12)]" />
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-muted/20 px-4 py-3">
              <p className="text-sm font-medium">{scanStatus}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Match is checked against the item `id` in inventory.
              </p>
            </div>

            <div
              className={cn(
                "rounded-2xl border px-4 py-3 text-sm",
                scanError
                  ? "border-destructive/30 bg-destructive/8 text-destructive"
                  : "border-border bg-background text-muted-foreground",
              )}
            >
              {scanError ?? "Scanner is ready. Hold the code steady in frame."}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
