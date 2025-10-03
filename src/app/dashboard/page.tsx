'use client';

import { useCallback, useEffect, useState } from 'react';
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
import { UserIcon, LogOutIcon, Loader2, CogIcon, GripVertical, MapPin, Globe, ArchiveIcon, DeleteIcon } from 'lucide-react'; // Assuming lucide-react for icons, Added Loader2 and new icons
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

export default function DashboardPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loadingWarehouses, setLoadingWarehouses] = useState(true);
  const [warehouseError, setWarehouseError] = useState<string | null>(null);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [totalItems, setTotalItems] = useState(0);
  const [selectedWarehouse, setSelectedWarehouse] = useState("All");
  const [selectedWarehouseCategory, setSelectedWarehouseCategory] = useState("All");
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

  useEffect(() => {
    const fetchSearchParams = async () => {
      try {
        const token = localStorage.getItem('authToken');
        if (!token) {
          throw new Error('Authentication token not found. Please log in.');
        }

        const response = await fetch('https://ship-orders.vpa.com.au/api/shipments/search/parameters', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || `Failed to fetch search parameters: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('Search Parameters:', data); // Log the fetched search parameters for verificatio
      } catch (err: any) {
        console.error('Error fetching search parameters:', err);
      } finally {
      }
    };

    const fetchWarehouses = async () => {
      setLoadingWarehouses(true);
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
          const errorData = await response.json();
          console.log(await response.text());
          throw new Error(errorData.message || `Failed to fetch warehouses: ${response.statusText}`);
        }

        const data = await response.json();
        const warehousesData = Object.values(data.warehouses || {});
        setWarehouses(warehousesData as Warehouse[]);

      } catch (err: any) {
        console.error('Error fetching warehouses:', err);
        setWarehouseError(err.message || 'An unexpected error occurred.');
      } finally {
        setLoadingWarehouses(false);
      }
    };

    fetchWarehouses();
    fetchSearchParams();
  }, [action]); // Removed itemsPerPage and currentPage as they are not used in these fetches

  const [isArchived, setIsArchived] = useState(false);

  useEffect(() => {
    (async () => {
      try {

        setShipmentsAreLoading(true);

        const token = localStorage.getItem('authToken');
        if (!token) {
          throw new Error('Authentication token not found. Please log in.');
        }

        const warehouseSegment =
          selectedWarehouse && selectedWarehouse !== 'Archived'
            ? selectedWarehouse
            : 'All';
        const typeSegment = (() => {
          if (isArchived || selectedWarehouse === 'Archived') {
            return 'archived';
          }
          if (selectedWarehouseCategory === 'Local') {
            return 'local';
          }
          if (selectedWarehouseCategory === 'International') {
            return 'international';
          }
          return 'all';
        })();

        const shipmentsUrl = new URL(`https://ship-orders.vpa.com.au/api/shipments/warehouse/${warehouseSegment}`);
        shipmentsUrl.searchParams.set('perPage', String(itemsPerPage));
        shipmentsUrl.searchParams.set('page', String(currentPage));
        shipmentsUrl.searchParams.set('archive', isArchived ? '1' : '0');
        shipmentsUrl.searchParams.set('type', typeSegment);

        if (searchParams) {
          const params = searchParams.startsWith('?') ? searchParams.slice(1) : searchParams;
          const extraParams = new URLSearchParams(params);
          extraParams.forEach((value, key) => {
            shipmentsUrl.searchParams.set(key, value);
          });
        }

        const finalUrl = shipmentsUrl.toString();

        const response = await fetch(finalUrl, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
          },
          method: 'GET',
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || `Failed to fetch shipments: ${response.statusText}`);
        }

        const data = await response.json();

        console.log('API Response:', data);

        setShipments(data.shipments || []);
        setTotalItems(data.total || 0);
        setLastPage(data.lastPage || 1);
      } catch (err: any) {
        console.error('Error fetching shipments:', err);
      } finally {
        setShipmentsAreLoading(false);
      }
    })();
  }, [itemsPerPage, currentPage, selectedWarehouse, action, isArchived, searchParams, selectedWarehouseCategory]);

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
      <Tabs defaultValue="All" className="w-full" onValueChange={(value) => {
        if (value === 'archived') {
          setIsArchived(true);
          setSelectedWarehouse('Archived');
        } else {
          setIsArchived(false);
          setSelectedWarehouse(value);
        }
      }}>
        <div>
        <TabsList className={`${selectedWarehouseCategory === "Local" ? 'mb-5' : ''} flex items-center justify-start space-x-2 p-1 rounded-lg bg-inherit`}>
            <TabsTrigger
              value="All"
              onClick={() => {
                setSelectedWarehouseCategory("");
                setSelectedWarehouse("All")
              }}
              className="flex flex-col items-center justify-center p-2 rounded-md data-[state=active]:bg-[#44743F] data-[state=active]:text-white text-gray-600 hover:bg-gray-200 transition-colors w-20 h-16"
            >
              <GripVertical className="h-5 w-5 mb-0.5" />
              <span className="text-xs font-medium">All</span>
            </TabsTrigger>
            
            <TabsTrigger
              value="Local"
              onClick={() => setSelectedWarehouseCategory("Local")}
              className="flex flex-col items-center justify-center p-2 rounded-md data-[state=active]:bg-[#44743F] data-[state=active]:text-white text-gray-600 hover:bg-gray-200 transition-colors w-20 h-16"
            >
              <MapPin className="h-5 w-5 mb-0.5" />
              <span className="text-xs font-medium">Local</span>
            </TabsTrigger>
            <TabsTrigger
              value="International"
              onClick={() => setSelectedWarehouseCategory("International")}
              className="flex flex-col items-center justify-center p-2 rounded-md data-[state=active]:bg-[#44743F] data-[state=active]:text-white text-gray-600 hover:bg-gray-200 transition-colors w-20 h-16"
            >
              <Globe className="h-5 w-5 mb-0.5" />
              <span className="text-xs font-medium">International</span>
            </TabsTrigger>
            <TabsTrigger
              value="archived"
              onClick={() => {
                setIsArchived(true);
                setSelectedWarehouse('Archived');
                setSelectedWarehouseCategory("");
              }}
              className="flex flex-col items-center justify-center p-2 rounded-md data-[state=active]:bg-[#44743F] data-[state=active]:text-white text-gray-600 hover:bg-gray-200 transition-colors w-20 h-16"
            >
              <DeleteIcon className="h-5 w-5 mb-0.5" />
              <span className="text-xs font-medium">Archived</span>
            </TabsTrigger>
          </TabsList>
        </div>
        <div className='flex flex-row justify-between items-center mt-3 mb-3  '>
          <TabsList className="mb-1 flex items-center justify-start space-x-2 p-1 rounded-lg bg-inherit">
            {selectedWarehouseCategory === "Local" ? warehouses.filter(wh => !wh.international).map((warehouse) => (
              <TabsTrigger
                key={warehouse.id}
                value={warehouse.code}
                onClick={() => setSelectedWarehouse(warehouse.code)}
                className="flex flex-col items-center justify-center p-2 rounded-md data-[state=active]:bg-[#44743F] data-[state=active]:text-white text-gray-600 hover:bg-gray-200 transition-colors w-20 h-16"
              >
                <MapPin className="h-5 w-5 mb-0.5" />
                <span className="text-xs font-medium">{warehouse.code.substring(0, 3).toUpperCase()}</span>
              </TabsTrigger>
            )) : selectedWarehouseCategory === "International" ? warehouses.filter(wh => wh.international).map((warehouse) => (
              <TabsTrigger
                key={warehouse.id}
                value={warehouse.code} // Or a generic 'INT' value if preferred for all international
                onClick={() => setSelectedWarehouse(warehouse.code)} // Or handle international selection differently
                className="flex flex-col items-center justify-center p-2 rounded-md data-[state=active]:bg-[#44743F] data-[state=active]:text-white text-gray-600 hover:bg-gray-200 transition-colors w-20 h-16"
              >
                <Globe className="h-5 w-5 mb-0.5" />
                <span className="text-xs font-medium">{warehouse.code.substring(0, 3).toUpperCase()}</span>
              </TabsTrigger>
            )) : null}
          </TabsList>
        </div>
        <TabsContent value="All">
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
        {/* Add TabsContent for each warehouse dynamically if needed */}
        {warehouses.map((warehouse) => (
          <TabsContent key={warehouse.id} value={warehouse.name}>
            <Card className="shadow-sm">
              <CardContent className="p-0">
                <ShipmentsTable
                  selectedWarehouse={selectedWarehouse}
                  setAction={setAction}
                  lastPage={lastPage}
                  shipments={shipments}
                  currentPage={currentPage}
                  itemsPerPage={itemsPerPage}
                  totalItems={totalItems}
                  setItemsPerPage={setItemsPerPage} // Add this line to pass the setItemsPerPage function to ShipmentsTable as a prop
                  setCurrentPage={setCurrentPage}
                  shipmentsAreLoading={shipmentsAreLoading}
                  setSearchParams={setSearchParams}
                />
              </CardContent>

            </Card>
          </TabsContent>
        ))}

        <TabsContent value="archived">
          <Card className="shadow-sm w-full">
            <CardContent className="p-0">
              <ShipmentsTable
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
                setSearchParams={setSearchParams}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

    </div>
  );
}


