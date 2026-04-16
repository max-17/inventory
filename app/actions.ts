"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/lib/action-result";
import { InventoryError } from "@/lib/inventory/service";
import {
  applyCheckout,
  applyStockIn,
  applyStockInBatch,
  createDepartment,
  createItem,
  createUser,
  deleteUser,
  getInventorySnapshot,
  getUsers,
  listDepartments,
  listItemMovements,
  updateDepartment,
  updateItem,
  updateUser,
} from "@/lib/inventory/service";
import type {
  CheckoutInput,
  CreateDepartmentInput,
  CreateItemInput,
  CreateUserInput,
  ItemMovementRecord,
  UpdateDepartmentInput,
  UpdateItemInput,
  UpdateUserInput,
} from "@/lib/inventory/types";

function getErrorMessage(error: unknown) {
  if (error instanceof InventoryError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong.";
}

export async function createDepartmentAction(
  input: CreateDepartmentInput,
): Promise<
  ActionResult<{ departments: Awaited<ReturnType<typeof listDepartments>> }>
> {
  try {
    await createDepartment(input);
    const departments = await listDepartments();
    revalidatePath("/departments");
    revalidatePath("/inventory");

    return {
      ok: true,
      data: { departments },
    };
  } catch (error) {
    return {
      ok: false,
      error: getErrorMessage(error),
    };
  }
}

export async function updateDepartmentAction(
  input: UpdateDepartmentInput,
): Promise<
  ActionResult<{ departments: Awaited<ReturnType<typeof listDepartments>> }>
> {
  try {
    await updateDepartment(input);
    const departments = await listDepartments();
    revalidatePath("/departments");
    revalidatePath("/inventory");

    return {
      ok: true,
      data: { departments },
    };
  } catch (error) {
    return {
      ok: false,
      error: getErrorMessage(error),
    };
  }
}

export async function createUserAction(
  input: CreateUserInput,
): Promise<
  ActionResult<{
    users: Awaited<ReturnType<typeof getUsers>>;
    selectedDepartmentId: string | null;
  }>
> {
  try {
    const user = await createUser(input);
    const users = await getUsers();
    revalidatePath("/departments");

    return {
      ok: true,
      data: {
        users,
        selectedDepartmentId: user.department_id,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: getErrorMessage(error),
    };
  }
}

export async function updateUserAction(
  input: UpdateUserInput,
): Promise<
  ActionResult<{
    users: Awaited<ReturnType<typeof getUsers>>;
    selectedDepartmentId: string | null;
  }>
> {
  try {
    const user = await updateUser(input);
    const users = await getUsers();
    revalidatePath("/departments");

    return {
      ok: true,
      data: {
        users,
        selectedDepartmentId: user.department_id,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: getErrorMessage(error),
    };
  }
}

export async function deleteUserAction(
  userId: string,
): Promise<ActionResult<{ users: Awaited<ReturnType<typeof getUsers>> }>> {
  try {
    await deleteUser(userId);
    const users = await getUsers();
    revalidatePath("/departments");

    return {
      ok: true,
      data: {
        users,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: getErrorMessage(error),
    };
  }
}

export async function createItemAction(
  input: Omit<CreateItemInput, "id">,
): Promise<
  ActionResult<{
    snapshot: Awaited<ReturnType<typeof getInventorySnapshot>>;
    itemId: string;
  }>
> {
  try {
    const item = await createItem(input);
    const snapshot = await getInventorySnapshot();
    revalidatePath("/inventory");
    revalidatePath("/checkout");

    return {
      ok: true,
      data: {
        snapshot,
        itemId: item.id,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: getErrorMessage(error),
    };
  }
}

export async function updateItemAction(
  input: UpdateItemInput,
): Promise<
  ActionResult<{
    snapshot: Awaited<ReturnType<typeof getInventorySnapshot>>;
    itemId: string;
  }>
> {
  try {
    const item = await updateItem(input);
    const snapshot = await getInventorySnapshot();
    revalidatePath("/inventory");
    revalidatePath("/checkout");

    return {
      ok: true,
      data: {
        snapshot,
        itemId: item.id,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: getErrorMessage(error),
    };
  }
}

export async function stockInAction(
  input: Parameters<typeof applyStockIn>[0],
): Promise<
  ActionResult<{
    snapshot: Awaited<ReturnType<typeof getInventorySnapshot>>;
    itemId: string;
  }>
> {
  try {
    const item = await applyStockIn(input);
    const snapshot = await getInventorySnapshot();
    revalidatePath("/inventory");
    revalidatePath("/checkout");

    return {
      ok: true,
      data: {
        snapshot,
        itemId: item.id,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: getErrorMessage(error),
    };
  }
}

export async function stockInBatchAction(
  input: Parameters<typeof applyStockInBatch>[0],
): Promise<
  ActionResult<{ snapshot: Awaited<ReturnType<typeof getInventorySnapshot>> }>
> {
  try {
    await applyStockInBatch(input);
    const snapshot = await getInventorySnapshot();
    revalidatePath("/inventory");
    revalidatePath("/checkout");

    return {
      ok: true,
      data: { snapshot },
    };
  } catch (error) {
    return {
      ok: false,
      error: getErrorMessage(error),
    };
  }
}

export async function checkoutAction(
  input: CheckoutInput,
): Promise<
  ActionResult<{ snapshot: Awaited<ReturnType<typeof getInventorySnapshot>> }>
> {
  try {
    await applyCheckout(input);
    const snapshot = await getInventorySnapshot();
    revalidatePath("/inventory");
    revalidatePath("/checkout");

    return {
      ok: true,
      data: { snapshot },
    };
  } catch (error) {
    return {
      ok: false,
      error: getErrorMessage(error),
    };
  }
}

export async function getItemHistoryAction(
  itemId: string,
): Promise<ActionResult<{ movements: ItemMovementRecord[] }>> {
  try {
    const movements = await listItemMovements(itemId);

    return {
      ok: true,
      data: { movements },
    };
  } catch (error) {
    return {
      ok: false,
      error: getErrorMessage(error),
    };
  }
}
