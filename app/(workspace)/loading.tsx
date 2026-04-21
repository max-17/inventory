import { Card, CardContent, CardHeader } from "@/components/ui/card";

function SkeletonBlock({
  className,
}: {
  className: string;
}) {
  return <div className={`animate-pulse rounded-2xl bg-muted ${className}`} />;
}

export default function WorkspaceLoading() {
  return (
    <div className="space-y-6">
      <Card className="rounded-[2rem] border-border/80 bg-background/90">
        <CardHeader className="gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-3">
            <SkeletonBlock className="h-6 w-28 rounded-full" />
            <SkeletonBlock className="h-10 w-64 max-w-full" />
            <SkeletonBlock className="h-5 w-80 max-w-full" />
          </div>
          <div className="flex flex-wrap gap-3">
            <SkeletonBlock className="h-20 w-32" />
            <SkeletonBlock className="h-20 w-32" />
            <SkeletonBlock className="h-20 w-32" />
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
        <Card className="rounded-[2rem]">
          <CardHeader className="space-y-3">
            <SkeletonBlock className="h-8 w-48 max-w-full" />
            <SkeletonBlock className="h-5 w-72 max-w-full" />
          </CardHeader>
          <CardContent className="space-y-4">
            <SkeletonBlock className="h-12 w-full" />
            <SkeletonBlock className="h-32 w-full" />
            <SkeletonBlock className="h-32 w-full" />
          </CardContent>
        </Card>

        <Card className="rounded-[2rem]">
          <CardHeader className="space-y-3">
            <SkeletonBlock className="h-8 w-40 max-w-full" />
            <SkeletonBlock className="h-5 w-56 max-w-full" />
          </CardHeader>
          <CardContent className="space-y-4">
            <SkeletonBlock className="h-24 w-full" />
            <SkeletonBlock className="h-24 w-full" />
            <SkeletonBlock className="h-24 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
