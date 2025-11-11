import { CourierDashboard } from "@/components/courier-dashboard"
import { ErrorBoundary } from "@/components/error-boundary"

export default function CourierDashboardPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1">
        <ErrorBoundary>
          <CourierDashboard />
        </ErrorBoundary>
      </main>
    </div>
  )
}
