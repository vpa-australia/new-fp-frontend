'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';

interface Warehouse {
  id: number;
  code: string;
  description: string | null;
  international: boolean;
  international_rank: number | null;
  active: boolean;
}

interface WarehousesResponse {
  success: boolean;
  warehouses: Record<string, Warehouse>;
}

interface UpdateWarehouseData {
  warehouse_code: string;
  description: string;
  international: number;
  international_rank: number;
  active: number;
}

export default function WarehousesTab() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditWarehouseOpen, setIsEditWarehouseOpen] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editWarehouseData, setEditWarehouseData] = useState<UpdateWarehouseData>({
    warehouse_code: '',
    description: '',
    international: 0,
    international_rank: 0,
    active: 0
  });
  const { toast } = useToast();
  const { requireAuthToken } = useAuth();

  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        const token = requireAuthToken();
        const response = await fetch('https://ship-orders.vpa.com.au/api/platform/warehouses', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch warehouses');
        }

        const data: WarehousesResponse = await response.json();

        if (!data.success) {
          throw new Error('API returned unsuccessful response');
        }

        // Convert the warehouses object to an array
        const warehousesArray = Object.values(data.warehouses);
        setWarehouses(warehousesArray);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    // Only run on the client side
    if (typeof window !== 'undefined') {
      fetchWarehouses();
    }
  }, [requireAuthToken]);

  const handleUpdateWarehouse = (warehouse: Warehouse) => {
    setSelectedWarehouse(warehouse);
    setEditWarehouseData({
      warehouse_code: warehouse.code,
      description: warehouse.description || '',
      international: warehouse.international ? 1 : 0,
      international_rank: warehouse.international_rank || 0,
      active: warehouse.active ? 1 : 0
    });
    setIsEditWarehouseOpen(true);
  };

  const handleSubmitUpdate = async () => {
    if (!selectedWarehouse) return;

    setIsSubmitting(true);

    try {
      const token = requireAuthToken();

      const response = await fetch(`https://ship-orders.vpa.com.au/api/platform/warehouses/address_only`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editWarehouseData)
      });

      if (!response.ok) {
        throw new Error('Failed to update warehouse');
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to update warehouse');
      }

      toast({
        title: 'Success',
        description: 'Warehouse updated successfully',
      });

      // Refresh warehouses list
      const updatedWarehouses = warehouses.map(warehouse => {
        if (warehouse.id === selectedWarehouse.id) {
          return {
            ...warehouse,
            description: editWarehouseData.description,
            international: editWarehouseData.international === 1,
            international_rank: editWarehouseData.international_rank,
            active: editWarehouseData.active === 1
          };
        }
        return warehouse;
      });

      setWarehouses(updatedWarehouses);
      setIsEditWarehouseOpen(false);
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to update warehouse',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Warehouse Management</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>International</TableHead>
              <TableHead>Rank</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center">Loading warehouses...</TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-red-600">{error}</TableCell>
              </TableRow>
            ) : warehouses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center">No warehouses found</TableCell>
              </TableRow>
            ) : warehouses.map((warehouse) => (
              <TableRow key={warehouse.id}>
                <TableCell>{warehouse.code}</TableCell>
                <TableCell>{warehouse.description || 'N/A'}</TableCell>
                <TableCell>
                  {warehouse.international ? (
                    <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">
                      Yes
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-gray-100 text-gray-800 border-gray-200">
                      No
                    </Badge>
                  )}
                </TableCell>
                <TableCell>{warehouse.international_rank || 'N/A'}</TableCell>
                <TableCell>
                  {warehouse.active ? (
                    <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">
                      Inactive
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => handleUpdateWarehouse(warehouse)}>Edit</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Edit Warehouse Dialog */}
        <Dialog open={isEditWarehouseOpen} onOpenChange={setIsEditWarehouseOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Edit Warehouse</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="warehouse-code" className="text-right">
                  Code
                </Label>
                <Input
                  id="warehouse-code"
                  value={editWarehouseData.warehouse_code}
                  className="col-span-3"
                  disabled
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="description" className="text-right">
                  Description
                </Label>
                <Input
                  id="description"
                  value={editWarehouseData.description}
                  onChange={(e) => setEditWarehouseData({ ...editWarehouseData, description: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="international" className="text-right">
                  International
                </Label>
                <Select
                  value={editWarehouseData.international.toString()}
                  onValueChange={(value) => setEditWarehouseData({ ...editWarehouseData, international: parseInt(value) })}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Yes</SelectItem>
                    <SelectItem value="0">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="international-rank" className="text-right">
                  International Rank
                </Label>
                <Input
                  id="international-rank"
                  type="number"
                  value={editWarehouseData.international_rank}
                  onChange={(e) => setEditWarehouseData({ ...editWarehouseData, international_rank: parseInt(e.target.value) })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="active-status" className="text-right">
                  Status
                </Label>
                <Select
                  value={editWarehouseData.active.toString()}
                  onValueChange={(value) => setEditWarehouseData({ ...editWarehouseData, active: parseInt(value) })}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Active</SelectItem>
                    <SelectItem value="0">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditWarehouseOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmitUpdate} disabled={isSubmitting}>
                {isSubmitting ? 'Updating...' : 'Update Warehouse'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
