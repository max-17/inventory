"use client";

import { useEffect, useRef, useState } from "react";
import type { Result } from "@zxing/library";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getClosestToCenter,
  getResultBoundingBox,
} from "@/lib/barcode/barcode.service";
import { useScanner } from "@/lib/barcode/useScanner";

type Props = {
  onScan: (result: Result) => void;
  className?: string;
  scanLabel?: string;
  autoStart?: boolean;
};

function normalizeBox(box: {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}) {
  return {
    x: box.minX,
    y: box.minY,
    w: Math.max(1, box.maxX - box.minX),
    h: Math.max(1, box.maxY - box.minY),
  };
}

export function BarcodeScanner({
  onScan,
  className,
  scanLabel = "Scan",
  autoStart = true,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [frozen, setFrozen] = useState(false);

  const { videoRef, startScan, stopScan, detected, status, error, permission } =
    useScanner();

  const canTrigger = Boolean(detected) && !frozen && status === "scanning";

  useEffect(() => {
    if (!autoStart) {
      return;
    }

    startScan();
  }, [autoStart, startScan]);

  useEffect(() => {
    if (frozen) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const result = detected;

    if (!video || !canvas) {
      return;
    }

    const displayWidth = video.clientWidth || 0;
    const displayHeight = video.clientHeight || 0;
    if (!displayWidth || !displayHeight) {
      return;
    }

    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!result) {
      return;
    }

    const closest = getClosestToCenter(
      [result],
      video.videoWidth || displayWidth,
      video.videoHeight || displayHeight,
    );
    if (!closest) {
      return;
    }

    const box = getResultBoundingBox(closest);
    if (!box) {
      return;
    }

    const intrinsicWidth = video.videoWidth || displayWidth;
    const intrinsicHeight = video.videoHeight || displayHeight;
    const scaleX = displayWidth / intrinsicWidth;
    const scaleY = displayHeight / intrinsicHeight;

    const normalized = normalizeBox(box);
    const x = normalized.x * scaleX;
    const y = normalized.y * scaleY;
    const w = normalized.w * scaleX;
    const h = normalized.h * scaleY;

    ctx.save();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(34,197,94,0.95)";
    ctx.fillStyle = "rgba(34,197,94,0.12)";
    ctx.shadowColor = "rgba(0,0,0,0.18)";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 14);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }, [detected, frozen, videoRef]);

  function freezeFrame() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) {
      return;
    }
    const displayWidth = video.clientWidth || 0;
    const displayHeight = video.clientHeight || 0;
    if (!displayWidth || !displayHeight) {
      return;
    }
    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="relative overflow-hidden rounded-[2rem] border border-border bg-muted/30">
        <video
          ref={videoRef}
          className="aspect-[4/3] w-full bg-black object-cover"
          autoPlay
          muted
          playsInline
        />
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full"
        />

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
          <div className="relative h-52 w-full max-w-sm rounded-[2rem] border-2 border-white/80 shadow-[0_0_0_999px_rgba(0,0,0,0.12)]" />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {status === "requesting_permission"
              ? "Requesting camera access..."
              : status === "scanning"
                ? detected
                  ? `Target detected: ${detected.getText()}`
                  : "Point the code into the reticle to detect it."
                : frozen
                  ? "Scanner frozen."
                  : "Camera is idle."}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {permission === "denied"
              ? "Camera permission was denied. Allow access in your browser settings, then retry."
              : error
                ? error
                : "The scan button unlocks once a barcode is detected near the center."}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setFrozen(false);
              startScan();
            }}
            disabled={status === "requesting_permission"}
          >
            {status === "scanning" ? "Restart" : "Start camera"}
          </Button>

          <Button
            type="button"
            onClick={() => {
              if (!detected) {
                return;
              }
              const video = videoRef.current;
              const width = video?.videoWidth || video?.clientWidth || 0;
              const height = video?.videoHeight || video?.clientHeight || 0;
              const chosen =
                width && height
                  ? (getClosestToCenter([detected], width, height) ?? detected)
                  : detected;
              freezeFrame();
              setFrozen(true);
              stopScan();
              onScan(chosen);
            }}
            disabled={!canTrigger}
          >
            {scanLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
