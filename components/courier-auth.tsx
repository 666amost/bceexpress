"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input" // Menggunakan komponen Input dari shadcn/ui
import { Label } from "@/components/ui/label" // Menggunakan komponen Label dari shadcn/ui
import { Alert, AlertDescription } from "@/components/ui/alert"
import { supabaseClient } from "@/lib/auth"
// Import ikon yang dibutuhkan dari lucide-react
import { Loader2, Eye, EyeOff } from "lucide-react"

export function CourierAuth() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  // State baru untuk mengontrol visibilitas password
  const [showPassword, setShowPassword] = useState(false);

  // Fungsi untuk mengganti status visibilitas password
  const togglePasswordVisibility = () => {
    setShowPassword(prevShowPassword => !prevShowPassword);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      // Sign in with Supabase
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      })

      if (error) {
        console.error("Login error:", error.message)
        setError(error.message)
        // Periksa jika error spesifik terkait kredensial
        if (error.message.includes("Invalid login credentials") || error.message.includes("Email not confirmed")) {
             setError("Invalid email or password.");
        }
        setIsLoading(false)
        return
      }

      // Redirect to dashboard
      // Menggunakan window.location.href akan melakukan full page reload
      // Jika Anda menggunakan Next.js App Router, disarankan menggunakan router.push() dari next/navigation
      // const router = useRouter(); // Import useRouter di bagian atas
      // router.push("/courier/dashboard");
       window.location.href = "/courier/dashboard"

    } catch (err) {
      console.error("Unexpected login error:", err)
      setError("An unexpected error occurred. Please try again.")
      setIsLoading(false)
    }
  }

  return (
    <div className="flex justify-center items-center py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Courier Portal</CardTitle>
          <CardDescription>Login to access the courier portal</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleLogin}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="courier@bceexpress.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                {/* Container relatif untuk input dan ikon */}
                <div className="relative">
                  {/* Input Password */}
                  <Input
                    id="password"
                    // Atribut 'type' dikontrol oleh state showPassword
                    type={showPassword ? "text" : "password"}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                    // Tambahkan padding kanan untuk memberi ruang ikon
                    className="pr-10" // Sesuaikan nilai padding (pr-8, pr-10, dll) jika perlu
                  />
                  {/* Tombol ikon mata */}
                  <button
                    type="button" // Gunakan type="button" agar tidak submit form
                    onClick={togglePasswordVisibility}
                    // Posisi absolut di kanan
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                  >
                    {/* Tampilkan ikon EyeOff atau Eye berdasarkan state showPassword */}
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Please wait
                  </>
                ) : (
                  "Login"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
