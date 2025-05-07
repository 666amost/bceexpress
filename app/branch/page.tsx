"use client"
// This is a new file for the branch dashboard
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AwbForm from '@/components/AwbForm';
import SidebarDashboard from '@/components/SidebarDashboard';
import HistoryManifest from '@/components/HistoryManifest';
import { FaPlus } from 'react-icons/fa';

// Placeholder komponen pelunasan dan payment jika belum ada
function PelunasanTable() {
  return <HistoryManifest mode="pelunasan" />;
}
function PaymentTable() {
  return <div className="mt-4 p-4 bg-blue-100 text-blue-900 rounded">Fitur Data Payment akan segera hadir.</div>;
}

export default function BranchDashboard() {
  const [selectedMenu, setSelectedMenu] = useState('awb');
  const [selectedSubMenu, setSelectedSubMenu] = useState('input');
  const [userRole, setUserRole] = useState<string | null>(null);
  const [showAwbForm, setShowAwbForm] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const checkAccess = async () => {
      const { data: { session }, error: sessionError } = await import('@/lib/auth').then(m => m.supabaseClient.auth.getSession());
      if (sessionError || !session || !session.user) {
        router.push('/branch/login');
        return;
      }
      const userId = session.user.id;
      const { data: userData, error: queryError } = await import('@/lib/auth').then(m => m.supabaseClient.from('users').select('role').eq('id', userId).single());
      if (queryError) {
        setUserRole('Error: ' + queryError.message);
      } else if (userData && userData.role === 'branch') {
        setUserRole(userData.role);
      } else {
        setUserRole(userData ? userData.role : 'Tidak ditemukan');
        router.push('/branch/login');
      }
    };
    checkAccess();
  }, [router]);

  if (userRole !== 'branch') {
    return <div>Anda tidak memiliki akses ke halaman ini. Role Anda: {userRole}. Silakan periksa role di Supabase.</div>;
  }

  return (
    <div className="flex min-h-screen bg-gray-100 relative">
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}
      
      <aside className={`fixed top-0 left-0 h-screen w-full md:w-72 z-50 bg-white flex flex-col select-none border-r border-gray-200 shadow-xl p-4 md:p-6 transition-all duration-300 overflow-y-auto transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <SidebarDashboard
          selectedMenu={selectedMenu}
          setSelectedMenu={setSelectedMenu}
          selectedSubMenu={selectedSubMenu}
          setSelectedSubMenu={setSelectedSubMenu}
        />
      </aside>
      
      <button
        className="md:hidden fixed top-4 left-4 z-60 bg-blue-600 text-white p-2 rounded-lg shadow-md"
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
      >
        {isSidebarOpen ? (
          // Close icon (X)
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          // Hamburger icon
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
          </svg>
        )}
      </button>
      
      <main className={`flex-1 p-4 md:p-8 w-full ${isSidebarOpen ? 'ml-72 md:ml-72' : 'md:ml-72'} z-10`}>
        <div className="bg-white rounded-xl shadow-xl p-8 w-full">
          {selectedMenu === 'awb' && selectedSubMenu === 'input' && (
            showAwbForm ? (
              <AwbForm onSuccess={() => setShowAwbForm(false)} onCancel={() => setShowAwbForm(false)} />
            ) : (
              <>
                <div className="flex justify-between items-center mb-2">
                  <h2 className="text-xl font-bold text-white bg-blue-600 px-4 py-2 rounded">History Manifest</h2>
                  <button
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700"
                    onClick={() => setShowAwbForm(true)}
                  >
                    <FaPlus /> Tambahkan
                  </button>
                </div>
                <HistoryManifest mode="" />
              </>
            )
          )}
          {selectedMenu === 'awb' && selectedSubMenu === 'pelunasan' && <PelunasanTable />}
          {selectedMenu === 'payment' && <PaymentTable />}
        </div>
      </main>
    </div>
  );
} 