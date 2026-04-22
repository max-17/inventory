import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function SkeletonBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-2xl bg-muted ${className}`} />;
}

export default function CheckoutLoading() {
  return (
    <div className="flex min-h-[72vh] items-center justify-center px-4 py-8 sm:px-6">
      <Card className="w-full max-w-3xl">
        <CardHeader className="space-y-3">
          <Badge variant="outline" className="w-fit">
            <SkeletonBlock className="h-4 w-12" />
          </Badge>
          <SkeletonBlock className="h-8 w-48" />
          <SkeletonBlock className="h-5 w-96 max-w-full" />
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-24 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
