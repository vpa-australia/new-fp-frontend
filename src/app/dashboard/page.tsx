'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { UserIcon, LogOutIcon, CogIcon, GripVertical, MapPin, Globe, DeleteIcon } from 'lucide-react';
import { ShipmentsTable } from '@/components/ShipmentsTable';
import Image from 'next/image';

// Define Warehouse interface
interface Warehouse {
  id: number;
  code: string;
  name: string;
  description: string | null;
  international: boolean;
  internationalRank: number;
  domesticRank: number;
  active: boolean;
}

interface Shipment {
  id: number;
  shopifyId: number;
  shopifyOrderNumber: string;
  orderName: string;
  email: string;
  address1: string;
  suburb: string;
  invoicePrinted: boolean;
  region: string;
  postCode: string;
  country: string;
  locked: boolean;
  warehouseCode: string;
  carrierCode: string;
  serviceCode: string;
  tracking_code: string;
  labelPrinted: boolean;
  sent: boolean;
  unlDone: boolean;
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
}

type CategoryTab = 'All' | 'Local' | 'International' | 'Archived';

export default function DashboardPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loadingWarehouses, setLoadingWarehouses] = useState(true);
  const [warehouseError, setWarehouseError] = useState<string | null>(null);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [totalItems, setTotalItems] = useState(0);
  const [selectedWarehouse, setSelectedWarehouse] = useState("All");
  const [category, setCategory] = useState<CategoryTab>("All");
  const [isArchived, setIsArchived] = useState(false);
  const [lastPage, setLastPage] = useState(1);
  const [action, setAction] = useState(0);
  const [shipmentsAreLoading, setShipmentsAreLoading] = useState(false);
  const router = useRouter();
  const [searchParams, setSearchParams] = useState("");

  const [userEmail, setUserEmail] = useState('');

  // Check authentication and get user email on component mount
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const email = localStorage.getItem('userEmail');
    if (!token) {
      router.push('/login');
    } else if (email) {
      setUserEmail(email);
    }
  }, [router]);


  // Logout handler function
  const handleLogout = useCallback(() => {
    // Remove the authentication token and user email from localStorage
    localStorage.removeItem('authToken');
    localStorage.removeItem('userEmail');
    // Redirect to the login page
    router.push('/login');
  }, [router]);

  const handleCategoryChange = useCallback(
    (value: string) => {
      const nextCategory = value as CategoryTab;
      setCategory(nextCategory);

      if (nextCategory === 'Archived') {
        setIsArchived(true);
        setSelectedWarehouse('All');
        return;
      }

      setIsArchived(false);

      if (nextCategory === 'All') {
        setSelectedWarehouse('All');
        return;
      }

      const filtered = warehouses.filter((warehouse) =>
        nextCategory === 'Local' ? !warehouse.international : warehouse.international
      );

      setSelectedWarehouse((previous) => {
        if (filtered.length === 0) {
          return 'All';
        }

        return filtered.some((warehouse) => warehouse.code === previous)
          ? previous
          : filtered[0].code;
      });
    },
    [warehouses]
  );

  const categoryWarehouses = useMemo(() => {
    if (category === 'Local') {
      return warehouses.filter((warehouse) => !warehouse.international);
    }

    if (category === 'International') {
      return warehouses.filter((warehouse) => warehouse.international);
    }

    return warehouses;
  }, [category, warehouses]);

  useEffect(() => {
    const fetchWarehouses = async () => {
      setLoadingWarehouses(true);
      setWarehouseError(null);
      try {
        const token = localStorage.getItem('authToken');

        if (!token) {
          throw new Error('Authentication token not found. Please log in.');
        }

        const response = await fetch('https://ship-orders.vpa.com.au/api/platform/warehouses', {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        });

        if (!response.ok) {
          const errorData = await response.json();

          throw new Error(errorData.message || `Failed to fetch warehouses: ${response.statusText}`);
        }

        const data: { warehouses?: Record<string, Warehouse> } = await response.json();
        const warehousesData = Object.values(data.warehouses ?? {});
        setWarehouses(warehousesData);

      } catch (error) {
        console.error('Error fetching warehouses:', error);
        const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
        setWarehouseError(message);
      } finally {
        setLoadingWarehouses(false);
      }
    };

    fetchWarehouses();
  }, []);

  useEffect(() => {
    if (category === 'Local' || category === 'International') {
      const filtered = categoryWarehouses;

      setSelectedWarehouse((previous) => {
        if (filtered.length === 0) {
          return 'All';
        }

        return filtered.some((warehouse) => warehouse.code === previous)
          ? previous
          : filtered[0].code;
      });
      return;
    }

    if (category === 'Archived') {
      setSelectedWarehouse((previous) => (previous === 'Archived' ? previous : 'Archived'));
      return;
    }

    setSelectedWarehouse((previous) => (previous === 'All' ? previous : 'All'));
  }, [category, categoryWarehouses]);

  useEffect(() => {
    (async () => {
      try {

        setShipmentsAreLoading(true);

        const token = localStorage.getItem('authToken');
        if (!token) {
          throw new Error('Authentication token not found. Please log in.');
        }

        const warehouseSegment = selectedWarehouse || 'All';
        let url = 'https://ship-orders.vpa.com.au/api/shipments';
        url += `/warehouse/${warehouseSegment}`;
        url += `?perPage=${itemsPerPage}&page=${currentPage}&archive=${isArchived ? 1 : 0}`;
        if (searchParams) {
          url += `&${searchParams}`;
        }

        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
          method: 'GET',
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || `Failed to fetch shipments: ${response.statusText}`);
        }

        const data = await response.json();



        setShipments(data.shipments || []);
        setTotalItems(data.total || 0);
        setLastPage(data.lastPage || 1);
      } catch (error) {
        console.error('Error fetching shipments:', error);
      } finally {
        setShipmentsAreLoading(false);
      }
    })();
  }, [itemsPerPage, currentPage, selectedWarehouse, action, isArchived, searchParams]);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 p-6">
      <header className="mb-6 flex justify-between items-center"> {/* Added flex layout */}
        <div className='flex gap-x-3 items-center'> {/* Wrapped existing header content */}
          <Image src="/vpa-full-logo_410x.avif" alt='VPA Logo' width={80} height={20} />
          <h1 className="text-3xl font-bold text-gray-900 italic">Fulfillments</h1>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Avatar className="cursor-pointer">
              <AvatarImage src="" alt={userEmail} />
              <AvatarFallback className='font-bold bg-gray-300'>{userEmail.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer">
              <UserIcon className="mr-2 h-4 w-4" />
              <span>Profile</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer" onClick={() => router.push('/dashboard/settings')}>
              <CogIcon className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />

            <DropdownMenuItem
              className="cursor-pointer text-red-600 focus:text-red-700 focus:bg-red-50"
              onClick={handleLogout} // Add onClick handler
            >
              <LogOutIcon className="mr-2 h-4 w-4" />
              <span>Logout</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      {/* Tabs and Table */}
      <Tabs value={category} onValueChange={handleCategoryChange} className="w-full">
        <div>
          {loadingWarehouses && (
            <p className="mb-2 text-sm text-muted-foreground">Loading warehouses...</p>
          )}
          {warehouseError && (
            <p className="mb-2 text-sm text-red-600">{warehouseError}</p>
          )}
          <TabsList className={`${category === 'Local' || category === 'International' ? 'mb-5' : ''} flex items-center justify-start space-x-2 p-1 rounded-lg bg-inherit`}>
            <TabsTrigger
              value="All"
              className="flex flex-col items-center justify-center p-2 rounded-md data-[state=active]:bg-[#44743F] data-[state=active]:text-white text-gray-600 hover:bg-gray-200 transition-colors w-20 h-16"
            >
              <GripVertical className="h-5 w-5 mb-0.5" />
              <span className="text-xs font-medium">All</span>
            </TabsTrigger>
            <TabsTrigger
              value="Local"
              className="flex flex-col items-center justify-center p-2 rounded-md data-[state=active]:bg-[#44743F] data-[state=active]:text-white text-gray-600 hover:bg-gray-200 transition-colors w-20 h-16"
            >
              <MapPin className="h-5 w-5 mb-0.5" />
              <span className="text-xs font-medium">Local</span>
            </TabsTrigger>
            <TabsTrigger
              value="International"
              className="flex flex-col items-center justify-center p-2 rounded-md data-[state=active]:bg-[#44743F] data-[state=active]:text-white text-gray-600 hover:bg-gray-200 transition-colors w-20 h-16"
            >
              <Globe className="h-5 w-5 mb-0.5" />
              <span className="text-xs font-medium">International</span>
            </TabsTrigger>
            <TabsTrigger
              value="Archived"
              className="flex flex-col items-center justify-center p-2 rounded-md data-[state=active]:bg-[#44743F] data-[state=active]:text-white text-gray-600 hover:bg-gray-200 transition-colors w-20 h-16"
            >
              <DeleteIcon className="h-5 w-5 mb-0.5" />
              <span className="text-xs font-medium">Archived</span>
            </TabsTrigger>
          </TabsList>
        </div>
        {(category === 'Local' || category === 'International') && (
          <div className="flex flex-row justify-between items-center mt-3 mb-3">
            <div className="mb-1 flex items-center justify-start space-x-2 p-1 rounded-lg bg-inherit">
              {categoryWarehouses.length === 0 ? (
                <span className="text-sm text-gray-500">No warehouses available.</span>
              ) : (
                categoryWarehouses.map((warehouse) => (
                  <button
                    key={warehouse.id}
                    type="button"
                    onClick={() => setSelectedWarehouse(warehouse.code)}
                    className={`flex flex-col items-center justify-center p-2 rounded-md transition-colors w-20 h-16 ${
                      selectedWarehouse === warehouse.code
                        ? 'bg-[#44743F] text-white'
                        : 'text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {category === 'Local' ? (
                      <MapPin className="h-5 w-5 mb-0.5" />
                    ) : (
                      <Globe className="h-5 w-5 mb-0.5" />
                    )}
                    <span className="text-xs font-medium">
                      {warehouse.code.substring(0, 3).toUpperCase()}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
        {(['All', 'Local', 'International', 'Archived'] as CategoryTab[]).map((tab) => (
          <TabsContent key={tab} value={tab}>
            <Card className="shadow-sm w-full">
              <CardContent className="p-0">
                <ShipmentsTable
                  setSearchParams={setSearchParams}
                  selectedWarehouse={selectedWarehouse}
                  setAction={setAction}
                  lastPage={lastPage}
                  shipments={shipments}
                  currentPage={currentPage}
                  itemsPerPage={itemsPerPage}
                  totalItems={totalItems}
                  setItemsPerPage={setItemsPerPage}
                  setCurrentPage={setCurrentPage}
                  shipmentsAreLoading={shipmentsAreLoading}
                />
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

    </div>
  );
}



