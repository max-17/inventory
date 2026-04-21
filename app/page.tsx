import Link from "next/link";
import { ArrowDownLeftIcon, ArrowUpRightIcon } from "lucide-react";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const flows = [
  {
    href: "/inventory",
    label: "Stock In",
    description: "Add new stock, update quantities, and keep the inventory room replenished.",
    icon: ArrowDownLeftIcon,
    iconClassName: "bg-emerald-100 text-emerald-700",
  },
  {
    href: "/checkout",
    label: "Checkout",
    description: "Issue items to teammates quickly and record who took what.",
    icon: ArrowUpRightIcon,
    iconClassName: "bg-amber-100 text-amber-700",
  },
] as const;

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f5f1e8] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center justify-center">
        <section className="w-full rounded-[2rem] border border-border/80 bg-background/90 p-6 shadow-sm backdrop-blur sm:p-8 lg:p-10">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-medium uppercase tracking-[0.28em] text-muted-foreground">
              Inventory Workspace
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Choose how you want to move stock
            </h1>
            <p className="mt-4 text-base text-muted-foreground sm:text-lg">
              Start with the workflow you need right now. Both paths take you straight into
              the existing workspace screens.
            </p>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            {flows.map((flow) => {
              const Icon = flow.icon;

              return (
                <Link
                  key={flow.href}
                  href={flow.href}
                  className="group block rounded-[2rem] outline-none transition-transform hover:-translate-y-1 focus-visible:ring-4 focus-visible:ring-ring/30"
                >
                  <Card className="h-full rounded-[2rem] border-border/80 bg-card/95 shadow-sm transition-colors group-hover:border-primary/35 group-hover:bg-background">
                    <CardHeader className="gap-5 p-7 sm:p-8">
                      <div
                        className={`flex size-16 items-center justify-center rounded-3xl ${flow.iconClassName}`}
                      >
                        <Icon className="size-7" />
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-4">
                          <CardTitle className="text-2xl sm:text-3xl">{flow.label}</CardTitle>
                          <ArrowUpRightIcon className="size-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:text-foreground" />
                        </div>
                        <CardDescription className="max-w-md text-sm leading-6 sm:text-base">
                          {flow.description}
                        </CardDescription>
                      </div>
                    </CardHeader>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
