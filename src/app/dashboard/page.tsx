'use client';

import { useEffect, useState } from 'react'; 
import { useRouter } from 'next/navigation'; 
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
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
import { ArrowUpIcon, BoxIcon, CheckCircleIcon, DollarSignIcon, SearchIcon, TruckIcon, UserIcon, LogOutIcon, Loader2, CogIcon } from 'lucide-react'; // Assuming lucide-react for icons, Added Loader2 and new icons
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

const getStatusClass = (status: string | null) => {
  if (!status) return 'bg-gray-100 text-gray-800';
  switch (status.toLowerCase()) {
    case 'manifested': return 'bg-green-100 text-green-800';
    case 'label_printed': return 'bg-blue-100 text-blue-800';
    case 'on_hold': return 'bg-yellow-100 text-yellow-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};



export default function DashboardPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loadingWarehouses, setLoadingWarehouses] = useState(true);
  const [warehouseError, setWarehouseError] = useState<string | null>(null);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [searchParams, setSearchParams] = useState<any>(null);
  const [loadingSearchParams, setLoadingSearchParams] = useState(false);
  const [searchParamsError, setSearchParamsError] = useState<string | null>(null);
  const [shipmentError, setShipmentError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [totalItems, setTotalItems] = useState(0);
  const [loadingShipments, setLoadingShipments] = useState(true);
  const [selectedWarehouse, setSelectedWarehouse] = useState("All");
  const [selectedShipmentIds, setSelectedShipmentIds] = useState<number[]>([]);
  const [lastPage, setLastPage] = useState(1); 
  const [action, setAction] = useState(0);
  const router = useRouter();

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
  const handleLogout = () => {
    // Remove the authentication token and user email from localStorage
    localStorage.removeItem('authToken');
    localStorage.removeItem('userEmail');
    // Redirect to the login page
    router.push('/login');
  };

  useEffect(() => {
    const fetchSearchParams = async () => {
      setLoadingSearchParams(true);
      setSearchParamsError(null);
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
        setSearchParams(data);
      } catch (err: any) {
        console.error('Error fetching search parameters:', err);
        setSearchParamsError(err.message || 'An unexpected error occurred.');
      } finally {
        setLoadingSearchParams(false);
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
  }, [itemsPerPage, currentPage, action]);

  useEffect(() => {
    (async () => {
        setLoadingShipments(true);
        setShipmentError(null);
        try {
            const token = localStorage.getItem('authToken');
            if (!token) {
            throw new Error('Authentication token not found. Please log in.');
            }
    
            let url = 'https://ship-orders.vpa.com.au/api/shipments';
            url += `/warehouse/${selectedWarehouse}`;
            url += `?perPage=${itemsPerPage}&page=${currentPage}`;
            
            // Add search parameters if available
            // if (searchParams?.searchParameters) {
            //   const params = new URLSearchParams();
            //   Object.entries(searchParams.searchParameters).forEach(([key, param]: [string, any]) => {
            //     params.append(key, param.column);
            //   });
            //   url += `&${params.toString()}`;
            // }
    
            const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
            },
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
            setShipmentError(err.message || 'An unexpected error occurred.');
        } finally {
            setLoadingShipments(false);
        }
    })();
  }, [itemsPerPage, currentPage, selectedWarehouse, action]);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 p-6">
      <header className="mb-6 flex justify-between items-center"> {/* Added flex layout */} 
        <div className='flex gap-x-3 items-center'> {/* Wrapped existing header content */} 
          <Image src="/vpa-full-logo_410x.avif" alt='VPA Logo' width={80} height={20} />
          <h1 className="text-3xl font-bold text-gray-900">Fulfillments</h1>
          {/* <p className="text-gray-600">Manage and process customer orders</p> */}
        </div>
        {/* Added User Avatar Dropdown */} 
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Avatar className="cursor-pointer">
              <AvatarImage src="" alt={userEmail} />
              <AvatarFallback className='font-bold bg-gray-3  00'>{userEmail.charAt(0).toUpperCase()}</AvatarFallback>
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

      {/* Stats Cards */}
      {/* ... existing stats cards code ... */}
      {/* <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Orders</CardTitle>
            <BoxIcon className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">24</div>
            <p className="text-xs text-muted-foreground flex items-center">
              <ArrowUpIcon className="h-3 w-3 text-green-500 mr-1" /> +12% from last week
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ready for Dispatch</CardTitle>
            <TruckIcon className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">18</div>
            <p className="text-xs text-muted-foreground flex items-center">
              <ArrowUpIcon className="h-3 w-3 text-green-500 mr-1" /> +5% from last week
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Today</CardTitle>
            <CheckCircleIcon className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">42</div>
            <p className="text-xs text-muted-foreground flex items-center">
              <ArrowUpIcon className="h-3 w-3 text-green-500 mr-1" /> +18% from last week
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <DollarSignIcon className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$5,842</div>
            <p className="text-xs text-muted-foreground flex items-center">
              <ArrowUpIcon className="h-3 w-3 text-green-500 mr-1" /> +8% from last week
            </p>
          </CardContent>
        </Card>
      </div> */}


      {/* Tabs and Table */} 
      <Tabs defaultValue="all" className="w-full" onValueChange={(value) => setSelectedWarehouse(value)}>
        <div className='flex flex-row justify-between items-center'>
        <TabsList className="bg-white p-1 rounded-lg shadow-sm mb-4 flex flex-wrap"> {/* Added flex-wrap */} 
          <TabsTrigger value="all" className="text-sm px-4 py-1.5">All Locations</TabsTrigger>
          {loadingWarehouses && (
            <div className="flex items-center px-4 py-1.5 text-sm text-gray-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading Locations...
            </div>
          )}
          {warehouseError && (
            <div className="px-4 py-1.5 text-sm text-red-600">
              Error: {warehouseError}
            </div>
          )}
          {!loadingWarehouses && !warehouseError && warehouses.map((warehouse) => (
            <TabsTrigger
              key={warehouse.id}
              value={warehouse.name} // Use a unique value, e.g., lowercase name or ID
              className="text-sm px-4 py-1.5"
            >
              {warehouse.name}
            </TabsTrigger>
          ))}
          <TabsTrigger value="archived" className="text-sm px-4 py-1.5">Archived</TabsTrigger>
        </TabsList>
        </div>
        <TabsContent value="all">
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
                />
            </CardContent>

          </Card>
          </TabsContent>
        ))}
      </Tabs>

    </div>
  );
}