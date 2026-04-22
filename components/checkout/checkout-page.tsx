"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ScanLineIcon } from "lucide-react";

import { checkoutAction } from "@/app/actions";
import { BatchListItem } from "@/components/batch-list-item";
import { ItemBrowser } from "@/components/item-browser";
import { Badge } from "@/components/ui/badge";
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
import { formatStock } from "@/lib/inventory/format";
import { filterItems, getItemsForTab } from "@/lib/inventory/selectors";
import type { InventorySnapshot, Unit, User } from "@/lib/inventory/types";
import { cn } from "@/lib/utils";

type CartLine = {
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
  const [scanStatus, setScanStatus] = useState(
    "Point your camera at an item QR code or barcode.",
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
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
    const item = snapshot.items.find((entry) => entry.id === itemId);
    if (!item) {
      return;
    }

    setSelectedItemId(itemId);
    setCartLineQuantity(itemId, getCartQuantity(itemId) + 1);
    setError(null);
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

    if (getCartQuantity(matchedItem.id) > 0) {
      setScanError(`"${matchedItem.name}" is already in the batch.`);
      setSelectedItemId(matchedItem.id);
      setScanStatus("Scan another item to continue.");
      return;
    }

    if (matchedItem.current_stock <= 0) {
      setScanError(`"${matchedItem.name}" is out of stock.`);
      setSelectedItemId(matchedItem.id);
      setScanStatus("Scan another item to continue.");
      return;
    }

    setActiveTab("all");
    setQuery("");
    setSelectedItemId(matchedItem.id);
    setCartLineQuantity(matchedItem.id, 1);
    setError(null);
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

      <Dialog open={scanDialogOpen} onOpenChange={setScanDialogOpen}>
        <DialogContent className="w-[min(92vw,44rem)]">
          <DialogHeader className="space-y-2">
            <DialogTitle>Scan item</DialogTitle>
            <DialogDescription>
              Chrome will use your camera to read a QR code or barcode and add
              the matching item ID to the batch.
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
