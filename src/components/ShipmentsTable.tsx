'use client';

import React, { useState, useEffect } from 'react'; // Added useState and useEffect
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { CalendarClock, Check, ChevronDownIcon, ChevronRightIcon, Clock, DollarSign, FileText, MapPin, QrCode, Send, Tag, Truck, X, Zap } from 'lucide-react'; // Added toggle icons
import { Checkbox } from '@/components/ui/checkbox'; // Added Checkbox import
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'; // Added Select imports
import { ShipmentDetailView } from './ShipmentDetailView'; // Import the detail view component
import { useToast } from '@/hooks/use-toast';
import { AiFillFile, AiFillTag, AiFillHdd } from "react-icons/ai";
import { BsFillSendFill } from "react-icons/bs";
import { PiCubeFocusBold } from "react-icons/pi";
import { FaTimes, FaUser } from "react-icons/fa";
import { FaLocationDot } from "react-icons/fa6";
import { FaCalendarDay } from "react-icons/fa6";

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
  unlDone: boolean;
  sent: boolean;
  invoicePrinted: boolean;
  manifested: boolean;
  status: string | null;
  carrierCodeDesired: string;
  quotes: Array<{
    carrierCodeDesired: string;
    carrierCode: string;
    serviceCode: string;
    costIncludingTax: string;
  }>;
  orderDate: number; // Added order date
  totalPrice: string; // Added total price (as string based on API)
  lastApiUpdate: number; // Added last API update time
  statusId?: number | null; // Add statusId to track the numeric ID
}

interface StatusOption {
  value: string;
  label: string;
  allowShipped: boolean;
  greenTick: boolean;
}

const defaultStatusOptions: StatusOption[] = [];
// Status options will be fetched from API

type ShipmentsTableProps = {
  shipments: Shipment[];
  warehouseCode?: string;
  currentPage: number;
  itemsPerPage: number;
  totalItems: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  setItemsPerPage: React.Dispatch<React.SetStateAction<number>>;
};

