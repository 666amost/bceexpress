"use client"
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseClient } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Navbar } from '@/components/navbar';

export default function BranchLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async () => {
    const { data, error: authError } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (authError) {
      setError('Login gagal. Periksa email dan password.');
    } else {
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (user) {
        const userId = user.id;  // Get UUID from user
        const { data: userData, error: queryError } = await supabaseClient.from('users').select('role').eq('id', userId).single();
        if (queryError) {
          setError('Error saat memeriksa role: ' + queryError.message);
        } else if (userData && userData.role === 'branch') {
          router.push('/branch');
        } else {
          setError(`Anda tidak memiliki akses dengan role ini. Role Anda: ${userData ? userData.role : 'Tidak ditemukan'}.`);
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
    <div>
      <Navbar />
      <Card>
        <CardHeader>
          <CardTitle>Login Portal Branch</CardTitle>
        </CardHeader>
        <CardContent>
          <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <p className="text-red-500">{error}</p>}
          <Button onClick={handleLogin}>Login</Button>
          <Button onClick={handleLogout} variant="secondary">Logout</Button>
        </CardContent>
      </Card>
    </div>
  );
} 