import React, { useState } from 'react';
import { FaPlus, FaEdit, FaTrash } from 'react-icons/fa';

const dummyData = [
  { no: '11747/BCE/05/2025', tgl: '03-05-2025', customer: 'BAYAR TUJUAN OUTGOING PGK UDAR', ket: 'TRANSFER', total: '2.061.000' },
  { no: '11749/BCE/05/2025', tgl: '30-04-2025', customer: 'BAYAR TUJUAN OUTGOING PGK UDAR', ket: 'TRANSFER', total: '210.000' },
  { no: '11745/BCE/04/2025', tgl: '28-04-2025', customer: 'BAYAR TUJUAN OUTGOING PGK UDAR', ket: 'TRANSFER', total: '1.150.000' },
];

function ModalTambah({ open, onClose, onSubmit }) {
  const [form, setForm] = useState({
    no: '', tgl: '', customer: '', ket: '', total: ''
  });
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">Tambah Pelunasan Resi</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-red-500 text-xl">&times;</button>
        </div>
        <form className="flex flex-wrap gap-4" onSubmit={e => {e.preventDefault(); onSubmit(form);}}>
          <div className="flex flex-col w-40">
            <label className="text-xs font-semibold mb-1">No Bukti</label>
            <input className="border rounded px-2 py-1 text-sm" value={form.no} onChange={e=>setForm(f=>({...f,no:e.target.value}))} required />
          </div>
          <div className="flex flex-col w-32">
            <label className="text-xs font-semibold mb-1">Tgl Bayar</label>
            <input type="date" className="border rounded px-2 py-1 text-sm" value={form.tgl} onChange={e=>setForm(f=>({...f,tgl:e.target.value}))} required />
          </div>
          <div className="flex flex-col flex-1 min-w-[120px]">
            <label className="text-xs font-semibold mb-1">Customer</label>
            <input className="border rounded px-2 py-1 text-sm" value={form.customer} onChange={e=>setForm(f=>({...f,customer:e.target.value}))} required />
          </div>
          <div className="flex flex-col w-32">
            <label className="text-xs font-semibold mb-1">Keterangan</label>
            <input className="border rounded px-2 py-1 text-sm" value={form.ket} onChange={e=>setForm(f=>({...f,ket:e.target.value}))} required />
          </div>
          <div className="flex flex-col w-32">
            <label className="text-xs font-semibold mb-1">Total Bayar</label>
            <input className="border rounded px-2 py-1 text-sm" value={form.total} onChange={e=>setForm(f=>({...f,total:e.target.value}))} required />
          </div>
          <div className="flex items-end">
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700">Simpan</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PelunasanResi() {
  const [modal, setModal] = useState(false);
  const [data, setData] = useState(dummyData);
  const [search, setSearch] = useState('');

  const filtered = data.filter(row =>
    row.no.toLowerCase().includes(search.toLowerCase()) ||
    row.customer.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-bold text-blue-900">Data Payment</h2>
        <button onClick={()=>setModal(true)} className="flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded font-bold hover:bg-blue-700"><FaPlus/>Tambah Data</button>
      </div>
      <div className="flex items-center gap-2 mb-2">
        <span>Search:</span>
        <input className="border rounded px-2 py-1 text-sm" value={search} onChange={e=>setSearch(e.target.value)} />
      </div>
      <div className="overflow-x-auto bg-white rounded shadow border">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-blue-600 text-white">
              <th className="px-2 py-2">No Bukti</th>
              <th className="px-2 py-2">Tgl Bayar</th>
              <th className="px-2 py-2">Customer</th>
              <th className="px-2 py-2">Keterangan</th>
              <th className="px-2 py-2">Total Bayar</th>
              <th className="px-2 py-2">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, i) => (
              <tr key={i} className="even:bg-blue-50">
                <td className="px-2 py-1 whitespace-nowrap">{row.no}</td>
                <td className="px-2 py-1 whitespace-nowrap">{row.tgl}</td>
                <td className="px-2 py-1 whitespace-nowrap">{row.customer}</td>
                <td className="px-2 py-1 whitespace-nowrap">{row.ket}</td>
                <td className="px-2 py-1 whitespace-nowrap text-right">{row.total}</td>
                <td className="px-2 py-1 flex gap-2">
                  <button className="text-blue-600 hover:text-blue-900"><FaEdit/></button>
                  <button className="text-red-600 hover:text-red-900"><FaTrash/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Pagination dummy */}
      <div className="flex justify-between items-center mt-2 text-xs">
        <span>Showing 1 to {filtered.length} of {data.length} entries</span>
        <div className="flex gap-1">
          <button className="px-2 py-1 rounded bg-blue-100">1</button>
          <button className="px-2 py-1 rounded hover:bg-blue-100">2</button>
          <button className="px-2 py-1 rounded hover:bg-blue-100">3</button>
        </div>
      </div>
      <ModalTambah open={modal} onClose={()=>setModal(false)} onSubmit={f=>{setData(d=>[f,...d]);setModal(false);}}/>
    </div>
  );
} 