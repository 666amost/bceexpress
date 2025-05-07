import React, { useState, useMemo } from 'react';
import { supabaseClient } from '../lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';
import { Label } from './ui/label';
import PrintLayout from './PrintLayout';

const kotaWilayah = {
  bangka: ['Pangkal Pinang', 'Sungailiat', 'Belinyu', 'Jebus', 'Koba', 'Toboali', 'Mentok'],
  'kalimantan barat': ['Pontianak', 'Singkawang', 'Sungai Pinyuh'],
  belitung: ['Tj Pandan'],
  bali: [],
};

const hargaPerKg = {
  'Pangkal Pinang': 28000,
  'Sungailiat': 30000,
  'Belinyu': 28000,
  'Jebus': 28000,
  'Koba': 31000,
  'Toboali': 32000,
  'Mentok': 32000,
  'Pontianak': 32000,
  'Singkawang': 35000,
  'Sungai Pinyuh': 35000,
  'Tj Pandan': 28000,
};

const agentList = [
  'GLC UDR', 'GLC COD UDR', 'GLC COD DRT', 'GLC DRT', 'Duta Garden', 'Poris Residence', 'Kartini', 'Otty Official'
];

const metodePembayaran = ['cash', 'transfer'];
const kirimVia = ['udara', 'darat'];
const kotaTujuan = ['bangka', 'kalimantan barat', 'belitung', 'bali'];

function generateAwbNo() {
  const timestamp = Date.now().toString();
  const lastSixDigits = timestamp.slice(-6);
  return 'BCE' + lastSixDigits;
}

