import { LeaderDashboard } from "@/components/leader-dashboard"
import { LeaderAuthGuard } from "@/components/leader-auth-guard"
import { ErrorBoundary } from "@/components/error-boundary"

export default function AdminDashboardPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <main className="flex-1 container mx-auto px-4 py-8">
        <ErrorBoundary>
          <LeaderAuthGuard>
            <LeaderDashboard />
          </LeaderAuthGuard>
        </ErrorBoundary>
      </main>
    </div>
  )
}
