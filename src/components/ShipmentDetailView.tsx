'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import { AlertCircleIcon, BoxIcon, Loader } from 'lucide-react';
import { AlertDialog } from './ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { useAuth } from '@/contexts/AuthContext';

interface OutOfStockWarehouse {
  id: number;
  variantId: string | number;
  warehouseCode: string;
}

interface LineItem {
  id: number;
  title: string;
  variant_title: string | null;
  sku: string;
  quantity: number;
  price: string | number;
  url: string | null;
  variantId: string | number;
  oosWarehouses?: OutOfStockWarehouse[];
}

interface ShipmentComment {
  id: number;
  comment: string;
  name: string;
  title: string;
  time: number;
}

interface ShipmentQuote {
  id: number;
  shipmentId: number;
  warehouseCode: string;
  carrierCode: string;
  serviceCode: string;
  serviceSubCode: string;
  costIncludingTax: string | number;
  apiQuoteId: number | null;
  carrier?: {
    manual?: boolean;
    name: string;
  };
  isExpress?: boolean;
}

interface ShipmentDetail {
  id: number;
  warehouseCode: string;
  comments?: ShipmentComment[];
  orderLines?: LineItem[];
  quotes?: ShipmentQuote[];
}

export interface ShipmentDetailResponse {
  shipment?: ShipmentDetail | null;
  [key: string]: unknown;
}

interface ShipmentError {
  message: string;
  shipmentId: number;
}

interface WarehouseSummary {
  code: string;
  name: string;
}

type WarehousesResponse = {
  success: boolean;
  warehouses?: Record<string, WarehouseSummary>;
};

type ApiSuccessResponse = {
  success: boolean;
  message?: string;
  [key: string]: unknown;
};

type StoredUserData = {
  data?: {
    name?: string | null;
  };
  roles?: {
    roles?: Array<string | number>;
  };
};

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const isWarehouseSummary = (value: unknown): value is WarehouseSummary => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as { code?: unknown; name?: unknown };
  return typeof candidate.code === 'string' && typeof candidate.name === 'string';
};

const isWarehousesResponseData = (value: unknown): value is WarehousesResponse => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as { success?: unknown; warehouses?: unknown };
  if (typeof candidate.success !== 'boolean') {
    return false;
  }
  if (candidate.warehouses === undefined) {
    return true;
  }
  if (typeof candidate.warehouses !== 'object' || candidate.warehouses === null) {
    return false;
  }
  return Object.values(candidate.warehouses).every(isWarehouseSummary);
};

const isShipmentComment = (value: unknown): value is ShipmentComment => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as {
    id?: unknown;
    comment?: unknown;
    name?: unknown;
    title?: unknown;
    time?: unknown;
  };
  return (
    typeof candidate.id === 'number' &&
    typeof candidate.comment === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.title === 'string' &&
    typeof candidate.time === 'number'
  );
};

const isShipmentError = (value: unknown): value is ShipmentError => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as { message?: unknown; shipmentId?: unknown };
  return typeof candidate.message === 'string' && typeof candidate.shipmentId === 'number';
};

const isShipmentErrorsResponse = (value: unknown): value is { success: boolean; errors: ShipmentError[] } => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as { success?: unknown; errors?: unknown };
  return (
    typeof candidate.success === 'boolean' &&
    Array.isArray(candidate.errors) &&
    candidate.errors.every(isShipmentError)
  );
};

const formatQuoteCost = (cost: ShipmentQuote['costIncludingTax']): string => {
  const numericCost = typeof cost === 'number' ? cost : Number.parseFloat(cost);
  if (Number.isNaN(numericCost)) {
    return '';
  }
  return `$${numericCost.toFixed(2)}`;
};

const getQuoteLabel = (quote: ShipmentQuote): string => {
  const costPrefix = quote.carrier?.manual === true ? '' : `${formatQuoteCost(quote.costIncludingTax)} `;
  const carrierName = quote.carrier?.name ?? quote.carrierCode;
  const expressSuffix = quote.isExpress ? ' (Express)' : '';
  return `${costPrefix}${carrierName}${expressSuffix}`;
};

