"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ActivityIcon,
  BoxesIcon,
  Building2Icon,
  PanelLeftCloseIcon,
  ScanLineIcon,
} from "lucide-react";

import { buttonVariants, Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/inventory", label: "Inventory", icon: BoxesIcon },
  { href: "/checkout", label: "Checkout", icon: ScanLineIcon },
  { href: "/activity", label: "Activity", icon: ActivityIcon },
  { href: "/departments", label: "Departments", icon: Building2Icon },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [desktopSheetOpen, setDesktopSheetOpen] = useState(false);

  function renderNavigation(onNavigate?: () => void) {
    return (
      <nav className="flex flex-col gap-2">
        {navigation.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                buttonVariants({ variant: active ? "default" : "ghost", size: "lg" }),
                "justify-start rounded-2xl px-4",
              )}
            >
              <Icon data-icon="inline-start" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f1e8] text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 flex w-20 flex-col items-center gap-3 border-r border-border/70 bg-background/90 p-3 backdrop-blur">
        <Sheet open={desktopSheetOpen} onOpenChange={setDesktopSheetOpen}>
          <SheetTrigger render={<Button variant="outline" size="icon-lg" aria-label="Open navigation" />}>
            <PanelLeftCloseIcon />
          </SheetTrigger>
          <SheetContent side="left" className="p-6">
            <SheetHeader>
              <SheetTitle className="sr-only">Navigation</SheetTitle>
            </SheetHeader>
            <div className="mt-8">{renderNavigation(() => setDesktopSheetOpen(false))}</div>
          </SheetContent>
        </Sheet>

        <nav className="flex flex-col gap-2">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                aria-label={item.label}
                className={cn(
                  buttonVariants({ variant: active ? "default" : "ghost", size: "icon-lg" }),
                  "rounded-2xl",
                )}
              >
                <Icon />
                <span className="sr-only">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="min-h-screen pl-20">
        <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
