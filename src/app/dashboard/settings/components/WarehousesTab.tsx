'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { HouseIcon, PlusIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Warehouse {
  id: number;
  code: string;
  name: string;
  description: string | null;
  international: boolean;
  internationalRank: number;
  domesticRank: number;
  active: boolean; 
  packages: string[];
  carriers: string[];
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
  const [isWarehouseDetailsOpen, setIsWarehouseDetailsOpen] = useState(false);
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

  const token = localStorage.getItem('authToken');

  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
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

    fetchWarehouses();
  }, []);

  const handleViewDetails = (warehouse: Warehouse) => {
    setSelectedWarehouse(warehouse);
    setIsWarehouseDetailsOpen(true);
  };

  const handleUpdateWarehose = (warehouse: Warehouse) => {
    setSelectedWarehouse(warehouse);
    setEditWarehouseData({
      warehouse_code: warehouse.code,
      description: warehouse.description || '',
      international: warehouse.international ? 1 : 0,
      international_rank: warehouse.internationalRank,
      active: warehouse.active ? 1 : 0
    });
    setIsEditWarehouseOpen(true);
  };

  const handleSubmitUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const response = await fetch(`https://ship-orders.vpa.com.au/api/platform/warehouses/${selectedWarehouse?.code}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(editWarehouseData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to update warehouse: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Refresh warehouses list
      const refreshResponse = await fetch('https://ship-orders.vpa.com.au/api/platform/warehouses', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!refreshResponse.ok) {
        throw new Error('Failed to refresh warehouses');
      }

      const refreshData: WarehousesResponse = await refreshResponse.json();
      const refreshedWarehouses = Object.values(refreshData.warehouses);
      setWarehouses(refreshedWarehouses);
      
      setIsEditWarehouseOpen(false);
      
      toast({
        title: 'Success',
        description: 'Warehouse updated successfully',
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to update warehouse',
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
        {/* <div className="flex justify-end mb-4">
          <Button>
            <PlusIcon className="mr-2 h-4 w-4" />
            Add New Warehouse
          </Button>
        </div> */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>International</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center">Loading warehouses...</TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-red-600">{error}</TableCell>
              </TableRow>
            ) : warehouses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center">No warehouses found</TableCell>
              </TableRow>
            ) : warehouses.map((warehouse) => (
              <TableRow key={warehouse.id}>
                <TableCell>{warehouse.code}</TableCell>
                <TableCell>{warehouse.name}</TableCell>
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
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => handleViewDetails(warehouse)}>
                    View Details
                  </Button>
                  <Button onClick={() => handleUpdateWarehose(warehouse)} variant="ghost" size="sm">Edit</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Warehouse Details Dialog */}
        <Dialog open={isWarehouseDetailsOpen} onOpenChange={setIsWarehouseDetailsOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Warehouse Details</DialogTitle>
            </DialogHeader>
            {selectedWarehouse && (
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-medium">Basic Information</h3>
                    <div className="mt-2 space-y-2">
                      <div>
                        <span className="font-medium">ID:</span> {selectedWarehouse.id}
                      </div>
                      <div>
                        <span className="font-medium">Code:</span> {selectedWarehouse.code}
                      </div>
                      <div>
                        <span className="font-medium">Name:</span> {selectedWarehouse.name}
                      </div>
                      <div>
                        <span className="font-medium">Description:</span> {selectedWarehouse.description || 'N/A'}
                      </div>
                      <div>
                        <span className="font-medium">Status:</span> {selectedWarehouse.active ? 'Active' : 'Inactive'}
                      </div>
                      <div>
                        <span className="font-medium">International:</span> {selectedWarehouse.international ? 'Yes' : 'No'}
                      </div>
                      <div>
                        <span className="font-medium">International Rank:</span> {selectedWarehouse.internationalRank}
                      </div>
                      <div>
                        <span className="font-medium">Domestic Rank:</span> {selectedWarehouse.domesticRank}
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-medium">Packages</h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedWarehouse.packages.length > 0 ? (
                        selectedWarehouse.packages.map((pkg) => (
                          <Badge key={pkg} variant="secondary">{pkg}</Badge>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500">No packages available</p>
                      )}
                    </div>
                    
                    <h3 className="font-medium mt-4">Carriers</h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedWarehouse.carriers.length > 0 ? (
                        selectedWarehouse.carriers.map((carrier) => (
                          <Badge key={carrier} variant="secondary">{carrier}</Badge>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500">No carriers available</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsWarehouseDetailsOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Warehouse Dialog */}
        <Dialog open={isEditWarehouseOpen} onOpenChange={setIsEditWarehouseOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Edit Warehouse</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmitUpdate}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="warehouse_code" className="text-right">
                    Code
                  </Label>
                  <Input
                    id="warehouse_code"
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
                    onChange={(e) => setEditWarehouseData({...editWarehouseData, description: e.target.value})}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="international" className="text-right">
                    International
                  </Label>
                  <Select 
                    value={editWarehouseData.international.toString()} 
                    onValueChange={(value) => setEditWarehouseData({...editWarehouseData, international: parseInt(value)})}
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select international status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Yes</SelectItem>
                      <SelectItem value="0">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="international_rank" className="text-right">
                    Int. Rank
                  </Label>
                  <Input
                    id="international_rank"
                    type="number"
                    value={editWarehouseData.international_rank}
                    onChange={(e) => setEditWarehouseData({...editWarehouseData, international_rank: parseInt(e.target.value)})}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="active" className="text-right">
                    Status
                  </Label>
                  <Select 
                    value={editWarehouseData.active.toString()} 
                    onValueChange={(value) => setEditWarehouseData({...editWarehouseData, active: parseInt(value)})}
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
                <Button type="button" variant="outline" onClick={() => setIsEditWarehouseOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <svg className="w-4 h-4 mr-2 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Updating...
                    </>
                  ) : (
                    'Update Warehouse'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}