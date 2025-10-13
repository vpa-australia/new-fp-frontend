'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from "@/lib/api/client";
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
import {Checkbox} from "@/components/ui/checkbox";

interface Carrier {
  id: number;
  code: string;
  name: string;
  description: string | null;
  maxParcelWeight: number | null;
  active: boolean;
  manual: boolean;
  color: string | null;
  warehouses: string[];
}

interface Warehouse {
  id: number;
  code: string;
  name: string;
  country: string | null;
  description: string | null;
  international: number;
  international_rank: number;
  domestic_rank: number;
  active: number;
}

interface CarriersResponse {
  success: boolean;
  carriers: Record<string, Carrier>;
}

interface WarehouseResponse {
  success: boolean;
  warehouses: Record<string, Warehouse>;
}

interface UpdateCarrierData {
  carrier_code: string;
  description: string;
  max_parcel_weight: number;
  color: string;
  warehouses: string[];
  active: number;
  manual: number;
}

export default function CarriersTab() {
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCarrierDetailsOpen, setIsCarrierDetailsOpen] = useState(false);
  const [isEditCarrierOpen, setIsEditCarrierOpen] = useState(false);
  const [selectedCarrier, setSelectedCarrier] = useState<Carrier | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editCarrierData, setEditCarrierData] = useState<UpdateCarrierData>({
    carrier_code: '',
    description: '',
    max_parcel_weight: 0,
    color: '',
    warehouses:[],
    active: 0,
    manual: 0
  });
  const { toast } = useToast();
  const { requireAuthToken } = useAuth();

  useEffect(() => {
    const fetchCarriers = async () => {
      try {
        const token = requireAuthToken();
        const response = await apiFetch('/platform/carriers', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch carriers');
        }

        const data: CarriersResponse = await response.json();

        if (!data.success) {
          throw new Error('API returned unsuccessful response');
        }

        // Convert the carriers object to an array
        const carriersArray = Object.values(data.carriers);
        setCarriers(carriersArray);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    const fetchWarehouses = async () => {
      try {
        const token = requireAuthToken();
        const response = await apiFetch('/platform/warehouses', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch warehouses');
        }

        const data: WarehouseResponse = await response.json();

        if (!data.success) {
          throw new Error('API returned unsuccessful response');
        }

        // Convert the carriers object to an array
        const warehouseArray = Object.values(data.warehouses);
        setWarehouses(warehouseArray);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    // Only run on the client side
    if (typeof window !== 'undefined') {
      fetchCarriers();
      fetchWarehouses();
    }
  }, [requireAuthToken]);

  const handleViewDetails = (carrier: Carrier) => {
    setSelectedCarrier(carrier);
    setIsCarrierDetailsOpen(true);
  };

  const handleUpdateCarrier = (carrier: Carrier) => {
    setSelectedCarrier(carrier);
    setEditCarrierData({
      carrier_code: carrier.code,
      description: carrier.description || '',
      max_parcel_weight: carrier.maxParcelWeight || 0,
      color: carrier.color || '',
      warehouses: carrier.warehouses || [],
      active: carrier.active ? 1 : 0,
      manual: carrier.manual ? 1 : 0,
    });
    setIsEditCarrierOpen(true);
  };

  const handleWarehouseChange = (warehouse: string, checked: boolean) => {
    if (checked) {
      setEditCarrierData({
        ...editCarrierData,
        warehouses: [...editCarrierData.warehouses, warehouse]
      });
    } else {
      setEditCarrierData({
        ...editCarrierData,
        warehouses: editCarrierData.warehouses.filter(r => r !== warehouse)
      });
    }
  };

  const handleSubmitUpdate = async () => {
    if (!selectedCarrier) return;

    setIsSubmitting(true);

    try {
      const token = requireAuthToken();

      const payload: {
        description: string;
        max_parcel_weight?: string;
        active: number;
        manual: number;
        color?: string;
        warehouses: string[];
      } = {
        description: editCarrierData.description,
        active: editCarrierData.active === 1 ? 1 : 0,
        manual: editCarrierData.manual === 1 ? 1 : 0,
        warehouses: editCarrierData.warehouses,
      };

      if (!isNaN(editCarrierData.max_parcel_weight)) {
        payload.max_parcel_weight = editCarrierData.max_parcel_weight.toString();
      }

      const trimmedColor = editCarrierData.color.trim();
      if (trimmedColor.length > 1) {
        payload.color = trimmedColor;
      }

      const response = await apiFetch(`/platform/carriers/`+ editCarrierData.carrier_code, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('Failed to update carrier');
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to update carrier');
      }

      toast({
        title: 'Success',
        description: 'Carrier updated successfully',
      });

      // Refresh carriers list
      const updatedCarriers = carriers.map(carrier => {
        if (carrier.id === selectedCarrier.id) {
          return {
            ...carrier,
            description: editCarrierData.description,
            maxParcelWeight: editCarrierData.max_parcel_weight,
            active: editCarrierData.active == 1,
            manual: editCarrierData.manual == 1,
            warehouses:editCarrierData.warehouses
          };
        }
        return carrier;
      });

      setCarriers(updatedCarriers);
      setIsEditCarrierOpen(false);
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to update carrier',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Carrier Management</CardTitle>
      </CardHeader>
      <CardContent>
        {/* <div className="flex justify-end mb-4">
          <Button>
            <PlusIcon className="mr-2 h-4 w-4" />
            Add New Carrier
          </Button>
        </div> */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Manual</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center">Loading carriers...</TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-red-600">{error}</TableCell>
              </TableRow>
            ) : carriers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center">No carriers found</TableCell>
              </TableRow>
            ) : carriers.map((carrier) => (
              <TableRow key={carrier.id}>
                <TableCell>{carrier.code}</TableCell>
                <TableCell>{carrier.name}</TableCell>
                <TableCell>
                  {carrier.active ? (
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
                  {carrier.manual ? (
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
                  <Button variant="ghost" size="sm" onClick={() => handleViewDetails(carrier)}>
                    View Details
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleUpdateCarrier(carrier)}>Edit</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Carrier Details Dialog */}
        <Dialog open={isCarrierDetailsOpen} onOpenChange={setIsCarrierDetailsOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Carrier Details</DialogTitle>
            </DialogHeader>
            {selectedCarrier && (
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-medium">Basic Information</h3>
                    <div className="mt-2 space-y-2">
                      <div>
                        <span className="font-medium">ID:</span> {selectedCarrier.id}
                      </div>
                      <div>
                        <span className="font-medium">Code:</span> {selectedCarrier.code}
                      </div>
                      <div>
                        <span className="font-medium">Name:</span> {selectedCarrier.name}
                      </div>
                      <div>
                        <span className="font-medium">Description:</span> {selectedCarrier.description || 'N/A'}
                      </div>
                      <div>
                        <span className="font-medium">Status:</span> {selectedCarrier.active ? 'Active' : 'Inactive'}
                      </div>
                      <div>
                        <span className="font-medium">Manual:</span> {selectedCarrier.manual ? 'Yes' : 'No'}
                      </div>
                      <div>
                        <span className="font-medium">Max Parcel Weight:</span> {selectedCarrier.maxParcelWeight || 'N/A'}
                      </div>
                      {selectedCarrier.color && (
                        <div>
                          <span className="font-medium">Color:</span>
                          <span
                            className="ml-2 inline-block w-4 h-4 rounded-full"
                            style={{ backgroundColor: selectedCarrier.color }}
                          ></span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <h3 className="font-medium">Warehouses</h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedCarrier.warehouses.length > 0 ? (
                        selectedCarrier.warehouses.map((warehouse) => (
                          <Badge key={warehouse} variant="secondary">{warehouse}</Badge>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500">No warehouses available</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCarrierDetailsOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Carrier Dialog */}
        <Dialog open={isEditCarrierOpen} onOpenChange={setIsEditCarrierOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Edit Carrier</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="carrier-code" className="text-right">
                  Code
                </Label>
                <Input
                  id="carrier-code"
                  value={editCarrierData.carrier_code}
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
                  value={editCarrierData.description}
                  onChange={(e) => setEditCarrierData({ ...editCarrierData, description: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="color" className="text-right">
                  Color
                </Label>
                <Input
                    id="description"
                    value={editCarrierData.color}
                    onChange={(e) => setEditCarrierData({ ...editCarrierData, color: e.target.value })}
                    className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="max-parcel-weight" className="text-right">
                  Max Parcel Weight (kg)
                </Label>
                <Input
                  id="max-parcel-weight"
                  type="number"
                  value={editCarrierData.max_parcel_weight}
                  onChange={(e) => setEditCarrierData({ ...editCarrierData, max_parcel_weight: parseFloat(e.target.value) })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="active-status" className="text-right">
                  Status
                </Label>
                <Select
                  value={editCarrierData.active.toString()}
                  onValueChange={(value) => setEditCarrierData({ ...editCarrierData, active: parseInt(value) })}
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
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="manual-status" className="text-right">
                  Manual or API Driven
                </Label>
                <Select
                    value={editCarrierData.manual.toString()}
                    onValueChange={(value) => setEditCarrierData({ ...editCarrierData, manual: parseInt(value) })}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Manual</SelectItem>
                    <SelectItem value="0">Uses API</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-start gap-4">
                <Label className="text-right pt-2">
                  Warehouses
                </Label>
                <div className="col-span-3 space-y-2">
                  {warehouses.length > 0 ? (
                      warehouses.map((warehouse) => (
                          <div key={warehouse.code} className="flex items-center space-x-2">
                            <Checkbox
                                id={`wh-${warehouse.code}`}
                                checked={editCarrierData.warehouses.includes(warehouse.code)}
                                onCheckedChange={(checked) => handleWarehouseChange(warehouse.code, checked === true)}
                            />
                            <Label htmlFor={`wh-${warehouse.code}`}>{warehouse.name}</Label>
                          </div>
                      ))
                  ) : (
                      <p className="text-sm text-gray-500">No warehouses available</p>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditCarrierOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmitUpdate} disabled={isSubmitting}>
                {isSubmitting ? 'Updating...' : 'Update Carrier'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
