'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { BoxIcon } from 'lucide-react';

// Define the Shipment interface again or import it if defined globally
interface LineItem {
  id: number;
  title: string;
  variant_title: string | null;
  sku: string;
  quantity: number;
  price: string;
  url: string | null;
  variantId: string;
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

// Define an interface for the warehouse data
interface Warehouse {
  code: string; // Assuming the API returns 'code'
  name: string; // Assuming the API returns 'name'
}

// Define an interface for the carrier data
interface Carrier {
  code: string; // Assuming the API returns 'code'
  name: string; // Assuming the API returns 'name'
}

interface ShipmentDetailViewProps {
  shipment: any;
  setAction: React.Dispatch<React.SetStateAction<number>>;
}

export function ShipmentDetailView({ shipment, setAction }: ShipmentDetailViewProps) {
  const { toast } = useToast();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoadingWarehouses, setIsLoadingWarehouses] = useState(true);
  const [warehouseError, setWarehouseError] = useState<string | null>(null);
  const [selectedStockStatus, setSelectedStockStatus] = useState<Record<number, 'yes' | 'no'>>(() => {
    const initialStockStatus: Record<number, 'yes' | 'no'> = {};
    shipment?.shipment?.orderLines?.forEach((item: any) => {
      const isOutOfStock = item.oosWarehouses?.some((wh: any) => 
        wh.warehouseCode === shipment.shipment.warehouseCode && 
        wh.variantId === item.variantId
      );
      initialStockStatus[item.id] = isOutOfStock ? 'no' : 'yes';
    });
    return initialStockStatus;
  });
  const [selectedDispatchFrom, setSelectedDispatchFrom] = useState<Record<number, 'B' | 'M'>>(() => {
    const initialDispatch: Record<number, 'B' | 'M'> = {};
    shipment?.shipment?.orderLines?.forEach((item: LineItem) => {
      initialDispatch[item.id] = shipment.shipment.warehouseCode === 'Brisbane' ? 'B' : 'M';
    });
    return initialDispatch;
  });

  // State for carriers, loading, and error handling
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [isLoadingCarriers, setIsLoadingCarriers] = useState(true);
  const [carrierError, setCarrierError] = useState<string | null>(null);
  const [selectedQuote, setSelectedQuote] = useState<number | null>(null); // State for selected quote
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [isLoadingLineItems, setIsLoadingLineItems] = useState(false);
  const [lineItemsError, setLineItemsError] = useState<string | null>(null);
  const [commentText, setCommentText] = useState(''); // State for the comment text
  const [comments, setComments] = useState<any[]>(shipment?.shipment?.comments || []); // State for comments to allow dynamic updates

  // Fetch warehouses on component mount

  console.log("shipment detail: ", shipment);

  useEffect(() => {
    const fetchWarehouses = async () => {
      setIsLoadingWarehouses(true);
      setWarehouseError(null);
      try {
        const token = localStorage.getItem('authToken');
        console.log('Token:', token);
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

        console.log('Warehouse data:', data); // Log the fetched data

        // Check if the response has the expected structure
        if (data && data.success && data.warehouses) {
          // Extract the warehouse objects into an array
          const warehouseArray = Object.values(data.warehouses);
          // Ensure the extracted data matches the Warehouse interface
          const formattedWarehouses = warehouseArray.map((wh: any) => ({
            code: wh.code,
            name: wh.name,
          }));
          setWarehouses(formattedWarehouses);
        } else {
          // Handle unexpected response structure
          console.error('Unexpected API response structure for warehouses:', data);
          throw new Error('Unexpected data format received for warehouses.');
        }

      } catch (error) {
        console.error('Error fetching warehouses:', error);
        setWarehouseError('Failed to load warehouses. Please try again.');
        setWarehouses([]); // Clear warehouses on error
      } finally {
        setIsLoadingWarehouses(false);
      }
    };

    fetchWarehouses();
  }, []);

  // Fetch carriers on component mount
  useEffect(() => {
    const fetchCarriers = async () => {
      setIsLoadingCarriers(true);
      setCarrierError(null);
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
          setCarriers(formattedCarriers);
        } else {
          // Handle unexpected response structure
          console.error('Unexpected API response structure for carriers:', data);
          throw new Error('Unexpected data format received for carriers.');
        }

      } catch (error) {
        console.error('Error fetching carriers:', error);
        setCarrierError('Failed to load carriers. Please try again.');
        setCarriers([]); // Clear carriers on error
      } finally {
        setIsLoadingCarriers(false);
      }
    };

