"use client"

import dynamic from "next/dynamic"
import { Loader2 } from "lucide-react"

// Import the component with no SSR
const CourierUpdateForm = dynamic(
  () => import("@/components/courier-update-form").then((mod) => mod.CourierUpdateForm),
  {
    ssr: false,
    loading: () => (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    ),
  },
)

export function CourierUpdateClientWrapper() {
  return <CourierUpdateForm />
}
