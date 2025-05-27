"use client";

import { useState, useEffect } from "react";
import { supabaseClient } from "../lib/auth";
import { FaTruck, FaUser, FaMapMarkerAlt, FaCalendarDay, FaCalendarWeek, FaHistory, FaPlus, FaBox } from "react-icons/fa";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";

import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement // Register ArcElement for Doughnut chart
);

interface RecentAwbItem {
  awb_no: string;
  awb_date: string;
  kota_tujuan?: string;
  nama_penerima?: string;
  agent_customer?: string;
  wilayah?: string;
  kirim_via?: string;
}

interface BranchDashboardProps {
  userRole: string | null;
  branchOrigin: string | null;
  onShowAwbForm: (show: boolean) => void;
}

export default function BranchDashboard({ userRole, branchOrigin, onShowAwbForm }: BranchDashboardProps) {
  const [dashboardStats, setDashboardStats] = useState<{ totalAWB: number, totalAgents: number, totalWilayah: number, totalAWBToday: number, totalAWBThisWeek: number, recentAWBs: RecentAwbItem[], awbPerKotaChartData: any, awbPerAgentChartData: any, awbPerDayChartData: any, awbPerViaChartData: any }>({ totalAWB: 0, totalAgents: 0, totalWilayah: 0, totalAWBToday: 0, totalAWBThisWeek: 0, recentAWBs: [], awbPerKotaChartData: null, awbPerAgentChartData: null, awbPerDayChartData: null, awbPerViaChartData: null });
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [allManifestData, setAllManifestData] = useState<RecentAwbItem[]>([]);

  const { toast } = useToast();

  let delayed: boolean;

  useEffect(() => {
    const fetchDashboardStats = async () => {
      try {
        if (!userRole) {
          setIsLoading(false);
          return;
        }

        setIsLoading(true);

        const targetTable = userRole === 'cabang' ? 'manifest_cabang' : 'manifest';
        
        let query = supabaseClient.from(targetTable).select('awb_no, awb_date, kota_tujuan, nama_penerima, agent_customer, wilayah, kirim_via');
        
        if (userRole === 'cabang' && branchOrigin) {
          query = query.eq('origin_branch', branchOrigin);
        }
        
        const { data: manifestData, error } = await query as { data: RecentAwbItem[] | null, error: any };
        
        if (error) {
          toast({
            title: "Gagal memuat data dashboard.",
            description: error.message || "Terjadi kesalahan saat mengambil data.",
            variant: "destructive",
          });
        }
        
        if (manifestData) {
          setAllManifestData(manifestData);
          
          const uniqueAWB = Array.from(new Set(manifestData.map(item => item.awb_no).filter(Boolean))).length;
          const uniqueAgents = Array.from(new Set(manifestData.map(item => item.agent_customer).filter(Boolean))).length;
          const uniqueWilayah = Array.from(new Set(manifestData.map(item => item.wilayah).filter(Boolean))).length;
          
          const manifestDataWithDate = manifestData.filter(item => item.awb_date);

          const getLocalYYYYMMDD = (date: Date): string => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
          };

          const today = new Date();
          const todayString = getLocalYYYYMMDD(today);

          const startOfWeek = new Date(today);
          const dayOfWeek = today.getDay();
          const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
          startOfWeek.setDate(today.getDate() - diff);
          startOfWeek.setHours(0, 0, 0, 0);
          
          const totalAWBToday = manifestDataWithDate.filter(item => item.awb_date === todayString).length;

          const totalAWBThisWeek = manifestDataWithDate.filter(item => {
            const parts = item.awb_date.split('-');
            const itemDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            itemDate.setHours(0, 0, 0, 0);
            
            return itemDate >= startOfWeek && itemDate <= today;
          }).length;

          const sortedManifestData = [...manifestData].sort((a, b) => new Date(b.awb_date).getTime() - new Date(a.awb_date).getTime());
          const recentAWBs = sortedManifestData.slice(0, 5);

          const awbCountsPerKota = manifestData.reduce((acc, item) => {
            if (item.kota_tujuan) {
              acc[item.kota_tujuan] = (acc[item.kota_tujuan] || 0) + 1;
            }
            return acc;
          }, {} as Record<string, number>);

          const awbPerKotaChartData = {
            labels: Object.keys(awbCountsPerKota).map(kota => kota.replace(/\b\w/g, l => l.toUpperCase())),
            datasets: [
              {
                label: 'Jumlah AWB',
                data: Object.values(awbCountsPerKota),
                backgroundColor: 'rgba(59, 130, 246, 0.6)',
                borderColor: 'rgba(59, 130, 246, 1)',
                borderWidth: 1,
              },
            ],
          };

          const awbCountsPerAgent = manifestData.reduce((acc, item) => {
            if (item.agent_customer) {
              acc[item.agent_customer] = (acc[item.agent_customer] || 0) + 1;
            }
            return acc;
          }, {} as Record<string, number>);

          const awbPerAgentChartData = {
            labels: Object.keys(awbCountsPerAgent),
            datasets: [
              {
                label: 'Jumlah AWB',
                data: Object.values(awbCountsPerAgent),
                backgroundColor: [
                  'rgba(255, 99, 132, 0.6)',
                  'rgba(54, 162, 235, 0.6)',
                  'rgba(255, 206, 86, 0.6)',
                  'rgba(75, 192, 192, 0.6)',
                  'rgba(153, 102, 255, 0.6)',
                  'rgba(255, 159, 64, 0.6)',
                  'rgba(201, 203, 207, 0.6)',
                ],
                borderColor: [
                  'rgba(255, 99, 132, 1)',
                  'rgba(54, 162, 235, 1)',
                  'rgba(255, 206, 86, 1)',
                  'rgba(75, 192, 192, 1)',
                  'rgba(153, 102, 255, 1)',
                  'rgba(255, 159, 64, 1)',
                  'rgba(201, 203, 207, 1)',
                ],
                borderWidth: 1,
              },
            ],
          };

          // Prepare data for AWB over time chart with Kirim Via breakdown (Stacked Bar)
          const awbCountsByDateAndVia: Record<string, Record<string, number>> = manifestDataWithDate.reduce((acc, item) => {
            if (item.awb_date && item.kirim_via) {
              if (!acc[item.awb_date]) {
                acc[item.awb_date] = {};
              }
              acc[item.awb_date][item.kirim_via] = (acc[item.awb_date][item.kirim_via] || 0) + 1;
            }
            return acc;
          }, {});

          const sortedDates = Object.keys(awbCountsByDateAndVia).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
          const uniqueVias = Array.from(new Set(manifestDataWithDate.map(item => item.kirim_via).filter(Boolean))) as string[];

          const awbTrendChartData = {
            labels: sortedDates,
            datasets: uniqueVias.map(via => ({
              label: via.toUpperCase(),
              data: sortedDates.map(date => awbCountsByDateAndVia[date]?.[via] || 0),
              backgroundColor: via.toLowerCase() === 'udara' ? 'rgba(54, 162, 235, 0.6)' : 'rgba(255, 99, 132, 0.6)', // Blue for Udara, Red for Darat
              borderColor: via.toLowerCase() === 'udara' ? 'rgba(54, 162, 235, 1)' : 'rgba(255, 99, 132, 1)',
              borderWidth: 1,
            })),
          };

          setDashboardStats(prevStats => ({
            ...prevStats,
            totalAWB: uniqueAWB,
            totalAgents: uniqueAgents,
            totalWilayah: uniqueWilayah,
            totalAWBToday,
            totalAWBThisWeek,
            recentAWBs,
            awbPerKotaChartData,
            awbPerAgentChartData,
            awbPerDayChartData: awbTrendChartData, // Use the new combined data for the bar chart
            awbPerViaChartData: null, // Clear the separate via chart data
          }));
        } else {
          setAllManifestData([]);
          setDashboardStats({ totalAWB: 0, totalAgents: 0, totalWilayah: 0, totalAWBToday: 0, totalAWBThisWeek: 0, recentAWBs: [], awbPerKotaChartData: null, awbPerAgentChartData: null, awbPerDayChartData: null, awbPerViaChartData: null });
        }
      } catch (error: any) {
        toast({
          title: "Gagal memuat data dashboard.",
          description: error.message || "Terjadi kesalahan saat mengambil data.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    // Reset delayed state when dependencies change (e.g., branch changes)
    delayed = false;
    fetchDashboardStats();

    // Optional: Refetch stats periodically or after form submission success
  }, [userRole, branchOrigin]); // Depend on userRole and branchOrigin // Add awbPerViaChartData to dependency array if it causes issues, though it's derived

  return (
    <>
      {/* Tombol Tambahkan Resi */}
      <div className="flex justify-end items-center mb-4">
        <Button
          className="flex items-center gap-2 bg-blue-600 dark:bg-blue-700 text-white px-4 py-2 rounded font-bold hover:bg-blue-700 dark:hover:bg-blue-800 transition-colors"
          onClick={() => onShowAwbForm(true)}
        >
          <FaPlus /> Tambahkan
        </Button>
      </div>

      {/* Main content area: Stats and Recent AWBs in a two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Dashboard Stats Cards Container (Left Column) */}
        <div className="lg:col-span-1 grid grid-cols-2 md:grid-cols-2 lg:grid-cols-2 gap-6">
          <Card className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-3 sm:p-4 text-center hover:shadow-xl transition-all duration-300 hover:scale-105">
            <CardHeader className="pb-1 sm:pb-2">
              <CardTitle className="text-base sm:text-lg font-bold text-blue-800 dark:text-blue-200 flex items-center justify-center gap-1 sm:gap-2"><FaBox /> Total AWB</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white min-h-[40px] flex items-center justify-center">{dashboardStats.totalAWB}</p>
            </CardContent>
          </Card>
          <Card className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-3 sm:p-4 text-center hover:shadow-xl transition-all duration-300 hover:scale-105">
            <CardHeader className="pb-1 sm:pb-2">
              <CardTitle className="text-base sm:text-lg font-bold text-green-800 dark:text-green-200 flex items-center justify-center gap-1 sm:gap-2"><FaUser /> Total Agent</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white">{dashboardStats.totalAgents}</p>
            </CardContent>
          </Card>
          <Card className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-3 sm:p-4 text-center hover:shadow-xl transition-all duration-300 hover:scale-105">
             <CardHeader className="pb-1 sm:pb-2">
              <CardTitle className="text-base sm:text-lg font-bold text-yellow-800 dark:text-yellow-200 flex items-center justify-center gap-1 sm:gap-2"><FaMapMarkerAlt /> Total Wilayah</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white min-h-[40px] flex items-center justify-center">{dashboardStats.totalWilayah}</p>
            </CardContent>
          </Card>
          <Card className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-3 sm:p-4 text-center hover:shadow-xl transition-all duration-300 hover:scale-105">
            <CardHeader className="pb-1 sm:pb-2">
              <CardTitle className="text-base sm:text-lg font-bold text-orange-800 dark:text-orange-200 flex items-center justify-center gap-1 sm:gap-2"><FaCalendarWeek /> AWB Periodik</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="min-h-[40px] flex flex-col justify-center text-lg sm:text-xl font-black text-gray-900 dark:text-white leading-tight px-2">
                <div className="flex justify-between items-center mb-1">
                  <span>Hari Ini:</span>
                  <span>{dashboardStats.totalAWBToday}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Minggu Ini:</span>
                  <span>{dashboardStats.totalAWBThisWeek}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent AWBs Section (Right Column) */}
        <div className="lg:col-span-1 bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
          <h3 className="text-xl font-bold text-blue-900 dark:text-blue-100 flex items-center gap-2 mb-4"><FaHistory /> AWB Terbaru</h3>

          {/* Search Input */}
          <div className="mb-4">
            <Input
              placeholder="Cari AWB No, Tujuan, Penerima..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>

          {isLoading ? (
            <div className="text-center text-gray-600 dark:text-gray-400">Memuat AWB terbaru...</div>
          ) : allManifestData.length > 0 ? (
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {/* Determine which list to display based on search term */}
              {
                (searchTerm
                  ? allManifestData.filter(awb =>
                      awb.awb_no?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      awb.kota_tujuan?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      awb.nama_penerima?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      awb.agent_customer?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      awb.awb_date?.includes(searchTerm)
                    )
                  : dashboardStats.recentAWBs // Display only top 5 if search is empty
                ).map((awb, index) => (
                  <li key={awb.awb_no || index} className="py-3 flex justify-between items-center text-gray-800 dark:text-gray-200">
                    <div>
                      <div className="font-semibold">{awb.awb_no}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Tujuan: {awb.kota_tujuan}</div>
                    </div>
                    <div className="text-sm text-right">
                      <div>{awb.nama_penerima}</div>
                      <div className="text-gray-600 dark:text-gray-400">{awb.awb_date}</div>
                    </div>
                  </li>
                ))}
              {/* Show message if search filter results in no items */}
              {searchTerm && allManifestData.filter(awb =>
                awb.awb_no?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                awb.kota_tujuan?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                awb.nama_penerima?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                awb.agent_customer?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                awb.awb_date?.includes(searchTerm)
              ).length === 0 && (
                <li className="text-center py-4 text-gray-600 dark:text-gray-400">Tidak ada AWB yang cocok dengan pencarian.</li>
              )}
            </ul>
          ) : (
            <p className="text-gray-600 dark:text-gray-400">Belum ada data manifest yang tersedia.</p>
          )}
        </div>
      </div>

      {/* AWB per Kota Tujuan Chart */}
      {dashboardStats.awbPerKotaChartData && (
        <div className="mt-8 bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
          <h3 className="text-xl font-bold text-blue-900 dark:text-blue-100 mb-4">Distribusi AWB per Kota Tujuan</h3>
          <div className="h-64">
             <Bar 
               data={dashboardStats.awbPerKotaChartData}
               options={{
                 responsive: true,
                 maintainAspectRatio: false,
                 plugins: {
                   legend: {
                     position: 'top' as const,
                     labels: {
                       color: userRole === 'cabang' ? '#E5E7EB' : '#1F2937',
                     }
                   },
                   title: {
                     display: false,
                   },
                   tooltip: {
                     callbacks: {
                       label: function(context) {
                         let label = context.dataset.label || '';
                         if (label) {
                           label += ': ';
                         }
                         if (context.parsed.y !== null) {
                           label += context.parsed.y + ' AWB';
                         }
                         return label;
                       }
                     }
                   },
                 },
                 scales: {
                   x: {
                     ticks: {
                       color: userRole === 'cabang' ? '#D1D5DB' : '#4B5563',
                     },
                   },
                   y: {
                     beginAtZero: true,
                     ticks: {
                       precision: 0,
                       color: userRole === 'cabang' ? '#D1D5DB' : '#4B5563',
                     },
                     grid: {
                        color: userRole === 'cabang' ? 'rgba(107, 114, 128, 0.3)' : 'rgba(229, 231, 235, 0.8)',
                     }
                   },
                 },
               }}
             />
          </div>
        </div>
      )}

      {/* AWB Trend per Day with Kirim Via Breakdown (Stacked Bar Chart) */}
      {dashboardStats.awbPerDayChartData && (
        <div className="mt-8 bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
          <h3 className="text-xl font-bold text-blue-900 dark:text-blue-100 mb-4">Tren AWB per Tanggal (Berdasarkan Metode Kirim)</h3>
          <div className="h-80">
            <Bar
              data={dashboardStats.awbPerDayChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'top' as const,
                    labels: {
                      color: userRole === 'cabang' ? '#E5E7EB' : '#1F2937',
                    }
                  },
                  title: {
                    display: false,
                  },
                  tooltip: {
                    callbacks: {
                      label: function (context) {
                        let label = context.dataset.label || '';
                        if (label) {
                          label += ': ';
                        }
                        if (context.parsed.y !== null) {
                          label += context.parsed.y + ' AWB';
                        }
                        return label;
                      }
                    }
                  },
                },
                scales: { // Configure scales for stacked bar chart
                  x: {
                    stacked: true,
                    ticks: {
                      color: userRole === 'cabang' ? '#D1D5DB' : '#4B5563',
                    },
                  },
                  y: {
                    stacked: true,
                    beginAtZero: true,
                    ticks: {
                      precision: 0,
                      color: userRole === 'cabang' ? '#D1D5DB' : '#4B5563',
                    },
                    grid: {
                      color: userRole === 'cabang' ? 'rgba(107, 114, 128, 0.3)' : 'rgba(229, 231, 235, 0.8)',
                    }
                  },
                },
                animation: { // Add animation delay options from Chart.js example
                   onComplete: () => { delayed = true; },
                   delay: (context) => { let delay = 0; if (context.type === 'data' && context.mode === 'default' && !delayed) { delay = context.dataIndex * 100 + context.datasetIndex * 50; } return delay; }, // Adjusted delay based on Chart.js stacked example
                }
              }}
            />
          </div>
        </div>
      )}

      {/* AWB per Agent/Customer Chart (Doughnut) */}
      {dashboardStats.awbPerAgentChartData && (
        <div className="mt-8 bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
          <h3 className="text-xl font-bold text-blue-900 dark:text-blue-100 mb-4">Distribusi AWB per Agent/Customer</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div className="h-64 flex justify-center items-center md:col-span-1">
              <Doughnut
                data={dashboardStats.awbPerAgentChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      display: false,
                    },
                    title: {
                      display: false,
                    },
                    tooltip: {
                       callbacks: {
                         label: function(context) {
                           let label = context.dataset.label || '';
                           if (label) {
                             label += ': ';
                           }
                           if (context.parsed !== null) {
                             label += context.parsed + ' AWB';
                           }
                           return label;
                         }
                       }
                    },
                  },
                }}
               />
            </div>

            <div className="text-gray-800 dark:text-gray-200 md:col-span-1">
              <h4 className="font-semibold mb-2">Detail Agent:</h4>
              <ul className="text-sm max-h-48 overflow-y-auto">
                {dashboardStats.awbPerAgentChartData.labels.map((agent: string, index: number) => (
                  <li key={agent} className="mb-1">
                    <span
                      className="inline-block w-3 h-3 mr-2 rounded-full"
                      style={{ backgroundColor: dashboardStats.awbPerAgentChartData.datasets[0].backgroundColor[index % dashboardStats.awbPerAgentChartData.datasets[0].backgroundColor.length] }}
                    ></span>
                    {agent}: <span className="font-medium">{dashboardStats.awbPerAgentChartData.datasets[0].data[index]} AWB</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
