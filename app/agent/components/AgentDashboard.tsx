"use client"

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FaBoxOpen, FaSearch, FaPlus, FaChartLine, FaBars, FaTimes, FaUser, FaSignOutAlt } from 'react-icons/fa';
import { AWBCreationForm } from './AWBCreationForm';
import { AWBStatusTracker, type AWBData } from './AWBStatusTracker';
import { DashboardStats } from './DashboardStats';
import { useAgent, type AWBHistory } from '../context/AgentContext';
import { supabaseClient } from '../../../lib/auth';

export const AgentDashboard: React.FC = () => {
  const { currentAgent } = useAgent();
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedAWB, setSelectedAWB] = useState<AWBData | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const router = useRouter();

  const handleNavigate = (tab: string, awbData?: AWBHistory) => {
    setActiveTab(tab);
    if (awbData) {
      // Convert AWBHistory to AWBData format
      const convertedAWB: AWBData = {
        id: awbData.id,
        awb_no: awbData.awb_no,
        awb_date: awbData.awb_date,
        nama_pengirim: awbData.nama_pengirim,
        nama_penerima: awbData.nama_penerima,
        kota_tujuan: awbData.kota_tujuan,
        status: awbData.status,
        total: awbData.total,
        created_at: awbData.created_at,
        verified_time: undefined
      };
      setSelectedAWB(convertedAWB);
    } else if (tab !== 'track-awb') {
      // Clear selected AWB when navigating away from track-awb
      setSelectedAWB(null);
    }
  };

  const navigationItems = [
    { id: 'create-awb', label: 'Create AWB', icon: FaPlus },
    { id: 'overview', label: 'Dashboard', icon: FaChartLine },
    { id: 'track-awb', label: 'Track AWB', icon: FaSearch }
  ];

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      
      // Sign out from Supabase
      const { error } = await supabaseClient.auth.signOut();
      
      if (error) {
        console.error('Logout error:', error);
      }
      
      // Clear any local storage
      localStorage.removeItem('rememberedAgentEmail');
      localStorage.removeItem('cachedSession');
      
      // Redirect to login page
      router.push('/agent/login');
    } catch (error) {
      console.error('Error during logout:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="agent-portal agent-dashboard min-h-screen bg-gradient-to-br from-blue-50 to-white">
      {/* Mobile Header */}
      <div className="lg:hidden bg-blue-900 text-white p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FaBoxOpen className="h-6 w-6 text-blue-300" />
          <div>
            <h1 className="text-white">BCE Express</h1>
            <p className="text-blue-300 text-xs">{currentAgent?.name || 'Agent Portal'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-blue-800 border border-blue-700 rounded px-3 py-1">
            <span className="text-white text-sm">{currentAgent?.email}</span>
          </div>
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="p-2 hover:bg-red-600 rounded-lg transition-colors text-red-300 hover:text-white"
            title="Logout"
          >
            <FaSignOutAlt className="h-4 w-4" />
          </button>
          <button
            onClick={toggleMobileMenu}
            className="p-2 hover:bg-blue-800 rounded-lg transition-colors"
          >
            {isMobileMenuOpen ? <FaTimes className="h-5 w-5" /> : <FaBars className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Overlay */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-50">
          <div className="bg-blue-900 text-white w-64 h-full p-4">
            <div className="flex items-center gap-2 mb-8">
              <FaBoxOpen className="h-8 w-8 text-blue-300" />
              <div>
                <h1 className="text-white">BCE Express</h1>
                <p className="text-blue-300 text-sm">Agent Portal</p>
              </div>
            </div>
            
            <nav className="space-y-2 mb-6">
              {navigationItems.map((item) => {
                const IconComponent = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      handleNavigate(item.id);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${
                      activeTab === item.id ? 'bg-blue-800 text-white' : 'text-blue-200 hover:bg-blue-800 hover:text-white'
                    }`}
                  >
                    <IconComponent className="h-5 w-5" />
                    {item.label}
                  </button>
                );
              })}
            </nav>

            {/* Mobile Logout Button */}
            <div className="mt-auto">
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-colors text-red-300 hover:bg-red-600 hover:text-white"
              >
                <FaSignOutAlt className="h-5 w-5" />
                {isLoggingOut ? 'Logging out...' : 'Logout'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex">
        {/* Desktop Sidebar */}
        <div className="hidden lg:block w-64 bg-blue-900 text-white min-h-screen">
          <div className="p-6 flex flex-col h-full">
            <div className="flex items-center gap-2 mb-6">
              <FaBoxOpen className="h-8 w-8 text-blue-300" />
              <div>
                <h1 className="text-white">BCE Express</h1>
                <p className="text-blue-300 text-sm">Agent Portal</p>
              </div>
            </div>
            
            {/* Agent Info */}
            <div className="mb-6">
              <label className="text-blue-300 text-sm block mb-2">Logged in as:</label>
              <div className="bg-blue-800 border border-blue-700 rounded px-3 py-2">
                <p className="text-white font-medium">{currentAgent?.name || 'Agent'}</p>
                <p className="text-blue-400 text-xs">{currentAgent?.email}</p>
                <p className="text-blue-400 text-xs">{currentAgent?.branchOrigin}</p>
              </div>
            </div>
            
            <nav className="space-y-2 flex-1">
              {navigationItems.map((item) => {
                const IconComponent = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavigate(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                      activeTab === item.id ? 'bg-blue-800 text-white' : 'text-blue-200 hover:bg-blue-800 hover:text-white'
                    }`}
                  >
                    <IconComponent className="h-5 w-5" />
                    {item.label}
                  </button>
                );
              })}
            </nav>

            {/* Desktop Logout Button */}
            <div className="mt-auto pt-4 border-t border-blue-800">
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-red-300 hover:bg-red-600 hover:text-white"
              >
                <FaSignOutAlt className="h-5 w-5" />
                {isLoggingOut ? 'Logging out...' : 'Logout'}
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          <div className="p-4 lg:p-8 pb-20 lg:pb-8">
            {/* Header */}
            <div className="mb-6">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-2xl lg:text-3xl text-blue-900 mb-2">
                    {activeTab === 'overview' && 'Dashboard Overview'}
                    {activeTab === 'create-awb' && 'Create New AWB'}
                    {activeTab === 'track-awb' && 'Track AWB Status'}
                  </h1>
                  <p className="text-gray-600 text-sm lg:text-base">
                    {activeTab === 'overview' && 'Monitor your logistics operations and AWB management'}
                    {activeTab === 'create-awb' && 'Generate new Air Waybill numbers for shipments'}
                    {activeTab === 'track-awb' && 'Search and monitor AWB status in real-time'}
                  </p>
                </div>
                
                {/* Desktop Header Logout Button */}
                <div className="hidden lg:block">
                  <Button
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    variant="outline"
                    className="border-red-300 text-red-600 hover:bg-red-600 hover:text-white"
                  >
                    <FaSignOutAlt className="h-4 w-4 mr-2" />
                    {isLoggingOut ? 'Logging out...' : 'Logout'}
                  </Button>
                </div>
              </div>
            </div>

            {/* Content based on active tab */}
            {activeTab === 'overview' && <DashboardStats onNavigate={handleNavigate} />}
            {activeTab === 'create-awb' && <AWBCreationForm />}
            {activeTab === 'track-awb' && <AWBStatusTracker selectedAWB={selectedAWB} />}
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-2">
        <div className="flex justify-around">
          {navigationItems.map((item) => {
            const IconComponent = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.id)}
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors ${
                  activeTab === item.id ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <IconComponent className="h-5 w-5" />
                <span className="text-xs">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
