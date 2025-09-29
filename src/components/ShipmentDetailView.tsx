'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { AlertCircleIcon, BoxIcon, Loader } from 'lucide-react';
import { AlertDialog } from './ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';

interface LineItem {
  id: number;
  title: string;
  variant_title: string | null;
  sku: string;
  quantity: number;
  price: string;
  url: string | null;
  variantId: string;
  oosWarehouses: Array<{
    id: number;
    variantId: string;
    warehouseCode: string;
  }>;
}

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
    id: number;
    shipmentId: number;
    warehouseCode: string;
    carrierCode: string;
    serviceCode: string;
    serviceSubCode: string;
    costIncludingTax: string;
    apiQuoteId: number;
  }>;
  line_items: LineItem[];
}



interface ShipmentDetailViewProps {
  shipment: any;
  setAction: React.Dispatch<React.SetStateAction<number>>;
}

export function ShipmentDetailView({ shipment, setAction }: ShipmentDetailViewProps) {
  const { toast } = useToast();
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [shipmentErrors, setShipmentErrors] = useState<Array<{ message: string, shipmentId: number }>>([]);
  const [isLoadingErrors, setIsLoadingErrors] = useState(false);
  const [selectedStockStatus, setSelectedStockStatus] = useState<Record<number, 'yes' | 'no'>>({});
  const [selectedDispatchFrom, setSelectedDispatchFrom] = useState<Record<number, string>>({});
  const [selectedQuote, setSelectedQuote] = useState<number | null>(null);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<any[]>([]);

  useEffect(() => {
    if (!shipment?.shipment) {
      setSelectedStockStatus({});
      setSelectedDispatchFrom({});
      setComments([]);
      return;
    }

    const currentWarehouseCode = shipment.shipment.warehouseCode || '';
    const nextStockStatus: Record<number, 'yes' | 'no'> = {};
    const nextDispatch: Record<number, string> = {};

    shipment.shipment.orderLines?.forEach((item: LineItem) => {
      const isOutOfStock = item.oosWarehouses?.some(
        (wh: any) =>
          wh.warehouseCode === currentWarehouseCode && wh.variantId === item.variantId
      );
      nextStockStatus[item.id] = isOutOfStock ? 'no' : 'yes';
      nextDispatch[item.id] = currentWarehouseCode;
    });

    setSelectedStockStatus(nextStockStatus);
    setSelectedDispatchFrom(nextDispatch);
    setComments(shipment.shipment.comments || []);
  }, [shipment]);

  // Fetch warehouses on component mount

  const [warehouses, setWarehouses] = useState<Array<{ code: string; name: string }>>([]);

  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        const token = localStorage.getItem('authToken');
        if (!token) {
          throw new Error('Authentication token not found. Please log in.');
        }

        const response = await fetch('https://ship-orders.vpa.com.au/api/platform/warehouses', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
          },
        });
        if (!response.ok) {
          throw new Error('Failed to fetch warehouses');
        }
        const data = await response.json();

        if (data && data.success && data.warehouses) {
          const warehouseArray = Object.values(data.warehouses);
          const formattedWarehouses = warehouseArray.map((wh: any) => ({
            code: wh.code,
            name: wh.name,
          }));
          setWarehouses(formattedWarehouses);
        } else {
          throw new Error('Unexpected data format received for warehouses.');
        }
      } catch (error) {
        console.error('Error fetching warehouses:', error);
        toast({
          title: "Error",
          description: "Failed to fetch warehouses. Please try again.",
          variant: "destructive",
        });
      }
    };

    fetchWarehouses();
  }, []);

  // Fetch carriers on component mount
  useEffect(() => {
    const fetchCarriers = async () => {
      try {

        const token = localStorage.getItem('authToken');
        console.log('Token:', token);
        if (!token) {
          throw new Error('Authentication token not found. Please log in.');
        }
        const response = await fetch('https://ship-orders.vpa.com.au/api/platform/carriers', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
          },
        });
        if (!response.ok) {
          throw new Error('Failed to fetch carriers');
        }
        const data = await response.json();

        console.log('Carrier data:', data); // Log the fetched data

        // Check if the response has the expected structure
        if (data && data.success && data.carriers) {
          // Extract the carrier objects into an array
          const carrierArray = Object.values(data.carriers);
          // Ensure the extracted data matches the Carrier interface
          const formattedCarriers = carrierArray.map((c: any) => ({
            code: c.code,
            name: c.name,
          }));
        } else {
          // Handle unexpected response structure
          console.error('Unexpected API response structure for carriers:', data);
          throw new Error('Unexpected data format received for carriers.');
        }

      } catch (error) {
        console.error('Error fetching carriers:', error);
      } finally {
      }
    };

    fetchCarriers();
  }, []);

  // TODO: Add handlers for quote selection, warehouse selection, and comments

  const handleQuoteSelection = async () => {

    if (!selectedQuote) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please select a quote first'
      });
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const response = await fetch(`https://ship-orders.vpa.com.au/api/shipments/quote/${shipment.shipment.id}?quote_id=${selectedQuote}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to update shipment quote');
      }

      const result = await response.json();

      toast({
        variant: 'success',
        title: 'Success',
        description: 'Quote has been updated successfully',
      });

      setAction(prev => prev + 1);

    } catch (error) {

      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update quote. Please try again.',
      });
    }
  };

  const handleMarkInStock = async (item: LineItem, code: string) => {
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

      const response = await fetch(`https://ship-orders.vpa.com.au/api/product/oos?sku=${item.sku}&warehouse_code=${code}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to update stock status');
      }

      const result = await response.json();
      if (result.success) {
        setAction(prev => prev + 1);
        setSelectedStockStatus(prev => ({ ...prev, [item.id]: 'yes' }));
        toast({
          variant: 'success',
          title: 'Success',
          description: 'Stock status updated successfully'
        });
      }
    } catch (error) {
      console.error('Error updating stock status:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update stock status'
      });
    }
  };

  const handleMarkOutOfStock = async (item: LineItem, code: string) => {
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

      const response = await fetch(`https://ship-orders.vpa.com.au/api/product/oos?sku=${item.sku}&warehouse_code=${code}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to update stock status');
      }

      const result = await response.json();
      if (result.success) {
        setAction(prev => prev + 1);
        setSelectedStockStatus(prev => ({ ...prev, [item.id]: 'no' }));
        toast({
          variant: 'success',
          title: 'Success',
          description: 'Stock status updated successfully'
        });
      }
    } catch (error) {
      console.error('Error updating stock status:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update stock status'
      });
    }
  };

  const handleSaveNote = async () => {
    if (!commentText.trim()) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Comment cannot be empty.',
      });
      return;
    }

    const token = localStorage.getItem('authToken');
    const userDataStr = localStorage.getItem('userData');

    if (!token || !userDataStr) {
      toast({
        variant: 'destructive',
        title: 'Authentication Error',
        description: 'Authentication data not found. Please log in again.',
      });
      return;
    }

    try {
      const userData = JSON.parse(userDataStr);
      const userName = userData.data.name;
      const userRole = userData.roles.roles.length > 0 ? userData.roles.roles[0] : 'User';

      const response = await fetch(`https://ship-orders.vpa.com.au/api/shipments/comment/${shipment.shipment.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          comment: commentText,
          name: userName,
          title: userRole,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save note');
      }

      const newComment = await response.json();

      // Add the new comment to the local state with current timestamp
      const commentToAdd = {
        id: Date.now(), // Temporary ID for new comments
        comment: commentText,
        name: userName,
        title: userRole,
        time: Math.floor(Date.now() / 1000), // Current timestamp in seconds
      };

      setComments(prevComments => [...prevComments, commentToAdd]);
      setCommentText(''); // Clear the textarea

      toast({
        variant: 'success',
        title: 'Success',
        description: 'Note saved successfully.',
      });
    } catch (error: any) {
      console.error('Error saving note:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to save note. Please try again.',
      });
    }
  };

  const handleMoveShipment = async () => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      toast({
        title: "Authentication Error",
        description: "Authentication token not found. Please log in again.",
        variant: 'destructive'
      });
      return;
    }

    const itemsByWarehouseCode: Record<string, string[]> = {};

    Object.entries(selectedDispatchFrom).forEach(([itemId, warehouseCode]) => {
      if (!warehouseCode) {
        return;
      }

      if (!itemsByWarehouseCode[warehouseCode]) {
        itemsByWarehouseCode[warehouseCode] = [];
      }

      itemsByWarehouseCode[warehouseCode].push(itemId);
    });

    if (Object.keys(itemsByWarehouseCode).length === 0) {
      toast({
        title: "No Items Selected",
        description: "Please select at least one item to move.",
        variant: 'destructive'
      });
      return;
    }

    const queryString = Object.entries(itemsByWarehouseCode)
      .map(([code, itemIds]) => `${encodeURIComponent(code)}=${encodeURIComponent(itemIds.join(','))}`)
      .join('&');

    const url = `https://ship-orders.vpa.com.au/api/shipments/move/${shipment.shipment.id}?${queryString}`;

    try {
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
      if (!response.ok) {
        throw new Error('Failed to move items');
      }
      const result = await response.json();
      if (result.success) {
        setAction((prev) => prev + 1);
        toast({
          title: "Move Successful",
          description: "Selected items have been moved.",
          variant: 'success'
        });
      } else {
        throw new Error(result.message || 'Failed to move items');
      }
    } catch (error: any) {
      toast({
        title: "Move Failed",
        description: error.message || 'Failed to move items.',
        variant: 'destructive'
      });
    }
  }

  const showShipmentErrors = async (shipmentId: any) => {
    setIsLoadingErrors(true);
    setErrorDialogOpen(true);

    try {
      // Get the token from localStorage
      const token = localStorage.getItem('authToken');

      if (!token) {
        toast({
          title: 'Authentication Error',
          description: 'You are not authenticated. Please log in again.',
          variant: 'destructive',
        });
        return;
      }

      const response = await fetch(`https://ship-orders.vpa.com.au/api/shipments/errors/${shipmentId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Error fetching shipment errors: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.errors) {
        setShipmentErrors(data.errors);
      } else {
        setShipmentErrors([]);
        toast({
          title: 'No errors found',
          description: 'No errors were found for this shipment.',
        });
      }
    } catch (error) {
      console.error('Error fetching shipment errors:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to fetch shipment errors',
        variant: 'destructive',
      });
      setShipmentErrors([]);
    } finally {
      setIsLoadingErrors(false);
    }
  }

  return (
    <div className="grid grid-cols-3 gap-4 p-4">
      {/* Error Dialog */}
      <Dialog open={errorDialogOpen} onOpenChange={setErrorDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircleIcon className="h-5 w-5 text-red-500" />
              Shipment Errors
            </DialogTitle>
          </DialogHeader>

          {isLoadingErrors ? (
            <div className="flex justify-center items-center py-8">
              <Loader className="h-8 w-8 animate-spin text-gray-500" />
              <span className="ml-2">Loading errors...</span>
            </div>
          ) : shipmentErrors.length > 0 ? (
            <div className="max-h-[60vh] overflow-y-auto">
              {shipmentErrors.map((error, index) => (
                <div key={index} className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-800 whitespace-pre-wrap">{error.message}</p>
                  <p className="text-xs text-gray-500 mt-1">Shipment ID: {error.shipmentId}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-gray-500">
              No errors found for this shipment.
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setErrorDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div>
        {/* Shipping Quotes Section */}
        <Card className="col-span-1">
          <CardHeader className="">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Shipping Quotes</CardTitle>
          </CardHeader>;
          <CardContent className='-mt-12'>
            <RadioGroup
              className=''
              defaultValue={`${shipment.id}`}
              onValueChange={(value) => {
                setSelectedQuote(parseInt(value.split('-')[0]));
              }}
            >
              {shipment?.shipment?.quotes?.map((quote: any) => (
                <div key={quote.id} className="flex items-center space-x-2 mb-2">
                  <RadioGroupItem value={`${quote.id}-${quote.carrierCode}-${quote.serviceCode}`} id={`quote-${quote.id}`} />
                  <Label htmlFor={`quote-${quote.id}`} className="flex-grow text-sm">
                    {quote.carrier.manual !== true ? `$${(quote.costIncludingTax.toString().split('.')[0] + '.' + (quote.costIncludingTax.toString().split('.')[1] || '00').substring(0, 2))} ` : ''}{quote.carrier.name} {quote.isExpress ? "(Express)" : ""}
                  </Label>
                </div>
              ))}
            </RadioGroup>

            <Button className='mt-5' onClick={handleQuoteSelection} size="sm" variant="outline">
              Change Quote
            </Button>
          </CardContent>
        </Card>
        <Card className='mt-4 p-10'>
          <AlertDialog>
            <div className='flex gap-x-3'>
              <AlertCircleIcon />
              To view errors you need to click the button below
            </div>
          </AlertDialog>
          <Button onClick={() => showShipmentErrors(shipment.shipment.id)}>Show Errors</Button>
        </Card>
      </div>

      {/* Second Column - NOTES Section */}
      <Card className="col-span-1">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wider">NOTES</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='h-[200px] overflow-y-scroll'>
            {comments.length === 0 ? (
              <p className="text-sm text-gray-500">No notes added yet.</p>
            ) :
              comments.map((comment: any) => (
                <div key={comment.id || comment.time} className="mb-4 p-4 bg-gray-50 rounded-lg"> {/* Use comment.time as fallback key if id is not present immediately after adding */}
                  <div className="flex items-center gap-2 mb-2">
                    <div className="font-medium text-gray-900">{comment.name}</div>
                    <div className="text-sm text-gray-500">{comment.title}</div>
                  </div>
                  <p className="text-gray-700 mb-2">{comment.comment}</p>
                  <div className="text-xs text-gray-500">
                    {new Date((comment.time || Date.now() / 1000) * 1000).toLocaleString()} {/* Use current time as fallback */}
                  </div>
                </div>
              ))
            }
          </div>
          <Textarea
            placeholder="Add your notes here..."
            className="w-full h-24 text-sm mt-2"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
          />
          <div className="mt-2 flex justify-end">
            <Button size="sm" variant="outline" onClick={handleSaveNote}>
              Save Note
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Third Column - Line Items Section */}
      <Card className="col-span-1">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Line Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2">
            {shipment?.shipment?.orderLines?.map((item: LineItem) => (
              <div key={item.id} className="bg-white border rounded-lg p-3">
                <div className="flex w-full items-center justify-between mb-2">

                  <div className="flex flex-col items-center">
                    <span className="text-xs text-gray-500 mb-1">In Stock</span>
                    <div className="flex gap-1">
                      {warehouses.map((warehouse) => (
                        <button
                          key={warehouse.code}
                          onClick={() => item?.oosWarehouses?.find((w: any) => w.warehouseCode === warehouse.code)?.id ? handleMarkInStock(item, warehouse.code) : handleMarkOutOfStock(item, warehouse.code)}
                          className={`px-2 py-1 ${item?.oosWarehouses?.find((w: any) => w.warehouseCode === warehouse.code)?.id ? 'bg-red-500 text-white' : 'bg-green-100 hover:bg-green-200 text-green-800'} text-xs font-medium rounded transition-colors`}
                        >
                          {warehouse.code.substring(0, 3).toUpperCase()}
                        </button>
                      ))}
                    </div>


                  </div>
                  <div className='flex items-center gap-x-2'>
                    {item.url ? (
                      <img src={item.url} alt={item.title} className="w-12 h-12 rounded-lg object-cover" />
                    ) : (
                      <div className="w-12 h-12 flex items-center justify-center bg-gray-50">
                        <BoxIcon className="w-6 h-6 text-gray-400" />
                      </div>
                    )}
                    <div className='flex flex-col'>
                      <p className="text-sm font-medium text-gray-900">{item.title}</p>
                      {item.variant_title && (
                        <p className="text-xs text-gray-500">{item.variant_title}</p>
                      )}
                      <span className="text-gray-600">SKU: {item.sku}</span>
                      <div className="flex items-center gap-4">
                        <span className="text-gray-900">Qty: {item.quantity}</span>
                        <span className="text-gray-900 font-medium">${parseFloat(item.price).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-xs text-gray-500 mb-1">Dispatch From</span>
                    <div className="flex gap-1">
                      {warehouses.map((warehouse) => (
                        <button
                          key={warehouse.code}
                          onClick={() => setSelectedDispatchFrom((prev) => ({ ...prev, [item.id]: warehouse.code }))}
                          className={`px-2 py-1 ${selectedDispatchFrom[item.id] === warehouse.code ? 'bg-blue-500 text-white' : 'bg-blue-100 hover:bg-blue-200 text-blue-800'} text-xs font-medium rounded transition-colors`}
                        >
                          {warehouse.code.substring(0, 3).toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              className="bg-blue-500 hover:bg-blue-600 text-white"
              onClick={handleMoveShipment}
            >
              MOVE
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


