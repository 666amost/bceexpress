"use client"

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { FaSearch, FaFilter, FaClock, FaCheckCircle, FaTimesCircle, FaDollarSign, FaCalendarAlt, FaUser, FaEye, FaPrint, FaDownload } from 'react-icons/fa';
import { useAgent } from '../context/AgentContext';
import PrintLayout from '../../../components/PrintLayout';
import { supabaseClient } from '../../../lib/auth';
import { type ShipmentHistory } from '@/lib/db';

export interface AWBData {
  id: string;
  awb_no: string;
  awb_date: string;
  nama_pengirim: string;
  nama_penerima: string;
  kota_tujuan: string;
  kecamatan?: string;
  alamat_penerima?: string;
  nomor_pengirim?: string;
  nomor_penerima?: string;
  coli?: number;
  berat_kg?: number;
  total: number;
  isi_barang?: string;
  metode_pembayaran?: string;
  kirim_via?: string;
  harga_per_kg?: number;
  sub_total?: number;
  biaya_admin?: number;
  biaya_packaging?: number;
  biaya_transit?: number;
  catatan?: string;
  agent_customer?: string;
  status: string;
  payment_status?: string;
  created_at: string;
  verified_time?: string;
  input_time?: string;
  // Shipment tracking fields
  shipment_status?: string;
  courier_name?: string;
  scanned_at?: string;
  delivered_at?: string;
  delivery_notes?: string;
  shipment_history?: Array<{
    awb_number: string;
    status: string;
    location: string;
    notes: string;
    created_at: string;
  }>;
}

interface AWBStatusTrackerProps {
  selectedAWB?: AWBData | null;
}

