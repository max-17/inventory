import type {
  CheckoutInput,
  CreateDepartmentInput,
  CreateItemInput,
  Department,
  DepartmentWithCount,
  InventoryDatabase,
  InventorySnapshot,
  Item,
  ItemMovementRecord,
  ItemWithRelations,
  StockInBatchInput,
  StockInInput,
  StockMovement,
  Unit,
  UpdateDepartmentInput,
  UpdateItemInput,
  User,
} from "@/lib/inventory/types";

const UNIT_SET: Unit[] = ["count", "kg", "litre"];

export class InventoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InventoryError";
  }
}

function createTimestamp() {
  return new Date().toISOString();
}

function normalizeText(value: string) {
  return value.trim();
}

function optionalText(value: string | null | undefined) {
  const text = value?.trim();
  return text ? text : null;
}

function validateQuantity(value: number, label: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new InventoryError(`${label} must be greater than 0.`);
  }
}

function validateNonNegative(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new InventoryError(`${label} cannot be negative.`);
  }
}

function requireDepartment(db: InventoryDatabase, departmentId: string | null | undefined) {
  if (!departmentId) {
    return null;
  }

  const department = db.departments.find((entry) => entry.id === departmentId);

  if (!department) {
    throw new InventoryError("Department was not found.");
  }

  return department;
}

function requireUser(db: InventoryDatabase, userId: string) {
  const user = db.users.find((entry) => entry.id === userId);

  if (!user) {
    throw new InventoryError("Operator was not found.");
  }

  return user;
}

function requireItem(db: InventoryDatabase, itemId: string) {
  const item = db.items.find((entry) => entry.id === itemId);

  if (!item) {
    throw new InventoryError("Item was not found.");
  }

  return item;
}

function ensureUnit(unit: string): asserts unit is Unit {
  if (!UNIT_SET.includes(unit as Unit)) {
    throw new InventoryError("Unit is invalid.");
  }
}

function nextId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function getMovementCount(db: InventoryDatabase, itemId: string) {
  return db.stock_movements.filter((movement) => movement.item_id === itemId).length;
}

function mapItem(db: InventoryDatabase, item: Item): ItemWithRelations {
  return {
    ...item,
    department: db.departments.find((department) => department.id === item.department_id) ?? null,
    movement_count: getMovementCount(db, item.id),
    low_stock: item.current_stock <= item.minimum_stock,
  };
}

function mapDepartmentWithCount(db: InventoryDatabase, department: Department): DepartmentWithCount {
  return {
    ...department,
    item_count: db.items.filter((item) => item.department_id === department.id).length,
    user_count: db.users.filter((user) => user.department_id === department.id).length,
  };
}

export function listDepartmentsCore(db: InventoryDatabase) {
  return [...db.departments]
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((department) => mapDepartmentWithCount(db, department));
}

export function listItemsCore(db: InventoryDatabase) {
  return [...db.items]
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((item) => mapItem(db, item));
}

export function listItemsByDepartmentCore(db: InventoryDatabase, departmentId: string | null) {
  return listItemsCore(db).filter((item) => item.department_id === departmentId);
}

export function searchItemsCore(db: InventoryDatabase, query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return listItemsCore(db);
  }

  return listItemsCore(db).filter((item) => {
    return (
      item.name.toLowerCase().includes(normalizedQuery) ||
      item.id.toLowerCase().includes(normalizedQuery) ||
      item.description?.toLowerCase().includes(normalizedQuery)
    );
  });
}

export function findItemByIdCore(db: InventoryDatabase, itemId: string) {
  const item = db.items.find((entry) => entry.id === itemId);
  return item ? mapItem(db, item) : null;
}

export function createDepartmentCore(db: InventoryDatabase, input: CreateDepartmentInput) {
  const name = normalizeText(input.name);
  const code = optionalText(input.code);

  if (!name) {
    throw new InventoryError("Department name is required.");
  }

  const duplicate = db.departments.find(
    (department) => department.name.toLowerCase() === name.toLowerCase(),
  );

  if (duplicate) {
    throw new InventoryError("Department name must be unique.");
  }

  const timestamp = createTimestamp();

  const department: Department = {
    id: nextId("dept"),
    name,
    code,
    created_at: timestamp,
    updated_at: timestamp,
  };

  db.departments.push(department);

  return department;
}

export function updateDepartmentCore(db: InventoryDatabase, input: UpdateDepartmentInput) {
  const name = normalizeText(input.name);
  const code = optionalText(input.code);

  if (!name) {
    throw new InventoryError("Department name is required.");
  }

  const department = db.departments.find((entry) => entry.id === input.id);

  if (!department) {
    throw new InventoryError("Department was not found.");
  }

  const duplicate = db.departments.find(
    (entry) => entry.id !== input.id && entry.name.toLowerCase() === name.toLowerCase(),
  );

  if (duplicate) {
    throw new InventoryError("Department name must be unique.");
  }

  department.name = name;
  department.code = code;
  department.updated_at = createTimestamp();

  return department;
}

