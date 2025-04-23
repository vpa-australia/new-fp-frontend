'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreHorizontalIcon, PrinterIcon, TruckIcon } from 'lucide-react';

interface Shipment {
  id: number;
  shopifyOrderNumber: string;
  orderName: string;
  email: string;
  address1: string;
  suburb: string;
  region: string;
  postCode: string;
  country: string;
  warehouseCode: string;
  carrierCode: string;
  serviceCode: string;
  tracking_code: string;
  labelPrinted: boolean;
  manifested: boolean;
  status: string | null;
  quotes: Array<{
    carrierCode: string;
    serviceCode: string;
    costIncludingTax: string;
  }>;
}

type ShipmentsTableProps = {
  shipments: Shipment[];
  warehouseCode?: string;
  currentPage: number;
  itemsPerPage: number;
  totalItems: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  setItemsPerPage: React.Dispatch<React.SetStateAction<number>>;
};

export function ShipmentsTable({ 
  shipments, 
  currentPage,
  itemsPerPage,
  totalItems,
  setCurrentPage,
  setItemsPerPage
}: ShipmentsTableProps) {
//   const filteredShipments = warehouseCode 
//     ? shipments.filter(shipment => shipment.warehouseCode === warehouseCode)
//     : shipments;

  return (
    <>
    <Table>
      <TableHeader>
        <TableRow className="bg-gray-50">
          <TableHead>Order #</TableHead>
          <TableHead>Customer</TableHead>
          <TableHead>Address</TableHead>
          <TableHead>Carrier</TableHead>
          <TableHead>Service</TableHead>
          <TableHead>Tracking</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {shipments.map((shipment) => (
          <TableRow key={shipment.id}>
            <TableCell>{shipment.shopifyOrderNumber}</TableCell>
            <TableCell>
              <div>{shipment.orderName}</div>
              <div className="text-sm text-gray-500">{shipment.email}</div>
            </TableCell>
            <TableCell>
              <div className="text-xs">{shipment.address1}</div>
              <div className="text-xs">{shipment.suburb}, {shipment.region} {shipment.postCode} {shipment.country}</div>
            </TableCell>
            <TableCell>{shipment.carrierCode}</TableCell>
            <TableCell>{shipment.serviceCode}</TableCell>
            <TableCell>{shipment.tracking_code || '-'}</TableCell>
            <TableCell>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusClass(shipment.status)}`}>
                {shipment.manifested ? 'Manifested' : 
                 shipment.labelPrinted ? 'Label Printed' : 
                 shipment.status || 'Pending'}
              </span>
            </TableCell>
            <TableCell>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-8 w-8 p-0">
                    <MoreHorizontalIcon className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuItem>
                    <PrinterIcon className="mr-2 h-4 w-4" />
                    Print Label
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <TruckIcon className="mr-2 h-4 w-4" />
                    Manifest
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
    <div className="flex items-center justify-between p-4 border-t">
      <div className="text-sm text-gray-600">
        Showing {Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)}-{Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} shipments
      </div>
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">Items per page:</span>
          <select
            value={itemsPerPage}
            onChange={(e) => setItemsPerPage(Number(e.target.value))}
            className="text-sm border rounded-md px-2 py-1"
          >
            <option value="5">5</option>
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
          </select>
        </div>
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            onClick={() => setCurrentPage(Math.max(currentPage - 1, 1))}
            // disabled={currentPage === 1}
          >
            Previous
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setCurrentPage(currentPage + 1)}
            // disabled={currentPage * itemsPerPage >= totalItems}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
    </>
  );
}

function getStatusClass(status: string | null) {
  if (!status) return 'bg-gray-100 text-gray-800';
  switch (status.toLowerCase()) {
    case 'manifested': return 'bg-green-100 text-green-800';
    case 'label_printed': return 'bg-blue-100 text-blue-800';
    case 'on_hold': return 'bg-yellow-100 text-yellow-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}