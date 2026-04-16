"use client";

import type { ComponentProps } from "react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Edit3Icon, PlusIcon, Trash2Icon, UsersIcon } from "lucide-react";

import {
  createDepartmentAction,
  createUserAction,
  deleteUserAction,
  updateDepartmentAction,
  updateUserAction,
} from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type {
  CreateUserInput,
  DepartmentWithCount,
  UpdateUserInput,
  User,
  UserRole,
} from "@/lib/inventory/types";

type DepartmentFormState = {
  name: string;
  code: string;
};

type UserFormState = {
  full_name: string;
  role: UserRole;
  badge_code: string;
  department_id: string;
};

const emptyDepartmentForm: DepartmentFormState = {
  name: "",
  code: "",
};

const emptyUserForm: UserFormState = {
  full_name: "",
  role: "operator",
  badge_code: "",
  department_id: "",
};

const roleOptions: Array<{ value: UserRole; label: string }> = [
  { value: "operator", label: "Operator" },
  { value: "manager", label: "Manager" },
  { value: "admin", label: "Admin" },
];

function FieldLabel({ children }: { children: string }) {
  return <p className="text-sm font-medium text-foreground">{children}</p>;
}

function SelectField(props: ComponentProps<"select">) {
  return (
    <select
      {...props}
      className={cn(
        "flex h-11 w-full rounded-xl border border-border bg-background px-3 text-sm shadow-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50",
        props.className,
      )}
    />
  );
}