export function createItemCore(db: InventoryDatabase, input: CreateItemInput) {
  const id = normalizeText(input.id);
  const name = normalizeText(input.name);
  const description = optionalText(input.description);
  const department = requireDepartment(db, input.department_id ?? null);

  if (!id) {
    throw new InventoryError("Item ID is required.");
  }

  if (!name) {
    throw new InventoryError("Item name is required.");
  }

  ensureUnit(input.unit);
  validateNonNegative(input.current_stock, "Current stock");
  validateNonNegative(input.minimum_stock, "Minimum stock");

  const duplicate = db.items.find((item) => item.id.toLowerCase() === id.toLowerCase());
  if (duplicate) {
    throw new InventoryError("Item ID must be unique.");
  }

  const timestamp = createTimestamp();

  const item: Item = {
    id,
    name,
    unit: input.unit,
    current_stock: input.current_stock,
    minimum_stock: input.minimum_stock,
    department_id: department?.id ?? null,
    description,
    created_at: timestamp,
    updated_at: timestamp,
  };

  db.items.push(item);

  if (input.current_stock > 0 && db.users[0]) {
    db.stock_movements.push({
      id: nextId("mov"),
      item_id: item.id,
      movement_type: "stock_in",
      quantity: input.current_stock,
      unit: item.unit,
      performed_by_user_id: db.users[0].id,
      note: "Opening stock",
      reference: null,
      created_at: timestamp,
    });
  }

  return item;
}

export function updateItemCore(db: InventoryDatabase, input: UpdateItemInput) {
  const item = requireItem(db, input.id);
  const name = normalizeText(input.name);
  const description = optionalText(input.description);
  const department = requireDepartment(db, input.department_id ?? null);

  if (!name) {
    throw new InventoryError("Item name is required.");
  }

  ensureUnit(input.unit);
  validateNonNegative(input.minimum_stock, "Minimum stock");

  item.name = name;
  item.unit = input.unit;
  item.minimum_stock = input.minimum_stock;
  item.department_id = department?.id ?? null;
  item.description = description;
  item.updated_at = createTimestamp();

  return item;
}

function appendMovement(
  db: InventoryDatabase,
  item: Item,
  user: User,
  type: StockMovement["movement_type"],
  quantity: number,
  note?: string | null,
  reference?: string | null,
) {
  db.stock_movements.push({
    id: nextId("mov"),
    item_id: item.id,
    movement_type: type,
    quantity,
    unit: item.unit,
    performed_by_user_id: user.id,
    note: optionalText(note),
    reference: optionalText(reference),
    created_at: createTimestamp(),
  });
}

export function applyStockInCore(db: InventoryDatabase, input: StockInInput) {
  validateQuantity(input.quantity, "Stock-in quantity");

  const item = requireItem(db, input.item_id);
  const user = requireUser(db, input.performed_by_user_id);

  item.current_stock += input.quantity;
  item.updated_at = createTimestamp();

  appendMovement(db, item, user, "stock_in", input.quantity, input.note, input.reference);

  return item;
}

export function applyStockInBatchCore(db: InventoryDatabase, input: StockInBatchInput) {
  const user = requireUser(db, input.performed_by_user_id);

  if (input.lines.length === 0) {
    throw new InventoryError("Stock-in needs at least one item.");
  }

  const requestedByItem = new Map<string, number>();

  for (const line of input.lines) {
    validateQuantity(line.quantity, "Stock-in quantity");
    requestedByItem.set(line.item_id, (requestedByItem.get(line.item_id) ?? 0) + line.quantity);
  }

  for (const [itemId, requestedQuantity] of requestedByItem.entries()) {
    const item = requireItem(db, itemId);
    item.current_stock += requestedQuantity;
    item.updated_at = createTimestamp();
    appendMovement(db, item, user, "stock_in", requestedQuantity);
  }

  return [...requestedByItem.entries()].map(([itemId]) => requireItem(db, itemId));
}

export function applyCheckoutCore(db: InventoryDatabase, input: CheckoutInput) {
  const user = requireUser(db, input.performed_by_user_id);

  if (input.lines.length === 0) {
    throw new InventoryError("Checkout needs at least one item.");
  }

  const requestedByItem = new Map<string, number>();

  for (const line of input.lines) {
    validateQuantity(line.quantity, "Checkout quantity");
    requestedByItem.set(line.item_id, (requestedByItem.get(line.item_id) ?? 0) + line.quantity);
  }

  for (const [itemId, requestedQuantity] of requestedByItem.entries()) {
    const item = requireItem(db, itemId);

    if (requestedQuantity > item.current_stock) {
      throw new InventoryError(`Not enough stock for ${item.name}.`);
    }
  }

  for (const [itemId, requestedQuantity] of requestedByItem.entries()) {
    const item = requireItem(db, itemId);
    item.current_stock -= requestedQuantity;
    item.updated_at = createTimestamp();
    appendMovement(db, item, user, "checkout", requestedQuantity, input.note, input.reference);
  }

  return [...requestedByItem.entries()].map(([itemId]) => requireItem(db, itemId));
}

export function listItemMovementsCore(db: InventoryDatabase, itemId: string): ItemMovementRecord[] {
  const item = requireItem(db, itemId);

  return [...db.stock_movements]
    .filter((movement) => movement.item_id === item.id)
    .sort((left, right) => right.created_at.localeCompare(left.created_at))
    .map((movement) => ({
      ...movement,
      item,
      performer: db.users.find((user) => user.id === movement.performed_by_user_id) ?? null,
    }));
}

export function createInventorySnapshot(db: InventoryDatabase): InventorySnapshot {
  return {
    departments: listDepartmentsCore(db),
    items: listItemsCore(db),
  };
}
