import React, { useState, useEffect } from 'react';
import { FaPlus, FaEdit, FaTrash } from 'react-icons/fa';
import { supabaseClient } from '../lib/auth';  // Import for fetching data

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
  const [data, setData] = useState([]);  // Initialize as empty array, will be populated from Supabase
  const [search, setSearch] = useState('');
  const [agentList, setAgentList] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [loadingAgents, setLoadingAgents] = useState(true);

  useEffect(() => {
    async function fetchDataFromSupabase() {
      try {
        const { data: fetchedData, error } = await supabaseClient.from('manifest').select('awb_no, awb_date, nama_pengirim, total, buktimembayar, potongan');  // Added potongan to select
        if (error) {
          console.error('Error fetching data from manifest:', error);
          console.error('Error details: Code -', error?.code, 'Message -', error?.message);
          setData([]);  // Set to empty array on error
        } else {
          setData(fetchedData);  // Set the fetched data to state
        }
      } catch (err) {
        console.error('Unexpected error fetching data:', err);
        setData([]);
      }
    }
    fetchDataFromSupabase();
  }, []);  // Run once on component mount

  useEffect(() => {
    async function fetchAgents() {
      setLoadingAgents(true);
      try {
        const { data, error } = await supabaseClient.from('manifest').select('agent_customer');
        if (error) {
          console.error('Error fetching agents:', error);
          setAgentList([]);
        } else {
          const distinctAgents = [...new Set(data.map(item => item.agent_customer).filter(Boolean))];
          setAgentList(distinctAgents);
        }
      } catch (err) {
        console.error('Unexpected error in fetchAgents:', err);
        setAgentList([]);
      } finally {
        setLoadingAgents(false);
      }
    }
    fetchAgents();
  }, []);

  useEffect(() => {
    if (selectedAgent) {
      // This ensures the data is filtered based on selectedAgent
      // No changes needed here, as filtered array handles persistence
    }
  }, [selectedAgent, data]);  // Added data as dependency to re-filter if data changes

  const filtered = data.filter(row =>
    row.awb_no.toLowerCase().includes(search.toLowerCase()) ||
    row.nama_pengirim.toLowerCase().includes(search.toLowerCase()) ||
    (selectedAgent && row.agent_customer === selectedAgent)
  );

  const handleRowChange = (index, e) => {
    const { name, value, type, checked } = e.target;
    const updatedData = [...data];  // Create a copy of the data array
    if (name === 'potongan') {
      // Recalculate total when potongan changes
      const newPotongan = parseFloat(value) || 0;
      const newTotal = parseFloat(updatedData[index].total) - newPotongan;  // Subtract from original total
      updatedData[index] = {
        ...updatedData[index],
        [name]: type === 'checkbox' ? checked : value,
        total: isNaN(newTotal) ? updatedData[index].total : newTotal,  // Update total only if calculation is valid
      };
    } else {
      updatedData[index] = {
        ...updatedData[index],
        [name]: type === 'checkbox' ? checked : value,
      };
    }
    setData(updatedData);  // Update the state directly
  };

  const handleSaveChanges = async () => {
    let successCount = 0;
    let skippedCount = 0;
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (!row.awb_no) continue;  // Skip incomplete rows

      // Check if total and potongan are valid numbers
      const totalValue = parseFloat(row.total);
      const potonganValue = parseFloat(row.potongan);
      if (isNaN(totalValue) || isNaN(potonganValue)) {
        console.error(`Row ${i} has invalid numeric data (total or potongan is not a number); skipping update.`);
        skippedCount++;
        continue;  // Skip this row
      }

      // Calculate updated total before saving
      const updatedTotal = totalValue - potonganValue;  // Safe to calculate now
      const updateData = {
        awb_date: row.awb_date,
        nama_pengirim: row.nama_pengirim,
        total: updatedTotal,  // Save the subtracted value as a number
        buktimembayar: row.buktimembayar,
        potongan: potonganValue,  // Ensure it's a number
      };

      try {
        const { error } = await supabaseClient.from('manifest').update(updateData).eq('awb_no', row.awb_no);
        if (error) {
          console.error(`Error updating row ${i}:`, error);  // Log the full error object
          if (error.code) console.error(`Error code: ${error.code}, Message: ${error.message}`);
        } else {
          console.log(`Row ${i} updated successfully`);
          successCount++;
        }
      } catch (err) {
        console.error(`Unexpected error updating row ${i}:`, err);
      }
    }
    if (successCount > 0) {
      alert(`Successfully saved ${successCount} changes to Supabase! Skipped ${skippedCount} rows due to invalid data.`);
    } else if (skippedCount > 0) {
      alert(`No changes were saved. Skipped ${skippedCount} rows due to invalid data. Check console for details.`);
    } else {
      alert('No changes were saved. Please check the console for errors.');
    }
    console.log('All changes processed');
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-bold text-blue-900">Data Payment</h2>
        <button 
          onClick={handleSaveChanges} 
          className="px-6 py-2 bg-blue-600 text-white font-bold rounded shadow-lg hover:bg-blue-700 transition text-base flex items-center gap-2"
        >
          Update Payment
        </button>
      </div>
      
      {/* Agent Selection Section - Always visible */}
      <div className="mb-4">
        <label className="block text-xs font-semibold mb-1">Pilih Agent/Customer:</label>
        {loadingAgents ? (
          <p>Loading agents...</p>
        ) : (
          <select
            className="border rounded px-2 py-1 text-sm w-full"
            onChange={(e) => setSelectedAgent(e.target.value)}
            value={selectedAgent || ''}
          >
            <option value="">Pilih Agent</option>
            {agentList.map(agent => (
              <option key={agent} value={agent}>{agent}</option>
            ))}
          </select>
        )}
      </div>
      
      {selectedAgent ? (
        <>
          <div className="flex items-center gap-2 mb-2">
            <span>Search:</span>
            <input className="border rounded px-2 py-1 text-sm" value={search} onChange={e=>setSearch(e.target.value)} />
          </div>
          <div className="overflow-x-auto bg-white rounded shadow border max-w-full w-full">
            <table className="min-w-full text-sm table-auto">
              <thead>
                <tr className="bg-blue-600 text-white">
                  <th className="px-2 py-2">No Resi/AWB/STTB</th>
                  <th className="px-2 py-2">Tgl STTB</th>
                  <th className="px-2 py-2">Pengirim</th>
                  <th className="px-2 py-2">Total Yg Sudah Dibayar</th>
                  <th className="px-2 py-2">Bukti Membayar</th>
                  <th className="px-2 py-2">Potongan</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, i) => (
                  <tr key={i} className="even:bg-blue-50">
                    <td className="px-2 py-1">{row.awb_no}</td>
                    <td className="px-2 py-1">{row.awb_date}</td>
                    <td className="px-2 py-1">{row.nama_pengirim}</td>
                    <td className="px-2 py-1">{row.total}</td>
                    <td className="px-2 py-1">
                      <input 
                        type="checkbox" 
                        name="buktimembayar" 
                        checked={row.buktimembayar || false} 
                        onChange={(e) => handleRowChange(i, e)} 
                        className="border rounded px-1 py-1" 
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input 
                        type="number" 
                        name="potongan" 
                        value={row.potongan || 0} 
                        onChange={(e) => handleRowChange(i, e)} 
                        className="border rounded px-1 py-1 w-full" 
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between items-center mt-2 text-xs">
            <span>Showing 1 to {filtered.length} of {data.length} entries</span>
            <div className="flex gap-1">
              <button className="px-2 py-1 rounded bg-blue-100">1</button>
              <button className="px-2 py-1 rounded hover:bg-blue-100">2</button>
              <button className="px-2 py-1 rounded hover:bg-blue-100">3</button>
            </div>
          </div>
        </>
      ) : (
        null
      )}
      <ModalTambah open={modal} onClose={()=>setModal(false)} onSubmit={f=>{setData(d=>[f,...d]);setModal(false);}}/>
    </div>
  );
} 