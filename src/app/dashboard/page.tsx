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
import { ShipmentsTable, type Shipment } from "@/components/ShipmentsTable";
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
    let isMounted = true;

    const normalizeNumber = (
      sources: Array<Record<string, unknown> | undefined>,
      keys: string[]
    ): number | undefined => {
      for (const source of sources) {
        if (!source || typeof source !== "object") {
          continue;
        }
        for (const key of keys) {
          const value = source[key];
          if (typeof value === "number" && !Number.isNaN(value)) {
            return value;
          }
        }
        const meta = source.meta;
        if (meta && typeof meta === "object") {
          for (const key of keys) {
            const metaValue = (meta as Record<string, unknown>)[key];
            if (typeof metaValue === "number" && !Number.isNaN(metaValue)) {
              return metaValue;
            }
          }
        }
      }
      return undefined;
    };

    const normalizeShipmentResponse = (
      payload: unknown
    ): { shipments: Shipment[]; total?: number; lastPage?: number } | null => {
      if (payload == null) {
        return null;
      }

      const visited = new Set<unknown>();
      const rootObject =
        typeof payload === "object" && !Array.isArray(payload)
          ? (payload as Record<string, unknown>)
          : undefined;

      const extract = (
        input: unknown
      ): { shipments: Shipment[]; total?: number; lastPage?: number } | null => {
        if (input == null) {
          return null;
        }
        if (Array.isArray(input)) {
          return {
            shipments: input as Shipment[],
            total: input.length,
            lastPage: 1,
          };
        }
        if (typeof input !== "object") {
          return null;
        }
        if (visited.has(input)) {
          return null;
        }
        visited.add(input);

        const obj = input as Record<string, unknown>;
        const candidateKeys = ["shipments", "data", "items", "results"];

        for (const key of candidateKeys) {
          if (!Object.prototype.hasOwnProperty.call(obj, key)) {
            continue;
          }

          const raw = obj[key];

          if (Array.isArray(raw)) {
            const sources = [obj, rootObject];
            return {
              shipments: raw as Shipment[],
              total:
                normalizeNumber(sources, [
                  "total",
                  "totalItems",
                  "total_items",
                  "count",
                ]) ?? (raw as unknown[]).length,
              lastPage:
                normalizeNumber(sources, [
                  "lastPage",
                  "last_page",
                  "pages",
                  "totalPages",
                  "total_pages",
                ]) ?? 1,
            };
          }

          if (
            raw &&
            typeof raw === "object" &&
            Array.isArray((raw as Record<string, unknown>).data)
          ) {
            const nested = raw as Record<string, unknown>;
            const shipmentsArray = (nested.data as Shipment[]) ?? [];
            const sources = [nested, obj, rootObject];
            return {
              shipments: shipmentsArray,
              total:
                normalizeNumber(sources, [
                  "total",
                  "totalItems",
                  "total_items",
                  "count",
                ]) ?? shipmentsArray.length,
              lastPage:
                normalizeNumber(sources, [
                  "lastPage",
                  "last_page",
                  "pages",
                  "totalPages",
                  "total_pages",
                ]) ?? 1,
            };
          }
        }

        const nestedKeys = ["data", "payload", "result", "results", "meta", "response"];
        for (const key of nestedKeys) {
          const nested = obj[key];
          if (nested === undefined) {
            continue;
          }
          const result = extract(nested);
          if (result) {
            return result;
          }
        }

        return null;
      };

      return extract(payload);
    };

    const applyQueryParams = (url: URL) => {
      url.searchParams.set("perPage", String(itemsPerPage));
      url.searchParams.set("page", String(currentPage));
      url.searchParams.set("archive", isArchived ? "1" : "0");

      const typeSegment = (() => {
        if (isArchived || selectedWarehouse === "Archived") {
          return "archived";
        }
        if (selectedWarehouseCategory === "Local") {
          return "local";
        }
        if (selectedWarehouseCategory === "International") {
          return "international";
        }
        return "all";
      })();
      url.searchParams.set("type", typeSegment);

      if (!searchParams) {
        return;
      }

      const params = searchParams.startsWith("?")
        ? searchParams.slice(1)
        : searchParams;
      const extraParams = new URLSearchParams(params);

      let orderByParam: string | null = null;
      const orderByKeys = ["order_by", "orderBy"];
      for (const key of orderByKeys) {
        const value = extraParams.get(key);
        if (value !== null) {
          orderByParam = value;
          break;
        }
      }
      orderByKeys.forEach((key) => extraParams.delete(key));

      let orderDirectionParam: string | null = null;
      const orderDirectionKeys = [
        "order_by_direction",
        "orderByDirection",
        "orderDirection",
      ];
      for (const key of orderDirectionKeys) {
        const value = extraParams.get(key);
        if (value !== null) {
          orderDirectionParam = value;
          break;
        }
      }
      orderDirectionKeys.forEach((key) => extraParams.delete(key));

      extraParams.forEach((value, key) => {
        url.searchParams.set(key, value);
      });

      if (orderByParam) {
        url.searchParams.set("order_by", orderByParam);
        const normalizedDirection =
          (orderDirectionParam ?? "ASC").toUpperCase() === "DESC"
            ? "DESC"
            : "ASC";
        url.searchParams.set("order_by_direction", normalizedDirection);
      } else if (orderDirectionParam) {
        const normalizedDirection =
          orderDirectionParam.toUpperCase() === "DESC" ? "DESC" : "ASC";
        url.searchParams.set("order_by_direction", normalizedDirection);
      }
    };

    const fetchShipmentsData = async () => {
      setShipmentsAreLoading(true);

      const token = requireAuthToken();

      const warehouseSegment = (() => {
        if (selectedWarehouseCategory === "International") {
          return "Int";
        }
        if (selectedWarehouse && selectedWarehouse !== "Archived") {
          if (selectedWarehouse.toUpperCase() === "BRI") {
            return "Brisbane";
          }
          return selectedWarehouse;
        }
        return "All";
      })();

      const fetchFromEndpoint = async (url: URL) => {
        const response = await apiFetch(url.toString(), {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          method: "GET",
        });

        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          const message =
            payload &&
            typeof payload === "object" &&
            payload !== null &&
            "message" in payload
              ? String((payload as { message?: unknown }).message ?? "")
              : undefined;
          throw new Error(
            message || `Failed to fetch shipments: ${response.statusText}`
          );
        }

        return payload;
      };

      const applyResponse = (payload: unknown) => {
        const normalized = normalizeShipmentResponse(payload);
        if (!normalized) {
          throw new Error("Unexpected shipments response format");
        }
        if (!isMounted) {
          return;
        }
        const shipmentsPayload = Array.isArray(normalized.shipments)
          ? normalized.shipments
          : [];
        setShipments(shipmentsPayload);
        setTotalItems(
          typeof normalized.total === "number"
            ? normalized.total
            : shipmentsPayload.length
        );
        setLastPage(
          typeof normalized.lastPage === "number"
            ? normalized.lastPage
            : 1
        );
      };

      const searchUrl = new URL(buildApiUrl(`/shipments/search`));
      searchUrl.searchParams.set("warehouse", warehouseSegment);
      applyQueryParams(searchUrl);

      try {
        const payload = await fetchFromEndpoint(searchUrl);
        applyResponse(payload);
        return;
      } catch (error) {
        console.warn(
          "Search endpoint did not return usable data, falling back to warehouse listing.",
          error
        );
      }

      const fallbackUrl = new URL(
        buildApiUrl(`/shipments/warehouse/${warehouseSegment}`)
      );
      applyQueryParams(fallbackUrl);

      const payload = await fetchFromEndpoint(fallbackUrl);
      applyResponse(payload);
    };

    fetchShipmentsData().catch((err: unknown) => {
      console.error("Error fetching shipments:", err);
    }).finally(() => {
      if (isMounted) {
        setShipmentsAreLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [
    itemsPerPage,
    currentPage,
    selectedWarehouse,
    action,
    isArchived,
    searchParams,
    selectedWarehouseCategory,
    requireAuthToken,
  ]);

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
                searchParams={searchParams}
                selectedWarehouse={selectedWarehouse}
                setAction={setAction}
                updateShipments={setShipments}
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
                searchParams={searchParams}
                selectedWarehouse={selectedWarehouse}
                setAction={setAction}
                updateShipments={setShipments}
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
                searchParams={searchParams}
                selectedWarehouse={selectedWarehouse}
                setAction={setAction}
                updateShipments={setShipments}
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
                  updateShipments={setShipments}
                  lastPage={lastPage}
                  shipments={shipments}
                  currentPage={currentPage}
                  itemsPerPage={itemsPerPage}
                  totalItems={totalItems}
                  setItemsPerPage={setItemsPerPage} // Add this line to pass the setItemsPerPage function to ShipmentsTable as a prop
                  setCurrentPage={setCurrentPage}
                  shipmentsAreLoading={shipmentsAreLoading}
                  searchParams={searchParams}
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
                updateShipments={setShipments}
                lastPage={lastPage}
                shipments={shipments}
                currentPage={currentPage}
                itemsPerPage={itemsPerPage}
                totalItems={totalItems}
                setItemsPerPage={setItemsPerPage}
                setCurrentPage={setCurrentPage}
                shipmentsAreLoading={shipmentsAreLoading}
                searchParams={searchParams}
                setSearchParams={setSearchParams}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

    </div>
  );
}