export function DepartmentsPage({
  initialDepartments,
  initialUsers,
}: {
  initialDepartments: DepartmentWithCount[];
  initialUsers: User[];
}) {
  const [departments, setDepartments] = useState(initialDepartments);
  const [users, setUsers] = useState(initialUsers);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<
    string | null
  >(initialDepartments[0]?.id ?? null);
  const [openCreateDepartment, setOpenCreateDepartment] = useState(false);
  const [editingDepartmentId, setEditingDepartmentId] = useState<string | null>(
    null,
  );
  const [departmentForm, setDepartmentForm] =
    useState<DepartmentFormState>(emptyDepartmentForm);
  const [openCreateUser, setOpenCreateUser] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userForm, setUserForm] = useState<UserFormState>(emptyUserForm);
  const [openDeleteUser, setOpenDeleteUser] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [departmentError, setDepartmentError] = useState<string | null>(null);
  const [userError, setUserError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setDepartments(initialDepartments);
  }, [initialDepartments]);

  useEffect(() => {
    setUsers(initialUsers);
  }, [initialUsers]);

  useEffect(() => {
    if (departments.length === 0) {
      setSelectedDepartmentId(null);
      return;
    }

    if (
      !selectedDepartmentId ||
      !departments.some((department) => department.id === selectedDepartmentId)
    ) {
      setSelectedDepartmentId(departments[0]?.id ?? null);
    }
  }, [departments, selectedDepartmentId]);

  const selectedDepartment = useMemo(
    () =>
      departments.find(
        (department) => department.id === selectedDepartmentId,
      ) ?? null,
    [departments, selectedDepartmentId],
  );

  const editingDepartment = useMemo(
    () =>
      departments.find((department) => department.id === editingDepartmentId) ??
      null,
    [departments, editingDepartmentId],
  );

  const departmentUsers = useMemo(() => {
    if (!selectedDepartmentId) {
      return [];
    }

    return users
      .filter((user) => user.department_id === selectedDepartmentId)
      .sort((left, right) => left.full_name.localeCompare(right.full_name));
  }, [selectedDepartmentId, users]);

  const editingUser = useMemo(
    () => users.find((user) => user.id === editingUserId) ?? null,
    [editingUserId, users],
  );

  const userCountByDepartment = useMemo(() => {
    const counts = new Map<string, number>();

    for (const user of users) {
      if (!user.department_id) {
        continue;
      }

      counts.set(user.department_id, (counts.get(user.department_id) ?? 0) + 1);
    }

    return counts;
  }, [users]);

  function syncDepartments(nextDepartments: DepartmentWithCount[]) {
    setDepartments(nextDepartments);
  }

  function syncUsers(
    nextUsers: User[],
    nextSelectedDepartmentId?: string | null,
  ) {
    setUsers(nextUsers);

    if (nextSelectedDepartmentId) {
      setSelectedDepartmentId(nextSelectedDepartmentId);
    }
  }

  function openCreateDepartmentDialog() {
    setDepartmentForm(emptyDepartmentForm);
    setDepartmentError(null);
    setOpenCreateDepartment(true);
  }

  function openEditDepartmentDialog(department: DepartmentWithCount) {
    setDepartmentForm({
      name: department.name,
      code: department.code ?? "",
    });
    setDepartmentError(null);
    setEditingDepartmentId(department.id);
  }

  function closeDepartmentDialogs() {
    setOpenCreateDepartment(false);
    setEditingDepartmentId(null);
    setDepartmentError(null);
  }

  function openCreateUserDialog() {
    setUserForm({
      ...emptyUserForm,
      department_id: selectedDepartmentId ?? "",
    });
    setUserError(null);
    setOpenCreateUser(true);
  }

  function openEditUserDialog(user: User) {
    setUserForm({
      full_name: user.full_name,
      role: user.role,
      badge_code: user.badge_code ?? "",
      department_id: user.department_id ?? "",
    });
    setUserError(null);
    setEditingUserId(user.id);
  }

  function closeUserDialogs() {
    setOpenCreateUser(false);
    setEditingUserId(null);
    setUserError(null);
  }

  function openDeleteUserDialog(userId: string) {
    setDeletingUserId(userId);
    setOpenDeleteUser(true);
  }

  function closeDeleteUserDialog() {
    setOpenDeleteUser(false);
    setDeletingUserId(null);
  }

  function handleDeleteUser() {
    if (!deletingUserId) {
      return;
    }

    startTransition(async () => {
      const result = await deleteUserAction(deletingUserId);

      if (!result.ok) {
        setUserError(result.error);
        return;
      }

      syncUsers(result.data.users);
      closeDeleteUserDialog();
    });
  }

  function handleCreateDepartment() {
    startTransition(async () => {
      const result = await createDepartmentAction(departmentForm);

      if (!result.ok) {
        setDepartmentError(result.error);
        return;
      }

      syncDepartments(result.data.departments);
      closeDepartmentDialogs();
    });
  }

  function handleUpdateDepartment() {
    if (!editingDepartment) {
      return;
    }

    startTransition(async () => {
      const result = await updateDepartmentAction({
        id: editingDepartment.id,
        ...departmentForm,
      });

      if (!result.ok) {
        setDepartmentError(result.error);
        return;
      }

      syncDepartments(result.data.departments);
      closeDepartmentDialogs();
    });
  }

  function handleCreateUser() {
    if (!selectedDepartmentId) {
      return;
    }

    startTransition(async () => {
      const result = await createUserAction({
        full_name: userForm.full_name,
        role: userForm.role,
        badge_code: userForm.badge_code || null,
        department_id: userForm.department_id || null,
      } satisfies CreateUserInput);

      if (!result.ok) {
        setUserError(result.error);
        return;
      }

      syncUsers(result.data.users, result.data.selectedDepartmentId);
      closeUserDialogs();
    });
  }

  function handleUpdateUser() {
    if (!editingUser) {
      return;
    }

    startTransition(async () => {
      const result = await updateUserAction({
        id: editingUser.id,
        full_name: userForm.full_name,
        role: userForm.role,
        badge_code: userForm.badge_code || null,
        department_id: userForm.department_id || null,
      } satisfies UpdateUserInput);

      if (!result.ok) {
        setUserError(result.error);
        return;
      }

      syncUsers(result.data.users, result.data.selectedDepartmentId);
      closeUserDialogs();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {departments.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No departments yet</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Create your first department to start assigning users.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
          <Card className="overflow-hidden">
            <CardHeader className="border-b border-border">
              <div className="flex items-center justify-between">
                <CardTitle>Departments</CardTitle>
                <Button onClick={openCreateDepartmentDialog}>
                  <PlusIcon data-icon="inline-start" />
                  New department
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="flex flex-col">
                {departments.map((department) => {
                  const isSelected = department.id === selectedDepartmentId;

                  return (
                    <button
                      key={department.id}
                      type="button"
                      onClick={() => setSelectedDepartmentId(department.id)}
                      className={cn(
                        "flex items-center justify-between gap-3 border-b border-border px-6 py-4 text-left transition-colors last:border-b-0 hover:bg-muted/40",
                        isSelected && "bg-muted",
                      )}
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {department.name}
                        </p>
                        <p className="truncate text-sm text-muted-foreground">
                          {department.code
                            ? `Code ${department.code}`
                            : "No code"}
                        </p>
                      </div>
                      <Badge variant="outline">
                        {userCountByDepartment.get(department.id) ?? 0} users
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="min-w-0">
            <CardHeader className="flex-row items-start justify-between gap-4 border-b border-border">
              <div className="space-y-2">
                <CardTitle>{selectedDepartment?.name}</CardTitle>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">
                    {selectedDepartment?.code
                      ? `Code ${selectedDepartment.code}`
                      : "No code"}
                  </Badge>
                  <Badge variant="outline">
                    {selectedDepartment?.item_count ?? 0} items
                  </Badge>
                  <Badge variant="outline">
                    {departmentUsers.length} users
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selectedDepartment ? (
                  <Button
                    variant="outline"
                    onClick={() => openEditDepartmentDialog(selectedDepartment)}
                  >
                    <Edit3Icon data-icon="inline-start" />
                    Edit department
                  </Button>
                ) : null}
                <Button
                  onClick={openCreateUserDialog}
                  disabled={!selectedDepartment}
                >
                  <PlusIcon data-icon="inline-start" />
                  New user
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {departmentUsers.length === 0 ? (
                <div className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-border bg-muted/20 p-8 text-center">
                  <UsersIcon className="size-8 text-muted-foreground" />
                  <p className="font-medium">No users in this department yet</p>
                  <p className="text-sm text-muted-foreground">
                    Add a user to start assigning people to{" "}
                    {selectedDepartment?.name}.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {departmentUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-muted/20 p-4 cursor-pointer hover:bg-muted/40 transition-colors"
                      onClick={() => openEditUserDialog(user)}
                    >
                      <div className="min-w-0 space-y-1">
                        <p className="truncate font-medium">{user.full_name}</p>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline">
                            {roleOptions.find(
                              (role) => role.value === user.role,
                            )?.label ?? user.role}
                          </Badge>
                          <Badge variant="outline">
                            {user.badge_code
                              ? `Badge ${user.badge_code}`
                              : "No badge"}
                          </Badge>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDeleteUserDialog(user.id);
                        }}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2Icon data-icon="inline-start" />
                        Delete
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog
        open={openCreateDepartment}
        onOpenChange={setOpenCreateDepartment}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create department</DialogTitle>
          </DialogHeader>
          <div className="mt-6 flex flex-col gap-4">
            <div className="space-y-2">
              <FieldLabel>Name</FieldLabel>
              <Input
                value={departmentForm.name}
                onChange={(event) =>
                  setDepartmentForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="Department name"
              />
            </div>
            <div className="space-y-2">
              <FieldLabel>Code</FieldLabel>
              <Input
                value={departmentForm.code}
                onChange={(event) =>
                  setDepartmentForm((current) => ({
                    ...current,
                    code: event.target.value,
                  }))
                }
                placeholder="Code"
              />
            </div>
            {departmentError ? (
              <p className="text-sm text-destructive">{departmentError}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDepartmentDialogs}>
              Cancel
            </Button>
            <Button onClick={handleCreateDepartment} disabled={isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editingDepartment)}
        onOpenChange={(open) => (!open ? closeDepartmentDialogs() : null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit department</DialogTitle>
          </DialogHeader>
          <div className="mt-6 flex flex-col gap-4">
            <div className="space-y-2">
              <FieldLabel>Name</FieldLabel>
              <Input
                value={departmentForm.name}
                onChange={(event) =>
                  setDepartmentForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="Department name"
              />
            </div>
            <div className="space-y-2">
              <FieldLabel>Code</FieldLabel>
              <Input
                value={departmentForm.code}
                onChange={(event) =>
                  setDepartmentForm((current) => ({
                    ...current,
                    code: event.target.value,
                  }))
                }
                placeholder="Code"
              />
            </div>
            {departmentError ? (
              <p className="text-sm text-destructive">{departmentError}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDepartmentDialogs}>
              Cancel
            </Button>
            <Button onClick={handleUpdateDepartment} disabled={isPending}>
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openCreateUser} onOpenChange={setOpenCreateUser}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create user</DialogTitle>
          </DialogHeader>
          <div className="mt-6 flex flex-col gap-4">
            <div className="space-y-2">
              <FieldLabel>Full name</FieldLabel>
              <Input
                value={userForm.full_name}
                onChange={(event) =>
                  setUserForm((current) => ({
                    ...current,
                    full_name: event.target.value,
                  }))
                }
                placeholder="Full name"
              />
            </div>
            <div className="space-y-2">
              <FieldLabel>Role</FieldLabel>
              <SelectField
                value={userForm.role}
                onChange={(event) =>
                  setUserForm((current) => ({
                    ...current,
                    role: event.target.value as UserRole,
                  }))
                }
              >
                {roleOptions.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </SelectField>
            </div>
            <div className="space-y-2">
              <FieldLabel>Badge code</FieldLabel>
              <Input
                value={userForm.badge_code}
                onChange={(event) =>
                  setUserForm((current) => ({
                    ...current,
                    badge_code: event.target.value,
                  }))
                }
                placeholder="Badge code"
              />
            </div>
            <div className="space-y-2">
              <FieldLabel>Department</FieldLabel>
              <SelectField
                value={userForm.department_id}
                onChange={(event) =>
                  setUserForm((current) => ({
                    ...current,
                    department_id: event.target.value,
                  }))
                }
              >
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </SelectField>
            </div>
            {userError ? (
              <p className="text-sm text-destructive">{userError}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeUserDialogs}>
              Cancel
            </Button>
            <Button onClick={handleCreateUser} disabled={isPending}>
              Save user
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editingUser)}
        onOpenChange={(open) => (!open ? closeUserDialogs() : null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit user</DialogTitle>
          </DialogHeader>
          <div className="mt-6 flex flex-col gap-4">
            <div className="space-y-2">
              <FieldLabel>Full name</FieldLabel>
              <Input
                value={userForm.full_name}
                onChange={(event) =>
                  setUserForm((current) => ({
                    ...current,
                    full_name: event.target.value,
                  }))
                }
                placeholder="Full name"
              />
            </div>
            <div className="space-y-2">
              <FieldLabel>Role</FieldLabel>
              <SelectField
                value={userForm.role}
                onChange={(event) =>
                  setUserForm((current) => ({
                    ...current,
                    role: event.target.value as UserRole,
                  }))
                }
              >
                {roleOptions.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </SelectField>
            </div>
            <div className="space-y-2">
              <FieldLabel>Badge code</FieldLabel>
              <Input
                value={userForm.badge_code}
                onChange={(event) =>
                  setUserForm((current) => ({
                    ...current,
                    badge_code: event.target.value,
                  }))
                }
                placeholder="Badge code"
              />
            </div>
            <div className="space-y-2">
              <FieldLabel>Department</FieldLabel>
              <SelectField
                value={userForm.department_id}
                onChange={(event) =>
                  setUserForm((current) => ({
                    ...current,
                    department_id: event.target.value,
                  }))
                }
              >
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </SelectField>
            </div>
            {userError ? (
              <p className="text-sm text-destructive">{userError}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeUserDialogs}>
              Cancel
            </Button>
            <Button onClick={handleUpdateUser} disabled={isPending}>
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={openDeleteUser} onOpenChange={setOpenDeleteUser}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this user? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={closeDeleteUserDialog}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete user
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
