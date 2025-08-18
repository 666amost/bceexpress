"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input" // Menggunakan komponen Input dari shadcn/ui
import { Label } from "@/components/ui/label" // Menggunakan komponen Label dari shadcn/ui
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import { supabaseClient } from "@/lib/auth"
// Import ikon yang dibutuhkan dari lucide-react
import { Loader2, Eye, EyeOff } from "lucide-react"
import { isInCapacitor, handleCapacitorLoginSuccess } from "@/lib/capacitor-utils"

export function CourierAuth() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  // State baru untuk mengontrol visibilitas password
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false)

  // Load saved credentials on mount
  useEffect(() => {
    const savedCredentials = localStorage.getItem("courierCredentials")
    if (savedCredentials) {
      const { email, password, rememberMe } = JSON.parse(savedCredentials)
      setLoginEmail(email)
      setLoginPassword(password)
      setRememberMe(rememberMe)
    }
  }, [])

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
        setError(error.message)
        // Periksa jika error spesifik terkait kredensial
        if (error.message.includes("Invalid login credentials") || error.message.includes("Email not confirmed")) {
             setError("Invalid email or password.");
        }
        setIsLoading(false)
        return
      }

      // Save credentials if remember me is checked
      if (rememberMe) {
        localStorage.setItem(
          "courierCredentials",
          JSON.stringify({
            email: loginEmail,
            password: loginPassword,
            rememberMe,
          })
        )
      } else {
        // Clear saved credentials if remember me is unchecked
        localStorage.removeItem("courierCredentials")
      }

      // Redirect to dashboard
      if (isInCapacitor()) {
        console.warn('CourierAuth: Using Capacitor login success flow');
        handleCapacitorLoginSuccess();
        setIsLoading(false);
        return; // Don't redirect in Capacitor
      }

      // Normal web redirect
      console.warn('CourierAuth: Using web browser redirect flow');
      window.location.href = "/courier/dashboard"

    } catch (err) {
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

              <div className="flex items-center space-x-3 py-1">
                <Checkbox
                  id="remember"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                  style={{
                    width: '16px',
                    height: '16px',
                    minWidth: '16px',
                    minHeight: '16px',
                    appearance: 'none',
                    WebkitAppearance: 'none'
                  }}
                />
                <Label
                  htmlFor="remember"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer select-none"
                >
                  Remember me
                </Label>
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
