import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { InventoryDatabase } from "@/lib/inventory/types";

const databasePath = path.join(process.cwd(), "data", "inventory-db.json");

export async function readDatabase() {
  const raw = await readFile(databasePath, "utf8");
  return JSON.parse(raw) as InventoryDatabase;
}

export async function writeDatabase(data: InventoryDatabase) {
  await writeFile(databasePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}
