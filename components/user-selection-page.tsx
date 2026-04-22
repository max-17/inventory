"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { User } from "@/lib/inventory/types";

export function UserSelectionPage({
  users,
  title,
  description,
  basePath,
}: {
  users: User[];
  title: string;
  description: string;
  basePath: "checkout" | "inventory";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleSelectUser = (userId: string) => {
    startTransition(() => {
      router.push(`/${basePath}/${userId}`);
    });
  };

  return (
    <div className="flex min-h-[72vh] items-center justify-center px-4 py-8 sm:px-6">
      <Card className="w-full max-w-3xl">
        <CardHeader className="space-y-3">
          <Badge variant="outline" className="w-fit">
            Step 1 of 2
          </Badge>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {users.map((user) => (
              <button
                key={user.id}
                onClick={() => handleSelectUser(user.id)}
                disabled={isPending}
                className="rounded-2xl border border-border bg-background px-4 py-4 text-left transition-colors hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <p className="font-medium">{user.full_name}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {user.role}
                </p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
