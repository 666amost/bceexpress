import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Package } from "lucide-react"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"

interface BulkShipmentsDetailsProps {
  shipments: Array<{
    awb_number: string
    status: string
    updated_at: string
  }>
}

export function BulkShipmentsDetails({ shipments }: BulkShipmentsDetailsProps) {
  const router = useRouter()

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold mb-4">Bulk Shipments Details</h2>
      <p className="text-muted-foreground mb-6">
        These are the shipments that have been marked as "Out For Delivery" and are pending delivery
      </p>

      <div className="space-y-4">
        {shipments.map((shipment) => (
          <Card key={shipment.awb_number} className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex-grow space-y-1">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-blue-500" />
                  <span className="font-mono font-medium">{shipment.awb_number}</span>
                  <Badge variant="outline" className="text-xs">OFD</Badge>
                </div>
                <p className="text-sm text-muted-foreground">Auto Generated Shipment</p>
                <p className="text-xs text-muted-foreground">
                  Updated: {new Date(shipment.updated_at).toLocaleString()}
                </p>
              </div>
              <Button
                onClick={() => router.push(`/courier/update?awb=${shipment.awb_number}`)}
                size="sm"
                className="ml-2"
              >
                Update
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
} 