const formatRelativeTime = (timestamp: number) => {
  const seconds = Math.floor(Date.now() / 1000 - timestamp);
  
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d`;
  if (seconds < 31536000) return `${Math.floor(seconds / 2592000)}mo`;
  return `${Math.floor(seconds / 31536000)}y`;
};

export function ShipmentsTable({ 
  shipments, 
  currentPage,
  itemsPerPage,
  totalItems,
  setCurrentPage,
  setItemsPerPage
}: ShipmentsTableProps) {
  const [selectedShipmentId, setSelectedShipmentId] = useState<number | null>(null); // State for selected row
  const [selectedRows, setSelectedRows] = useState<Record<number, boolean>>({}); // State for selected checkboxes
  const [detailedShipment, setDetailedShipment] = useState<Shipment | null>(null); // State for detailed shipment data
  const [isLoadingDetail, setIsLoadingDetail] = useState(false); // Loading state for detail fetch
  const [statusOptions, setStatusOptions] = useState<StatusOption[]>(defaultStatusOptions);
  const [isLoadingStatuses, setIsLoadingStatuses] = useState(true);

  // Fetch status options when component mounts
  useEffect(() => {
    const fetchStatusOptions = async () => {
      setIsLoadingStatuses(true);
      try {
        const token = localStorage.getItem('authToken');
        if (!token) {
          throw new Error('Authentication token not found');
        }

        const response = await fetch('https://ship-orders.vpa.com.au/api/platform/statuses', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch status options');
        }

        const data = await response.json();
        if (data && data.success && data.statuses) {
          const formattedStatuses = data.statuses.map((status: any) => ({
            value: status.id.toString(),
            label: status.name,
            allowShipped: status.allowShipped,
            greenTick: status.greenTick
          }));

          console.log("formatted statuses", formattedStatuses)
          setStatusOptions(formattedStatuses);
        }
      } catch (error) {
        console.error('Error fetching status options:', error);
        // Fallback to empty status options
        setStatusOptions([]);
      } finally {
        setIsLoadingStatuses(false);
      }
    };

    fetchStatusOptions();
  }, []);

  const handleSelectRow = (id: number, checked: boolean) => {
    setSelectedRows((prev) => ({ ...prev, [id]: checked }));
  };

  const handleSelectAll = (checked: boolean) => {
    const newSelectedRows: Record<number, boolean> = {};
    if (checked) {
      shipments?.forEach((shipment) => {
        newSelectedRows[shipment.id] = true;
      });
    }
    setSelectedRows(newSelectedRows);
  };

  const isAllSelected = shipments?.length > 0 && shipments.every((shipment) => selectedRows[shipment.id]);

//   const filteredShipments = warehouseCode 
//     ? shipments.filter(shipment => shipment.warehouseCode === warehouseCode)
//     : shipments;

  // Handler for status change
  const { toast } = useToast();

  const handleStatusChange = async (shipmentId: number, newStatusId: string) => {
    console.log(`Shipment ${shipmentId} status changed to ${newStatusId}`);

    const token = localStorage.getItem('authToken');
    if (!token) {
      toast({
        variant: "destructive",
        title: "Authentication Error",
        description: "Please log in to continue."
      });
      return;
    }

    // The API endpoint uses the status ID in the path
    const apiUrl = `https://ship-orders.vpa.com.au/api/shipments/status/${newStatusId}?shipment_ids=${shipmentId}`;
    
    // The API expects shipment IDs as a comma-separated string in the query parameters
    const params = new URLSearchParams({
      shipment_ids: String(shipmentId) // Ensure shipmentId is treated as a string
    });

    try {
      const response = await fetch(`${apiUrl}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to update shipment status: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Shipment status updated successfully:', result);

      toast({
        variant: 'success',
        title: 'Status Updated',
        description: 'Quote has been updated successfully',
      });

    } catch (error: any) {
      console.error('Error updating shipment status:', error);
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: error.message || "Failed to update shipment status."
      });
    }
  };

  return (
    <>
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-md flex items-center justify-start gap-2 z-50">
        <Button variant="outline" size="sm">
          <FileText className="mr-2 h-4 w-4" /> Print Invoices
        </Button>
        <Button 
          variant="outline" 
          size="sm"
          onClick={async () => {
            const selectedIds = Object.entries(selectedRows)
              .filter(([_, isChecked]) => isChecked)
              .map(([id]) => id);
            
            if (selectedIds.length === 0) {
              toast({
                variant: "destructive",
                title: "No Shipments Selected",
                description: "Please select at least one shipment to generate labels."
              });
              return;
            }
            
            const token = localStorage.getItem('authToken');
            if (!token) {
              toast({
                variant: "destructive",                
                title: "Authentication Error",
                description: "Please log in to continue."
              });
              return;
            }
            
            try {
              const response = await fetch(`https://ship-orders.vpa.com.au/api/pdf/labels/generateLabels?shipment_ids=${selectedIds.join(',')}`, {
                method: 'PUT',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Accept': 'application/json',
                },
              });
              
              if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Failed to generate labels: ${response.statusText}`);
              }
              
              const blob = await response.blob();
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'shipment-labels.pdf';
              document.body.appendChild(a);
              a.click();
              window.URL.revokeObjectURL(url);
              document.body.removeChild(a);

              toast({
                variant: "success",
                title: "Labels Generated",
                description: "Labels have been generated successfully."
              });
            } catch (error: any) {
              console.error('Error generating labels:', error);
              toast({
                variant: "destructive",
                title: "Generation Failed",
                description: error.message || "Failed to generate labels."
              });
            }
          }}
        >
          <Tag className="mr-2 h-4 w-4" /> Generate Labels
        </Button>
        <Button 
          variant="outline" 
          size="sm"
          onClick={async () => {
            const selectedIds = Object.entries(selectedRows)
              .filter(([_, isChecked]) => isChecked)
              .map(([id]) => id);
            
            if (selectedIds.length === 0) {
              toast({
                variant: "destructive",
                title: "No Shipments Selected",
                description: "Please select at least one shipment to quick print."
              });
              return;
            }
            
            const token = localStorage.getItem('authToken');
            if (!token) {
              toast({
                variant: "destructive",                
                title: "Authentication Error",
                description: "Please log in to continue."
              });
              return;
            }
            
            try {
              const response = await fetch(`https://ship-orders.vpa.com.au/api/pdf/labels/quickPrint?shipment_ids=${selectedIds.join(',')}`, {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Accept': 'application/json',
                },
              });
              
              if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Failed to quick print: ${response.statusText}`);
              }

              toast({
                variant: "success",
                title: "Quick Print Successful",
                description: "Labels have been sent to the printer."
              });
            } catch (error: any) {
              console.error('Error during quick print:', error);
              toast({
                variant: "destructive",
                title: "Quick Print Failed",
                description: error.message || "Failed to quick print labels."
              });
            }
          }}
        >
          <Zap className="mr-2 h-4 w-4" /> Quick Print
        </Button>
        <Button variant="outline" size="sm" onClick={async () => {
          const checkedIds = Object.entries(selectedRows)
            .filter(([_, isChecked]) => isChecked)
            .map(([id]) => id.toString()); // Keep as strings as per API requirement
          
          if (checkedIds.length === 0) {
            console.log('No shipments selected');
            return;
          }
          
          const token = localStorage.getItem('authToken');
          if (!token) {
            console.error('Authentication token not found. Please log in.');
            return;
          }
          
          try {
            const response = await fetch(`https://ship-orders.vpa.com.au/api/shipments/shipped/1?shipment_ids=${checkedIds.join(',')}`, {
              method: 'PATCH',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
              },
            });
            
            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.message || `Failed to mark shipments as shipped: ${response.statusText}`);
            }
            
            const result = await response.json();
            console.log('Shipments marked as shipped successfully:', result);
            // TODO: Add success feedback to user
          } catch (error) {
            console.error('Error marking shipments as shipped:', error);
            // TODO: Add error feedback to user
          }
        }}>
          <Check className="mr-2 h-4 w-4" /> Mark Shipped
        </Button>
        <Button variant="outline" size="sm" onClick={async () => {
          const checkedIds = Object.entries(selectedRows)
            .filter(([_, isChecked]) => isChecked)
            .map(([id]) => id.toString()); // Keep as strings as per API requirement
          
          if (checkedIds.length === 0) {
            console.log('No shipments selected');
            return;
          }
          
          const token = localStorage.getItem('authToken');
          if (!token) {
            console.error('Authentication token not found. Please log in.');
            return;
          }
          
          try {
            const response = await fetch(`https://ship-orders.vpa.com.au/api/shipments/shipped/0?shipment_ids=${checkedIds.join(',')}`, {
              method: 'PATCH',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
              },
            });
            
            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.message || `Failed to mark shipments as shipped: ${response.statusText}`);
            }
            
            const result = await response.json();
            console.log('Shipments marked as shipped successfully:', result);
            // TODO: Add success feedback to user
          } catch (error) {
            console.error('Error marking shipments as shipped:', error);
            // TODO: Add error feedback to user
          }
        }}>
          <X className="mr-2 h-4 w-4" /> Mark Not Shipped
        </Button>
        <Button variant="outline" size="sm">
          <Send className="mr-2 h-4 w-4" /> Manifest
        </Button>
        <Button variant="outline" size="sm">
          <MapPin className="mr-2 h-4 w-4" /> Change Order's Location
        </Button>
        <Button variant="outline" size="sm">
          <QrCode className="mr-2 h-4 w-4" /> Manifest using Codes
        </Button>
      </div>
    <Table>
      <TableHeader>
        <TableRow className="">
          <TableHead className="flex items-center gap-x-5">
            <Checkbox 
              checked={isAllSelected}
              onCheckedChange={(checked) => handleSelectAll(Boolean(checked))} 
              aria-label="Select all rows"
            />
            <div className="flex gap-x-2">
              <div className="flex items-center gap-x-1">
                <div className="w-4 h-4 rounded-sm bg-[#F46E6B]"></div>
                <span>AusPost</span>
              </div>
              <div className="flex items-center gap-x-1">
                <div className="w-4 h-4 rounded-sm bg-[#9370db]"></div>
                <span>Aramex</span>
              </div>
            </div>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {shipments?.map((shipment) => (
          <React.Fragment key={shipment.id}>
            <TableRow
              key={shipment.id}
            >
              <TableCell id={`select-row-${shipment.id}`} className={`text-white ${shipment.carrierCode === 'auspost' ? 'bg-[#F46E6B]' : 'bg-[#9370db]'}`}>
              <div className='flex flex-row gap-x-3 items-center'>
                <Checkbox 
                  checked={selectedRows[shipment.id] || false}
                  onCheckedChange={(checked) => handleSelectRow(shipment.id, Boolean(checked))}
                  aria-labelledby={`select-row-${shipment.id}`}
                />
                {shipment.shopifyOrderNumber}
                {shipment.invoicePrinted ? <AiFillFile  className="w-5 h-5 text-green-500" /> : <AiFillFile  className="w-5 h-5 text-gray-200" />}
                {shipment.labelPrinted ? <AiFillTag className="w-5 h-5 text-green-500" /> : <AiFillTag className="w-5 h-5 text-gray-200" />}
                {shipment.manifested ? <AiFillHdd className="w-5 h-5 text-green-500" /> : <AiFillHdd className="w-5 h-5 text-gray-200" />}
                {shipment.sent ? <BsFillSendFill  className="w-5 h-5 text-green-500" /> : <BsFillSendFill  className="w-5 h-5 text-gray-200" />}
                <div className='cursor-pointer'>
                <FaTimes className="w-5 h-5 text-white" />
                </div>
                <div className='ml-5 w-36 flex items-center gap-x-1'>
                <FaUser className='w-4 h-4' /> {shipment.orderName}
                </div>
                <div className="w-88 flex">
                  <FaLocationDot className='w-4 h-4' /> {(shipment.address1 +", "+ shipment.suburb).length > 45 ? `${(shipment.address1 + ", "+ shipment.suburb).substring(0, 45)}...` : (shipment.address1 + ", "+ shipment.suburb).substring(0, 45)}
                </div>
                {/* <div className="text-xs">{shipment.suburb}, {shipment.region} {shipment.postCode} {shipment.country}</div> */}
                <div className='w-48 flex gap-x-2'>
                  <FaCalendarDay className='w-4 h-4' /> {new Date(shipment.orderDate * 1000).toLocaleString()}
                </div>
                <div className='w-28 flex items-center'>
                  <DollarSign className='w-4 h-4' />
                  {parseFloat(shipment.totalPrice).toFixed(2)}
                </div>
                <div className='flex gap-x-2 items-center w-28'>
                  <Truck className='w-4 h-4' />
                {shipment.carrierCode ? shipment.carrierCode.charAt(0).toUpperCase() + shipment.carrierCode.slice(1) : shipment.carrierCodeDesired.charAt(0).toUpperCase() + shipment.carrierCodeDesired.slice(1)}
                </div>
                <div className='flex gap-x-1 items-center w-16'>
                  <Clock className='w-4 h-4' />
                  {formatRelativeTime(shipment.lastApiUpdate)}
                </div>
                <div className='w-13'>
                  <div className='cursor-pointer'>
                  {shipment.unlDone ? <PiCubeFocusBold className="w-6 h-6 text-green-500" /> : <PiCubeFocusBold size={22} className="text-gray-300" />}
                  </div>
                </div>
                <Select
                  defaultValue={`${shipment.status ? shipment.status : '-'}`}
                  onValueChange={(value) => handleStatusChange(shipment.id, value)}
                >
                  <SelectTrigger  className="w-[180px]">
                    <SelectValue placeholder="Select Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem key={"-"} value="-">
                        Select Status
                    </SelectItem>
                    {statusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button 
                  variant="ghost" 
                  className="h-8 w-8 p-0 ml-28"
                  onClick={async (e) => {
                      e.stopPropagation(); // Prevent row selection if clicking button
                      const newSelectedId = selectedShipmentId === shipment.id ? null : shipment.id;
                      setSelectedShipmentId(newSelectedId);
                      
                      if (newSelectedId) {
                        setIsLoadingDetail(true);
                        try {
                          const token = localStorage.getItem('authToken');
                          if (!token) {
                            throw new Error('Authentication token not found');
                          }
                          
                          const response = await fetch(`https://ship-orders.vpa.com.au/api/shipments/${newSelectedId}?columns=otherShipments,orderLines,shipmentPackages,shipmentQuotes`, {
                            headers: {
                              'Authorization': `Bearer ${token}`,
                              'Accept': 'application/json'
                            }
                          });
                          
                          if (!response.ok) {
                            throw new Error('Failed to fetch shipment details');
                          }
                          
                          const data = await response.json();
                          setDetailedShipment(data);
                        } catch (error) {
                          console.error('Error fetching shipment details:', error);
                          setDetailedShipment(null);
                        } finally {
                          setIsLoadingDetail(false);
                        }
                      } else {
                        setDetailedShipment(null);
                      }
                  }}
                >
                  {selectedShipmentId === shipment.id ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
                </Button>
              </div>
              </TableCell>
            </TableRow>
            {selectedShipmentId === shipment.id && (
              <TableRow>
                <TableCell colSpan={10}>
                  {isLoadingDetail ? (
                    <div className="flex justify-center items-center p-4">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                    </div>
                  ) : (
                    <ShipmentDetailView shipment={detailedShipment as any} />
                  )}
                </TableCell>
              </TableRow>
            )}
          </React.Fragment>
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

// REMOVE THE FOLLOWING FUNCTION COMPLETELY
/*
function getStatusClass(status: string | null) {
  if (!status) return 'bg-gray-100 text-gray-800';
  switch (status.toLowerCase()) {
    case 'manifested': return 'bg-green-100 text-green-800';
    case 'label_printed': return 'bg-blue-100 text-blue-800';
    case 'on_hold': return 'bg-yellow-100 text-yellow-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}
*/