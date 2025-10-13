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
import {
  UserIcon,
  LogOutIcon,
  CogIcon,
  GripVertical,
  MapPin,
  Globe,
  DeleteIcon,
} from "lucide-react"; // Assuming lucide-react for icons
import Image from "next/image";
import { useAuth } from "@/contexts/AuthContext";
import { ShipmentsTable } from "@/components/ShipmentsTable";
import { apiFetch, buildApiUrl } from "@/lib/api/client";

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
  company: string;
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
  const { user, logout, requireAuthToken } = useAuth();

  const userEmail = useMemo(() => {
    if (!user) {
      return '';
    }
    if (typeof user.email === 'string' && user.email.length > 0) {
      return user.email;
    }
    const dataEmail =
      user.data && typeof user.data === 'object'
        ? (user.data as { email?: string | null }).email ?? ''
        : '';
    return typeof dataEmail === 'string' ? dataEmail : '';
  }, [user]);

  const orderedLocalWarehouses = useMemo(() => {
    const preferredOrder = ["BRI", "MEL", "TEX"];

    const matchesPreferredCode = (warehouse: Warehouse, target: string) => {
      const normalizedTarget = target.toUpperCase();
      const normalizedCode = warehouse.code.trim().toUpperCase();
      const normalizedName = warehouse.name.trim().toUpperCase();
      return (
        normalizedCode === normalizedTarget ||
        normalizedName === normalizedTarget ||
        normalizedCode.startsWith(normalizedTarget) ||
        normalizedName.startsWith(normalizedTarget)
      );
    };

    const isConsideredLocal = (warehouse: Warehouse) =>
      !warehouse.international || matchesPreferredCode(warehouse, "BRI");

    const locals = warehouses.filter(isConsideredLocal);
    const available = [...locals];

    const prioritized: Warehouse[] = [];
    preferredOrder.forEach((targetCode) => {
      const matchIndex = available.findIndex((warehouse) =>
        matchesPreferredCode(warehouse, targetCode)
      );
      if (matchIndex !== -1) {
        prioritized.push(available[matchIndex]);
        available.splice(matchIndex, 1);
      }
    });

    return [...prioritized, ...available];
  }, [warehouses]);

  // Logout handler function
  const handleLogout = useCallback(() => {
    logout({ redirectTo: '/login' });
  }, [logout]);

  const handleTopLevelTabChange = useCallback(
    (value: string) => {
      if (value === 'archived') {
        setIsArchived(true);
        setSelectedWarehouse('Archived');
        setSelectedWarehouseCategory('');
        return;
      }

      setIsArchived(false);

      if (value === 'All') {
        setSelectedWarehouse('All');
        setSelectedWarehouseCategory('');
        return;
      }

      if (value === 'International') {
        setSelectedWarehouseCategory('International');
        setSelectedWarehouse('Int');
        return;
      }

      if (value === 'Local') {
        setSelectedWarehouseCategory('Local');
        setSelectedWarehouse('Local');
        return;
      }

      const normalizedValue = value.trim().toLowerCase();
      const matchingWarehouse = warehouses.find((warehouse) => {
        return (
          warehouse.code.toLowerCase() === normalizedValue ||
          warehouse.name.toLowerCase() === normalizedValue
        );
      });

      if (matchingWarehouse) {
        const isBrisbaneSelection =
          normalizedValue === "bri" || normalizedValue === "brisbane";
        const treatAsLocal =
          !matchingWarehouse.international || isBrisbaneSelection;

        setSelectedWarehouseCategory(
          treatAsLocal ? "Local" : "International"
        );
        setSelectedWarehouse(matchingWarehouse.code);
        return;
      }

      setSelectedWarehouse(value);
    },
    [warehouses]
  );

  useEffect(() => {
    const fetchSearchParams = async () => {
      try {
        const token = requireAuthToken();

        const response = await apiFetch('/shipments/search/parameters', {
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
      } catch (err: unknown) {
        console.error('Error fetching search parameters:', err);
      } finally {
      }
    };

    const fetchWarehouses = async () => {
      try {
        const token = requireAuthToken();

        const response = await apiFetch('/platform/warehouses', {
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
        const normalizedWarehouses = (warehousesData as Warehouse[]).map((warehouse) => {
          if (typeof warehouse.code === 'string' && warehouse.code.toUpperCase() === 'BRI') {
            return { ...warehouse, international: false };
          }
          return warehouse;
        });
        setWarehouses(normalizedWarehouses);

      } catch (err: unknown) {
        console.error('Error fetching warehouses:', err);
        const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
        console.error(message);
      } finally {
      }
    };

    fetchWarehouses();
    fetchSearchParams();
  }, [action, requireAuthToken]); // Removed itemsPerPage and currentPage as they are not used in these fetches

  const [isArchived, setIsArchived] = useState(false);

  useEffect(() => {
    (async () => {
      try {

        setShipmentsAreLoading(true);

        const token = requireAuthToken();

        const warehouseSegment = (() => {
          if (selectedWarehouseCategory === 'International') {
            return 'Int';
          }
          if (selectedWarehouse && selectedWarehouse !== 'Archived') {
            if (selectedWarehouse.toUpperCase() === 'BRI') {
              return 'Brisbane';
            }
            return selectedWarehouse;
          }
          return 'All';
        })();
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

        const shipmentsUrl = new URL(buildApiUrl(`/shipments/warehouse/${warehouseSegment}`));
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

        const response = await apiFetch(finalUrl, {
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
      } catch (err: unknown) {
        console.error('Error fetching shipments:', err);
      } finally {
        setShipmentsAreLoading(false);
      }
    })();
    }, [itemsPerPage, currentPage, selectedWarehouse, action, isArchived, searchParams, selectedWarehouseCategory, requireAuthToken]);

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
      <Tabs defaultValue="All" className="w-full" onValueChange={handleTopLevelTabChange}>
        <div>
        <TabsList className={`${selectedWarehouseCategory === "Local" ? 'mb-5' : ''} flex items-center justify-start space-x-2 p-1 rounded-lg bg-inherit`}>
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
              value="archived"
              className="flex flex-col items-center justify-center p-2 rounded-md data-[state=active]:bg-[#44743F] data-[state=active]:text-white text-gray-600 hover:bg-gray-200 transition-colors w-20 h-16"
            >
              <DeleteIcon className="h-5 w-5 mb-0.5" />
              <span className="text-xs font-medium">Archived</span>
            </TabsTrigger>
          </TabsList>
        </div>
        {selectedWarehouseCategory === "Local" && (
          <div className="flex flex-row justify-between items-center mt-3 mb-3">
            <TabsList className="mb-1 flex items-center justify-start space-x-2 p-1 rounded-lg bg-inherit">
              {orderedLocalWarehouses.map((warehouse) => (
                  <TabsTrigger
                    key={warehouse.id}
                    value={warehouse.code}
                    onClick={() => setSelectedWarehouse(warehouse.code)}
                    className="flex flex-col items-center justify-center p-2 rounded-md data-[state=active]:bg-[#44743F] data-[state=active]:text-white text-gray-600 hover:bg-gray-200 transition-colors w-20 h-16"
                  >
                    <MapPin className="h-5 w-5 mb-0.5" />
                    <span className="text-xs font-medium">
                      {warehouse.code.substring(0, 3).toUpperCase()}
                    </span>
                  </TabsTrigger>
                ))}
            </TabsList>
          </div>
        )}
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
        <TabsContent value="Local">
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
        <TabsContent value="International">
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


