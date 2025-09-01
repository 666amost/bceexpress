"use client"

import React, { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { FaBoxOpen, FaChartLine, FaUsers, FaBox, FaSearch, FaBars, FaTimes, FaSignOutAlt } from 'react-icons/fa';
import { supabaseClient } from '@/lib/auth';
import { AdminLeaderContent } from './AdminLeaderContent';
import { User } from '@supabase/supabase-js';
import { ThemeToggle } from '@/components/theme-toggle';

export const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'couriers' | 'shipments' | 'search'>('overview');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  const loadUserProfile = useCallback(async () => {
    try {
      const { data: { user: userData }, error: userError } = await supabaseClient.auth.getUser();

      if (userError || !userData) {
        router.push("/admin");
        return;
      }
      setUser(userData);
    } catch (err) {
      router.push("/admin");
    }
  }, [router]);

  useEffect(() => {
    loadUserProfile();
  }, [loadUserProfile]);

  const handleNavigate = (tab: 'overview' | 'couriers' | 'shipments' | 'search') => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  const navigationItems = [
    { id: 'overview' as const, label: 'Dashboard', icon: FaChartLine },
    { id: 'couriers' as const, label: 'Couriers', icon: FaUsers },
    { id: 'shipments' as const, label: 'Shipments', icon: FaBox },
    { id: 'search' as const, label: 'Search', icon: FaSearch }
  ];

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      const { error } = await supabaseClient.auth.signOut();
      if (error) {
        console.error('Logout error:', error);
      }
      router.push('/admin');
    } catch (error) {
      console.error('Error during logout:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="admin-portal min-h-screen bg-gradient-to-br from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
      {/* Mobile Header */}
      <div className="lg:hidden bg-blue-900 dark:bg-gray-800 text-white p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/images/bce-logo-white.png" alt="BCE Express" className="h-8 w-8" />
          <div>
            <h1 className="text-white">BCE Express</h1>
            <p className="text-blue-300 dark:text-gray-300 text-xs">Admin Portal</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
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
            className="p-2 hover:bg-blue-800 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            {isMobileMenuOpen ? <FaTimes className="h-5 w-5" /> : <FaBars className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Overlay */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-50">
          <div className="bg-blue-900 dark:bg-gray-800 text-white w-64 h-full p-4">
            <div className="flex items-center gap-2 mb-8">
              <img src="/images/bce-logo-white.png" alt="BCE Express" className="h-8 w-8" />
              <div>
                <h1 className="text-white">BCE Express</h1>
                <p className="text-blue-300 dark:text-gray-300 text-sm">Admin Portal</p>
              </div>
            </div>
            
            <nav className="space-y-2 mb-6">
              {navigationItems.map((item) => {
                const IconComponent = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavigate(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${
                      activeTab === item.id ? 'bg-blue-800 dark:bg-gray-700 text-white' : 'text-blue-200 dark:text-gray-300 hover:bg-blue-800 dark:hover:bg-gray-700 hover:text-white'
                    }`}
                  >
                    <IconComponent className="h-5 w-5" />
                    {item.label}
                  </button>
                );
              })}
            </nav>

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
        <div className="hidden lg:block w-64 bg-blue-900 dark:bg-gray-800 text-white min-h-screen">
          <div className="p-6 flex flex-col h-full">
            <div className="flex items-center gap-2 mb-6">
              <img src="/images/bce-logo-white.png" alt="BCE Express" className="h-8 w-8" />
              <div>
                <h1 className="text-white">BCE Express</h1>
                <p className="text-blue-300 dark:text-gray-300 text-sm">Admin Portal</p>
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
                      activeTab === item.id ? 'bg-blue-800 dark:bg-gray-700 text-white' : 'text-blue-200 dark:text-gray-300 hover:bg-blue-800 dark:hover:bg-gray-700 hover:text-white'
                    }`}
                  >
                    <IconComponent className="h-5 w-5" />
                    {item.label}
                  </button>
                );
              })}
            </nav>

            <div className="mt-auto pt-4 border-t border-blue-800 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <span className="text-blue-200 dark:text-gray-300 text-sm">Theme</span>
                <ThemeToggle />
              </div>
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
                  <h1 className="text-2xl lg:text-3xl text-blue-900 dark:text-white mb-2">
                    {activeTab === 'overview' && 'Leader Dashboard'}
                    {activeTab === 'couriers' && 'Courier Management'}
                    {activeTab === 'shipments' && 'Shipment Management'}
                    {activeTab === 'search' && 'Search & Track'}
                  </h1>
                  <p className="text-gray-600 dark:text-gray-300 text-sm lg:text-base">
                    {activeTab === 'overview' && 'Monitor courier operations and shipment statistics'}
                    {activeTab === 'couriers' && 'Manage and track courier performance'}
                    {activeTab === 'shipments' && 'View and manage all shipments'}
                    {activeTab === 'search' && 'Search for specific shipments or couriers'}
                  </p>
                </div>
                
                {/* Desktop Header - No Logout Button Here */}
              </div>
            </div>

            {/* Content based on active tab */}
            <AdminLeaderContent activeView={activeTab} onTabChange={setActiveTab} />
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-2 z-40">
        <div className="flex justify-around">
          {navigationItems.map((item) => {
            const IconComponent = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.id)}
                className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg transition-colors min-w-0 flex-1 ${
                  activeTab === item.id ? 'bg-blue-100 dark:bg-gray-700 text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <IconComponent className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                <span className="text-xs leading-none truncate w-full text-center">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
