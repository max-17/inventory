import { Card, CardContent, CardHeader } from "@/components/ui/card";

function SkeletonBlock({
  className,
}: {
  className: string;
}) {
  return <div className={`animate-pulse rounded-2xl bg-muted ${className}`} />;
}

export default function InventoryUserPageLoading() {
  return (
    <div className="space-y-6">
      <Card className="rounded-[2rem] border-border/80 bg-background/90">
        <CardHeader className="gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-3">
            <SkeletonBlock className="h-6 w-28 rounded-full" />
            <SkeletonBlock className="h-10 w-64 max-w-full" />
          </div>
          <SkeletonBlock className="h-10 w-32" />
        </CardHeader>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
        <Card className="rounded-[2rem]">
          <CardHeader className="space-y-3">
            <SkeletonBlock className="h-12 w-full" />
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <SkeletonBlock key={i} className="h-8 w-20" />
              ))}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-28 w-full rounded-3xl" />
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-[2rem]">
          <CardHeader className="space-y-3">
            <SkeletonBlock className="h-8 w-40 max-w-full" />
            <SkeletonBlock className="h-5 w-56 max-w-full" />
          </CardHeader>
          <CardContent className="space-y-4">
            <SkeletonBlock className="h-32 w-full" />
            <SkeletonBlock className="h-16 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
