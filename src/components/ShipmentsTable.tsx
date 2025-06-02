'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Check, ChevronDownIcon, ChevronRightIcon, Clock, DollarSign, GripVertical, FileText, MapPin, QrCode, SearchIcon, Send, Tag, Truck, X, Zap, UserIcon, Lock, Unlock } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox'; 
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'; 
import { ShipmentDetailView } from './ShipmentDetailView'; 
import { useToast } from '@/hooks/use-toast';
import { AiFillFile, AiFillTag, AiFillHdd } from "react-icons/ai";
import { PiCubeFocusBold } from "react-icons/pi";
import { FaCheck, FaLink, FaTimes, FaTruck, FaUser } from "react-icons/fa";
import { FaLocationDot } from "react-icons/fa6";
import { FaCalendarDay } from "react-icons/fa6";
import { Input } from './ui/input';
import { MdRefresh } from "react-icons/md";
import { GrStatusGood } from "react-icons/gr";
import { PdfViewer } from "./ui/pdf-viewer";

interface Shipment {
  id: number;
  shopifyId: number;
  shopifyOrderNumber: string;
  orderName: string;
  email: string;
  address1: string;
  suburb: string;
  region: string;
  postCode: string;
  country: string;
  locked: boolean;
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
  orderDate: number; 
  totalPrice: string;
  lastApiUpdate: number; 
  statusId?: number | null; 
}

interface StatusOption {
  value: string;
  label: string;
  allowShipped: boolean;
  greenTick: boolean;
}

const defaultStatusOptions: StatusOption[] = [];