const isItemOutOfStockAtWarehouse = (item: LineItem, warehouseCode: string): boolean =>
  item.oosWarehouses?.some((warehouse) => warehouse.warehouseCode === warehouseCode) ?? false;

const formatPrice = (price: LineItem['price']): string => {
  const numericPrice = typeof price === 'number' ? price : Number.parseFloat(price);
  if (Number.isNaN(numericPrice)) {
    return '';
  }
  return `$${numericPrice.toFixed(2)}`;
};

interface ShipmentDetailViewProps {
  shipment: ShipmentDetailResponse | null;
  setAction: React.Dispatch<React.SetStateAction<number>>;
}

export function ShipmentDetailView({ shipment, setAction }: ShipmentDetailViewProps) {
  const { toast } = useToast();
  const { requireAuthToken } = useAuth();
  const getAuthToken = useCallback(() => {
    try {
      return requireAuthToken();
    } catch (error) {
      toast({
        title: 'Authentication Error',
        description: 'Your session has expired. Please log in again.',
        variant: 'destructive',
      });
      throw (error instanceof Error ? error : new Error('User is not authenticated.'));
    }
  }, [requireAuthToken, toast]);
  const dateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat('en-AU', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Australia/Sydney',
      }),
    []
  );

  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [shipmentErrors, setShipmentErrors] = useState<ShipmentError[]>([]);
  const [isLoadingErrors, setIsLoadingErrors] = useState(false);
  const [selectedDispatchFrom, setSelectedDispatchFrom] = useState<Record<number, string>>({});
  const [selectedQuote, setSelectedQuote] = useState<number | null>(null);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<ShipmentComment[]>([]);
  const detail = shipment?.shipment ?? null;
  const quotes = detail?.quotes ?? [];
  const orderLines = detail?.orderLines ?? [];

  useEffect(() => {
    if (quotes.length === 0) {
      setSelectedQuote(null);
      return;
    }

    const quoteAlreadySelected = selectedQuote !== null && quotes.some((quote) => quote.id === selectedQuote);
    if (!quoteAlreadySelected) {
      setSelectedQuote(quotes[0].id);
    }
  }, [quotes, selectedQuote]);

  const getQuoteRadioValue = useCallback(
    (quote: ShipmentQuote) => `${quote.id}-${quote.carrierCode}-${quote.serviceCode}`,
    [],
  );

  const selectedQuoteValue = useMemo(() => {
    if (selectedQuote === null) {
      return '';
    }
    const quote = quotes.find((item) => item.id === selectedQuote);
    return quote ? getQuoteRadioValue(quote) : '';
  }, [getQuoteRadioValue, quotes, selectedQuote]);

  useEffect(() => {
    if (!detail) {
      setSelectedDispatchFrom({});
      setComments([]);
      return;
    }

    const currentWarehouseCode = detail.warehouseCode ?? '';
    const nextDispatch: Record<number, string> = {};

    detail.orderLines?.forEach((item) => {
      nextDispatch[item.id] = currentWarehouseCode;
    });

    setSelectedDispatchFrom(nextDispatch);
    setComments(detail.comments ?? []);
  }, [detail]);

  // Fetch warehouses on component mount

  const [warehouses, setWarehouses] = useState<WarehouseSummary[]>([]);

  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        const token = getAuthToken();

        const response = await fetch('https://ship-orders.vpa.com.au/api/platform/warehouses', {
          headers: {
            Authorization: 'Bearer ' + token,
            Accept: 'application/json',
          },
        });
        if (!response.ok) {
          throw new Error('Failed to fetch warehouses');
        }

        const data: unknown = await response.json();
        if (!isWarehousesResponseData(data) || !data.warehouses) {
          throw new Error('Unexpected data format received for warehouses.');
        }

        const formattedWarehouses = Object.values(data.warehouses).filter(isWarehouseSummary);
        setWarehouses(formattedWarehouses);
      } catch (error) {
        console.error('Error fetching warehouses:', error);
        toast({
          title: 'Error',
          description: getErrorMessage(error, 'Failed to fetch warehouses. Please try again.'),
          variant: 'destructive',
        });
      }
    };

    fetchWarehouses();
  }, [getAuthToken, toast]);

  // TODO: Add handlers for quote selection, warehouse selection, and comments

  const handleQuoteSelection = async () => {
    if (!detail?.id) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Shipment details are unavailable. Please try again.',
      });
      return;
    }

    if (!selectedQuote) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please select a quote first',
      });
      return;
    }

    try {
      const token = getAuthToken();

      const response = await fetch(
        `https://ship-orders.vpa.com.au/api/shipments/quote/${detail.id}?quote_id=${selectedQuote}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: 'Bearer ' + token,
            Accept: 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update shipment quote');
      }
  
      const result = (await response.json().catch(() => null)) as ApiSuccessResponse | null;
      if (result?.success === false) {
        throw new Error(result.message ?? 'Failed to update shipment quote');
      }

      toast({
        variant: 'success',
        title: 'Success',
        description: 'Quote has been updated successfully',
      });

      setAction((prev) => prev + 1);
    } catch (error) {
      console.error('Failed to update shipment quote:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: getErrorMessage(error, 'Failed to update quote. Please try again.'),
      });
    }
  };

  const handleMarkInStock = async (item: LineItem, code: string) => {
    try {
      const token = getAuthToken();

      const response = await fetch(
        `https://ship-orders.vpa.com.au/api/product/oos?sku=${item.sku}&warehouse_code=${code}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update stock status');
      }

      const result = (await response.json().catch(() => null)) as ApiSuccessResponse | null;
      if (result?.success === false) {
        throw new Error(result.message ?? 'Failed to update stock status');
      }

      setAction((prev) => prev + 1);
      toast({
        variant: 'success',
        title: 'Success',
        description: 'Stock status updated successfully',
      });
    } catch (error) {
      console.error('Error updating stock status:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: getErrorMessage(error, 'Failed to update stock status'),
      });
    }
  };

  const handleMarkOutOfStock = async (item: LineItem, code: string) => {
    try {
      const token = getAuthToken();

      const response = await fetch(
        `https://ship-orders.vpa.com.au/api/product/oos?sku=${item.sku}&warehouse_code=${code}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update stock status');
      }

      const result = (await response.json().catch(() => null)) as ApiSuccessResponse | null;
      if (result?.success === false) {
        throw new Error(result.message ?? 'Failed to update stock status');
      }

      setAction((prev) => prev + 1);
      toast({
        variant: 'success',
        title: 'Success',
        description: 'Stock status updated successfully',
      });
    } catch (error) {
      console.error('Error updating stock status:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: getErrorMessage(error, 'Failed to update stock status'),
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

    let token: string;
    try {
      token = getAuthToken();
    } catch {
      return;
    }

    const userDataStr = localStorage.getItem('userData');
    if (!userDataStr) {
      toast({
        variant: 'destructive',
        title: 'Authentication Error',
        description: 'Authentication data not found. Please log in again.',
      });
      return;
    }

    if (!detail?.id) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Shipment details are unavailable. Please try again.',
      });
      return;
    }

    try {
      const parsedUserData = JSON.parse(userDataStr) as StoredUserData | unknown;
      const storedUserData = (parsedUserData as StoredUserData) ?? {};
      const userName = (
        typeof storedUserData.data?.name === 'string' ? storedUserData.data.name : 'User'
      );
      const userRole = (
        Array.isArray(storedUserData.roles?.roles) && storedUserData.roles.roles.length > 0
          ? String(storedUserData.roles.roles[0])
          : 'User'
      );

      const response = await fetch(`https://ship-orders.vpa.com.au/api/shipments/comment/${detail.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
          Accept: 'application/json',
        },
        body: JSON.stringify({
          comment: commentText,
          name: userName,
          title: userRole,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null) as ApiSuccessResponse | null;
        throw new Error(errorData?.message ?? 'Failed to save note');
      }

      const apiComment = await response.json().catch(() => null);
      const commentToAdd = isShipmentComment(apiComment)
        ? apiComment
        : {
            id: Date.now(),
            comment: commentText,
            name: userName,
            title: userRole,
            time: Math.floor(Date.now() / 1000),
          };

      setComments((prevComments) => [...prevComments, commentToAdd]);
      setCommentText('');

      toast({
        variant: 'success',
        title: 'Success',
        description: 'Note saved successfully.',
      });
    } catch (error) {
      console.error('Error saving note:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: getErrorMessage(error, 'Failed to save note. Please try again.'),
      });
    }
  };

  const handleMoveShipment = async () => {
    if (!detail?.id) {
      toast({
        title: 'Error',
        description: 'Shipment details are unavailable. Please try again.',
        variant: 'destructive',
      });
      return;
    }

    const token = getAuthToken();

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
        title: 'No Items Selected',
        description: 'Please select at least one item to move.',
        variant: 'destructive',
      });
      return;
    }

    const queryString = Object.entries(itemsByWarehouseCode)
      .map(([code, itemIds]) => `${encodeURIComponent(code)}=${encodeURIComponent(itemIds.join(','))}`)
      .join('&');

    const url = `https://ship-orders.vpa.com.au/api/shipments/move/${detail.id}?${queryString}`;

    try {
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer ' + token,
          Accept: 'application/json',
        },
      });
      const payload = await response.json().catch(() => null) as ApiSuccessResponse | null;
      if (!response.ok) {
        throw new Error(payload?.message ?? 'Failed to move items');
      }

      if (payload?.success === false) {
        throw new Error(payload.message ?? 'Failed to move items');
      }

      setAction((prev) => prev + 1);
      toast({
        title: 'Move Successful',
        description: 'Selected items have been moved.',
        variant: 'success',
      });
    } catch (error) {
      console.error('Error moving items:', error);
      toast({
        title: 'Move Failed',
        description: getErrorMessage(error, 'Failed to move items.'),
        variant: 'destructive',
      });
    }
  };

  const showShipmentErrors = async (shipmentId: number) => {
    setIsLoadingErrors(true);
    setErrorDialogOpen(true);

    try {
      const token = getAuthToken();

      const response = await fetch(`https://ship-orders.vpa.com.au/api/shipments/errors/${shipmentId}`, {
        method: 'GET',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
        },
      });

      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = (
          data &&
          typeof data === 'object' &&
          data !== null &&
          'message' in data
            ? String((data as { message?: unknown }).message ?? '')
            : undefined
        );
        throw new Error(message || `Error fetching shipment errors: ${response.status}`);
      }

      if (isShipmentErrorsResponse(data) && data.success) {
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
        description: getErrorMessage(error, 'Failed to fetch shipment errors'),
        variant: 'destructive',
      });
      setShipmentErrors([]);
    } finally {
      setIsLoadingErrors(false);
    }
  };

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
              {shipmentErrors.map((error) => (
                <div
                  key={`${error.shipmentId}-${error.message}`}
                  className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md"
                >
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
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={selectedQuoteValue}
              onValueChange={(value) => {
                const [quoteId] = value.split('-');
                const parsedId = Number.parseInt(quoteId, 10);
                setSelectedQuote(Number.isNaN(parsedId) ? null : parsedId);
              }}
            >
              {quotes.map((quote) => (
                <div key={quote.id} className="flex items-center space-x-2 mb-2">
                  <RadioGroupItem
                    value={getQuoteRadioValue(quote)}
                    id={`quote-${quote.id}`}
                  />
                  <Label htmlFor={`quote-${quote.id}`} className="flex-grow text-sm">
                    {getQuoteLabel(quote)}
                  </Label>
                </div>
              ))}
            </RadioGroup>

            <Button className="mt-5" onClick={handleQuoteSelection} size="sm" variant="outline">
              Change Quote
            </Button>
          </CardContent>
        </Card>
        <Card className="mt-4 p-10">
          <AlertDialog>
            <div className="flex gap-x-3">
              <AlertCircleIcon />
              To view errors you need to click the button below
            </div>
          </AlertDialog>
          <Button
            disabled={!detail?.id}
            onClick={() => detail?.id && showShipmentErrors(detail.id)}
          >
            Show Errors
          </Button>
        </Card>
      </div>

      {/* Second Column - NOTES Section */}
      <Card className="col-span-1">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wider">NOTES</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] overflow-y-scroll">
            {comments.length === 0 ? (
              <p className="text-sm text-gray-500">No notes added yet.</p>
            ) : (
              comments.map((comment) => {
                const timestampSeconds = comment.time ?? Math.floor(Date.now() / 1000);
                const timestampMs = timestampSeconds * 1000;
                const commentKey = comment.id ?? timestampSeconds;
                return (
                  <div key={commentKey} className="mb-4 p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="font-medium text-gray-900">{comment.name}</div>
                      <div className="text-sm text-gray-500">{comment.title}</div>
                    </div>
                    <p className="text-gray-700 mb-2">{comment.comment}</p>
                    <div className="text-xs text-gray-500">
                      {dateTimeFormatter.format(new Date(timestampMs))}
                    </div>
                  </div>
                );
              })
            )}

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
            {orderLines.map((item) => (
              <div key={item.id} className="bg-white border rounded-lg p-3">
                <div className="flex w-full items-center justify-between mb-2">

                  <div className="flex flex-col items-center">
                    <span className="text-xs text-gray-500 mb-1">In Stock</span>
                    <div className="flex gap-1">
                      {warehouses.map((warehouse) => {
                        const isOutOfStock = isItemOutOfStockAtWarehouse(item, warehouse.code);
                        return (
                          <button
                            key={warehouse.code}
                            onClick={() =>
                              isOutOfStock
                                ? handleMarkInStock(item, warehouse.code)
                                : handleMarkOutOfStock(item, warehouse.code)
                            }
                            className={`px-2 py-1 ${
                              isOutOfStock
                                ? 'bg-red-500 text-white'
                                : 'bg-green-100 hover:bg-green-200 text-green-800'
                            } text-xs font-medium rounded transition-colors`}
                          >
                            {warehouse.code.substring(0, 3).toUpperCase()}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex items-center gap-x-2">
                    {item.url ? (
                      <Image
                        src={item.url}
                        alt={item.title}
                        width={48}
                        height={48}
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 flex items-center justify-center bg-gray-50">
                        <BoxIcon className="w-6 h-6 text-gray-400" />
                      </div>
                    )}
                    <div className="flex flex-col">
                      <p className="text-sm font-medium text-gray-900">{item.title}</p>
                      {item.variant_title && (
                        <p className="text-xs text-gray-500">{item.variant_title}</p>
                      )}
                      <span className="text-gray-600">SKU: {item.sku}</span>
                      <div className="flex items-center gap-4">
                        <span className="text-gray-900">Qty: {item.quantity}</span>
                        <span className="text-gray-900 font-medium">{formatPrice(item.price)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-xs text-gray-500 mb-1">Dispatch From</span>
                    <div className="flex gap-1">
                      {warehouses.map((warehouse) => (
                        <button
                          key={warehouse.code}
                          onClick={() =>
                            setSelectedDispatchFrom((prev) => ({
                              ...prev,
                              [item.id]: warehouse.code,
                            }))
                          }
                          className={`px-2 py-1 ${
                            selectedDispatchFrom[item.id] === warehouse.code
                              ? 'bg-blue-500 text-white'
                              : 'bg-blue-100 hover:bg-blue-200 text-blue-800'
                          } text-xs font-medium rounded transition-colors`}
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





