"use client"  // New: Mark as client component to support hooks like useEffect

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Timeline,
  TimelineItem,
  TimelineConnector,
  TimelineHeader,
  TimelineIcon,
  TimelineBody,
} from "@/components/ui/timeline"
import { type ShipmentHistory, type Shipment } from "@/lib/db"
import { Box } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { gsap } from 'gsap'
import { supabaseClient } from "@/lib/auth"

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
}

export function TrackingResults({ awbNumber }: { awbNumber: string }) {
  const [shipment, setShipment] = useState<Shipment | null>(null)
  const [history, setHistory] = useState<ShipmentHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({})
  const [showImages, setShowImages] = useState<Record<string, boolean>>({})
  const [enlargedImageUrl, setEnlargedImageUrl] = useState<string | null>(null)
  const [lastUpdateTime, setLastUpdateTime] = useState<string>("")
  const [courierName, setCourierName] = useState<string>("")

  const getProgress = (status: string) => {
    switch (status) {
      case 'processed':
        return 20;
      case 'shipped':
        return 40;
      case 'in_transit':
        return 60;
      case 'out_for_delivery':
        return 80;
      case 'delivered':
        return 100;
      default:
        return 0;
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: shipmentData, error: shipmentError } = await supabaseClient.from("shipments").select("*").eq("awb_number", awbNumber).single();
        if (shipmentError) {
          setError("Shipment not found");
          return;
        }

        const { data: historyData, error: historyError } = await supabaseClient.from("shipment_history").select("*").eq("awb_number", awbNumber).order("created_at", { ascending: false });
        if (historyError) {
          setError(`Error fetching history: ${historyError.message}`);
        }

        setShipment(shipmentData);
        setHistory(historyData || []);

        if (historyData && historyData.length > 0) {
          const latestEntry = historyData[0];
          if (latestEntry.notes) {
            const byMatch = latestEntry.notes.match(/by\s+(\w+)/i);
            const dashMatch = latestEntry.notes.match(/-\s+(\w+)/i);
            const bulkMatch = latestEntry.notes.match(/Bulk update - Shipped by\s+(\w+)/i);

            if (byMatch && byMatch[1]) {
              setCourierName(byMatch[1]);
            } else if (dashMatch && dashMatch[1]) {
              setCourierName(dashMatch[1]);
            } else if (bulkMatch && bulkMatch[1]) {
              setCourierName(bulkMatch[1]);
            } else {
              setCourierName("Unknown");  // Fallback jika tidak ada pola yang cocok
            }
          } else {
            setCourierName("Unknown");  // Fallback jika notes tidak ada
          }
          setLastUpdateTime(new Date(latestEntry.created_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }));
        } else if (shipmentData) {
          setCourierName(shipmentData.courier || "Unknown");  // Fallback ke shipmentData jika history kosong
        }

        if (!shipmentData) {
          setError(`No shipment found with AWB number ${awbNumber}`);
        }
      } catch (err) {
        setError("Terjadi kesalahan saat mengambil data tracking")
      } finally {
        setLoading(false)
      }
    };
    fetchData();
  }, [awbNumber]);

  useEffect(() => {
    if (shipment) {
      const progressPercent = getProgress(shipment.current_status);
      const color = shipment.current_status === 'delivered' ? 'green' : 'blue';
      gsap.to('#progress-bar', {
        width: `${progressPercent}%`,
        backgroundColor: color,
        duration: 1,
        ease: 'power2.out',
      });
    }
  }, [shipment]);

  const handleImageError = (id: string) => {
    setImageErrors((prev) => ({ ...prev, [id]: true }))
  }

  const handleEnlargeImage = (url: string) => {
    setEnlargedImageUrl(url);
  };

  const closeEnlargedImage = () => {
    setEnlargedImageUrl(null);
  };

  const toggleImage = (id: string) => {
    setShowImages((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  if (error) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (!shipment && !loading) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertTitle>Not Found</AlertTitle>
        <AlertDescription>No shipment found with AWB number {awbNumber}</AlertDescription>
      </Alert>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Loading shipment information...</p>
        </div>
      </div>
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "processed":
        return "bg-blue-500"
      case "shipped":
        return "bg-indigo-500"
      case "in_transit":
        return "bg-yellow-500"
      case "out_for_delivery":
        return "bg-orange-500"
      case "delivered":
        return "bg-green-500"
      case "exception":
        return "bg-red-500"
      default:
        return "bg-gray-500"
    }
  }

  const formatStatus = (status: string) => {
    return status
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 md:p-8 bg-background min-h-screen">
      {enlargedImageUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={closeEnlargedImage}>
          <div className="relative max-w-[80%] sm:max-w-[70%] md:max-w-[60%] max-h-[80%]">
            <img src={enlargedImageUrl} alt="Enlarged proof of delivery" className="w-full h-full object-contain rounded-lg shadow-lg" />
            <Button variant="ghost" className="absolute top-2 right-2" onClick={closeEnlargedImage}>Close</Button>
          </div>
        </div>
      )}

      <Card className="shadow-md border-0 rounded-lg overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-800 p-6 text-center">
          <CardTitle className="text-2xl sm:text-3xl md:text-4xl font-bold text-white text-center sm:text-left">Shipment Details</CardTitle>
          <div className="mt-2 text-xl sm:text-2xl font-bold text-blue-500 bg-muted p-3 rounded-md shadow-sm text-center sm:text-left">
            AWB: {awbNumber}
          </div>
          {shipment && (
            <div className="mt-4 text-sm sm:text-base text-muted-foreground bg-muted p-4 rounded-md flex flex-col sm:flex-row justify-between items-center gap-4">
              <p className="font-medium bg-yellow-100 p-2 rounded-md shadow-sm">Handled by: {courierName}</p>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 text-blue-500">
                <p>Last updated: {lastUpdateTime}</p>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-6">
          {shipment && (
            <>
              {(shipment.sender_name && shipment.sender_name !== 'Auto Generated') || (shipment.receiver_name && shipment.receiver_name !== 'Auto Generated') ? (
                <div className="bg-muted p-4 rounded-lg shadow-sm space-y-4 mb-6">
                  {shipment.sender_name && shipment.sender_name !== 'Auto Generated' && (
                    <div className="text-center sm:text-left">
                      <h3 className="text-base font-semibold mb-1 text-primary">Sender Information</h3>
                      <p className="font-medium text-sm">{shipment.sender_name}</p>
                      <p className="text-xs text-muted-foreground">{shipment.sender_address}</p>
                      <p className="text-xs text-muted-foreground">{shipment.sender_phone}</p>
                    </div>
                  )}
                  {shipment.receiver_name && shipment.receiver_name !== 'Auto Generated' && (
                    <div className="text-center sm:text-left">
                      <h3 className="text-base font-semibold mb-1 text-primary">Receiver Information</h3>
                      <p className="font-medium text-sm">{shipment.receiver_name}</p>
                      <p className="text-xs text-muted-foreground">{shipment.receiver_address}</p>
                      <p className="text-xs text-muted-foreground">{shipment.receiver_phone}</p>
                    </div>
                  )}
                  {(shipment.sender_name && shipment.sender_name !== 'Auto Generated') || (shipment.receiver_name && shipment.receiver_name !== 'Auto Generated') ? (
                    <div className="text-center sm:text-left">
                      <h3 className="text-base font-semibold mb-1 text-primary">Package Details</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {typeof shipment.weight === 'string' && shipment.weight !== 'Auto Generated' && (
                          <div>
                            <p className="text-xs text-muted-foreground">Weight</p>
                            <p className="font-medium text-sm">{shipment.weight} kg</p>
                          </div>
                        )}
                        {shipment.dimensions && shipment.dimensions !== 'Auto Generated' && (
                          <div>
                            <p className="text-xs text-muted-foreground">Dimensions</p>
                            <p className="font-medium text-sm">{shipment.dimensions}</p>
                          </div>
                        )}
                        {shipment.service_type && shipment.service_type !== 'Auto Generated' && (
                          <div>
                            <p className="text-xs text-muted-foreground">Service Type</p>
                            <p className="font-medium text-sm">{shipment.service_type}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="w-full bg-gray-200 rounded-full h-6 mt-6 relative shadow-sm">
                <div id="progress-bar" className="h-full rounded-full flex items-center justify-center text-center text-white font-medium transition-all duration-300" style={{ width: '0%', backgroundColor: 'blue' }}>
                  {shipment && formatStatus(shipment.current_status)}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-md border-0 rounded-lg overflow-hidden">
        <CardHeader>
          <CardTitle className="text-2xl sm:text-3xl font-bold">Shipment History</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length > 0 ? (
            <Timeline className="relative ml-4 sm:ml-6">
              {history.map((item, index) => (
                <TimelineItem key={item.id} className="mb-4">
                  {index < history.length - 1 && <TimelineConnector className="bg-border absolute left-3.5 top-4 -bottom-9 w-px" aria-hidden="true" />}
                  <TimelineHeader className="flex items-center gap-3 relative">
                    <TimelineIcon className={`p-2 rounded-full ${getStatusColor(item.status)}`} />
                    <div className="flex flex-col gap-1">
                      <h4 className="text-base sm:text-lg font-semibold">{formatStatus(item.status)}</h4>
                      <time className="text-sm text-muted-foreground">{formatDate(item.created_at)}</time>
                    </div>
                  </TimelineHeader>
                  <TimelineBody className="ml-10 sm:ml-12 mt-2 space-y-2">
                    <p className="text-foreground">{item.location}</p>
                    {item.notes && <p className="text-sm text-muted-foreground">{item.notes}</p>}
                    {item.photo_url && !imageErrors[item.id] && (
                      <div className="mt-2">
                        {showImages[item.id] ? (
                          <div className="relative bg-muted rounded-md p-4 flex flex-col items-center cursor-pointer" onClick={() => item.photo_url && handleEnlargeImage(item.photo_url)}>
                            <div className="w-full max-w-md h-48 relative flex items-center justify-center border rounded-md overflow-hidden bg-background">
                              <div className="absolute inset-0 flex items-center justify-center">
                                <Box className="h-12 w-12 text-muted-foreground" />
                              </div>
                              {item.photo_url && (
                                <img
                                  src={item.photo_url}
                                  alt={`Proof of ${item.status}`}
                                  className="relative z-10 max-w-full max-h-full object-contain"
                                  onError={() => handleImageError(item.id)}
                                />
                              )}
                            </div>
                            <Button variant="outline" size="sm" className="mt-2" onClick={(e) => { e.stopPropagation(); toggleImage(item.id); }}>
                              Hide Image
                            </Button>
                          </div>
                        ) : (
                          <Button variant="outline" size="sm" className="flex items-center gap-2 w-full sm:w-auto" onClick={() => toggleImage(item.id)}>
                            <Box className="h-4 w-4" />
                            View Proof of {formatStatus(item.status)}
                          </Button>
                        )}
                      </div>
                    )}
                    {item.latitude && item.longitude && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        GPS: {item.latitude}, {item.longitude}
                      </div>
                    )}
                  </TimelineBody>
                </TimelineItem>
              ))}
            </Timeline>
          ) : (
            <p className="text-center py-4 text-muted-foreground">No history available for this shipment.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