type ShipmentsTableProps = {
  setAction: React.Dispatch<React.SetStateAction<number>>; // ADDED ACTION TRACKER FOR ACTIONS ON SHIPMENTS DAT
  shipments: Shipment[];
  warehouseCode?: string;
  currentPage: number;
  itemsPerPage: number;
  totalItems: number;
  lastPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  setItemsPerPage: React.Dispatch<React.SetStateAction<number>>;
  selectedWarehouse: string | null;
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

interface DraggableToolbarProps {
  onIncrement?: () => void
  onDecrement?: () => void
  onReset?: () => void
  className?: string
}

type EdgePosition = "top" | "bottom" | "left" | "right"

export function ShipmentsTable({ 
  setAction,
  shipments, 
  currentPage,
  itemsPerPage,
  setCurrentPage,
  setItemsPerPage,
  lastPage,
  selectedWarehouse
}: ShipmentsTableProps) {
  const [selectedShipmentId, setSelectedShipmentId] = useState<number | null>(null); 
  const [selectedRows, setSelectedRows] = useState<Record<string, boolean>>({});
  const [pdfUrl, setPdfUrl] = useState<string>("");
  const [isPdfOpen, setIsPdfOpen] = useState(false);
  const [pdfTitle, setPdfTitle] = useState<string>("");
  const [detailedShipment, setDetailedShipment] = useState<Shipment | null>(null); 
  const [isLoadingDetail, setIsLoadingDetail] = useState(false); 
  const [statusOptions, setStatusOptions] = useState<StatusOption[]>(defaultStatusOptions);
  const [isLoadingStatuses, setIsLoadingStatuses] = useState(true);
  const [loadingSearchParams, setLoadingSearchParams] = useState(false);
  const [searchParams, setSearchParams] = useState<Record<string, string>>({});

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
        setStatusOptions([]);
      } finally {
        setIsLoadingStatuses(false);
      }
    };

    fetchStatusOptions();
  }, []);

  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [edge, setEdge] = useState<EdgePosition>("bottom")
  const toolbarRef = useRef<HTMLDivElement>(null)

  // Calculate which edge is closest and snap to it
  const snapToEdge = (x: number, y: number) => {
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    if (!toolbarRef.current) return

    const toolbarWidth = toolbarRef.current.offsetWidth
    const toolbarHeight = toolbarRef.current.offsetHeight

    // Calculate distances to each edge
    const distanceToLeft = x
    const distanceToRight = viewportWidth - (x + toolbarWidth)
    const distanceToTop = y
    const distanceToBottom = viewportHeight - (y + toolbarHeight)

    // Find the closest edge
    const minDistance = Math.min(distanceToLeft, distanceToRight, distanceToTop, distanceToBottom)

    let newEdge: EdgePosition
    let newX: number
    let newY: number

    if (minDistance === distanceToLeft) {
      newEdge = "left"
      newX = 20
      newY = Math.max(20, Math.min(y, viewportHeight - toolbarHeight - 20))
    } else if (minDistance === distanceToRight) {
      newEdge = "right"
      newX = viewportWidth - toolbarWidth - 20
      newY = Math.max(20, Math.min(y, viewportHeight - toolbarHeight - 20))
    } else if (minDistance === distanceToTop) {
      newEdge = "top"
      newX = Math.max(20, Math.min(x, viewportWidth - toolbarWidth - 20))
      newY = 20
    } else {
      newEdge = "bottom"
      newX = Math.max(20, Math.min(x, viewportWidth - toolbarWidth - 20))
      newY = viewportHeight - toolbarHeight - 20
    }

    setEdge(newEdge)
    setPosition({ x: newX, y: newY })
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (toolbarRef.current) {
      const rect = toolbarRef.current.getBoundingClientRect()
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      })
      setIsDragging(true)
    }
  }

  // Handle mouse move when dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && toolbarRef.current) {
        const newX = e.clientX - dragOffset.x
        const newY = e.clientY - dragOffset.y

        // Update position while dragging (free movement)
        setPosition({ x: newX, y: newY })
      }
    }

    const handleMouseUp = () => {
      if (isDragging) {
        // Snap to nearest edge when drag ends
        snapToEdge(position.x, position.y)
        setIsDragging(false)
      }
    }

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isDragging, dragOffset, position])

  // Initialize position on mount
  useEffect(() => {
    if (toolbarRef.current) {
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      const toolbarWidth = toolbarRef.current.offsetWidth
      const toolbarHeight = toolbarRef.current.offsetHeight

      setPosition({
        x: Math.max(20, (viewportWidth - toolbarWidth) / 2),
        y: viewportHeight - toolbarHeight - 20,
      })
    }
  }, [])

  const isVertical = edge === "left" || edge === "right"

  // Determine tooltip side based on toolbar position
  const getTooltipSide = (): "top" | "right" | "bottom" | "left" => {
    switch (edge) {
      case "left":
        return "right"
      case "right":
        return "left"
      case "top":
        return "bottom"
      case "bottom":
        return "top"
      default:
        return "right"
    }
  }

  const isAllSelected = shipments?.length > 0 && shipments.every((shipment) => selectedRows[shipment.id]);

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

  const { toast } = useToast();

  const handleStatusChange = async (shipmentId: number | number[], newStatusId: string) => {
    console.log(`Shipment(s) ${Array.isArray(shipmentId) ? shipmentId.join(', ') : shipmentId} status changed to ${newStatusId}`);

    const token = localStorage.getItem('authToken');
    if (!token) {
      toast({
        variant: "destructive",
        title: "Authentication Error",
        description: "Please log in to continue."
      });
      return;
    }

    const shipmentIdsString = Array.isArray(shipmentId) ? shipmentId.join(',') : String(shipmentId);
    const apiUrl = `https://ship-orders.vpa.com.au/api/shipments/status/${newStatusId}?shipment_ids=${shipmentIdsString}`;

    try {
      const response = await fetch(apiUrl, {
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
        description: 'Shipment status has been updated successfully.',
      });

      setAction(prev => prev + 1);

    } catch (error: any) {
      //
      console.error('Error updating shipment status:', error);
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: error.message || "Failed to update shipment status."
      });
    }
  };

  const handleBulkStatusChange = async (newStatusId: string) => {
    const selectedIds = Object.entries(selectedRows)
      .filter(([_, isChecked]) => isChecked)
      .map(([id]) => parseInt(id, 10));

    if (selectedIds.length === 0) {
      toast({
        variant: "destructive",
        title: "No Shipments Selected",
        description: "Please select at least one shipment to update status."
      });
      return;
    }
    await handleStatusChange(selectedIds, newStatusId);
    setAction(prev => prev + 1);

  };

  const handleRefreshShipment = async (shipmentId: number) => {
    console.log(`Refreshing shipment ${shipmentId}`);

    const token = localStorage.getItem('authToken');
    if (!token) {
      toast({
        variant: "destructive",
        title: "Authentication Error",
        description: "Please log in to continue."
      });
      return;
    }

    const apiUrl = `https://ship-orders.vpa.com.au/api/shipments/refresh/${shipmentId}`;

    try {
      const response = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to refresh shipment: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Shipment refreshed successfully:', result);

      toast({
        variant: 'success',
        title: 'Shipment Refreshed',
        description: 'Shipment data has been refreshed successfully.',
      });

      setAction(prev => prev + 1);

    } catch (error: any) {
      console.error('Error refreshing shipment:', error);
      toast({
        variant: "destructive",
        title: "Refresh Failed",
        description: error.message || "Failed to refresh shipment."
      });
    }
  };

  const handleMarkShipmentsAsShipped = async () => {
    const checkedIds = Object.entries(selectedRows)
      .filter(([_, isChecked]) => isChecked)
      .map(([id]) => id.toString());

    if (checkedIds.length === 0) {
      toast({
        variant: "destructive",
        title: "No Shipments Selected",
        description: "Please select at least one shipment to mark as shipped."
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

      toast({
        variant: "success",
        title: "Success",
        description: "Selected shipments have been marked as shipped."
      });
      setAction(prev => prev + 1);

      // Clear selected rows after successful update
      setSelectedRows({});

      // Trigger refresh if callback is provided
      // if (onStatusUpdateSuccess) {
      //   onStatusUpdateSuccess();
      // }

    } catch (error: any) {
      console.error('Error marking shipments as shipped:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to mark shipments as shipped."
      });
    }
  };

  const handleMarkShipmentsAsNotShipped = async () => {
    const checkedIds = Object.entries(selectedRows)
      .filter(([_, isChecked]) => isChecked)
      .map(([id]) => id.toString());
  
    if (checkedIds.length === 0) {
      toast({
        variant: "destructive",
        title: "No Shipments Selected",
        description: "Please select at least one shipment to mark as not shipped."
      });
      return;
    }
  
    const token = localStorage.getItem('authToken');
    if (!token) {
      toast({
        variant: "destructive",
        title: "Authentication Error",
        description: "Please log in to mark shipments as not shipped."
      });
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
        throw new Error(errorData.message || `Failed to mark shipments as not shipped: ${response.statusText}`);
      }
  
      const result = await response.json();
      toast({
        title: "Success",
        description: "Selected shipments have been marked as not shipped."
      });

      setAction(prev => prev + 1);
      
      // Clear selected rows
      setSelectedRows({});
  
    } catch (error: any) {
      console.error('Error marking shipments as not shipped:', error);
      toast({
        variant: "destructive",
        title: "Operation Failed",
        description: error.message || "Failed to mark shipments as not shipped."
      });
    }
  };

  const handleShipmentDetailClick = async (e: React.MouseEvent, shipmentId: number) => {
    e.stopPropagation();
    const newSelectedId = selectedShipmentId === shipmentId ? null : shipmentId;
    setSelectedShipmentId(newSelectedId);

    if (newSelectedId) {
      setIsLoadingDetail(true);
      try {
        const token = localStorage.getItem('authToken');
        if (!token) {
          toast({
            variant: "destructive",
            title: "Authentication Error",
            description: "Please log in to continue."
          });
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
      } catch (error: any) {
        console.error('Error fetching shipment details:', error);
        setDetailedShipment(null);
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message || "Failed to fetch shipment details."
        });
      } finally {
        setIsLoadingDetail(false);
      }
    } else {
      setDetailedShipment(null);
    }
  };

  const handleUnlStatusUpdate = async (shipment: Shipment) => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Authentication token not found. Please log in again.'
        });
        return;
      }

      const response = await fetch(`https://ship-orders.vpa.com.au/api/shipments/unlDone/${shipment.unlDone ? 0 : 1}?shipment_ids=${shipment.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to update UNL status');
      }

      const result = await response.json();
      if (result.success) {
        toast({
          variant: 'success',
          title: 'Success',
          description: `UNL status ${!shipment.unlDone ? 'completed' : 'pending'}`
        });
        setAction(prev => prev + 1);

      }
    } catch (error) {
      console.error('Error updating UNL status:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update UNL status'
      });
    }
  };

  const handleDeleteShipment = async (shipmentId: number) => {
    console.log(`Deleting shipment ${shipmentId}`);

    const token = localStorage.getItem('authToken');
    if (!token) {
      toast({
        variant: "destructive",
        title: "Authentication Error",
        description: "Please log in to continue."
      });
      return;
    }

    const apiUrl = `https://ship-orders.vpa.com.au/api/shipments/${shipmentId}`;

    try {
      const response = await fetch(apiUrl, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        },
      });

      if (!response.ok) {
        // Attempt to parse error message from response if available
        let errorMessage = `Failed to delete shipment: ${response.statusText}`;
        try {
            const errorData = await response.json();
            errorMessage = errorData.message || errorMessage;
        } catch (e) {
            // Ignore if response is not JSON or empty
        }
        throw new Error(errorMessage);
      }

      // Assuming a successful DELETE request returns a 204 No Content or a success message
      // If it returns data, you can parse it: const result = await response.json();
      console.log('Shipment deleted successfully');

      toast({
        variant: 'success',
        title: 'Shipment Deleted',
        description: 'Shipment has been deleted successfully.',
      });
      setAction(prev => prev + 1);


      // Trigger a refresh of the shipments list
      // if (onStatusUpdateSuccess) {
      //   onStatusUpdateSuccess();
      // }

    } catch (error: any) {
      console.error('Error deleting shipment:', error);
      toast({
        variant: "destructive",
        title: "Delete Failed",
        description: error.message || "Failed to delete shipment."
      });
    }
  };

  
  const handleGenerateLabels = async () => {
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
          'Accept': 'application/pdf',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to generate labels: ${response.statusText}`);
      }

      toast({
        variant: "success",
        title: "Labels Generated",
        description: "Labels have been generated successfully."
      });
      setAction(prev => prev + 1);

    } catch (error: any) {
      console.error('Error generating labels:', error);
      toast({
        variant: "destructive",
        title: "Generation Failed",
        description: error.message || "Failed to generate labels."
      });
    }
  };

  const handleQuickPrint = async () => {
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
          'Accept': 'application/pdf',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to quick print: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      setPdfUrl(url);
      setIsPdfOpen(true);
      setPdfTitle('Quick Print Labels Preview');
  
      toast({
        variant: "success",
        title: "Quick Print Ready",
        description: "Labels are ready for printing."
      });
      setAction(prev => prev + 1);

    } catch (error: any) {
      console.error('Error during quick print:', error);
      toast({
        variant: "destructive",
        title: "Quick Print Failed",
        description: error.message || "Failed to quick print labels."
      });
    }
  };

  const handleInvoicePrint = async () => {
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
      const response = await fetch(`https://ship-orders.vpa.com.au/api/pdf/invoices?shipment_ids=${selectedIds.join(',')}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/pdf',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to print Invoices: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      setPdfUrl(url);
      setIsPdfOpen(true);
      setPdfTitle('Invoice Preview');
      
      toast({
        variant: "success",
        title: "Invoice Generated",
        description: "The invoice PDF has been generated successfully."
      });
      setAction(prev => prev + 1);

    } catch (error: any) {
      console.error('Error during Invoices print:', error);
      toast({
        variant: "destructive",
        title: "Invoice Generation Failed",
        description: error.message || "Failed to generate invoice PDF."
      });
    }
  };

  const handlePdfClose = () => {
    setIsPdfOpen(false);
    if (pdfUrl) {
      window.URL.revokeObjectURL(pdfUrl);
      setPdfUrl("");
    }
  };

  return (
    <>
     <PdfViewer
        isOpen={isPdfOpen}
        onClose={handlePdfClose}
        pdfUrl={pdfUrl}
        title={pdfTitle}
      />
      <TooltipProvider delayDuration={300}>
      <div
        ref={toolbarRef}
        className={cn(
          "fixed bg-background border rounded-lg shadow-lg p-1 select-none",
          isVertical ? "flex flex-col items-center" : "flex items-center",
          isDragging ? "cursor-grabbing transition-none" : "transition-all duration-300 ease-out",
        )}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          zIndex: 50,
        }}
        aria-label="Toolbar"
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className="p-2 cursor-grab hover:bg-muted rounded-md"
              onMouseDown={handleMouseDown}
              aria-label="Drag handle"
            >
              <GripVertical className={cn("h-4 w-4", isVertical && "transform rotate-90")} />
            </div>
          </TooltipTrigger>
          <TooltipContent side={getTooltipSide() as any}>
            <p>Drag to move toolbar</p>
          </TooltipContent>
        </Tooltip>

        <div className={cn(isVertical ? "flex flex-col gap-2" : "flex flex-wrap gap-2")}>
          <div className="flex-grow sm:flex-grow-0">
            <Select disabled={isLoadingStatuses || selectedWarehouse === "All"} onValueChange={handleBulkStatusChange}>
              <SelectTrigger className="w-full sm:w-[60px] text-xs sm:text-sm">
                <GrStatusGood />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="-" disabled>Change Status</SelectItem>
                {statusOptions.map((option) => (
                  <SelectItem className='-p-2' key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button disabled={isLoadingStatuses || selectedWarehouse === "All"} onClick={handleInvoicePrint} variant="outline" size="icon" className="flex-grow-0">
                <FileText className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side={getTooltipSide() as any}>
              <p>Print Invoices</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button disabled={isLoadingStatuses || selectedWarehouse === "All"} variant="outline" size="icon" onClick={handleGenerateLabels}>
                <Tag className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side={getTooltipSide()  as any}>
              <p>Generate Labels</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button disabled={isLoadingStatuses || selectedWarehouse === "All"} variant="outline" size="icon" onClick={handleQuickPrint}>
                <Zap className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side={getTooltipSide()  as any}>
              <p>Quick Print</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button disabled={isLoadingStatuses || selectedWarehouse === "All"} variant="outline" size="icon" onClick={handleMarkShipmentsAsShipped}>
                <Check className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side={getTooltipSide() as any}>
              <p>Mark Shipped</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button disabled={isLoadingStatuses || selectedWarehouse === "All"} variant="outline" size="icon" onClick={handleMarkShipmentsAsNotShipped}>
                <X className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side={getTooltipSide() as any}>
              <p>Mark Not Shipped</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon">
                <Send className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side={getTooltipSide() as any}>
              <p>Manifest</p>
            </TooltipContent>
          </Tooltip>

          {/* <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon">
                <MapPin className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side={getTooltipSide() as any}>
              <p>Change Location</p>
            </TooltipContent>
          </Tooltip> */}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon">
                <QrCode className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side={getTooltipSide() as any}>
              <p>Manifest Codes</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
      </TooltipProvider>

    <Table className=''>
      <TableHeader>
        <TableRow className="">
          <TableHead className="flex justify-between items-center gap-x-5 mb-3">
            <div className='flex gap-x-5 items-center'>
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
            </div>
            <div className="relative w-[300px] mr-2">
              <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input 
                type="search" 
                placeholder="Search orders..." 
                className="pl-10 pr-24 py-2 border rounded-md text-sm" 
                disabled={loadingSearchParams}
              />
              {searchParams?.searchParameters && (
              <select 
                className="absolute right-3 top-1/2 transform -translate-y-1/2 bg-white border-l pl-2 text-sm w-20"
                onChange={(e) => {
                  const [param, value] = e.target.value.split(':');
                  console.log('Search param selected:', param, value);
                }}
              >
                <option value="">Filter</option>
                {Object.entries(searchParams.searchParameters).map(([key, param]: [string, any]) => (
                  <option key={key} value={`${key}:${param.column}`}>
                    {param.name}
                  </option>
                ))}
              </select>
              )}
            </div>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {shipments?.map((shipment) => (
          <React.Fragment key={shipment.id}>
            <TableRow
              key={shipment.id}
              className="py-1" // Add vertical padding reduction
            >
              <TableCell id={`select-row-${shipment.id}`} className={`text-white ${shipment.carrierCode === 'auspost' ? 'bg-[#F46E6B]' : 'bg-[#9370db]'} py-0`}>
              <div className='flex flex-row gap-x-3 items-center'>
                <Checkbox 
                  checked={selectedRows[shipment.id] || false}
                  onCheckedChange={(checked) => handleSelectRow(shipment.id, Boolean(checked))}
                  aria-labelledby={`select-row-${shipment.id}`}
                />
                {shipment.shopifyOrderNumber}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <a target='_blank' href={`https://admin.shopify.com/store/vpa-australia/orders/${shipment.shopifyId}`}>
                      <FaLink className="w-5 h-5" />
                    </a>
                  </TooltipTrigger>
                  <TooltipContent>View in Shopify</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      {shipment.invoicePrinted ? <AiFillFile className="w-5 h-5 text-green-500" /> : <AiFillFile className="w-5 h-5 text-gray-700" />}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Invoice {shipment.invoicePrinted ? 'Printed' : 'Not Printed'}</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      {shipment.labelPrinted ? <AiFillTag className="w-5 h-5 text-green-500" /> : <AiFillTag className="w-5 h-5 text-gray-700" />}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Label {shipment.labelPrinted ? 'Printed' : 'Not Printed'}</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      {shipment.manifested ? <AiFillHdd className="w-5 h-5 text-green-500" /> : <AiFillHdd className="w-5 h-5 text-gray-700" />}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>{shipment.manifested ? 'Manifested' : 'Not Manifested'}</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      {shipment.sent ? <FaTruck className="w-5 h-5 text-green-500" /> : <FaTruck className="w-5 h-5 text-gray-700" />}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>{shipment.sent ? 'Sent' : 'Not Sent'}</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className='cursor-pointer' onClick={() => handleRefreshShipment(shipment.id)}>
                      <MdRefresh className="w-5 h-5 text-white" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Refresh Shipment</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className='cursor-pointer' onClick={() => handleDeleteShipment(shipment.id)}>
                      <FaTimes className="w-5 h-5 text-white" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Delete Shipment</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      {(statusOptions.filter(option => option.value == shipment.status))[0]?.greenTick == true ? 
                        <FaCheck className="w-5 h-5 text-green-500" /> : 
                        <FaCheck className="w-5 h-5 text-gray-700" />}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Status Check</TooltipContent>
                </Tooltip>

                <div className='ml-5 w-52 flex items-center gap-x-1'>
                <FaUser className='w-4 h-4' />
                {shipment.orderName.length > 45 ? `${shipment.orderName.substring(0, 45)}...` : shipment.orderName.substring(0, 45)}
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
                {shipment.carrierCode ? shipment.carrierCode?.charAt(0).toUpperCase() + shipment.carrierCode?.slice(1) : shipment.carrierCodeDesired?.charAt(0).toUpperCase() + shipment.carrierCodeDesired?.slice(1)}
                </div>
                <div className='flex gap-x-1 items-center w-16'>
                  <Clock className='w-4 h-4' />
                  {formatRelativeTime(shipment.lastApiUpdate)}
                </div>
                <div className='w-16 flex gap-x-3 items-center'>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className='cursor-pointer' onClick={() => handleUnlStatusUpdate(shipment)}>
                        {shipment.unlDone ? 
                          <PiCubeFocusBold className="w-6 h-6 text-green-500" /> : 
                          <PiCubeFocusBold size={22} className="text-gray-700" />
                        }
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      {shipment.unlDone ? 'UNL Completed' : 'UNL Pending'}
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className='cursor-pointer' onClick={() => handleUnlStatusUpdate(shipment)}>
                        {shipment.locked ? 
                          <Lock size={17} className="text-red-500" /> : 
                          <Unlock  size={17} className="text-gray-700" />
                        }
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      {shipment.locked ? 'Locked' : 'Un-Locked'}
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Select
                  defaultValue={`${shipment.status ? shipment.status : '-'}`}
                  onValueChange={(value) => handleStatusChange(shipment.id, value)}
                  disabled={isLoadingStatuses}
                >
                  <SelectTrigger size='sm' className="w-[180px]">
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
                  size={"icon"}
                  variant="link" 
                  className="-p-3 ml-10"
                  onClick={(e) => handleShipmentDetailClick(e, shipment.id)}
                >
                  {selectedShipmentId === shipment.id ? <ChevronDownIcon className="h-7 w-7 text-white rounded" /> : <ChevronRightIcon className="h-7 w-7 text-white rounded" />}
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
                    <ShipmentDetailView setAction={setAction} shipment={detailedShipment as any} />
                  )}
                </TableCell>
              </TableRow>
            )}
          </React.Fragment>
        ))}
      </TableBody>
    </Table>
    <div className="flex items-center justify-between p-4 border-t mb-10">
      <div className="text-sm text-gray-600">
        {/* Showing {Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)}-{Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} shipments */}
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
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setCurrentPage(currentPage + 1)}
            disabled={currentPage === lastPage}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
    </>
  );
}
