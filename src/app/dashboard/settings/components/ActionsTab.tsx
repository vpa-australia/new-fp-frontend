'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ActivityIcon, PlusIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

interface Status {
  id: number;
  name: string;
  allowShipped: boolean;
  greenTick: boolean;
}

interface StatusesResponse {
  success: boolean;
  statuses: Status[];
}

export default function ActionsTab() {
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isStatusDetailsOpen, setIsStatusDetailsOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<Status | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchStatuses = async () => {
      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch('https://ship-orders.vpa.com.au/api/platform/statuses', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch statuses');
        }

        const data: StatusesResponse = await response.json();
        
        if (!data.success) {
          throw new Error('API returned unsuccessful response');
        }

        setStatuses(data.statuses);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    // Only run on the client side
    if (typeof window !== 'undefined') {
      fetchStatuses();
    }
  }, []);

  const handleViewDetails = (status: Status) => {
    setSelectedStatus(status);
    setIsStatusDetailsOpen(true);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Status Management</CardTitle>
      </CardHeader>
      <CardContent>
        {/* <div className="flex justify-end mb-4">
          <Button>
            <PlusIcon className="mr-2 h-4 w-4" />
            Add New Status
          </Button>
        </div> */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Allow Shipped</TableHead>
              <TableHead>Green Tick</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center">Loading statuses...</TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-red-600">{error}</TableCell>
              </TableRow>
            ) : statuses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center">No statuses found</TableCell>
              </TableRow>
            ) : statuses.map((status) => (
              <TableRow key={status.id}>
                <TableCell>{status.id}</TableCell>
                <TableCell>{status.name}</TableCell>
                <TableCell>
                  {status.allowShipped ? (
                    <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
                      Yes
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">
                      No
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {status.greenTick ? (
                    <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
                      Yes
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">
                      No
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => handleViewDetails(status)}>
                    View Details
                  </Button>
                  {/* <Button variant="ghost" size="sm">Edit</Button> */}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Status Details Dialog */}
        <Dialog open={isStatusDetailsOpen} onOpenChange={setIsStatusDetailsOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Status Details</DialogTitle>
            </DialogHeader>
            {selectedStatus && (
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <div>
                    <span className="font-medium">ID:</span> {selectedStatus.id}
                  </div>
                  <div>
                    <span className="font-medium">Name:</span> {selectedStatus.name}
                  </div>
                  <div>
                    <span className="font-medium">Allow Shipped:</span> {selectedStatus.allowShipped ? 'Yes' : 'No'}
                  </div>
                  <div>
                    <span className="font-medium">Green Tick:</span> {selectedStatus.greenTick ? 'Yes' : 'No'}
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsStatusDetailsOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}