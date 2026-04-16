export type Unit = "count" | "kg" | "litre";
export type UserRole = "operator" | "manager" | "admin";
export type MovementType = "stock_in" | "checkout";

export type Department = {
  id: string;
  name: string;
  code: string | null;
  created_at: string;
  updated_at: string;
};

export type User = {
  id: string;
  full_name: string;
  role: UserRole;
  badge_code: string | null;
  department_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Item = {
  id: string;
  name: string;
  unit: Unit;
  current_stock: number;
  minimum_stock: number;
  department_id: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type StockMovement = {
  id: string;
  item_id: string;
  movement_type: MovementType;
  quantity: number;
  unit: Unit;
  performed_by_user_id: string;
  note: string | null;
  reference: string | null;
  created_at: string;
};

export type InventoryDatabase = {
  departments: Department[];
  users: User[];
  items: Item[];
  stock_movements: StockMovement[];
};

export type DepartmentWithCount = Department & {
  item_count: number;
  user_count: number;
};

export type ItemWithRelations = Item & {
  department: Department | null;
  movement_count: number;
  low_stock: boolean;
};

export type ItemMovementRecord = StockMovement & {
  item: Item;
  performer: User | null;
};

export type InventorySnapshot = {
  departments: DepartmentWithCount[];
  items: ItemWithRelations[];
};

export type CreateDepartmentInput = {
  name: string;
  code?: string | null;
};

export type UpdateDepartmentInput = {
  id: string;
  name: string;
  code?: string | null;
};

export type CreateUserInput = {
  full_name: string;
  role: UserRole;
  badge_code?: string | null;
  department_id?: string | null;
};

export type UpdateUserInput = {
  id: string;
  full_name: string;
  role: UserRole;
  badge_code?: string | null;
  department_id?: string | null;
};

export type CreateItemInput = {
  id: string;
  name: string;
  unit: Unit;
  current_stock: number;
  minimum_stock: number;
  department_id?: string | null;
  description?: string | null;
};

export type UpdateItemInput = {
  id: string;
  name: string;
  unit: Unit;
  minimum_stock: number;
  department_id?: string | null;
  description?: string | null;
};

export type StockInInput = {
  item_id: string;
  quantity: number;
  performed_by_user_id: string;
  note?: string | null;
  reference?: string | null;
};

export type StockInLineInput = {
  item_id: string;
  quantity: number;
};

export type StockInBatchInput = {
  lines: StockInLineInput[];
  performed_by_user_id: string;
};

export type CheckoutLineInput = {
  item_id: string;
  quantity: number;
};

export type CheckoutInput = {
  lines: CheckoutLineInput[];
  performed_by_user_id: string;
  note?: string | null;
  reference?: string | null;
};
