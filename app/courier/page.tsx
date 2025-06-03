import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { CourierAuth } from "@/components/courier-auth"

export default function CourierPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-8">
        <CourierAuth />
      </main>
      <Footer />
    </div>
  )
}
