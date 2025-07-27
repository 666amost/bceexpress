"use client"

import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabaseClient } from '../../../lib/auth';

interface CustomerHistory {
  nama_pengirim: string;
  nomor_pengirim: string;
  nama_penerima: string;
  nomor_penerima: string;
  alamat_penerima: string;
  kota_tujuan: string;
  kecamatan: string;
  isi_barang: string;
  lastUsed: string;
  frequency: number;
}

export interface AWBHistory {
  id: string;
  awb_no: string;
  awb_date: string;
  nama_pengirim: string;
  nama_penerima: string;
  kota_tujuan: string;
  status: string;
  total: number;
  created_at: string;
}

interface CustomerHistory {
  nama_pengirim: string;
  nomor_pengirim: string;
  nama_penerima: string;
  nomor_penerima: string;
  alamat_penerima: string;
  kota_tujuan: string;
  kecamatan: string;
  isi_barang: string;
  lastUsed: string;
  frequency: number;
}

interface UserData {
  email: string;
  name?: string;
  origin_branch?: string;
}

interface AgentData {
  email: string;
  name: string;
  branchOrigin: string;
  awbHistory: AWBHistory[];
  customerHistory: CustomerHistory[];
  stats: {
    totalAWBs: number;
    todayAWBs: number;
    thisWeekAWBs: number;
    pendingAWBs: number;
    completedAWBs: number;
  };
}

