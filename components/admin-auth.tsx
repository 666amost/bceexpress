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
import { Loader2, ShieldAlert, Eye, EyeOff } from "lucide-react" // Menambahkan Eye dan EyeOff
import { useRouter } from "next/navigation"

export function AdminAuth() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  // State baru untuk mengontrol visibilitas password
  const [showPassword, setShowPassword] = useState(false); // State untuk toggle password

  const router = useRouter()

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
        // Tampilkan pesan error yang lebih user-friendly untuk kredensial tidak valid
         if (error.message.includes("Invalid login credentials") || error.message.includes("Email not confirmed")) {
             setError("Invalid email or password.");
         } else {
             setError(error.message);
         }
        setIsLoading(false)
        return
      }

      // Jika login berhasil, cek role user
      // Pastikan data.user tidak null sebelum mengakses id
      if (!data?.user) {
           setError("Login failed, user data not retrieved.");
           await supabaseClient.auth.signOut(); // Logout jika status tidak jelas
           setIsLoading(false);
           return;
      }


      const { data: userData, error: userError } = await supabaseClient
        .from("users")
        .select("role")
        .eq("id", data.user.id) // Menggunakan id dari data user hasil login
        .single()

      if (userError) {
        console.error("User role check error:", userError.message)
        setError("Error verifying user role")
        await supabaseClient.auth.signOut(); // Logout jika gagal cek role
        setIsLoading(false)
        return
      }

      // Cek apakah role user adalah admin atau leader
      if (userData.role !== "admin" && userData.role !== "leader") {
        setError("Access denied. Admin or Leader privileges required.")
        await supabaseClient.auth.signOut() // Logout jika role tidak sesuai
        setIsLoading(false)
        return
      }

      // Redirect ke leader dashboard jika role sesuai
      router.push("/leader/dashboard")
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
           {/* Menggunakan flex untuk mensejajarkan ikon ShieldAlert dengan judul */}
          <div className="flex items-center gap-2">
             <ShieldAlert className="h-6 w-6 text-primary" /> {/* Ikon Admin */}
            <CardTitle className="text-2xl font-bold">Admin Portal</CardTitle>
          </div>
          <CardDescription>Login to access the admin dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              {/* Menambahkan ikon error jika diperlukan */}
              {/* <AlertCircle className="h-4 w-4 mr-2" /> */}
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleLogin}>
            <div className="space-y-4">
              {/* Input Email */}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label> {/* ID "email" */}
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@bceexpress.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                />
              </div>
              {/* Input Password - Dengan Fitur Show/Hide */}
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label> {/* ID "password" */}
                {/* Container relatif untuk input dan ikon mata */}
                <div className="relative">
                  {/* Komponen Input Password */}
                  <Input
                    id="password"
                    // Atribut 'type' dikontrol oleh state showPassword
                    type={showPassword ? "text" : "password"}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                    // Tambahkan padding kanan untuk memberi ruang ikon
                    // Sesuaikan nilai pr- jika ikon terpotong atau terlalu jauh
                    className="pr-10" // Contoh: pr-8, pr-10, pr-12
                  />
                  {/* Tombol ikon mata (Show/Hide Password) */}
                  <button
                    type="button" // Penting: type="button" mencegah submit form
                    onClick={togglePasswordVisibility}
                    // Posisi absolut di tepi kanan input
                    // flex items-center untuk memusatkan ikon secara vertikal di dalam tombol
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                  >
                    {/* Tampilkan ikon EyeOff jika password terlihat, Eye jika tersembunyi */}
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" /> // Ikon "sembunyikan" (mata dicoret)
                    ) : (
                      <Eye className="h-5 w-5" /> // Ikon "tampilkan" (mata terbuka)
                    )}
                  </button>
                </div>
              </div>
              {/* Tombol Submit Login */}
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
