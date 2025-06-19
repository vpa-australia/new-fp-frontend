'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Check, ChevronDownIcon, ChevronRightIcon, Clock, DollarSign, GripVertical, FileText, QrCode, SearchIcon, Send, Tag, Truck, X, Zap, Lock, Unlock, Loader, Settings } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShipmentDetailView } from './ShipmentDetailView';
import { useToast } from '@/hooks/use-toast';
import { AiFillFile, AiFillTag, AiFillHdd } from "react-icons/ai";
import { PiCubeFocusBold } from "react-icons/pi";
import { FaCheck, FaLink, FaTimes, FaTrashRestore, FaTruck, FaUser, FaCalendarDay } from "react-icons/fa";
import { FaLocationDot } from "react-icons/fa6";
import { Input } from './ui/input';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';  
import { MdRefresh } from "react-icons/md";
import { GrStatusGood } from "react-icons/gr";
import { PdfViewer } from "./ui/pdf-viewer";
import Image from 'next/image';

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
  shipmentsAreLoading: boolean;
};

type EdgePosition = "top" | "bottom" | "left" | "right"

const MemoizedShipmentDetailView = React.memo(ShipmentDetailView);

export function ShipmentsTable({
  setAction,
  shipments,
  currentPage,
  itemsPerPage,
  setCurrentPage,
  setItemsPerPage,
  lastPage,
  selectedWarehouse,
  shipmentsAreLoading
}: ShipmentsTableProps) {
  const [selectedShipmentId, setSelectedShipmentId] = useState<number | null>(null);
  const [selectedRows, setSelectedRows] = useState<Record<string, boolean>>({});
  const [pdfUrl, setPdfUrl] = useState<string>("");
  const { toast } = useToast();

  const handlePdfUpload = async (event: React.ChangeEvent<HTMLInputElement>, shipmentId: number, tracking_code: string, carrier_code: string, name: string, title: string): Promise<void> => {
    return new Promise(async (resolve, reject) => {
      const file = event.target.files?.[0];
      if (!file) {
        reject(new Error('No file selected'));
        return;
      }

      const token = localStorage.getItem('authToken');
      if (!token) {
        toast({
          title: "Authentication Error",
          description: "Authentication token not found. Please log in again.",
          variant: 'destructive'
        });
        reject(new Error('Authentication token not found'));
        return;
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', name || file.name);
      formData.append('title', title || 'Uploaded PDF');
      formData.append('tracking_code', tracking_code || '');
      formData.append('manual_carrier_code', carrier_code || '');

      try {
        const response = await fetch(`https://ship-orders.vpa.com.au/api/shipments/pdf/${shipmentId}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData
        });

        if (!response.ok) {
          throw new Error('Failed to upload PDF');
        }

        toast({
          title: "Upload Successful",
          description: "PDF has been uploaded successfully.",
          variant: 'success'
        });
        resolve();
      } catch (error: any) {
        toast({
          title: "Upload Failed",
          description: error.message || 'Failed to upload PDF.',
          variant: 'destructive'
        });
        reject(error);
      }
    });
  };
  const [isPdfOpen, setIsPdfOpen] = useState(false);
  const [pdfTitle, setPdfTitle] = useState<string>("");
  const [detailedShipment, setDetailedShipment] = useState<Shipment | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [statusOptions, setStatusOptions] = useState<StatusOption[]>(defaultStatusOptions);
  const [isLoadingStatuses, setIsLoadingStatuses] = useState(true);
  const [loadingSearchParams, setLoadingSearchParams] = useState(false);
  const [searchParams, setSearchParams] = useState<Record<string, string>>({});
  const [searchFields, setSearchFields] = useState<Record<string, { name: string, column: string, type: string, weight: number }>>({});
  const [searchValues, setSearchValues] = useState<Record<string, string>>({});
  const [visibleFields, setVisibleFields] = useState<Record<string, boolean>>({});
  const [detailAction, setDetailAction] = useState(0);
  const [stillInProgress, setStillInProgress] = useState(false);
  const [dialogOpen, setDialogOpen] = useState<Record<string, boolean>>({});

  const formatRelativeTime = useCallback((timestamp: number) => {
    const seconds = Math.floor(Date.now() / 1000 - timestamp);

    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d`;
    if (seconds < 31536000) return `${Math.floor(seconds / 2592000)}mo`;
    return `${Math.floor(seconds / 31536000)}y`;
  }, []);

  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [edge, setEdge] = useState<EdgePosition>("bottom")
  const toolbarRef = useRef<HTMLDivElement>(null)

  // Function to fetch shipments with search parameters
  const fetchShipments = useCallback(async () => {
    try {
      // Notify parent component that an action is being performed
      setAction(prev => prev + 1);
    } catch (error) {
      console.error('Error in fetchShipments:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch shipments."
      });
    }
  }, [setAction, toast]);

  useEffect(() => {
    const fetchSearchParameters = async () => {
      setLoadingSearchParams(true);
      try {
        const token = localStorage.getItem('authToken');
        if (!token) {
          toast({
            variant: "destructive",
            title: "Authentication Error",
            description: "Please log in to continue."
          });
          return;
        }

        const response = await fetch('https://ship-orders.vpa.com.au/api/shipments/search/parameters', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch search parameters');
        }

        const data = await response.json();
        if (data && data.success && data.searchParameters) {
          setSearchFields(data.searchParameters);
          
          // Initialize visible fields and search values
          let initialVisibleFields: Record<string, boolean> = {};
          const initialSearchValues: Record<string, string> = {};
          
          // Try to load saved visible fields from localStorage
          const savedVisibleFields = localStorage.getItem('searchVisibleFields');
          
          if (savedVisibleFields) {
            try {
              // Parse saved fields and validate they still exist in the API response
              const parsedFields = JSON.parse(savedVisibleFields);
              // Filter out any fields that no longer exist in the API response
              initialVisibleFields = Object.keys(data.searchParameters).reduce((acc, key) => {
                acc[key] = parsedFields[key] === true;
                return acc;
              }, {} as Record<string, boolean>);
              
              // If no fields are visible (all false), show default top fields
              if (!Object.values(initialVisibleFields).some(value => value === true)) {
                // Fall back to default top fields
                const topFields = Object.entries(data.searchParameters)
                  .sort((a : any, b : any) => b[1].weight - a[1].weight)
                  .slice(0, 5)
                  .map(([key]) => key);
                
                Object.keys(data.searchParameters).forEach(key => {
                  initialVisibleFields[key] = topFields.includes(key);
                });
              }
            } catch (e) {
              console.error('Error parsing saved search fields:', e);
              // Fall back to default top fields
              const topFields = Object.entries(data.searchParameters)
                .sort((a : any, b : any) => b[1].weight - a[1].weight)
                .slice(0, 5)
                .map(([key]) => key);
              
              Object.keys(data.searchParameters).forEach(key => {
                initialVisibleFields[key] = topFields.includes(key); // Only top fields visible by default
              });
            }
          } else {
            // No saved fields, use default top fields
            const topFields = Object.entries(data.searchParameters)
              .sort((a : any, b : any) => b[1].weight - a[1].weight)
              .slice(0, 5)
              .map(([key]) => key);
            
            Object.keys(data.searchParameters).forEach(key => {
              initialVisibleFields[key] = topFields.includes(key); // Only top fields visible by default
            });
          }
          
          // Initialize all search values as empty
          Object.keys(data.searchParameters).forEach(key => {
            initialSearchValues[key] = ''; // Empty values by default
          });
          
          setVisibleFields(initialVisibleFields);
          setSearchValues(initialSearchValues);
        }
      } catch (error) {
        console.error('Error fetching search parameters:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to fetch search parameters."
        });
      } finally {
        setLoadingSearchParams(false);
      }
    };

    fetchSearchParameters();

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

  // Calculate which edge is closest and snap to it
  const snapToEdge = useCallback((x: number, y: number) => {
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
  }, [setEdge, setPosition, toolbarRef]) // toolbarRef is stable, setEdge and setPosition are stable


  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (toolbarRef.current) {
      const rect = toolbarRef.current.getBoundingClientRect()
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      })
      setIsDragging(true)
    }
  }, [toolbarRef, setDragOffset, setIsDragging])

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
  const getTooltipSide = useCallback((): "top" | "right" | "bottom" | "left" => {
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
  }, [edge])

  const isAllSelected = shipments?.length > 0 && shipments.every((shipment) => selectedRows[shipment.id]);

  const handleSelectRow = useCallback((id: number, checked: boolean) => {
    setSelectedRows((prev) => ({ ...prev, [id]: checked }));
  }, [setSelectedRows]);

  const handleSelectAll = useCallback((checked: boolean) => {
    const newSelectedRows: Record<number, boolean> = {};
    if (checked) {
      shipments?.forEach((shipment) => {
        newSelectedRows[shipment.id] = true;
      });
    }
    setSelectedRows(newSelectedRows);
  }, [shipments, setSelectedRows]);

  const handleStatusChange = useCallback(async (shipmentId: number | number[], newStatusId: string) => {
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
  }, [toast, setAction, selectedRows]);

  const handleBulkStatusChange = useCallback(async (newStatusId: string) => {
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

  }, [selectedRows, toast, handleStatusChange, setAction]);

  const handleRefreshShipment = useCallback(async (shipmentId: number) => {
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
  }, [toast, setAction]);

  const handleMarkShipmentsAsShipped = useCallback(async () => {
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
  }, [selectedRows, toast, setAction, setSelectedRows]);

  const handleMarkShipmentsAsNotShipped = useCallback(async () => {
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
  }, [selectedRows, toast, setAction, setSelectedRows]);

  useEffect(() => {
    (async () => {
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

        const response = await fetch(`https://ship-orders.vpa.com.au/api/shipments/${selectedShipmentId}?columns=otherShipments,orderLines,shipmentPackages,shipmentQuotes`, {
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
    })();
  }, [detailAction]);
  
  const handleShipmentDetailClick = useCallback(async (e: React.MouseEvent, shipmentId: number) => {
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
  }, [selectedShipmentId, setSelectedShipmentId, setIsLoadingDetail, toast, setDetailedShipment]);

  const handleUnlStatusUpdate = useCallback(async (shipment: Shipment) => {
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

      if (result.shipments && result.shipments.length > 0) {
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
  }, [toast, setAction, selectedRows]);

  const handleLockUnlockShipment = useCallback(async (shipment: Shipment) => {
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

      const endpoint = shipment.locked ? 'unlock' : 'lock';
      const response = await fetch(`https://ship-orders.vpa.com.au/api/shipments/${endpoint}/${shipment.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to ${endpoint} shipment`);
      }

      const result = await response.json();
      if (result.success) {
        toast({
          variant: 'success',
          title: 'Success',
          description: `Shipment ${shipment.locked ? 'unlocked' : 'locked'} successfully`
        });
        setAction(prev => prev + 1);
      }
    } catch (error) {
      console.error(`Error ${shipment.locked ? 'unlocking' : 'locking'} shipment:`, error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: `Failed to ${shipment.locked ? 'unlock' : 'lock'} shipment`
      });
    }
  }, [toast, setAction, selectedRows]);

  const handleDeleteShipment = useCallback(async (shipmentId: number) => {
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

    const apiUrl = `https://ship-orders.vpa.com.au/api/shipments/archive/${shipmentId}`;

    try {
      const response = await fetch(apiUrl, {
        method: 'PATCH',
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
  }, [toast, setAction, selectedRows]);

  const handleGenerateLabels = useCallback(async () => {

    console.log("Selected Rows: ", selectedRows);

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
      setStillInProgress(true);
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
      setStillInProgress(false);
      setSelectedRows({});

    } catch (error: any) {
      console.error('Error generating labels:', error);
      toast({
        variant: "destructive",
        title: "Generation Failed",
        description: error.message || "Failed to generate labels."
      });
    }
  }, [selectedRows, toast, setPdfUrl, setIsPdfOpen, setPdfTitle, setAction]);

  const handleQuickPrint = useCallback(async () => {
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
  }, [selectedRows, toast, setPdfUrl, setIsPdfOpen, setPdfTitle, setAction]);

  const handleInvoicePrint = useCallback(async () => {
    console.log("Selected Rows: ", selectedRows)
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
  }, [toast, setAction, selectedRows]);

  const handlePdfClose = useCallback(() => {
    setIsPdfOpen(false);
    if (pdfUrl) {
      window.URL.revokeObjectURL(pdfUrl);
      setPdfUrl("");
    }
  }, [toast, setAction]);

  const handleRestoreShipment = useCallback(async (shipmentId: number) => {
    try {

      const token = localStorage.getItem('authToken');
      if (!token) {
        toast({
          variant: "destructive",
          title: "Authentication Error",
          description: "Please log in to continue."
        });
        return;
      }

      const response = await fetch(`https://ship-orders.vpa.com.au/api/shipments/unarchive/${shipmentId}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to restore shipment: ${response.statusText}`);
      }

      toast({
        variant: "success",
        title: "Shipment Restored",
        description: `Shipment ${shipmentId} has been restored successfully.`
      });
      setAction(prev => prev + 1); // Refresh data

    } catch (error: any) {
      console.error('Error restoring shipment:', error);
      toast({
        variant: "destructive",
        title: "Restore Failed",
        description: error.message || "Failed to restore shipment."
      });
    }
  }, [toast, setAction]);

  const handleDeleteLabel = useCallback(async (shipmentId: number) => {
    try {
      const token = localStorage.getItem('authToken');

      const response = await fetch(`https://ship-orders.vpa.com.au/api/pdf/labels?shipment_ids=${shipmentId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `$Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to delete label: ${response.statusText}`);
      }

      toast({
        variant: "success",
        title: "Label Deleted",
        description: `Label for shipment ${shipmentId} has been deleted successfully.`
      });
      setAction(prev => prev + 1); // Refresh data

    } catch (error: any) {
      console.error('Error deleting label:', error);
      toast({
        variant: "destructive",
        title: "Delete Failed",
        description: error.message || "Failed to delete label."
      });
    }
  }, [toast, setAction]);

  const handlePrintLabel = useCallback(async (shipmentId: number) => {

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
      const response = await fetch(`https://ship-orders.vpa.com.au/api/pdf/labels/generateLabels?shipment_ids=${shipmentId}`, {
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
  }, [toast, setAction]);

  const handleUploadPDFShipment = useCallback(async (shipmentId: number) => {

  }, [toast, setAction]);

  if (shipmentsAreLoading) {
    return <div className='flex flex-1 justify-center items-center h-[90vh] w-full'>
      <Loader className='animate-spin' />
    </div>
  }

  if (stillInProgress) {
    return <div className='flex flex-1 justify-center items-center h-[90vh] w-full'>
      <p><Loader className='animate-spin' /></p>
      <p>Still in progress...</p>
    </div>
  }

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
              <TooltipContent side={getTooltipSide() as any}>
                <p>Generate Labels</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button disabled={isLoadingStatuses || selectedWarehouse === "All"} variant="outline" size="icon" onClick={handleQuickPrint}>
                  <Zap className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side={getTooltipSide() as any}>
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
            <TableHead className="mb-3">
              <div className='flex items-center space-x-10 pb-3 px-3'>
                <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={(checked) => handleSelectAll(Boolean(checked))}
                  aria-label="Select all rows"
                  className="h-8 w-8 rounded-full data-[state=checked]:bg-[#3D753A] data-[state=checked]:text-primary-foreground border-gray-300 focus-visible:ring-sky-500"
                />
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="icon" className="rounded-full h-10 w-10 bg-[#3D753A] text-white hover:text-white hover:bg-black">
                      <SearchIcon className="h-5 w-5 hover:text-white" />
                      <span className="sr-only">Search Shipments</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>Search Shipments</DialogTitle>
                      {/* <DialogDescription>
                        Enter your search criteria below.
                      </DialogDescription> */}
                    </DialogHeader>
                    <div className="mt-2">
                      <Button variant="outline">CLEAR</Button>
                    </div>
                    <div className="grid gap-4 py-4 pt-0">
                      {loadingSearchParams ? (
                        <div className="flex justify-center items-center py-4">
                          <Loader className="h-6 w-6 animate-spin mr-2" />
                          <span>Loading search fields...</span>
                        </div>
                      ) : (
                        Object.entries(searchFields)
                          .sort((a, b) => b[1].weight - a[1].weight) // Sort by weight (highest first)
                          .filter(([key]) => visibleFields[key])
                          .map(([key, field]) => (
                            <div key={key} className="grid grid-cols-1 items-center gap-2">
                              <div className="flex justify-between items-center">
                                <Label htmlFor={key}>{field.name}</Label>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => {
                                    const updatedFields = {
                                      ...visibleFields,
                                      [key]: false
                                    };
                                    setVisibleFields(updatedFields);
                                    // Save to localStorage
                                    localStorage.setItem('searchVisibleFields', JSON.stringify(updatedFields));
                                  }}
                                  className="h-6 w-6 p-0"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                              {field.type === 'date' ? (
                                <Input 
                                  id={key} 
                                  type="date" 
                                  value={searchValues[key] || ''}
                                  onChange={(e) => {
                                    setSearchValues(prev => ({
                                      ...prev,
                                      [key]: e.target.value
                                    }));
                                  }}
                                />
                              ) : (
                                <Input 
                                  id={key} 
                                  placeholder="" 
                                  value={searchValues[key] || ''}
                                  onChange={(e) => {
                                    setSearchValues(prev => ({
                                      ...prev,
                                      [key]: e.target.value
                                    }));
                                  }}
                                />
                              )}
                            </div>
                          ))
                      )}
                      
                      {/* Field selector dropdown */}
                      {!loadingSearchParams && Object.keys(searchFields).some(key => !visibleFields[key]) && (
                        <div className="mt-2">
                          <Select 
                            onValueChange={(value) => {
                              const updatedFields = {
                                ...visibleFields,
                                [value]: true
                              };
                              setVisibleFields(updatedFields);
                              // Save to localStorage
                              localStorage.setItem('searchVisibleFields', JSON.stringify(updatedFields));
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Add search field" />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(searchFields)
                                .filter(([key]) => !visibleFields[key])
                                .map(([key, field]) => (
                                  <SelectItem key={key} value={key}>
                                    {field.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                    <DialogFooter className="justify-end space-x-2">
                      <DialogClose asChild>
                        <Button variant="outline">CLOSE</Button>
                      </DialogClose>
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          setSearchValues({});
                          // Reset all fields to their initial visibility state
                          if (searchFields) {
                            const initialVisibility = Object.keys(searchFields).reduce((acc, key) => {
                              // Show top 5 fields by weight by default
                              const topFields = Object.entries(searchFields)
                                .sort((a, b) => b[1].weight - a[1].weight)
                                .slice(0, 5)
                                .map(([k]) => k);
                              acc[key] = topFields.includes(key);
                              return acc;
                            }, {} as Record<string, boolean>);
                            setVisibleFields(initialVisibility);
                            // Save reset fields to localStorage
                            localStorage.setItem('searchVisibleFields', JSON.stringify(initialVisibility));
                          }
                        }}
                      >
                        CLEAR
                      </Button>
                      <Button 
                        type="submit" 
                        className="bg-[#3D753A] hover:bg-black text-white"
                        onClick={() => {
                          // Filter out empty values
                          const filters = Object.entries(searchValues)
                            .filter(([_, value]) => value && value.trim() !== '')
                            .reduce((acc, [key, value]) => {
                              // Use the column name from searchFields for the API
                              if (searchFields[key]) {
                                acc[searchFields[key].column] = value;
                              }
                              return acc;
                            }, {} as Record<string, string>);
                          
                          // Update searchParams with the new filters
                          setSearchParams(prev => ({
                            ...prev,
                            ...filters
                          }));
                          
                          // Close the dialog and trigger search
                          setDialogOpen(false as any);
                          fetchShipments();
                        }}
                      >
                        SEARCH
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <Select value={String(itemsPerPage)} onValueChange={(value) => setItemsPerPage(Number(value))}>
                  <SelectTrigger className="h-10 rounded-full bg-[#3D753A] text-white hover:bg-black px-4 text-sm w-auto">
                    <SelectValue className='text-white' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
                <Select>
                  <SelectTrigger className="h-10 rounded-full bg-[#3D753A] text-white hover:bg-black px-4 text-sm w-auto">
                    <div className='text-white flex items-center'>
                    <FaCalendarDay className="h-5 w-5 mr-2 text-white" /> Order Date
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {/* Add SelectItem options for Order Date here */}
                  </SelectContent>
                </Select>
                <Select>
                  <SelectTrigger className="h-10 rounded-full bg-[#3D753A] text-white hover:bg-black px-4 text-sm w-auto">
                  <div className='text-white flex items-center'>
                    <GrStatusGood className="h-5 w-5 mr-2 text-white" /> All Status
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {/* Add SelectItem options for Status here */}                   
                  </SelectContent>
                </Select>
                <Select>
                  <SelectTrigger className="h-10 rounded-full bg-[#3D753A] text-white hover:bg-black px-4 text-sm w-auto">
                    <div className='text-white flex items-center'>
                      <Truck className="h-5 w-5 mr-2 text-white" /> All Shipping
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {/* Add SelectItem options for Shipping here */}
                  </SelectContent>
                </Select>
                <Select>
                  <SelectTrigger className="h-10 rounded-full bg-[#3D753A] text-white hover:bg-black px-4 text-sm w-auto">
                    <div className='text-white flex items-center'>
                      <AiFillHdd className="h-5 w-5 mr-2 text-white" /> All Manifest
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {/* Add SelectItem options for Manifest here */}
                  </SelectContent>
                </Select>
                <Select>
                  <SelectTrigger className="h-10 rounded-full bg-[#3D753A] text-white hover:bg-black px-4 text-sm w-auto">
                    <div className='text-white flex items-center'>
                      <Settings className='text-white' />
                      All States
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {/* Add SelectItem options for States here */}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" className="rounded-full h-10 w-10 bg-white text-gray-700 hover:bg-gray-50">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
                  </svg>
                  <span className="sr-only">Help</span>
                </Button>
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
                    <p className='w-16'>{shipment.shopifyOrderNumber}</p>
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
                          {shipment.invoicePrinted ? 
                          <Image alt='invoice print' width={21} height={21} src={"/invoice-green.avif"} />
                          : <Image alt='invoice print' width={21} height={21} src={"/invoice.avif"} />}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>Invoice {shipment.invoicePrinted ? 'Printed' : 'Not Printed'}</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className='cursor-pointer' onClick={() => shipment.labelPrinted ? handleDeleteLabel(shipment.id) : handlePrintLabel(shipment.id)}>
                          {shipment.labelPrinted ? 
                          <Image alt='label print' width={20} height={20} src={"/label-green.avif"} />
                          : <Image alt='label' width={20} height={20} src={"/label.avif"} />}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>Label {shipment.labelPrinted ? 'Printed' : 'Not Printed'}</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>
                          {shipment.manifested ? 
                          <Image alt='manifest icon' width={21} height={21} src={"/manifest-green.avif"} />
                          : <Image alt='maniffest icon' width={21} height={21} src={"/manifest.avif"} />}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>{shipment.manifested ? 'Manifested' : 'Not Manifested'}</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>
                          {shipment.sent ? 
                          // <FaTruck className="w-5 h-5 text-green-500" /> 
                          <Image alt='truck' width={21} height={21} src={"/truck-green.avif"} />
                          : <Image alt='truck' width={21} height={21} src={"/truck.avif"} />} 
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>{shipment.sent ? 'Sent' : 'Not Sent'}</TooltipContent>
                    </Tooltip>

                    {
                      selectedWarehouse !== 'Archived' ?
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className='cursor-pointer' onClick={() => handleRefreshShipment(shipment.id)}>
                              <MdRefresh className="w-5 h-5 text-white" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>Refresh Shipment</TooltipContent>
                        </Tooltip> : null
                    }


                    {
                      selectedWarehouse !== 'Archived' ?
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className='cursor-pointer' onClick={() => handleDeleteShipment(shipment.id)}>
                              <FaTimes className="w-5 h-5 text-white" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>Delete Shipment</TooltipContent>
                        </Tooltip> : <Tooltip>
                          <TooltipTrigger asChild>
                            <div className='cursor-pointer' onClick={() => handleRestoreShipment(shipment.id)}>
                              <FaTrashRestore className="w-5 h-5 text-white" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>Restore Shipment</TooltipContent>
                        </Tooltip>
                    }

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>
                          {(statusOptions.filter(option => option.value == shipment.status))[0]?.greenTick == true ?
                            <Image alt='sent' width={22} height={22} src={"/sent-green.avif"} /> :
                            <Image alt='sent' width={22} height={22} src={"/sent.avif"} />}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>Status Check</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Dialog open={dialogOpen[`pdf-dialog-${shipment.id}`]} onOpenChange={(open) => setDialogOpen(prev => ({ ...prev, [`pdf-dialog-${shipment.id}`]: open }))}>
                          <DialogTrigger asChild>
                            <div 
                              className='cursor-pointer'
                              onClick={() => setDialogOpen(prev => ({ ...prev, [`pdf-dialog-${shipment.id}`]: true }))}
                            >
                              {(statusOptions.filter(option => option.value == shipment.status))[0]?.greenTick == true ?
                                <Image alt='upload pdf' width={22} height={22} src={"/upload-green.avif"} /> :
                                <Image alt='upload pdf' width={22} height={22} src={"/upload.avif"} />}
                            </div>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Upload PDF for Shipment</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={async (e) => {
                              e.preventDefault();
                              const fileInput = document.getElementById(`pdf-upload-${shipment.id}`) as HTMLInputElement;
                              const nameInput = document.getElementById(`pdf-name-${shipment.id}`) as HTMLInputElement;
                              const titleInput = document.getElementById(`pdf-title-${shipment.id}`) as HTMLInputElement;
                              const trackingInput = document.getElementById(`pdf-tracking-${shipment.id}`) as HTMLInputElement;
                              const carrierInput = document.getElementById(`pdf-carrier-${shipment.id}`) as HTMLInputElement;
                              const submitButton = document.getElementById(`pdf-submit-${shipment.id}`) as HTMLButtonElement;
                              
                              if (!fileInput.files?.length) {
                                toast({
                                  title: "Error",
                                  description: "Please select a PDF file",
                                  variant: 'destructive'
                                });
                                return;
                              }
                              
                              // Show loading state
                              if (submitButton) {
                                submitButton.disabled = true;
                                submitButton.innerHTML = '<span class="spinner"></span> Uploading...';
                              }
                              
                              try {
                                await handlePdfUpload(
                                  { target: { files: fileInput.files } } as React.ChangeEvent<HTMLInputElement>,
                                  shipment.id,
                                  trackingInput?.value || '',
                                  carrierInput?.value || '',
                                  nameInput?.value || '',
                                  titleInput?.value || ''
                                );
                                
                                // Close dialog on success by updating the dialogOpen state
                                setDialogOpen(prev => ({
                                  ...prev,
                                  [`pdf-dialog-${shipment.id}`]: false
                                }));
                                
                                // Reset form fields
                                if (fileInput) fileInput.value = '';
                                if (nameInput) nameInput.value = '';
                                if (titleInput) titleInput.value = '';
                                
                                // Update the file name display
                                const fileNameDisplay = document.getElementById(`pdf-filename-${shipment.id}`);
                                if (fileNameDisplay) {
                                  fileNameDisplay.textContent = "No file selected";
                                  fileNameDisplay.className = "text-sm text-muted-foreground mt-1";
                                }
                                
                                // Reset the choose button text
                                const chooseButton = document.getElementById(`pdf-choose-button-${shipment.id}`);
                                if (chooseButton) {
                                  chooseButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4"><path d="M14 2v4a2 2 0 0 0 2 2h4"></path><path d="M18 18v-7h-7"></path><path d="M18 18H6a2 2 0 0 1-2-2V4"></path></svg> Choose PDF File`;
                                }
                              } catch (error) {
                                // Error is already handled in handlePdfUpload
                              } finally {
                                // Reset button state
                                if (submitButton) {
                                  submitButton.disabled = false;
                                  submitButton.innerHTML = 'Upload PDF';
                                }
                              }
                            }} className="space-y-4">
                              <div className="grid gap-4 py-4">
                                <div className="space-y-4">
                                  <div>
                                    <Label>Document Name</Label>
                                    <Input
                                      placeholder="Enter document name"
                                      className="mt-1"
                                      id={`pdf-name-${shipment.id}`}
                                      required
                                    />
                                  </div>
                                  <div>
                                    <Label>Document Title</Label>
                                    <Input
                                      placeholder="Enter document title"
                                      className="mt-1"
                                      id={`pdf-title-${shipment.id}`}
                                      required
                                    />
                                  </div>
                                  <div>
                                    <Label>Tracking Code</Label>
                                    <Input
                                      placeholder="Enter tracking code"
                                      className="mt-1"
                                      defaultValue={shipment.tracking_code || ''}
                                      id={`pdf-tracking-${shipment.id}`}
                                      required
                                    />
                                  </div>
                                  <div>
                                    <Label>Carrier Code</Label>
                                    <Input
                                      placeholder="Enter carrier code"
                                      className="mt-1"
                                      defaultValue={shipment.carrierCode || ''}
                                      id={`pdf-carrier-${shipment.id}`}
                                      required
                                    />
                                  </div>
                                  <div className="relative space-y-2">
                                     <input
                                       type="file"
                                       accept=".pdf"
                                       className="hidden"
                                       id={`pdf-upload-${shipment.id}`}
                                       required
                                       onChange={(e) => {
                                         const fileInput = e.target as HTMLInputElement;
                                         const fileNameDisplay = document.getElementById(`pdf-filename-${shipment.id}`);
                                         const chooseButton = document.getElementById(`pdf-choose-button-${shipment.id}`);
                                         const nameInput = document.getElementById(`pdf-name-${shipment.id}`) as HTMLInputElement;
                                         
                                         if (fileNameDisplay) {
                                           if (fileInput.files && fileInput.files.length > 0) {
                                             const fileName = fileInput.files[0].name;
                                             fileNameDisplay.textContent = `Selected: ${fileName}`;
                                             fileNameDisplay.className = "text-sm text-green-600 font-medium mt-1";
                                             
                                             // Set the document name field to the file name (without extension)
                                             if (nameInput) {
                                               const fileNameWithoutExtension = fileName.replace(/\.[^/.]+$/, "");
                                               nameInput.value = fileNameWithoutExtension;
                                             }
                                             
                                             // Update the button text to show the selected file
                                             if (chooseButton) {
                                               chooseButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4"><path d="M14 2v4a2 2 0 0 0 2 2h4"></path><path d="M18 18v-7h-7"></path><path d="M18 18H6a2 2 0 0 1-2-2V4"></path></svg> ${fileName.length > 20 ? fileName.substring(0, 17) + '...' : fileName}`;
                                             }
                                           } else {
                                             fileNameDisplay.textContent = "No file selected";
                                             fileNameDisplay.className = "text-sm text-muted-foreground mt-1";
                                             
                                             // Clear the document name field
                                             if (nameInput) {
                                               nameInput.value = "";
                                             }
                                             
                                             // Reset the button text
                                             if (chooseButton) {
                                               chooseButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4"><path d="M14 2v4a2 2 0 0 0 2 2h4"></path><path d="M18 18v-7h-7"></path><path d="M18 18H6a2 2 0 0 1-2-2V4"></path></svg> Choose PDF File`;
                                             }
                                           }
                                         }
                                         console.log("File selected:", fileInput.files?.[0]?.name);
                                       }}
                                     />
                                     <Button
                                       type="button"
                                       variant="outline"
                                       className="flex items-center gap-2 w-full justify-center"
                                       onClick={() => document.getElementById(`pdf-upload-${shipment.id}`)?.click()}
                                       id={`pdf-choose-button-${shipment.id}`}
                                     >
                                       <FileText className="h-4 w-4" />
                                       Choose PDF File
                                     </Button>
                                     <div id={`pdf-filename-${shipment.id}`} className="text-sm text-muted-foreground mt-1">
                                       No file selected
                                     </div>
                                   </div>
                                </div>
                              </div>
                              <DialogFooter>
                                <Button type="submit" className="w-full" id={`pdf-submit-${shipment.id}`}>
                                  Upload PDF
                                </Button>
                              </DialogFooter>
                            </form>
                          </DialogContent>
                        </Dialog>
                      </TooltipTrigger>
                      <TooltipContent>Upload PDF for Shipment</TooltipContent>
                    </Tooltip>

                    <div className='ml-5 w-56 flex items-center gap-x-1'> 
                      <FaUser className='w-4 h-4' />
                      <span className='font-medium'>{shipment.orderName.length > 45 ? `${shipment.orderName.substring(0, 45)}...` : shipment.orderName.substring(0, 45)}</span>
                    </div>
                    <div className="w-88 flex">
                      <FaLocationDot className='w-4 h-4' /> 
                      <span className='font-medium'>{(shipment.address1 + ", " + shipment.suburb).length > 45 ? `${(shipment.address1 + ", " + shipment.suburb).substring(0, 45)}...` : (shipment.address1 + ", " + shipment.suburb).substring(0, 45)}</span>
                    </div>
                    {/* <div className="text-xs">{shipment.suburb}, {shipment.region} {shipment.postCode} {shipment.country}</div> */}
                    <div className='w-48 flex gap-x-2'>
                      <FaCalendarDay className='w-4 h-4' /> 
                      <span className='font-medium'>{new Date(shipment.orderDate * 1000).toLocaleString()}</span>
                    </div>
                    <div className='w-28 flex items-center'>
                      <DollarSign className='w-4 h-4' />
                      <span className='font-medium'>{parseFloat(shipment.totalPrice).toFixed(2)}</span>
                    </div>
                    {/* <div className='flex gap-x-2 items-center w-28'>
                      <Truck className='w-4 h-4' />
                      {shipment.carrierCode ? shipment.carrierCode?.charAt(0).toUpperCase() + shipment.carrierCode?.slice(1) : shipment.carrierCodeDesired?.charAt(0).toUpperCase() + shipment.carrierCodeDesired?.slice(1)}
                    </div> */}
                    <div className='flex gap-x-1 items-center w-16'>
                      <Clock className='w-4 h-4' />
                      <span className='font-medium'>{formatRelativeTime(shipment.lastApiUpdate)}</span>
                    </div>
                    {
                      selectedWarehouse !== 'Archived' ?
                        <>
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
                                <div className={shipment.locked ? 'cursor-pointer' : ''}
                                  onClick={shipment.locked ? () => handleLockUnlockShipment(shipment) : undefined}>
                                  {shipment.locked ?
                                    <Lock size={17} className="text-red-500" /> :
                                    <Unlock size={17} className="text-gray-700" />
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
                        </> : null
                    }
                    <Button
                      size={"icon"}
                      variant="link"
                      className="-p-3 ml-10 cursor-pointer"
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
                      <MemoizedShipmentDetailView setAction={setDetailAction} shipment={detailedShipment as any} />
                    )}
                  </TableCell>
                </TableRow>
              )}
            </React.Fragment>
          ))}
        </TableBody>
      </Table>
      <div className="flex items-center justify-between pt-3 px-4 border-t">
        <div className="text-sm text-gray-600">
          {/* Showing {Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)}-{Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} shipments */}
        </div>
        <div className="flex items-center space-x-4">

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