export const AWBStatusTracker: React.FC<AWBStatusTrackerProps> = ({ selectedAWB: propSelectedAWB }) => {
  const { currentAgent } = useAgent();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [filteredAWBs, setFilteredAWBs] = useState<AWBData[]>([]);
  const [selectedAWB, setSelectedAWB] = useState<AWBData | null>(null);
  const [printData, setPrintData] = useState<AWBData | null>(null);
  const printFrameRef = useRef<HTMLDivElement>(null);

  // Set selected AWB when prop changes
  useEffect(() => {
    if (propSelectedAWB) {
      setSelectedAWB(propSelectedAWB);
    }
  }, [propSelectedAWB]);

  // Function to enrich AWB data with shipment information
  const enrichAWBWithShipmentData = async (awbs: AWBData[]): Promise<AWBData[]> => {
    try {
      const awbNumbers = awbs.map(awb => awb.awb_no);
      
      // Fetch shipment data for these AWBs - using 'shipments' table like in leader-dashboard
      const { data: shipmentData, error } = await supabaseClient
        .from('shipments')
        .select('awb_number, current_status, courier_id, created_at, updated_at')
        .in('awb_number', awbNumbers);

      if (error) {
        console.error('Error fetching shipment data:', error);
        return awbs; // Return original data if shipment fetch fails
      }

      // Create a map of shipment data by AWB number
      const shipmentMap = new Map();
      shipmentData?.forEach(shipment => {
        shipmentMap.set(shipment.awb_number, shipment);
      });

      // Fetch courier names for the shipments
      const courierIds = shipmentData?.map(s => s.courier_id).filter(Boolean) || [];
      let courierNames: Record<string, string> = {};
      
      if (courierIds.length > 0) {
        const { data: couriers } = await supabaseClient
          .from('users')
          .select('id, name')
          .in('id', courierIds);
        
        courierNames = (couriers || []).reduce((acc, c) => {
          acc[c.id] = c.name;
          return acc;
        }, {} as Record<string, string>);
      }

      // Fetch shipment history for more detailed tracking
      const { data: historyData } = await supabaseClient
        .from('shipment_history')
        .select('awb_number, status, location, notes, created_at')
        .in('awb_number', awbNumbers)
        .order('created_at', { ascending: false });

      // Group history by AWB number
      const historyMap = new Map();
      historyData?.forEach(history => {
        if (!historyMap.has(history.awb_number)) {
          historyMap.set(history.awb_number, []);
        }
        historyMap.get(history.awb_number).push(history);
      });

      // Enrich AWB data with shipment information
      return awbs.map(awb => {
        const shipment = shipmentMap.get(awb.awb_no);
        const history = historyMap.get(awb.awb_no) || [];
        
        if (shipment) {
          const deliveredHistory = history.find((h: ShipmentHistory) => h.status === 'delivered');
          
          return {
            ...awb,
            shipment_status: shipment.current_status,
            courier_name: courierNames[shipment.courier_id] || 'Unknown Courier',
            scanned_at: shipment.updated_at,
            delivered_at: deliveredHistory?.created_at || (shipment.current_status === 'delivered' ? shipment.updated_at : undefined),
            delivery_notes: history.length > 0 ? history[0].notes : `Handled by ${courierNames[shipment.courier_id] || 'Unknown Courier'}`,
            // Update main status if shipment has more recent status
            status: shipment.current_status || awb.status,
            // Add history for timeline
            shipment_history: history
          };
        }
        return awb;
      });
    } catch (error) {
      console.error('Error enriching AWB data:', error);
      return awbs;
    }
  };

  const filterAWBs = React.useCallback(async () => {
    if (!currentAgent?.awbHistory) {
      setFilteredAWBs([]);
      return;
    }

    let filtered = [...currentAgent.awbHistory];

    // Enrich with shipment data first
    filtered = await enrichAWBWithShipmentData(filtered);

    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(awb =>
        awb.awb_no.toLowerCase().includes(searchLower) ||
        awb.nama_pengirim.toLowerCase().includes(searchLower) ||
        awb.nama_penerima.toLowerCase().includes(searchLower) ||
        awb.kota_tujuan.toLowerCase().includes(searchLower)
      );
    }

    // Status filter (check both main status and shipment status)
    if (statusFilter) {
      filtered = filtered.filter(awb => {
        const enrichedAWB = awb as AWBData;
        return enrichedAWB.status === statusFilter || 
               enrichedAWB.shipment_status === statusFilter;
      });
    }

    // Payment filter
    if (paymentFilter) {
      filtered = filtered.filter(awb => (awb as AWBData & { payment_status?: string }).payment_status === paymentFilter);
    }

    // Date filter
    if (dateFilter) {
      const today = new Date();
      const filterDate = new Date(today);

      switch (dateFilter) {
        case 'today':
          filterDate.setHours(0, 0, 0, 0);
          filtered = filtered.filter(awb => 
            new Date(awb.awb_date) >= filterDate
          );
          break;
        case 'week':
          filterDate.setDate(today.getDate() - 7);
          filtered = filtered.filter(awb => 
            new Date(awb.created_at) >= filterDate
          );
          break;
        case 'month':
          filterDate.setMonth(today.getMonth() - 1);
          filtered = filtered.filter(awb => 
            new Date(awb.created_at) >= filterDate
          );
          break;
      }
    }

    setFilteredAWBs(filtered as AWBData[]);
  }, [currentAgent, searchTerm, statusFilter, paymentFilter, dateFilter]);

  useEffect(() => {
    filterAWBs();
  }, [filterAWBs]);

  const handleDownloadPDF = async (awb: AWBData) => {
    setPrintData(awb);
    
    setTimeout(async () => {
      const element = printFrameRef.current;
      if (element) {
        try {
          // Add PDF-specific styling like in HistoryManifest.tsx
          const pdfSpecificStyle = document.createElement('style');
          pdfSpecificStyle.innerHTML = `
            .payment-method-code {
              font-size: 20px !important;
              font-weight: bold !important;
              width: 100% !important;
              text-align: center !important;
              margin-top: -1mm !important;
              display: block !important;
              position: relative !important;
              top: -1mm !important;
            }
            .logo-qr {
              padding-top: 0mm !important;
            }
            .shipping-details {
              margin-top: -2mm !important;
            }
            .agent-code-box .agent-abbr-left {
              position: relative !important;
              top: -3mm !important;
            }
          `;
          element.appendChild(pdfSpecificStyle);

          // Import html2pdf
          const html2pdf = await import('html2pdf.js');
          
          // Configuration for PDF
          const options = {
            filename: `${awb.awb_no}.pdf`,
            margin: 0,
            image: { 
              type: 'jpeg', 
              quality: 1.0 
            },
            html2canvas: { 
              scale: 4,
              useCORS: true,
              allowTaint: true,
              backgroundColor: '#ffffff',
              width: 378,
              height: 378,
              scrollX: 0,
              scrollY: 0
            },
            jsPDF: { 
              unit: 'mm', 
              format: [100, 100] as [number, number], 
              orientation: 'portrait',
              compress: true
            }
          };
          
          // Generate PDF
          await html2pdf.default()
            .set(options)
            .from(element)
            .save();

          // Remove style after PDF generation
          element.removeChild(pdfSpecificStyle);
            
          setPrintData(null);
        } catch (error) {
          console.error('Error generating PDF:', error);
          alert('Gagal membuat PDF. Silakan coba lagi.');
          setPrintData(null);
        }
      }
    }, 600);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'delivered':
      case 'terkirim':
        return 'bg-green-100 text-green-800';
      case 'in transit':
      case 'dalam perjalanan':
      case 'picked up':
      case 'dipickup':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
      case 'menunggu':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
      case 'dibatalkan':
        return 'bg-red-100 text-red-800';
      case 'scanned':
      case 'dipindai':
        return 'bg-purple-100 text-purple-800';
      case 'verified':
      case 'diverifikasi':
        return 'bg-indigo-100 text-indigo-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'unpaid':
        return 'bg-red-100 text-red-800';
      case 'partial':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('');
    setPaymentFilter('');
    setDateFilter('');
  };

  return (
    <div className="space-y-6">
      {/* Search and Filter Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FaSearch className="h-5 w-5 text-blue-600" />
            Search & Filter AWBs
          </CardTitle>
          <CardDescription>
            Search for AWBs and apply filters to find specific shipments
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search">Search AWB</Label>
              <div className="relative">
                <Input
                  id="search"
                  placeholder="AWB No, Sender, Receiver..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <FaSearch className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status-filter">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="In Transit">In Transit</SelectItem>
                  <SelectItem value="Delivered">Delivered</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment-filter">Payment</Label>
              <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Payment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Payment</SelectItem>
                  <SelectItem value="Paid">Paid</SelectItem>
                  <SelectItem value="Unpaid">Unpaid</SelectItem>
                  <SelectItem value="Partial">Partial</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date-filter">Date Range</Label>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <Button
                variant="outline"
                onClick={clearFilters}
                className="w-full"
              >
                <FaFilter className="h-4 w-4 mr-2" />
                Clear Filters
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Found {filteredAWBs.length} AWB{filteredAWBs.length !== 1 ? 's' : ''}
            </div>
            <div className="flex gap-2">
              <Badge variant="outline" className="bg-yellow-50">
                Pending: {filteredAWBs.filter(awb => awb.status.toLowerCase() === 'pending').length}
              </Badge>
              <Badge variant="outline" className="bg-blue-50">
                In Transit: {filteredAWBs.filter(awb => awb.status.toLowerCase() === 'in transit').length}
              </Badge>
              <Badge variant="outline" className="bg-green-50">
                Delivered: {filteredAWBs.filter(awb => awb.status.toLowerCase() === 'delivered').length}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AWB List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>AWB List</CardTitle>
            <CardDescription>
              Click on an AWB to view detailed information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {filteredAWBs.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FaSearch className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No AWBs found</p>
                  <p className="text-sm">Try adjusting your search or filters</p>
                </div>
              ) : (
                filteredAWBs.map((awb) => (
                  <div
                    key={awb.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors hover:bg-gray-50 ${
                      selectedAWB?.id === awb.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                    }`}
                    onClick={() => setSelectedAWB(awb)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-mono font-semibold text-blue-600">
                        {awb.awb_no}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedAWB(awb);
                          }}
                          title="Lihat Detail"
                        >
                          <FaEye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(`/agent/print-label/${awb.awb_no}`, '_blank');
                          }}
                          title="Cetak Label AWB"
                          className="text-green-600 hover:text-green-700"
                        >
                          <FaPrint className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadPDF(awb);
                          }}
                          title="Download PDF Resi"
                          className="text-red-600 hover:text-red-700"
                        >
                          <FaDownload className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2">
                        <FaUser className="h-3 w-3 text-gray-400" />
                        <span>{awb.nama_pengirim}</span>
                        <span className="text-gray-400">→</span>
                        <span>{awb.nama_penerima}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <FaEye className="h-3 w-3 text-gray-400" />
                        <span>{awb.kota_tujuan}</span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FaCalendarAlt className="h-3 w-3 text-gray-400" />
                          <span>{new Date(awb.awb_date).toLocaleDateString('id-ID')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <FaDollarSign className="h-3 w-3 text-gray-400" />
                          <span>Rp {awb.total.toLocaleString()}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 mt-2">
                        <Badge className={getStatusColor(awb.status)}>
                          {awb.status}
                        </Badge>
                        {(awb as AWBData & { payment_status?: string }).payment_status && (
                          <Badge className={getPaymentStatusColor((awb as AWBData & { payment_status?: string }).payment_status!)}>
                            {(awb as AWBData & { payment_status?: string }).payment_status}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* AWB Details */}
        <Card>
          <CardHeader>
            <CardTitle>AWB Details</CardTitle>
            <CardDescription>
              Detailed information about the selected AWB
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedAWB ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-mono text-lg font-semibold text-blue-600">
                    {selectedAWB.awb_no}
                  </h3>
                  <div className="flex gap-2">
                    <Badge className={getStatusColor(selectedAWB.status)}>
                      {selectedAWB.status}
                    </Badge>
                    {(selectedAWB as AWBData).shipment_status && (
                      <Badge className={getStatusColor((selectedAWB as AWBData).shipment_status!)}>
                        📦 {(selectedAWB as AWBData).shipment_status}
                      </Badge>
                    )}
                    {(selectedAWB as AWBData & { payment_status?: string }).payment_status && (
                      <Badge className={getPaymentStatusColor((selectedAWB as AWBData & { payment_status?: string }).payment_status!)}>
                        {(selectedAWB as AWBData & { payment_status?: string }).payment_status}
                      </Badge>
                    )}
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Sender</Label>
                      <p className="font-medium">{selectedAWB.nama_pengirim}</p>
                    </div>
                    
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Receiver</Label>
                      <p className="font-medium">{selectedAWB.nama_penerima}</p>
                    </div>
                    
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Destination</Label>
                      <p className="font-medium">{selectedAWB.kota_tujuan}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm font-medium text-gray-500">AWB Date</Label>
                      <p className="font-medium">{new Date(selectedAWB.awb_date).toLocaleDateString('id-ID')}</p>
                    </div>
                    
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Total Amount</Label>
                      <p className="font-medium text-green-600">Rp {selectedAWB.total.toLocaleString()}</p>
                    </div>
                    
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Created</Label>
                      <p className="font-medium">{formatDate(selectedAWB.created_at)}</p>
                    </div>
                  </div>
                </div>

                {/* Shipment Information */}
                {((selectedAWB as AWBData).shipment_status || (selectedAWB as AWBData).courier_name) && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <Label className="text-sm font-medium text-gray-500">📦 Shipment Information</Label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {(selectedAWB as AWBData).courier_name && (
                          <div>
                            <Label className="text-sm font-medium text-gray-500">Courier</Label>
                            <p className="font-medium">{(selectedAWB as AWBData).courier_name}</p>
                          </div>
                        )}
                        {(selectedAWB as AWBData).scanned_at && (
                          <div>
                            <Label className="text-sm font-medium text-gray-500">Scanned At</Label>
                            <p className="font-medium">{formatDate((selectedAWB as AWBData).scanned_at!)}</p>
                          </div>
                        )}
                        {(selectedAWB as AWBData).delivered_at && (
                          <div>
                            <Label className="text-sm font-medium text-gray-500">Delivered At</Label>
                            <p className="font-medium text-green-600">{formatDate((selectedAWB as AWBData).delivered_at!)}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {/* Shipment History Timeline */}
                {(selectedAWB as AWBData).shipment_history && (selectedAWB as AWBData).shipment_history!.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <Label className="text-sm font-medium text-gray-500">📋 Shipment History</Label>
                      <div className="max-h-40 overflow-y-auto space-y-2">
                        {(selectedAWB as AWBData).shipment_history!.map((history, index) => (
                          <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                            <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-sm capitalize">{history.status}</span>
                                <span className="text-xs text-gray-500">
                                  {formatDate(history.created_at)}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600">{history.location}</p>
                              {history.notes && (
                                <p className="text-xs text-gray-500 mt-1">{history.notes}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {((selectedAWB as AWBData & { verified_time?: string; input_time?: string }).verified_time || (selectedAWB as AWBData & { verified_time?: string; input_time?: string }).input_time) && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-500">Timeline</Label>
                      <div className="space-y-2">
                        {(selectedAWB as AWBData & { input_time?: string }).input_time && (
                          <div className="flex items-center gap-2 text-sm">
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            <FaClock className="h-3 w-3 text-gray-400" />
                            <span>Input: {formatDate((selectedAWB as AWBData & { input_time?: string }).input_time!)}</span>
                          </div>
                        )}
                        {(selectedAWB as AWBData & { verified_time?: string }).verified_time && (
                          <div className="flex items-center gap-2 text-sm">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <FaCheckCircle className="h-3 w-3 text-green-500" />
                            <span>Verified: {formatDate((selectedAWB as AWBData & { verified_time?: string }).verified_time!)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
                
                <Separator />
                
                {/* Print and Download Buttons */}
                <div className="flex justify-center gap-3 pt-4">
                  <Button
                    onClick={() => window.open(`/agent/print-label/${selectedAWB.awb_no}`, '_blank')}
                    className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
                  >
                    <FaPrint className="h-4 w-4" />
                    Cetak Label
                  </Button>
                  <Button
                    onClick={() => handleDownloadPDF(selectedAWB)}
                    className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-2"
                  >
                    <FaDownload className="h-4 w-4" />
                    Download PDF
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <FaSearch className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>Select an AWB to view details</p>
                <p className="text-sm">Click on any AWB from the list</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Hidden print frame for PDF generation */}
      {printData && (
        <div 
          ref={printFrameRef} 
          style={{ 
            position: 'absolute', 
            left: '-9999px', 
            width: '100mm', 
            height: '100mm' 
          }}
        >
          <PrintLayout data={printData} />
        </div>
      )}
    </div>
  );
};
