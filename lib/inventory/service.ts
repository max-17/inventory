import { db } from "@/lib/db";
import type {
  MovementType as PrismaMovementType,
  Unit as PrismaUnit,
  UserRole as PrismaUserRole,
} from "@/lib/generated/prisma/enums";
import type {
  CheckoutInput,
  CreateDepartmentInput,
  CreateItemInput,
  CreateUserInput,
  Department,
  DepartmentWithCount,
  InventorySnapshot,
  Item,
  ItemMovementRecord,
  ItemWithRelations,
  MovementType,
  StockInBatchInput,
  StockInInput,
  Unit,
  UpdateDepartmentInput,
  UpdateItemInput,
  UpdateUserInput,
  User,
  UserRole,
} from "@/lib/inventory/types";

export class InventoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InventoryError";
  }
}

function createTimestamp() {
  return new Date();
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

function nextId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function slugifyItemName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function createUniqueItemId(name: string) {
  const baseId = slugifyItemName(name) || "item";
  let candidateId = baseId;
  let suffix = 2;

  while (
    await db.item.findUnique({
      where: { id: candidateId },
      select: { id: true },
    })
  ) {
    candidateId = `${baseId}-${suffix}`;
    suffix += 1;
  }

  return candidateId;
}

function mapUnit(unit: PrismaUnit): Unit {
  return unit;
}

function mapRole(role: PrismaUserRole): UserRole {
  return role.toLowerCase() as UserRole;
}

function toPrismaRole(role: UserRole): PrismaUserRole {
  switch (role) {
    case "operator":
      return "OPERATOR";
    case "manager":
      return "MANAGER";
    case "admin":
      return "ADMIN";
    default:
      throw new InventoryError("Role is invalid.");
  }
}

function mapMovementType(movementType: PrismaMovementType): MovementType {
  return movementType;
}

function mapDepartment(department: {
  id: string;
  name: string;
  code: string | null;
  createdAt: Date;
  updatedAt: Date;
}): Department {
  return {
    id: department.id,
    name: department.name,
    code: department.code,
    created_at: department.createdAt.toISOString(),
    updated_at: department.updatedAt.toISOString(),
  };
}

function mapUser(user: {
  id: string;
  fullName: string;
  role: PrismaUserRole;
  badgeCode: string | null;
  departmentId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): User {
  return {
    id: user.id,
    full_name: user.fullName,
    role: mapRole(user.role),
    badge_code: user.badgeCode,
    department_id: user.departmentId,
    created_at: user.createdAt.toISOString(),
    updated_at: user.updatedAt.toISOString(),
  };
}

function mapItem(item: {
  id: string;
  name: string;
  unit: PrismaUnit;
  currentStock: number;
  minimumStock: number;
  departmentId: string | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  department?: {
    id: string;
    name: string;
    code: string | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  _count?: {
    movements: number;
  };
}): ItemWithRelations {
  return {
    id: item.id,
    name: item.name,
    unit: mapUnit(item.unit),
    current_stock: item.currentStock,
    minimum_stock: item.minimumStock,
    department_id: item.departmentId,
    description: item.description,
    created_at: item.createdAt.toISOString(),
    updated_at: item.updatedAt.toISOString(),
    department: item.department ? mapDepartment(item.department) : null,
    movement_count: item._count?.movements ?? 0,
    low_stock: item.currentStock <= item.minimumStock,
  };
}

function mapItemBase(item: {
  id: string;
  name: string;
  unit: PrismaUnit;
  currentStock: number;
  minimumStock: number;
  departmentId: string | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}): Item {
  return {
    id: item.id,
    name: item.name,
    unit: mapUnit(item.unit),
    current_stock: item.currentStock,
    minimum_stock: item.minimumStock,
    department_id: item.departmentId,
    description: item.description,
    created_at: item.createdAt.toISOString(),
    updated_at: item.updatedAt.toISOString(),
  };
}

function mapDepartmentWithCount(department: {
  id: string;
  name: string;
  code: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    items: number;
    users: number;
  };
}): DepartmentWithCount {
  return {
    ...mapDepartment(department),
    item_count: department._count.items,
    user_count: department._count.users,
  };
}

function mapMovement(movement: {
  id: string;
  itemId: string;
  movementType: PrismaMovementType;
  quantity: number;
  unit: PrismaUnit;
  performedByUserId: string;
  note: string | null;
  reference: string | null;
  createdAt: Date;
  item: {
    id: string;
    name: string;
    unit: PrismaUnit;
    currentStock: number;
    minimumStock: number;
    departmentId: string | null;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  performer: {
    id: string;
    fullName: string;
    role: PrismaUserRole;
    badgeCode: string | null;
    departmentId: string | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
}): ItemMovementRecord {
  return {
    id: movement.id,
    item_id: movement.itemId,
    movement_type: mapMovementType(movement.movementType),
    quantity: movement.quantity,
    unit: mapUnit(movement.unit),
    performed_by_user_id: movement.performedByUserId,
    note: movement.note,
    reference: movement.reference,
    created_at: movement.createdAt.toISOString(),
    item: mapItemBase(movement.item),
    performer: movement.performer ? mapUser(movement.performer) : null,
  };
}

async function requireDepartment(departmentId: string | null | undefined) {
  if (!departmentId) {
    return null;
  }

  const department = await db.department.findUnique({
    where: { id: departmentId },
  });

  if (!department) {
    throw new InventoryError("Department was not found.");
  }

  return department;
}

async function requireUser(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new InventoryError("Operator was not found.");
  }

  return user;
}

async function requireItem(itemId: string) {
  const item = await db.item.findUnique({
    where: { id: itemId },
  });

  if (!item) {
    throw new InventoryError("Item was not found.");
  }

  return item;
}

function aggregateLines(
  lines: Array<{ item_id: string; quantity: number }>,
  label: string,
) {
  const requestedByItem = new Map<string, number>();

  for (const line of lines) {
    validateQuantity(line.quantity, label);
    requestedByItem.set(
      line.item_id,
      (requestedByItem.get(line.item_id) ?? 0) + line.quantity,
    );
  }

  return requestedByItem;
}

export async function listDepartments() {
  const departments = await db.department.findMany({
    include: {
      _count: {
        select: {
          items: true,
          users: true,
        },
      },
    },
    orderBy: {
      name: "asc",
    },
  });

  return departments.map(mapDepartmentWithCount);
}

export async function createDepartment(input: CreateDepartmentInput) {
  const name = normalizeText(input.name);
  const code = optionalText(input.code);

  if (!name) {
    throw new InventoryError("Department name is required.");
  }

  const duplicate = await db.department.findFirst({
    where: {
      name: {
        equals: name,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
    },
  });

  if (duplicate) {
    throw new InventoryError("Department name must be unique.");
  }

  const timestamp = createTimestamp();

  const department = await db.department.create({
    data: {
      id: nextId("dept"),
      name,
      code,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  });

  return mapDepartment(department);
}

export async function updateDepartment(input: UpdateDepartmentInput) {
  const name = normalizeText(input.name);
  const code = optionalText(input.code);

  if (!name) {
    throw new InventoryError("Department name is required.");
  }

  const department = await db.department.findUnique({
    where: { id: input.id },
    select: { id: true },
  });

  if (!department) {
    throw new InventoryError("Department was not found.");
  }

  const duplicate = await db.department.findFirst({
    where: {
      id: {
        not: input.id,
      },
      name: {
        equals: name,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
    },
  });

  if (duplicate) {
    throw new InventoryError("Department name must be unique.");
  }

  const updatedDepartment = await db.department.update({
    where: { id: input.id },
    data: {
      name,
      code,
      updatedAt: createTimestamp(),
    },
  });

  return mapDepartment(updatedDepartment);
}

export async function listUsersByDepartment(departmentId: string) {
  await requireDepartment(departmentId);

  const users = await db.user.findMany({
    where: {
      departmentId,
    },
    orderBy: [
      {
        fullName: "asc",
      },
      {
        createdAt: "asc",
      },
    ],
  });

  return users.map(mapUser);
}

export async function createUser(input: CreateUserInput) {
  const fullName = normalizeText(input.full_name);
  const badgeCode = optionalText(input.badge_code);

  if (!fullName) {
    throw new InventoryError("User name is required.");
  }

  const department = await requireDepartment(input.department_id ?? null);

  const user = await db.user.create({
    data: {
      id: nextId("user"),
      fullName,
      role: toPrismaRole(input.role),
      badgeCode,
      departmentId: department?.id ?? null,
      createdAt: createTimestamp(),
      updatedAt: createTimestamp(),
    },
  });

  return mapUser(user);
}

export async function updateUser(input: UpdateUserInput) {
  const fullName = normalizeText(input.full_name);
  const badgeCode = optionalText(input.badge_code);

  if (!fullName) {
    throw new InventoryError("User name is required.");
  }

  const existingUser = await requireUser(input.id);
  const department = await requireDepartment(input.department_id ?? null);

  const updatedUser = await db.user.update({
    where: {
      id: existingUser.id,
    },
    data: {
      fullName,
      role: toPrismaRole(input.role),
      badgeCode,
      departmentId: department?.id ?? null,
      updatedAt: createTimestamp(),
    },
  });

  return mapUser(updatedUser);
}

export async function deleteUser(userId: string) {
  const existingUser = await requireUser(userId);

  await db.user.delete({
    where: {
      id: existingUser.id,
    },
  });
}

export async function listItems() {
  const items = await db.item.findMany({
    include: {
      department: true,
      _count: {
        select: {
          movements: true,
        },
      },
    },
    orderBy: {
      name: "asc",
    },
  });

  return items.map(mapItem);
}

export async function listItemsByDepartment(departmentId: string | null) {
  const items = await db.item.findMany({
    where: {
      departmentId,
    },
    include: {
      department: true,
      _count: {
        select: {
          movements: true,
        },
      },
    },
    orderBy: {
      name: "asc",
    },
  });

  return items.map(mapItem);
}

export async function searchItems(query: string) {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return listItems();
  }

  const items = await db.item.findMany({
    where: {
      OR: [
        {
          name: {
            contains: normalizedQuery,
            mode: "insensitive",
          },
        },
        {
          id: {
            contains: normalizedQuery,
            mode: "insensitive",
          },
        },
        {
          description: {
            contains: normalizedQuery,
            mode: "insensitive",
          },
        },
      ],
    },
    include: {
      department: true,
      _count: {
        select: {
          movements: true,
        },
      },
    },
    orderBy: {
      name: "asc",
    },
  });

  return items.map(mapItem);
}

export async function findItemById(itemId: string) {
  const item = await db.item.findUnique({
    where: { id: itemId },
    include: {
      department: true,
      _count: {
        select: {
          movements: true,
        },
      },
    },
  });

  return item ? mapItem(item) : null;
}

export async function createItem(input: Omit<CreateItemInput, "id">) {
  const name = normalizeText(input.name);
  const description = optionalText(input.description);

  if (!name) {
    throw new InventoryError("Item name is required.");
  }

  validateNonNegative(input.current_stock, "Current stock");
  validateNonNegative(input.minimum_stock, "Minimum stock");

  const department = await requireDepartment(input.department_id ?? null);
  const itemId = await createUniqueItemId(name);

  const item = await db.$transaction(async (tx) => {
    const timestamp = createTimestamp();
    const createdItem = await tx.item.create({
      data: {
        id: itemId,
        name,
        unit: input.unit,
        currentStock: input.current_stock,
        minimumStock: input.minimum_stock,
        departmentId: department?.id ?? null,
        description,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    });

    if (input.current_stock > 0) {
      const openingUser = await tx.user.findFirst({
        orderBy: {
          createdAt: "asc",
        },
      });

      if (openingUser) {
        await tx.stockMovement.create({
          data: {
            id: nextId("mov"),
            itemId: createdItem.id,
            movementType: "stock_in",
            quantity: input.current_stock,
            unit: input.unit,
            performedByUserId: openingUser.id,
            note: "Opening stock",
            reference: null,
            createdAt: timestamp,
          },
        });
      }
    }

    return createdItem;
  });

  return mapItemBase(item);
}

export async function updateItem(input: UpdateItemInput) {
  const item = await requireItem(input.id);
  const name = normalizeText(input.name);
  const description = optionalText(input.description);

  if (!name) {
    throw new InventoryError("Item name is required.");
  }

  validateNonNegative(input.minimum_stock, "Minimum stock");

  const department = await requireDepartment(input.department_id ?? null);

  const updatedItem = await db.item.update({
    where: { id: item.id },
    data: {
      name,
      unit: input.unit,
      minimumStock: input.minimum_stock,
      departmentId: department?.id ?? null,
      description,
      updatedAt: createTimestamp(),
    },
  });

  return mapItemBase(updatedItem);
}

export async function applyStockIn(input: StockInInput) {
  validateQuantity(input.quantity, "Stock-in quantity");

  const [item, user] = await Promise.all([
    requireItem(input.item_id),
    requireUser(input.performed_by_user_id),
  ]);

  const updatedItem = await db.$transaction(async (tx) => {
    const timestamp = createTimestamp();
    const nextItem = await tx.item.update({
      where: { id: item.id },
      data: {
        currentStock: {
          increment: input.quantity,
        },
        updatedAt: timestamp,
      },
    });

    await tx.stockMovement.create({
      data: {
        id: nextId("mov"),
        itemId: item.id,
        movementType: "stock_in",
        quantity: input.quantity,
        unit: item.unit,
        performedByUserId: user.id,
        note: optionalText(input.note),
        reference: optionalText(input.reference),
        createdAt: timestamp,
      },
    });

    return nextItem;
  });

  return mapItemBase(updatedItem);
}

export async function applyStockInBatch(input: StockInBatchInput) {
  await requireUser(input.performed_by_user_id);

  if (input.lines.length === 0) {
    throw new InventoryError("Stock-in needs at least one item.");
  }

  const requestedByItem = aggregateLines(input.lines, "Stock-in quantity");
  const itemIds = [...requestedByItem.keys()];
  const items = await db.item.findMany({
    where: {
      id: {
        in: itemIds,
      },
    },
  });

  if (items.length !== itemIds.length) {
    throw new InventoryError("Item was not found.");
  }

  const itemsById = new Map(items.map((item) => [item.id, item]));

  const updatedItems = await db.$transaction(async (tx) => {
    const timestamp = createTimestamp();

    for (const [itemId, quantity] of requestedByItem.entries()) {
      const item = itemsById.get(itemId);
      if (!item) {
        throw new InventoryError("Item was not found.");
      }

      await tx.item.update({
        where: { id: itemId },
        data: {
          currentStock: {
            increment: quantity,
          },
          updatedAt: timestamp,
        },
      });

      await tx.stockMovement.create({
        data: {
          id: nextId("mov"),
          itemId,
          movementType: "stock_in",
          quantity,
          unit: item.unit,
          performedByUserId: input.performed_by_user_id,
          createdAt: timestamp,
        },
      });
    }

    return tx.item.findMany({
      where: {
        id: {
          in: itemIds,
        },
      },
    });
  });

  return updatedItems.map(mapItemBase);
}

export async function applyCheckout(input: CheckoutInput) {
  await requireUser(input.performed_by_user_id);

  if (input.lines.length === 0) {
    throw new InventoryError("Checkout needs at least one item.");
  }

  const requestedByItem = aggregateLines(input.lines, "Checkout quantity");
  const itemIds = [...requestedByItem.keys()];

  const updatedItems = await db.$transaction(async (tx) => {
    const items = await tx.item.findMany({
      where: {
        id: {
          in: itemIds,
        },
      },
    });

    if (items.length !== itemIds.length) {
      throw new InventoryError("Item was not found.");
    }

    const itemsById = new Map(items.map((item) => [item.id, item]));

    for (const [itemId, quantity] of requestedByItem.entries()) {
      const item = itemsById.get(itemId);

      if (!item) {
        throw new InventoryError("Item was not found.");
      }

      if (quantity > item.currentStock) {
        throw new InventoryError(`Not enough stock for ${item.name}.`);
      }
    }

    const timestamp = createTimestamp();

    for (const [itemId, quantity] of requestedByItem.entries()) {
      const item = itemsById.get(itemId);
      if (!item) {
        throw new InventoryError("Item was not found.");
      }

      await tx.item.update({
        where: { id: itemId },
        data: {
          currentStock: {
            decrement: quantity,
          },
          updatedAt: timestamp,
        },
      });

      await tx.stockMovement.create({
        data: {
          id: nextId("mov"),
          itemId,
          movementType: "checkout",
          quantity,
          unit: item.unit,
          performedByUserId: input.performed_by_user_id,
          note: optionalText(input.note),
          reference: optionalText(input.reference),
          createdAt: timestamp,
        },
      });
    }

    return tx.item.findMany({
      where: {
        id: {
          in: itemIds,
        },
      },
    });
  });

  return updatedItems.map(mapItemBase);
}

export async function listItemMovements(
  itemId: string,
): Promise<ItemMovementRecord[]> {
  const item = await db.item.findUnique({
    where: { id: itemId },
    select: { id: true },
  });

  if (!item) {
    throw new InventoryError("Item was not found.");
  }

  const movements = await db.stockMovement.findMany({
    where: {
      itemId,
    },
    include: {
      item: true,
      performer: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return movements.map(mapMovement);
}

export async function getInventorySnapshot(): Promise<InventorySnapshot> {
  const [departments, items] = await Promise.all([
    listDepartments(),
    listItems(),
  ]);

  return {
    departments,
    items,
  };
}

export async function getUsers() {
  const users = await db.user.findMany({
    orderBy: [
      {
        createdAt: "asc",
      },
      {
        fullName: "asc",
      },
    ],
  });

  return users.map(mapUser);
}