export default function AwbForm({ onSuccess, onCancel }) {
  const [form, setForm] = useState({
    awb_no: '',
    awb_date: new Date().toISOString().slice(0, 10),
    kirim_via: '',
    kota_tujuan: '',
    wilayah: '',
    metode_pembayaran: '',
    agent_customer: '',
    nama_pengirim: '',
    nomor_pengirim: '',
    nama_penerima: '',
    nomor_penerima: '',
    alamat_penerima: '',
    coli: 1,
    berat_kg: 1,
    harga_per_kg: 0,
    sub_total: 0,
    biaya_admin: 0,
    biaya_packaging: 0,
    biaya_transit: 0,
    total: 0,
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const wilayahOptions = useMemo(() => kotaWilayah[form.kota_tujuan] || [], [form.kota_tujuan]);

  React.useEffect(() => {
    if (form.wilayah && hargaPerKg[form.wilayah]) {
      setForm(f => ({ ...f, harga_per_kg: hargaPerKg[form.wilayah] }));
    }
  }, [form.wilayah]);

  React.useEffect(() => {
    const sub_total = form.berat_kg * form.harga_per_kg;
    const total = sub_total + Number(form.biaya_admin) + Number(form.biaya_packaging) + Number(form.biaya_transit);
    setForm(f => ({ ...f, sub_total, total }));
  }, [form.berat_kg, form.harga_per_kg, form.biaya_admin, form.biaya_packaging, form.biaya_transit]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
    setError('');
    setSuccess('');
  };

  const handleSelectChange = (name, value) => {
    setForm(f => ({ ...f, [name]: value }));
    setError('');
    setSuccess('');
  };

  const handleGenerateAwb = (e) => {
    e.preventDefault();
    setForm(f => ({ ...f, awb_no: generateAwbNo() }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!form.awb_no || !form.kota_tujuan || !form.wilayah || !form.nama_pengirim || !form.nama_penerima) {
      setError('Mohon lengkapi semua field wajib.');
      return;
    }
    const { error: sbError } = await supabaseClient.from('manifest').insert([{ ...form }]);
    if (sbError) {
      setError('Gagal menyimpan data: ' + sbError.message);
    } else {
      setSuccess('Data berhasil disimpan!');
      setShowPrintPreview(true);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleClosePrintPreview = () => {
    setShowPrintPreview(false);
    if (onSuccess) onSuccess();
  };

  return (
    <>
      <form onSubmit={handleSubmit} autoComplete="off" className="w-full max-w-none mx-0 px-0 py-6 bg-transparent">
        <h2 className="text-2xl font-extrabold text-blue-900 mb-4 tracking-tight">Input AWB Manifest</h2>
        {error && <div className="mb-2 p-2 bg-red-100 text-red-700 rounded-lg font-semibold shadow">{error}</div>}
        {success && <div className="mb-2 p-2 bg-green-100 text-green-700 rounded-lg font-semibold shadow">{success}</div>}
        {/* Section 1: Data Pengiriman - Made responsive to stack on mobile */}
        <section className="bg-white/70 rounded-lg p-3 border border-blue-100 shadow flex flex-col md:flex-wrap md:flex-row gap-4 items-end mb-2">
          <div className="flex flex-col w-full md:w-40 md:ml-auto">
            <label className="text-xs font-semibold mb-1 text-blue-900">Nomor Resi (AWB)</label>
            <div className="flex w-full gap-2 items-center">
              <input type="text" name="awb_no" value={form.awb_no} onChange={handleChange} required className="rounded border border-blue-200 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 flex-grow px-2 py-1 text-sm shadow-sm transition bg-white" />
              <button onClick={handleGenerateAwb} type="button" className="flex-shrink-0 px-4 py-1 bg-blue-600 text-white font-bold rounded shadow hover:bg-blue-700 text-sm">Generate</button>
            </div>
          </div>
          <div className="flex flex-col w-full md:w-40 md:ml-auto">
            <label className="text-xs font-semibold mb-1 text-blue-900">Tanggal AWB</label>
            <input type="date" name="awb_date" value={form.awb_date} onChange={handleChange} required className="rounded border border-blue-200 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 w-full px-2 py-1 text-sm shadow-sm transition bg-white" />
          </div>
          <div className="flex flex-col w-full md:w-32 md:ml-auto">
            <label className="text-xs font-semibold mb-1 text-blue-900">Kirim Via</label>
            <select name="kirim_via" value={form.kirim_via} onChange={handleChange} required className="rounded border border-blue-200 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 w-full px-2 py-1 text-sm shadow-sm transition bg-white">
              <option value="">Pilih</option>
              {kirimVia.map(opt => <option key={opt} value={opt}>{opt.toUpperCase()}</option>)}
            </select>
          </div>
          <div className="flex flex-col w-full md:w-40 md:ml-auto">
            <label className="text-xs font-semibold mb-1 text-blue-900">Kota Tujuan</label>
            <select name="kota_tujuan" value={form.kota_tujuan} onChange={handleChange} required className="rounded border border-blue-200 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 w-full px-2 py-1 text-sm shadow-sm transition bg-white">
              <option value="">Pilih</option>
              {kotaTujuan.map(opt => <option key={opt} value={opt}>{opt.replace(/\b\w/g, l => l.toUpperCase())}</option>)}
            </select>
          </div>
          <div className="flex flex-col w-full md:w-36 md:ml-auto">
            <label className="text-xs font-semibold mb-1 text-blue-900">Wilayah</label>
            <select name="wilayah" value={form.wilayah} onChange={handleChange} required disabled={!form.kota_tujuan} className="rounded border border-blue-200 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 w-full px-2 py-1 text-sm shadow-sm transition bg-white disabled:bg-gray-100">
              <option value="">Pilih</option>
              {wilayahOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
          <div className="flex flex-col w-full md:w-40 md:ml-auto">
            <label className="text-xs font-semibold mb-1 text-blue-900">Agent</label>
            <select name="agent_customer" value={form.agent_customer} onChange={handleChange} required className="rounded border border-blue-200 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 w-full px-2 py-1 text-sm shadow-sm transition bg-white">
              <option value="">Pilih</option>
              {agentList.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
        </section>
        {/* Section 2: Data Penerima */}
        <section className="bg-white/70 rounded-lg p-3 border border-blue-100 shadow flex flex-wrap gap-4 items-end mb-2">
          <div className="flex flex-col w-40 min-w-[140px]">
            <label className="text-xs font-semibold mb-1 text-blue-900">Nama Pengirim</label>
            <input type="text" name="nama_pengirim" value={form.nama_pengirim} onChange={handleChange} required className="rounded border border-blue-200 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 w-full px-2 py-1 text-sm shadow-sm transition bg-white" />
          </div>
          <div className="flex flex-col w-40 min-w-[140px]">
            <label className="text-xs font-semibold mb-1 text-blue-900">Nomor Pengirim</label>
            <input type="text" name="nomor_pengirim" value={form.nomor_pengirim} onChange={handleChange} required className="rounded border border-blue-200 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 w-full px-2 py-1 text-sm shadow-sm transition bg-white" />
          </div>
          <div className="flex flex-col w-40 min-w-[140px]">
            <label className="text-xs font-semibold mb-1 text-blue-900">Nama Penerima</label>
            <input type="text" name="nama_penerima" value={form.nama_penerima} onChange={handleChange} required className="rounded border border-blue-200 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 w-full px-2 py-1 text-sm shadow-sm transition bg-white" />
          </div>
          <div className="flex flex-col w-40 min-w-[140px]">
            <label className="text-xs font-semibold mb-1 text-blue-900">Nomor Penerima</label>
            <input type="text" name="nomor_penerima" value={form.nomor_penerima} onChange={handleChange} required className="rounded border border-blue-200 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 w-full px-2 py-1 text-sm shadow-sm transition bg-white" />
          </div>
          <div className="flex flex-col flex-1 min-w-[180px]">
            <label className="text-xs font-semibold mb-1 text-blue-900">Alamat Penerima</label>
            <textarea id="alamat_penerima" name="alamat_penerima" value={form.alamat_penerima} onChange={handleChange} required className="rounded border border-blue-200 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 w-full px-2 py-1 text-sm shadow-sm transition bg-white min-h-[32px]" />
          </div>
          <div className="flex flex-col w-24 min-w-[70px]">
            <label className="text-xs font-semibold mb-1 text-blue-900">Coli</label>
            <input type="number" name="coli" value={form.coli} onChange={handleChange} min={1} required className="rounded border border-blue-200 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 w-full px-2 py-1 text-sm shadow-sm transition bg-white" />
          </div>
        </section>
        {/* Section 3: Ongkos & Biaya - Made responsive */}
        <section className="bg-white/70 rounded-lg p-3 border border-blue-100 shadow flex flex-col md:flex-wrap md:flex-row gap-4 items-end mb-2">
          <div className="flex flex-col w-full md:w-28">
            <label className="text-xs font-semibold mb-1 text-blue-900">Berat (kg)</label>
            <input type="number" name="berat_kg" value={form.berat_kg} onChange={handleChange} min={1} step={0.1} required className="rounded border border-blue-200 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 w-full px-2 py-1 text-sm shadow-sm transition bg-white" />
          </div>
          <div className="flex flex-col w-full md:w-28">
            <label className="text-xs font-semibold mb-1 text-blue-900">Harga/kg</label>
            <input type="number" name="harga_per_kg" value={form.harga_per_kg} readOnly className="bg-gray-100 rounded border border-blue-200 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 w-full px-2 py-1 text-sm shadow-sm transition" />
          </div>
          <div className="flex flex-col w-full md:w-28">
            <label className="text-xs font-semibold mb-1 text-blue-900">Subtotal</label>
            <input type="number" name="sub_total" value={form.sub_total} readOnly className="bg-gray-100 rounded border border-blue-200 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 w-full px-2 py-1 text-sm shadow-sm transition" />
          </div>
          <div className="flex flex-col w-full md:w-28">
            <label className="text-xs font-semibold mb-1 text-blue-900">Biaya Admin</label>
            <input type="number" name="biaya_admin" value={form.biaya_admin} onChange={handleChange} className="rounded border border-blue-200 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 w-full px-2 py-1 text-sm shadow-sm transition bg-white" />
          </div>
          <div className="flex flex-col w-full md:w-28">
            <label className="text-xs font-semibold mb-1 text-blue-900">Biaya Packaging</label>
            <input type="number" name="biaya_packaging" value={form.biaya_packaging} onChange={handleChange} className="rounded border border-blue-200 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 w-full px-2 py-1 text-sm shadow-sm transition bg-white" />
          </div>
          <div className="flex flex-col w-full md:w-28">
            <label className="text-xs font-semibold mb-1 text-blue-900">Biaya Transit</label>
            <input type="number" name="biaya_transit" value={form.biaya_transit} onChange={handleChange} className="rounded border border-blue-200 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 w-full px-2 py-1 text-sm shadow-sm transition bg-white" />
          </div>
          <div className="flex flex-col w-full md:w-32 md:ml-auto">
            <label className="text-xs font-semibold mb-1 text-blue-900">Total</label>
            <input type="number" name="total" value={form.total} readOnly className="bg-gray-100 rounded border border-blue-200 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 w-full px-2 py-1 text-base shadow-sm transition font-bold" />
          </div>
          <div className="flex flex-col w-full md:w-32 md:ml-auto">
            <label className="text-xs font-semibold mb-1 text-blue-900">Metode</label>
            <select name="metode_pembayaran" value={form.metode_pembayaran} onChange={handleChange} required className="rounded border border-blue-200 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 w-full px-2 py-1 text-sm shadow-sm transition bg-white">
              <option value="">Pilih</option>
              {metodePembayaran.map(opt => <option key={opt} value={opt}>{opt.toUpperCase()}</option>)}
            </select>
          </div>
        </section>
        <div className="flex flex-col md:flex-row justify-between mt-2">
          {onCancel && (
            <button type="button" onClick={onCancel} className="px-4 py-2 bg-gray-200 rounded mb-2 md:mb-0">Batal</button>
          )}
          <button type="submit" className="px-6 py-2 bg-blue-600 text-white font-bold rounded shadow-lg hover:bg-blue-700 transition text-base">SIMPAN DAN PRINT</button>
        </div>
      </form>

      {showPrintPreview && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white p-4 rounded-lg shadow-lg">
            <div className="mb-4">
              <PrintLayout data={form} />
            </div>
            <div className="flex justify-end gap-2 no-print">
              <button onClick={handleClosePrintPreview} className="px-4 py-2 bg-gray-200 rounded">Tutup</button>
              <button onClick={handlePrint} className="px-4 py-2 bg-blue-600 text-white rounded">Print</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 