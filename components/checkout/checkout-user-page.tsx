import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { User } from "@/lib/inventory/types";

export function CheckoutUserPage({ users }: { users: User[] }) {
  return (
    <div className="flex min-h-[72vh] items-center justify-center px-4 py-8 sm:px-6">
      <Card className="w-full max-w-3xl">
        <CardHeader className="space-y-3">
          <Badge variant="outline" className="w-fit">
            Step 1 of 2
          </Badge>
          <CardTitle>Select user</CardTitle>
          <CardDescription>
            Choose who is checking out inventory before selecting items for the
            batch.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {users.map((user) => (
              <Link
                key={user.id}
                href={`/checkout/${user.id}`}
                className="rounded-2xl border border-border bg-background px-4 py-4 transition-colors hover:bg-muted/40"
              >
                <p className="font-medium">{user.full_name}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {user.role}
                </p>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
