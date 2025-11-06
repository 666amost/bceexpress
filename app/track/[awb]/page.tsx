import { Suspense } from "react"
import type { Metadata } from "next"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { TrackingResults } from "@/components/tracking-results"
import { TrackingResultsSkeleton } from "@/components/tracking-results-skeleton"

export default async function TrackPage(props: { params: Promise<{ awb: string }> }) {
  const params = await props.params;
  const { awb } = params

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-8 min-h-[calc(100vh-headerHeight-footerHeight)]">
        <Suspense fallback={<TrackingResultsSkeleton />}>
          <TrackingResults awbNumber={awb} />
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
}
