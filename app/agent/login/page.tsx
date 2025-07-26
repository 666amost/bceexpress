"use client"
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseClient } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Navbar } from '@/components/navbar';

export default function AgentLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const savedEmail = localStorage.getItem('rememberedAgentEmail');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  const handleLogin = async () => {
    const { data, error: authError } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (authError) {
      setError('Login gagal. Periksa email dan password.');
    } else {
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (user) {
        const userId = user.id;
        const { data: userData, error: queryError } = await supabaseClient.from('users').select('role, origin_branch').eq('id', userId).single();
        if (queryError) {
          setError('Error saat memeriksa role: ' + queryError.message);
        } else if (userData && userData.role === 'agent') {
          // Agent berhasil login
          router.push('/agent');
          if (rememberMe) {
            localStorage.setItem('rememberedAgentEmail', email);
          } else {
            localStorage.removeItem('rememberedAgentEmail');
          }
        } else {
          setError(`Anda tidak memiliki akses sebagai agent. Role Anda: ${userData ? userData.role : 'Tidak ditemukan'}.`);
          await supabaseClient.auth.signOut();
        }
      } else {
        setError('User data tidak ditemukan. Silakan coba lagi.');
      }
    }
  };

  const handleLogout = async () => {
    await supabaseClient.auth.signOut();
    router.push('/');
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Navbar />
      <div className="flex items-center justify-center flex-1 p-4">
        <Card className="w-full max-w-md shadow-lg rounded-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-green-600">Login Portal Agent</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input 
              placeholder="Email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              className="border rounded-md p-2 w-full focus:ring-green-500"
            />
            <Input 
              placeholder="Password" 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              className="border rounded-md p-2 w-full focus:ring-green-500"
            />
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input 
                  type="checkbox" 
                  checked={rememberMe} 
                  onChange={(e) => setRememberMe(e.target.checked)} 
                  className="mr-2 accent-green-600"
                />
                <label className="text-sm text-gray-600">Remember Me</label>
              </div>
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <Button 
              onClick={handleLogin} 
              className="w-full bg-green-600 hover:bg-green-700 rounded-md py-2 text-white font-semibold"
            >
              Login
            </Button>
            <Button 
              onClick={handleLogout} 
              variant="secondary" 
              className="w-full bg-gray-300 hover:bg-gray-400 rounded-md py-2 text-gray-800"
            >
              Logout
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
