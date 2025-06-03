import { CourierUpdateClientWrapper } from "@/components/courier-update-client-wrapper"

export default function CourierUpdatePage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">Update Shipment Status</h1>
          <CourierUpdateClientWrapper />
        </div>
      </main>
    </div>
  )
}
