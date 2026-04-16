import { DepartmentsPage } from "@/components/departments/departments-page";
import { getUsers, listDepartments } from "@/lib/inventory/service";

export default async function DepartmentsRoute() {
  const [departments, users] = await Promise.all([listDepartments(), getUsers()]);

  return <DepartmentsPage initialDepartments={departments} initialUsers={users} />;
}