    fetchCarriers();
  }, []);

  // TODO: Add handlers for quote selection, warehouse selection, and comments

  const handleQuoteSelection = async () => {

    console.log("selected quote: ", selectedQuote);
    if (!selectedQuote) {
      console.error('No quote selected');
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
      console.log('Quote updated successfully:', result);
      toast({
        variant: 'success',
        title: 'Success',
        description: 'Quote has been updated successfully',
      });

      setAction(prev => prev + 1);

    } catch (error) {
      console.error('Error updating quote:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update quote. Please try again.',
      });
    }
  };

  const handleMarkInStock = async (item: LineItem) => {
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

      const response = await fetch(`https://ship-orders.vpa.com.au/api/product/oos?variant_id=${item.variantId}&warehouse_code=${shipment.shipment.warehouseCode}`, {
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

  const handleMarkOutOfStock = async (item: LineItem) => {
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

      const response = await fetch(`https://ship-orders.vpa.com.au/api/product/oos?variant_id=${item.variantId}&warehouse_code=${shipment.shipment.warehouseCode}`, {
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

  return (
    <div className="grid grid-cols-3 gap-4 p-4">
      <div>
        {/* Shipping Quotes Section */}
        <Card className="col-span-1 mb-5">
          <CardHeader className="">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Shipping Quotes</CardTitle>
          </CardHeader>
          <CardContent>
            {/* <p className='mb-4 -mt-3'>Desired Carrier Code: {shipment.shipment.carrierCodeDesired}</p>
            <p className='mb-5 -mt-3'>Selected Carrier Code: {shipment.shipment.carrierCode}</p> */}
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
                    {quote.carrier.manual !== true ? `$${(quote.costIncludingTax.toString().split('.')[0] + '.' + (quote.costIncludingTax.toString().split('.')[1] || '00').substring(0,2))} ` : ''}{quote.carrier.name} {quote.isExpress ? "(Express)": ""}
                  </Label>
                </div>
              ))}
            </RadioGroup>

            <Button className='mt-5' onClick={handleQuoteSelection} size="sm" variant="outline">
              Change Quote
            </Button>
          </CardContent>
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
                        <button 
                          onClick={() => handleMarkInStock(item)} 
                          className={`px-2 py-1 ${selectedStockStatus[item.id] === 'yes' ? 'bg-green-500 text-white' : 'bg-green-100 hover:bg-green-200 text-green-800'} text-xs font-medium rounded transition-colors`}
                        >
                          YES
                        </button>
                        <button 
                          onClick={() => handleMarkOutOfStock(item)} 
                          className={`px-2 py-1 ${selectedStockStatus[item.id] === 'no' ? 'bg-red-500 text-white' : 'bg-red-100 hover:bg-red-200 text-red-800'} text-xs font-medium rounded transition-colors`}
                        >
                          NO
                        </button>
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
                        <button 
                          onClick={() => setSelectedDispatchFrom(prev => ({ ...prev, [item.id]: 'B' }))} 
                          className={`px-2 py-1 ${selectedDispatchFrom[item.id] === 'B' ? 'bg-blue-500 text-white' : 'bg-blue-100 hover:bg-blue-200 text-blue-800'} text-xs font-medium rounded transition-colors`}
                        >
                          B
                        </button>
                        <button 
                          onClick={() => setSelectedDispatchFrom(prev => ({ ...prev, [item.id]: 'M' }))} 
                          className={`px-2 py-1 ${selectedDispatchFrom[item.id] === 'M' ? 'bg-purple-500 text-white' : 'bg-purple-100 hover:bg-purple-200 text-purple-800'} text-xs font-medium rounded transition-colors`}
                        >
                          M
                        </button>
                      </div>
                    </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <Button 
              className="bg-blue-500 hover:bg-blue-600 text-white" 
              onClick={async () => {
                const token = localStorage.getItem('authToken');
                if (!token) {
                  toast({
                    title: "Authentication Error",
                    description: "Authentication token not found. Please log in again.",
                    variant: 'destructive'
                  });
                  return;
                }
                // Group line items by selected dispatch warehouse
                const brisbaneIds = Object.entries(selectedDispatchFrom)
                  .filter(([_, v]) => v === 'B')
                  .map(([k]) => k);
                const melbourneIds = Object.entries(selectedDispatchFrom)
                  .filter(([_, v]) => v === 'M')
                  .map(([k]) => k);
                if (brisbaneIds.length === 0 && melbourneIds.length === 0) {
                  toast({
                    title: "No Items Selected",
                    description: "Please select at least one item to move.",
                    variant: 'destructive'
                  });
                  return;
                }
                const params = [];
                if (brisbaneIds.length > 0) params.push(`Brisbane=${brisbaneIds.join(',')}`);
                if (melbourneIds.length > 0) params.push(`Melbourne=${melbourneIds.join(',')}`);
                const url = `https://ship-orders.vpa.com.au/api/shipments/move/${shipment.shipment.id}?${params.join('&')}`;
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
              }}
            >
              MOVE
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}