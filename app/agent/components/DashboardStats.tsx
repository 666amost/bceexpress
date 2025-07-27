"use client"

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FaBoxOpen, FaChartLine, FaCheckCircle, FaClock, FaUser } from 'react-icons/fa';
import { useAgent, type AWBHistory } from '../context/AgentContext';

interface DashboardStatsProps {
  onNavigate?: (tab: string, awbData?: AWBHistory) => void;
}

export const DashboardStats: React.FC<DashboardStatsProps> = ({ onNavigate }) => {
  const { currentAgent } = useAgent();

  if (!currentAgent) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-8 text-center">
            <div className="text-gray-500">Loading dashboard data...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Agent Info Card - Simple version like Figma */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <FaUser className="h-6 w-6 text-blue-600" />
              <div>
                <h3 className="text-lg font-semibold text-blue-900">Active Agent</h3>
                <p className="text-blue-700 text-sm">Current agent session and statistics</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-blue-600 font-medium">{currentAgent.name}</div>
              <p className="text-sm text-blue-600">{currentAgent.email}</p>
              <p className="text-xs text-blue-500">{currentAgent.branchOrigin}</p>
            </div>
          </div>
          
          {/* Agent Statistics - like the Figma layout */}
          <div className="grid grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-blue-600 text-2xl font-bold mb-1">{currentAgent.stats.totalAWBs}</div>
              <p className="text-blue-700 text-sm">Total AWBs</p>
            </div>
            <div>
              <div className="text-blue-600 text-2xl font-bold mb-1">{currentAgent.stats.todayAWBs}</div>
              <p className="text-blue-700 text-sm">Today</p>
            </div>
            <div>
              <div className="text-blue-600 text-2xl font-bold mb-1">{currentAgent.stats.thisWeekAWBs}</div>
              <p className="text-blue-700 text-sm">This Week</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent AWBs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FaBoxOpen className="h-5 w-5 text-blue-600" />
            Recent AWBs
          </CardTitle>
          <CardDescription>
            Latest air waybills created by {currentAgent.name}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {currentAgent.awbHistory.length > 0 ? (
            <div className="space-y-3">
              {currentAgent.awbHistory.slice(0, 5).map((awb) => (
                <div
                  key={awb.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => onNavigate?.('track-awb', awb)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <FaBoxOpen className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{awb.awb_no}</div>
                      <div className="text-sm text-gray-500">{awb.nama_penerima} • {awb.kota_tujuan}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">
                      Rp {awb.total.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(awb.awb_date).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <FaBoxOpen className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>No AWBs created yet</p>
              <p className="text-sm">Create your first AWB to see it here</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => onNavigate?.('track-awb')}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Pending AWBs</p>
                <p className="text-2xl font-bold text-orange-600">{currentAgent.stats.pendingAWBs}</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                <FaClock className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => onNavigate?.('track-awb')}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Completed</p>
                <p className="text-2xl font-bold text-green-600">{currentAgent.stats.completedAWBs}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <FaCheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => onNavigate?.('track-awb')}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">This Week</p>
                <p className="text-2xl font-bold text-blue-600">{currentAgent.stats.thisWeekAWBs}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <FaChartLine className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => onNavigate?.('track-awb')}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Today</p>
                <p className="text-2xl font-bold text-purple-600">{currentAgent.stats.todayAWBs}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <FaBoxOpen className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
