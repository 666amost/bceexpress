import React, { useEffect, useState } from "react";
import { supabaseClient } from "../lib/auth";

export default function HistoryManifest({ mode }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editData, setEditData] = useState(null);
  const [editPotongan, setEditPotongan] = useState(0);
  const [editStatus, setEditStatus] = useState('lunas');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    supabaseClient
      .from("manifest")
      .select("*")
      .order("awb_date", { ascending: false })
      .then(({ data }) => {
        setData(data || []);
        setLoading(false);
      });
  }, [saving]);

  const openEditModal = (row) => {
    setEditData(row);
    setEditPotongan(row.potongan || 0);
    setEditStatus(row.status_pelunasan || 'lunas');
  };
  const closeEditModal = () => {
    setEditData(null);
    setEditPotongan(0);
    setEditStatus('lunas');
  };
  const handleEditSave = async () => {
    setSaving(true);
    await supabaseClient
      .from('manifest')
      .update({ status_pelunasan: editStatus, potongan: editPotongan })
      .eq('id', editData.id);
    setSaving(false);
    closeEditModal();
  };

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 mb-2">
        <span>Search:</span>
        <input
          className="border rounded px-2 py-1 text-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by AWB, customer, etc."
        />
      </div>
      <div className="overflow-x-auto bg-white rounded shadow border">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-blue-600 text-white">
              <th className="px-2 py-2">No STTB</th>
              <th className="px-2 py-2">Tgl STTB</th>
              <th className="px-2 py-2">Kirim Via</th>
              <th className="px-2 py-2">Tujuan</th>
              <th className="px-2 py-2">Agen/Customer</th>
              <th className="px-2 py-2">Bayar</th>
              <th className="px-2 py-2">Pengirim</th>
              <th className="px-2 py-2">Penerima</th>
              <th className="px-2 py-2">Kg</th>
              <th className="px-2 py-2">Total STTB</th>
              {mode === "pelunasan" && <th className="px-2 py-2">Aksi</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={mode === "pelunasan" ? 11 : 10} className="text-center py-4">Loading...</td></tr>
            ) : data.length === 0 ? (
              <tr><td colSpan={mode === "pelunasan" ? 11 : 10} className="text-center py-4">Belum ada data manifest.</td></tr>
            ) : (
              data
                .filter(item =>
                  item.awb_no.toLowerCase().includes(search.toLowerCase()) ||
                  item.kota_tujuan.toLowerCase().includes(search.toLowerCase()) ||
                  item.agent_customer.toLowerCase().includes(search.toLowerCase()) ||
                  item.nama_pengirim.toLowerCase().includes(search.toLowerCase()) ||
                  item.nama_penerima.toLowerCase().includes(search.toLowerCase())
                )
                .map((m, idx) => (
                  <tr key={m.id || m.awb_no || idx} className="even:bg-blue-50">
                    <td className="px-2 py-1">{m.awb_no}</td>
                    <td className="px-2 py-1">{m.awb_date}</td>
                    <td className="px-2 py-1">{m.kirim_via}</td>
                    <td className="px-2 py-1">{m.kota_tujuan}</td>
                    <td className="px-2 py-1">{m.agent_customer}</td>
                    <td className="px-2 py-1">{m.metode_pembayaran}</td>
                    <td className="px-2 py-1">{m.nama_pengirim}</td>
                    <td className="px-2 py-1">{m.nama_penerima}</td>
                    <td className="px-2 py-1 text-right">{m.berat_kg}</td>
                    <td className="px-2 py-1 text-right">{m.total}</td>
                    {mode === "pelunasan" && (
                      <td className="px-2 py-1 flex gap-2">
                        <button className="bg-yellow-400 hover:bg-yellow-500 text-xs px-2 py-1 rounded" onClick={() => openEditModal(m)}>Edit</button>
                        <button className="bg-green-400 hover:bg-green-500 text-xs px-2 py-1 rounded" onClick={() => window.print()}>Reprint</button>
                        <button className="bg-red-400 hover:bg-red-500 text-xs px-2 py-1 rounded" onClick={async () => {
                          if (confirm('Hapus item ini?')) {
                            await supabaseClient.from('manifest').delete().eq('id', m.id);
                            setData(data.filter(item => item.id !== m.id));
                          }
                        }}>Delete</button>
                      </td>
                    )}
                  </tr>
                ))
            )}
          </tbody>
        </table>
      </div>
      {/* Modal Edit */}
      {editData && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Edit Pelunasan Resi</h3>
              <button onClick={closeEditModal} className="text-gray-500 hover:text-red-500 text-xl">&times;</button>
            </div>
            <div className="mb-4">
              <div className="mb-2">No STTB: <b>{editData.awb_no}</b></div>
              <div className="mb-2">Total: <b>{editData.total}</b></div>
              <div className="mb-2">
                <label className="block text-xs font-semibold mb-1">Status Pelunasan</label>
                <select className="border rounded px-2 py-1 text-sm w-full" value={editStatus} onChange={e=>setEditStatus(e.target.value)}>
                  <option value="lunas">Lunas</option>
                  <option value="belum lunas">Belum Lunas</option>
                </select>
              </div>
              <div className="mb-2">
                <label className="block text-xs font-semibold mb-1">Potongan</label>
                <input type="number" className="border rounded px-2 py-1 text-sm w-full" value={editPotongan} onChange={e=>setEditPotongan(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={closeEditModal} className="px-4 py-2 bg-gray-200 rounded">Batal</button>
              <button onClick={handleEditSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700">{saving ? 'Menyimpan...' : 'Simpan'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 