interface ManifestBookingData {
  awb_no: string;
  awb_date: string;
  kirim_via: string;
  kota_tujuan: string;
  kecamatan: string;
  metode_pembayaran: string;
  agent_customer: string;
  nama_pengirim: string;
  nomor_pengirim: string;
  nama_penerima: string;
  nomor_penerima: string;
  alamat_penerima: string;
  coli: number;
  berat_kg: number;
  harga_per_kg: number;
  sub_total: number;
  biaya_admin: number;
  biaya_packaging: number;
  biaya_transit: number;
  total: number;
  isi_barang: string;
  catatan?: string;
  // Database fields
  agent_id?: string;
  origin_branch?: string;
  jenis_service?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

interface AgentContextType {
  currentAgent: AgentData | null;
  addAWB: (awbData: ManifestBookingData) => Promise<ManifestBookingData>;
  getCustomerSuggestions: (searchTerm: string) => CustomerHistory[];
  updateCustomerHistory: (customerData: Partial<CustomerHistory>) => void;
  isLoading: boolean;
}

const AgentContext = createContext<AgentContextType | undefined>(undefined);

export const AgentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentAgent, setCurrentAgent] = useState<AgentData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadCustomerHistory = React.useCallback(async (agentId: string): Promise<CustomerHistory[]> => {
    const { data } = await supabaseClient
      .from('manifest_booking')
      .select('nama_pengirim, nomor_pengirim, nama_penerima, nomor_penerima, alamat_penerima, kota_tujuan, kecamatan, isi_barang, created_at')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false });

    if (!data) return [];

    // Group by sender for frequency calculation
    const grouped = data.reduce((acc, item) => {
      const key = `${item.nama_pengirim}-${item.nomor_pengirim}`;
      if (!acc[key]) {
        acc[key] = {
          nama_pengirim: item.nama_pengirim,
          nomor_pengirim: item.nomor_pengirim,
          nama_penerima: item.nama_penerima,
          nomor_penerima: item.nomor_penerima,
          alamat_penerima: item.alamat_penerima,
          kota_tujuan: item.kota_tujuan,
          kecamatan: item.kecamatan,
          isi_barang: item.isi_barang,
          lastUsed: item.created_at,
          frequency: 1
        };
      } else {
        acc[key].frequency += 1;
        if (new Date(item.created_at) > new Date(acc[key].lastUsed)) {
          acc[key] = {
            ...acc[key],
            nama_penerima: item.nama_penerima,
            nomor_penerima: item.nomor_penerima,
            alamat_penerima: item.alamat_penerima,
            kota_tujuan: item.kota_tujuan,
            kecamatan: item.kecamatan,
            isi_barang: item.isi_barang,
            lastUsed: item.created_at,
            frequency: acc[key].frequency
          };
        }
      }
      return acc;
    }, {} as Record<string, CustomerHistory>);

    return Object.values(grouped).sort((a, b) => 
      new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime()
    );
  }, []);

  const calculateStats = React.useCallback((awbHistory: AWBHistory[]) => {
    const today = new Date();
    const startOfWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay());
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    return {
      totalAWBs: awbHistory.length,
      todayAWBs: awbHistory.filter(awb => new Date(awb.created_at) >= startOfToday).length,
      thisWeekAWBs: awbHistory.filter(awb => new Date(awb.created_at) >= startOfWeek).length,
      pendingAWBs: awbHistory.filter(awb => awb.status === 'pending' || !awb.status).length,
      completedAWBs: awbHistory.filter(awb => awb.status === 'delivered').length,
    };
  }, []);

  const processAgentData = React.useCallback(async (userData: UserData, userId: string) => {
    try {
      // Load AWB history for agent using agent_id
      const { data: awbHistory, error: awbError } = await supabaseClient
        .from('manifest_booking')
        .select('*')
        .eq('agent_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (awbError) {
        console.error('Error loading AWB history:', awbError);
      }

      // Load customer history
      const customerHistory = await loadCustomerHistory(userId);

      // Calculate stats
      const stats = calculateStats(awbHistory || []);

      const agentData: AgentData = {
        email: userData.email,
        name: userData.name || userData.email,
        branchOrigin: userData.origin_branch || '',
        awbHistory: (awbHistory || []).map(awb => ({
          id: awb.id,
          awb_no: awb.awb_no,
          awb_date: awb.awb_date,
          nama_pengirim: awb.nama_pengirim,
          nama_penerima: awb.nama_penerima,
          kota_tujuan: awb.kota_tujuan,
          status: awb.status || 'pending',
          total: awb.total,
          created_at: awb.created_at
        })),
        customerHistory,
        stats
      };

      setCurrentAgent(agentData);
    } catch (error) {
      console.error('Error processing agent data:', error);
    }
  }, [loadCustomerHistory, calculateStats]);

  const loadAgentData = React.useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Check session with retry logic
      const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
      
      if (sessionError) {
        console.error('Session error:', sessionError);
        // Redirect to login if session error
        if (typeof window !== 'undefined') {
          window.location.href = '/agent/login';
        }
        return;
      }
      
      if (!sessionData.session?.user) {
        console.warn('No active session found - redirecting to login');
        // Redirect to login if no session
        if (typeof window !== 'undefined') {
          window.location.href = '/agent/login';
        }
        return;
      }

      const user = sessionData.session.user;
      
      // Only log if we don't already have this agent loaded
      if (!currentAgent || currentAgent.email !== user.email) {
        // Found user session for agent
      }

      // Get current user info from users table
      const { data: userData, error: userError } = await supabaseClient
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (userError) {
        console.error('Error fetching user data:', userError);
        // Try with email as fallback
        const { data: fallbackUserData } = await supabaseClient
          .from('users')
          .select('*')
          .eq('email', user.email)
          .single();
        
        if (fallbackUserData && fallbackUserData.role === 'agent') {
          await processAgentData(fallbackUserData, user.id);
        } else {
          console.warn('User not found or not an agent - redirecting to login');
          if (typeof window !== 'undefined') {
            window.location.href = '/agent/login';
          }
        }
      } else if (userData && userData.role === 'agent') {
        await processAgentData(userData, user.id);
      } else {
        console.warn('User is not an agent - userData:', userData);
        if (typeof window !== 'undefined') {
          window.location.href = '/agent/login';
        }
      }
    } catch (error) {
              console.warn('Error loading agent data:', error);
      // Redirect to login on error
      if (typeof window !== 'undefined') {
        window.location.href = '/agent/login';
      }
    } finally {
      setIsLoading(false);
    }
  }, [currentAgent, processAgentData]);

  useEffect(() => {
    loadAgentData();
  }, [loadAgentData]); // Include loadAgentData dependency

  const addAWB = async (awbData: ManifestBookingData): Promise<ManifestBookingData> => {
    try {
      // Enhanced session checking with refresh attempt
      let { data: sessionData } = await supabaseClient.auth.getSession();
      
      if (!sessionData.session?.user) {
        await supabaseClient.auth.refreshSession();
        const refreshResult = await supabaseClient.auth.getSession();
        sessionData = refreshResult.data;
        
        if (!sessionData.session?.user) {
          throw new Error('Authentication required. Please log in again.');
        }
      }

      // Check if currentAgent exists and has required data
      if (!currentAgent) {
        throw new Error('Agent data not loaded. Please refresh the page.');
      }

      if (!currentAgent.branchOrigin) {
        throw new Error('Agent branch information missing. Please contact support.');
      }

      const { data, error } = await supabaseClient
        .from('manifest_booking')
        .insert({
          awb_no: awbData.awb_no,
          awb_date: awbData.awb_date,
          kirim_via: awbData.kirim_via,
          kota_tujuan: awbData.kota_tujuan,
          kecamatan: awbData.kecamatan,
          metode_pembayaran: awbData.metode_pembayaran,
          agent_customer: currentAgent.email,
          nama_pengirim: awbData.nama_pengirim,
          nomor_pengirim: awbData.nomor_pengirim,
          nama_penerima: awbData.nama_penerima,
          nomor_penerima: awbData.nomor_penerima,
          alamat_penerima: awbData.alamat_penerima,
          coli: awbData.coli,
          berat_kg: awbData.berat_kg,
          harga_per_kg: awbData.harga_per_kg,
          sub_total: awbData.sub_total,
          biaya_admin: awbData.biaya_admin,
          biaya_packaging: awbData.biaya_packaging,
          biaya_transit: awbData.biaya_transit,
          total: awbData.total,
          isi_barang: awbData.isi_barang,
          catatan: awbData.catatan || '',
          agent_id: sessionData.session.user.id,
          origin_branch: currentAgent.branchOrigin,
          status: 'pending',
          payment_status: 'outstanding',
          input_time: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('Supabase error details:', error);
        throw new Error(`Failed to create AWB: ${error.message}`);
      }

      // Update local state after successful creation
      if (currentAgent && data) {
        const newAWBHistory: AWBHistory = {
          id: data.id,
          awb_no: data.awb_no,
          awb_date: data.awb_date,
          nama_pengirim: data.nama_pengirim,
          nama_penerima: data.nama_penerima,
          kota_tujuan: data.kota_tujuan,
          status: data.status || 'pending',
          total: data.total,
          created_at: data.created_at
        };

        setCurrentAgent(prev => prev ? {
          ...prev,
          awbHistory: [newAWBHistory, ...prev.awbHistory],
          stats: {
            ...prev.stats,
            totalAWBs: prev.stats.totalAWBs + 1,
            todayAWBs: prev.stats.todayAWBs + 1,
            pendingAWBs: prev.stats.pendingAWBs + 1
          }
        } : null);

        // Update customer history
        updateCustomerHistory({
          nama_pengirim: data.nama_pengirim,
          nomor_pengirim: data.nomor_pengirim,
          nama_penerima: data.nama_penerima,
          nomor_penerima: data.nomor_penerima,
          alamat_penerima: data.alamat_penerima,
          kota_tujuan: data.kota_tujuan,
          kecamatan: data.kecamatan,
          isi_barang: data.isi_barang
        });
      }

      return data;
    } catch (error) {
      console.error('Error in addAWB:', error);
      // Provide more specific error details
      if (error instanceof Error) {
        throw new Error(`AWB Creation Failed: ${error.message}`);
      } else {
        throw new Error('AWB Creation Failed: Unknown error occurred');
      }
    }
  };

  const getCustomerSuggestions = (searchTerm: string): CustomerHistory[] => {
    if (!currentAgent || !searchTerm.trim()) return [];
    
    const term = searchTerm.toLowerCase();
    return currentAgent.customerHistory.filter(customer =>
      customer.nama_pengirim.toLowerCase().includes(term) ||
      customer.nomor_pengirim.includes(term) ||
      customer.nama_penerima.toLowerCase().includes(term) ||
      customer.alamat_penerima.toLowerCase().includes(term)
    ).slice(0, 5);
  };

  const updateCustomerHistory = (customerData: Partial<CustomerHistory>) => {
    if (!currentAgent) return;
    
    // Implementation for updating customer history
    // This would typically involve updating the local state and possibly the database
  };

  return (
    <AgentContext.Provider value={{
      currentAgent,
      addAWB,
      getCustomerSuggestions,
      updateCustomerHistory,
      isLoading,
    }}>
      {children}
    </AgentContext.Provider>
  );
};

export const useAgent = () => {
  const context = useContext(AgentContext);
  if (context === undefined) {
    throw new Error('useAgent must be used within an AgentProvider');
  }
  return context;
};
