import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import { supabaseClient } from "@/lib/auth"
import { toast } from "sonner"

export function AdminLoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const router = useRouter()

  // Load saved credentials on mount
  useEffect(() => {
    const savedCredentials = localStorage.getItem("adminCredentials")
    if (savedCredentials) {
      const { email, password, rememberMe } = JSON.parse(savedCredentials)
      setEmail(email)
      setPassword(password)
      setRememberMe(rememberMe)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setError(error.message)
        return
      }

      // Check if user is admin
      const { data: userData, error: userError } = await supabaseClient
        .from("users")
        .select("role")
        .eq("id", data.user.id)
        .single()

      if (userError || userData?.role !== "admin") {
        setError("Unauthorized access. This portal is for administrators only.")
        await supabaseClient.auth.signOut()
        return
      }

      // Save credentials if remember me is checked
      if (rememberMe) {
        localStorage.setItem(
          "adminCredentials",
          JSON.stringify({
            email,
            password,
            rememberMe,
          })
        )
      } else {
        // Clear saved credentials if remember me is unchecked
        localStorage.removeItem("adminCredentials")
      }

      toast.success("Login berhasil!", {
        description: "Selamat datang kembali, Admin!",
      })

      router.push("/admin/dashboard")
    } catch (err) {
      console.error("Login error:", err)
      setError("An unexpected error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-sm space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold">Admin Login</h1>
        <p className="text-gray-500 dark:text-gray-400">Enter your credentials to access the admin portal</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            placeholder="admin@example.com"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            placeholder="Enter your password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="remember"
            checked={rememberMe}
            onCheckedChange={(checked) => setRememberMe(checked as boolean)}
          />
          <label
            htmlFor="remember"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Remember me
          </label>
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Logging in..." : "Login"}
        </Button>
      </form>
    </div>
  )
} 