import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function TrackingResultsSkeleton() {
  return (
    <Card className="shadow-lg border border-border/40">
      <CardHeader className="bg-primary text-primary-foreground p-6 h-28 flex flex-col justify-center">
        <div className="flex justify-between items-center mb-2">
          <Skeleton className="h-8 w-48 bg-primary-foreground/50" />
          <Skeleton className="h-6 w-32 bg-primary-foreground/50" />
        </div>
        <Skeleton className="h-8 w-60 bg-muted/50 rounded-md" />
      </CardHeader>

      <CardContent className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-muted/50 p-4 rounded-lg h-36">
              <Skeleton className="h-5 w-24 mb-2" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ))}
        </div>

        <div className="mb-8 h-20">
          <Skeleton className="h-6 w-64 mb-4" />

          <div className="tracking-progress relative h-6 bg-gray-200 rounded-full overflow-hidden">
            <Skeleton className="h-full w-1/2 rounded-full" />
          </div>

          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>

        <div className="mb-8">
          <Skeleton className="h-6 w-40 mb-4" />
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex h-28">
                <div className="mr-4 flex-shrink-0">
                  <Skeleton className="w-10 h-10 rounded-full" />
                </div>
                <div className="flex-grow">
                  <div className="flex justify-between items-center mb-1">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <Skeleton className="h-4 w-full mb-1" />
                  <Skeleton className="h-4 w-2/3" />
                  {i === 1 && <Skeleton className="h-24 w-48 mt-2 rounded-md" />}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
