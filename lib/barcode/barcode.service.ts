import type { Result } from "@zxing/library";

type BoundingBox = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

function getBoundingBox(result: Result): BoundingBox | null {
  const points = result.getResultPoints();
  if (!points || points.length === 0) {
    return null;
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const point of points) {
    const x = point.getX();
    const y = point.getY();
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  return { minX, minY, maxX, maxY };
}

function getBoxCenter(box: BoundingBox) {
  return {
    x: (box.minX + box.maxX) / 2,
    y: (box.minY + box.maxY) / 2,
  };
}

let lastClosest: {
  text: string;
  centerX: number;
  centerY: number;
  distance: number;
  at: number;
} | null = null;

/**
 * Picks a single barcode result closest to the video frame center.
 *
 * Includes a small hysteresis buffer to avoid "jitter switching" when two
 * candidates are almost equally close to center across frames.
 */
export function getClosestToCenter(
  results: Result[],
  width: number,
  height: number,
): Result | null {
  if (!results || results.length === 0) {
    return null;
  }

  const frameCenterX = width / 2;
  const frameCenterY = height / 2;

  // Keep the previous selection unless the new best is meaningfully better.
  const hysteresisPx = Math.max(10, Math.min(width, height) * 0.02);
  const hysteresisWindowMs = 700;

  let best: {
    result: Result;
    text: string;
    centerX: number;
    centerY: number;
    distance: number;
  } | null = null;

  for (const result of results) {
    const text = result.getText();
    const box = getBoundingBox(result);

    const center = box
      ? getBoxCenter(box)
      : { x: frameCenterX, y: frameCenterY };
    const distance = Math.hypot(
      center.x - frameCenterX,
      center.y - frameCenterY,
    );

    if (!best || distance < best.distance) {
      best = { result, text, centerX: center.x, centerY: center.y, distance };
    }
  }

  if (!best) {
    return null;
  }

  const last = lastClosest;
  if (last && Date.now() - last.at <= hysteresisWindowMs) {
    const prevCandidate =
      results.find((result) => result.getText() === last.text) ?? null;

    if (prevCandidate) {
      const prevBox = getBoundingBox(prevCandidate);
      const prevCenter = prevBox
        ? getBoxCenter(prevBox)
        : { x: last.centerX, y: last.centerY };
      const prevDistance = Math.hypot(
        prevCenter.x - frameCenterX,
        prevCenter.y - frameCenterY,
      );

      // If the new best doesn't beat the previous by a buffer, keep the previous.
      if (best.distance + hysteresisPx >= prevDistance) {
        lastClosest = {
          text: prevCandidate.getText(),
          centerX: prevCenter.x,
          centerY: prevCenter.y,
          distance: prevDistance,
          at: Date.now(),
        };
        return prevCandidate;
      }
    }
  }

  lastClosest = {
    text: best.text,
    centerX: best.centerX,
    centerY: best.centerY,
    distance: best.distance,
    at: Date.now(),
  };

  return best.result;
}

export function getResultBoundingBox(result: Result): BoundingBox | null {
  return getBoundingBox(result);
}
