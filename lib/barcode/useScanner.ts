"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import type { Result } from "@zxing/library";

type ScannerStatus =
  | "idle"
  | "requesting_permission"
  | "ready"
  | "scanning"
  | "stopped"
  | "error";

type UseScannerOptions = {
  constraints?: MediaStreamConstraints;
  decodeIntervalMs?: number;
};

type UseScannerState = {
  status: ScannerStatus;
  error: string | null;
  detected: Result | null;
  permission: "unknown" | "granted" | "denied";
};

export function useScanner(options: UseScannerOptions = {}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const captureCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const lastDecodeAtRef = useRef(0);
  const lastTextRef = useRef<string | null>(null);
  const lastEmittedAtRef = useRef(0);

  const decodeIntervalMs = options.decodeIntervalMs ?? 110;

  const [state, setState] = useState<UseScannerState>({
    status: "idle",
    error: null,
    detected: null,
    permission: "unknown",
  });

  const cleanup = useCallback(() => {
    runningRef.current = false;

    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    const video = videoRef.current;
    if (video) {
      video.pause();
    }

    const stream = streamRef.current;
    if (stream) {
      for (const track of stream.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
  }, []);

  const stopScan = useCallback(() => {
    cleanup();
    setState((current) => ({
      ...current,
      status: current.status === "error" ? "error" : "stopped",
    }));
  }, [cleanup]);

  const startScan = useCallback(async () => {
    const constraints: MediaStreamConstraints = options.constraints ?? {
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    };

    if (!window.isSecureContext) {
      setState({
        status: "error",
        error: "Camera access requires a secure context (HTTPS).",
        detected: null,
        permission: "unknown",
      });
      return;
    }

    const video = videoRef.current;
    if (!video) {
      setState({
        status: "error",
        error: "Scanner video element is not ready.",
        detected: null,
        permission: "unknown",
      });
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setState({
        status: "error",
        error: "Camera access is not supported in this browser.",
        detected: null,
        permission: "unknown",
      });
      return;
    }

    if (!readerRef.current) {
      readerRef.current = new BrowserMultiFormatReader();
    }

    // Ensure we don't have multiple streams/loops running.
    cleanup();

    setState((current) => ({
      ...current,
      status: "requesting_permission",
      error: null,
      detected: null,
    }));

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      video.srcObject = stream;
      video.playsInline = true;
      video.muted = true;

      await video.play();

      if (!captureCanvasRef.current) {
        captureCanvasRef.current = document.createElement("canvas");
      }
      if (!captureCtxRef.current) {
        captureCtxRef.current = captureCanvasRef.current.getContext("2d", {
          willReadFrequently: true,
        });
      }

      lastDecodeAtRef.current = 0;
      lastTextRef.current = null;
      lastEmittedAtRef.current = 0;

      runningRef.current = true;
      setState((current) => ({
        ...current,
        status: "scanning",
        permission: "granted",
      }));

      const tick = () => {
        if (!runningRef.current) {
          return;
        }

        rafRef.current = window.requestAnimationFrame(tick);

        const now = Date.now();
        if (now - lastDecodeAtRef.current < decodeIntervalMs) {
          return;
        }
        lastDecodeAtRef.current = now;

        const localVideo = videoRef.current;
        const reader = readerRef.current;
        const canvas = captureCanvasRef.current;
        const ctx = captureCtxRef.current;

        if (!localVideo || !reader || !canvas || !ctx) {
          return;
        }

        if (localVideo.readyState < 2) {
          return;
        }

        const width = localVideo.videoWidth;
        const height = localVideo.videoHeight;
        if (!width || !height) {
          return;
        }

        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }

        try {
          ctx.drawImage(localVideo, 0, 0, width, height);
          const result = reader.decodeFromCanvas(canvas);
          const text = result.getText();

          // Avoid state churn when the same code is seen every frame.
          if (
            text &&
            (text !== lastTextRef.current ||
              now - lastEmittedAtRef.current > 800)
          ) {
            lastTextRef.current = text;
            lastEmittedAtRef.current = now;
            setState((current) => ({
              ...current,
              detected: result,
              error: null,
              status: "scanning",
            }));
          }
        } catch {
          // NotFound/Checksum/Format errors are normal per-frame; ignore.
        }
      };

      rafRef.current = window.requestAnimationFrame(tick);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to access the camera.";

      cleanup();
      setState({
        status: "error",
        error: message,
        detected: null,
        permission:
          typeof error === "object" &&
          error !== null &&
          "name" in error &&
          (error as { name?: string }).name === "NotAllowedError"
            ? "denied"
            : "unknown",
      });
    }
  }, [cleanup, decodeIntervalMs, options.constraints]);

  useEffect(() => {
    return () => {
      stopScan();
    };
  }, [stopScan]);

  return {
    videoRef,
    startScan,
    stopScan,
    ...state,
  };
}
