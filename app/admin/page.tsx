import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { AdminAuth } from "@/components/admin-auth"

export default function AdminPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-8">
        <AdminAuth />
      </main>
      <Footer />
    </div>
  )
}
