import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Renew as RefreshIcon } from '@carbon/icons-react';

interface BulkUpdateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  couriers: Array<{ id: string; name: string }>;
  totalPendingByCourier: Record<string, number>;
  selectedCourierId: string;
  selectedStatus: string;
  notes: string;
  error: string;
  isUpdating: boolean;
  onCourierChange: (id: string) => void;
  onStatusChange: (status: string) => void;
  onNotesChange: (notes: string) => void;
  onSubmit: () => void;
  onVerifySync?: (courierId: string) => Promise<void>;
}

export function BulkUpdateModal({
  open,
  onOpenChange,
  couriers,
  totalPendingByCourier,
  selectedCourierId,
  selectedStatus,
  notes,
  error,
  isUpdating,
  onCourierChange,
  onStatusChange,
  onNotesChange,
  onSubmit,
  onVerifySync,
}: BulkUpdateModalProps) {
  const [isVerifying, setIsVerifying] = React.useState(false);

  const handleVerifySync = async () => {
    if (!selectedCourierId || !onVerifySync) return;
    setIsVerifying(true);
    try {
      await onVerifySync(selectedCourierId);
    } finally {
      setIsVerifying(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-lg">
        <DialogHeader>
          <DialogTitle className="text-orange-600 font-bold flex items-center gap-2">
            <RefreshIcon className="h-5 w-5" />
            Bulk Update Courier Status
          </DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium mb-2">Select Courier</label>
            <Select value={selectedCourierId} onValueChange={onCourierChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose courier..." />
              </SelectTrigger>
              <SelectContent>
                {couriers.map((courier) => {
                  const totalPending = totalPendingByCourier[courier.id] || 0;
                  return (
                    <SelectItem key={courier.id} value={courier.id}>
                      {courier.name} {totalPending > 0 ? `(${totalPending} old pending >7d)` : '(no old pending)'}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {selectedCourierId && totalPendingByCourier[selectedCourierId] > 0 && (
              <p className="text-xs text-gray-600 mt-2">
                Old pending shipments (&gt;7 days): <strong className="text-orange-600">{totalPendingByCourier[selectedCourierId]}</strong> shipments
              </p>
            )}
            {selectedCourierId && onVerifySync && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 text-xs"
                onClick={handleVerifySync}
                disabled={isVerifying}
              >
                {isVerifying ? 'Checking...' : 'Verify Sync Status'}
              </Button>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Update Status To</label>
            <Select value={selectedStatus} onValueChange={onStatusChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="processed">Processed</SelectItem>
                <SelectItem value="shipped">Shipped</SelectItem>
                <SelectItem value="in_transit">In Transit</SelectItem>
                <SelectItem value="out_for_delivery">Out For Delivery</SelectItem>
                <SelectItem value="exception">Exception</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Notes (Optional)</label>
            <Textarea
              value={notes}
              onChange={e => onNotesChange(e.target.value)}
              placeholder="Add notes for this bulk update..."
              className="w-full min-h-[80px]"
            />
          </div>
          
          {error && (
            <div className="text-red-600 text-sm bg-red-50 p-2 rounded">{error}</div>
          )}
          
          <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
            <p className="text-sm text-yellow-800">
              <strong>Warning:</strong> This will update pending shipments <strong>older than 7 days</strong> for the selected courier to "{selectedStatus}". Fresh shipments (last 7 days) will be skipped.
            </p>
          </div>
          
          <div className="flex gap-2 justify-end">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)} 
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              className="bg-orange-600 hover:bg-orange-700" 
              disabled={isUpdating || !selectedCourierId}
            >
              {isUpdating ? "Updating..." : "Update All"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
