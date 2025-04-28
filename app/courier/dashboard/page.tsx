import { CourierDashboard } from "@/components/courier-dashboard"
import { ErrorBoundary } from "@/components/error-boundary"

export default function CourierDashboardPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <main className="flex-1 container mx-auto px-4 py-8">
        <ErrorBoundary>
          <CourierDashboard />
        </ErrorBoundary>
      </main>
    </div>
  )
}
