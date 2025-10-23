'use client';

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useLayoutEffect,
  useMemo,
  FormEvent,
} from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Check,
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  Clock,
  DollarSign,
  GripVertical,
  FileText,
  QrCode,
  Send,
  Tag,
  X,
  Printer,
  RotateCcw,
  Trash2,
  Lock,
  Unlock,
  Loader2,
  Search,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ShipmentDetailView,
  type ShipmentDetailResponse,
} from "./ShipmentDetailView";
import { useToast } from "@/hooks/use-toast";
import { PiCubeFocusBold } from "react-icons/pi";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FaLink,
  FaTimes,
  FaTrashRestore,
  FaUser,
  FaCalendarDay,
  FaBuilding,
} from "react-icons/fa";
import { FaLocationDot } from "react-icons/fa6";
import { MdRefresh } from "react-icons/md";
import { GrStatusGood } from "react-icons/gr";
import { PdfViewer } from "./ui/pdf-viewer";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import Image from "next/image";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api/client";

type ShipmentOriginalAddressObject = {
  regionCode?: string | null;
  region_code?: string | null;
  region?: string | null;
  state?: string | null;
  province?: string | null;
  provinceCode?: string | null;
  province_code?: string | null;
  [key: string]: unknown;
};

export interface Shipment {
  id: number;
  shopifyId: number;
  shopifyOrderNumber: string;
  orderName: string;
  company: string;
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
  potentialNewLabel?: boolean;
  unlDone: boolean;
  sent: boolean;
  invoicePrinted: boolean;
  selectedQuoteId?: number | null;
  manifested: boolean;
  status: string | null;
  carrierCodeDesired: string;
  store?: {
    id: number;
    shop: string;
    name: string | null;
    countryCode: string | null;
    weightId: string | null;
    measurementId: string | null;
    active: number;
  } | null;
  quotes: Array<{
    carrierCodeDesired: string;
    carrierCode: string;
    serviceCode: string;
    costIncludingTax: string;
    carrier?: {
      name?: string | null;
      manual?: boolean;
      code?: string | null;
      color?: string | null;
    };
    color?: string | null;
  }>;
  orderDate: number;
  totalPrice: string;
  lastApiUpdate: number;
  statusId?: number | null;
  originalAddress?: ShipmentOriginalAddressObject | string | null;
}

interface StatusOption {
  value: string;
  label: string;
  allowShipped: boolean;
  greenTick: boolean;
}

interface CarrierSummary {
  id: number;
  code: string;
  name: string;
  color: string | null;
}

type CarriersResponse = {
  success: boolean;
  carriers?: Record<string, CarrierSummary>;
};

type SearchParameterOption =
  | string
  | number
  | {
      value?: string | number;
      label?: string | null;
      name?: string | null;
      title?: string | null;
      id?: string | number;
      code?: string | number;
      allowShipped?: boolean;
      allow_shipped?: boolean;
      greenTick?: boolean;
      green_tick?: boolean;
      [key: string]: unknown;
    };

type SearchParameter = {
  name: string;
  column: string;
  type: string;
  weight?: number;
  options?: SearchParameterOption[];
};

type SearchParametersResponse = {
  success: boolean;
  searchParameters?: Record<string, SearchParameter>;
};
type NormalizedSearchOption = {
  value: string;
  label: string;
};

const normalizeSearchParameterOption = (
  option: SearchParameterOption
): NormalizedSearchOption | null => {
  if (option == null) {
    return null;
  }

  if (typeof option === "string" || typeof option === "number") {
    const value = String(option).trim();
    if (!value) {
      return null;
    }
    return {
      value,
      label: value,
    };
  }

  if (typeof option === "object") {
    const record = option as Record<string, unknown>;
    const rawValue =
      record.value ??
      record.id ??
      record.code ??
      record.label ??
      record.name ??
      record.title ??
      null;
    const value =
      rawValue != null && rawValue !== undefined ? String(rawValue).trim() : "";
    if (!value) {
      return null;
    }

    const rawLabel = record.label ?? record.name ?? record.title ?? rawValue;
    const label =
      rawLabel != null && rawLabel !== undefined ? String(rawLabel) : value;

    return {
      value,
      label,
    };
  }

  return null;
};

const normalizeSearchParameterOptions = (
  options?: SearchParameterOption[]
): NormalizedSearchOption[] => {
  if (!Array.isArray(options)) {
    return [];
  }

  const seen = new Set<string>();
  const normalized: NormalizedSearchOption[] = [];

  options.forEach((option) => {
    const normalizedOption = normalizeSearchParameterOption(option);
    if (!normalizedOption) {
      return;
    }
    if (seen.has(normalizedOption.value)) {
      return;
    }
    seen.add(normalizedOption.value);
    normalized.push(normalizedOption);
  });

  return normalized;
};

const STATUS_INDICATOR_KEYS = new Set([
  "statuschanged",
  "status_changed",
  "statusupdates",
  "status_updates",
  "statuschangeids",
  "status_change_ids",
  "updatedshipmentids",
  "updated_shipments",
  "updated_shipments_ids",
  "changedshipments",
  "changed_shipments",
]);

const SHIPMENT_COLLECTION_KEYS = new Set([
  "shipments",
  "items",
  "data",
  "results",
  "payload",
  "response",
  "records",
  "updatedshipments",
  "updated_shipments",
]);

const POSITIVE_STATUS_TOKENS = [
  "printed",
  "label printed",
  "label_printed",
  "labelled",
  "label-generated",
  "label generated",
  "labelled printed",
  "printed successfully",
  "printed_successfully",
];

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
};

const toBoolean = (value: unknown): boolean | null => {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    if (value === 1) {
      return true;
    }
    if (value === 0) {
      return false;
    }
    return null;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return null;
    }
    if (["true", "1", "yes", "y"].includes(normalized)) {
      return true;
    }
    if (["false", "0", "no", "n"].includes(normalized)) {
      return false;
    }
  }
  return null;
};

const normalizeRegionFragment = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed;
};

const extractRegionCodeFromAddressObject = (
  address: ShipmentOriginalAddressObject | null | undefined
): string | null => {
  if (!address || typeof address !== "object") {
    return null;
  }

  const candidate =
    address.regionCode ??
    address.region_code ??
    address.provinceCode ??
    address.province_code ??
    address.state ??
    address.region ??
    address.province;

  return normalizeRegionFragment(candidate);
};

const extractOriginalRegionCode = (originalAddress: unknown): string | null => {
  if (!originalAddress) {
    return null;
  }

  if (typeof originalAddress === "string") {
    const trimmed = originalAddress.trim();
    if (!trimmed) {
      return null;
    }
    try {
      const parsed = JSON.parse(
        trimmed
      ) as ShipmentOriginalAddressObject | null;
      const extracted = extractRegionCodeFromAddressObject(parsed);
      if (extracted) {
        return extracted;
      }
    } catch {
      // If the string is not JSON, fall back to treating it as the region fragment itself.
      const normalized = normalizeRegionFragment(trimmed);
      if (normalized) {
        return normalized;
      }
    }
    return null;
  }

  if (typeof originalAddress === "object") {
    return extractRegionCodeFromAddressObject(
      originalAddress as ShipmentOriginalAddressObject
    );
  }

  return null;
};

const extractStatusChangedShipmentIds = (
  payload: unknown,
  fallbackIds: number[]
): number[] => {
  const changed = new Set<number>();
  const visited = new Set<unknown>();

  const pushId = (candidate: unknown) => {
    const id = toNumber(candidate);
    if (id != null) {
      changed.add(id);
    }
  };

  const indicatesPrintedStatus = (rawStatus: unknown): boolean => {
    if (typeof rawStatus !== "string") {
      return false;
    }

    const normalized = rawStatus.trim().toLowerCase();
    if (!normalized) {
      return false;
    }

    if (normalized.startsWith("not ") || normalized.includes("not printed")) {
      return false;
    }

    if (POSITIVE_STATUS_TOKENS.some((token) => normalized.includes(token))) {
      return true;
    }

    return normalized.includes("printed") || normalized.includes("labelled");
  };

  const considerShipmentLike = (value: unknown) => {
    if (!value || typeof value !== "object") {
      return;
    }

    const candidate = value as Record<string, unknown>;
    const id =
      toNumber(candidate.id) ??
      toNumber(candidate.shipmentId) ??
      toNumber(candidate.shipment_id);

    if (id == null) {
      return;
    }

    const statusFlag =
      toBoolean(candidate.statusChanged) ??
      toBoolean(candidate.status_changed) ??
      toBoolean(candidate.statusUpdated) ??
      toBoolean(candidate.status_updated) ??
      toBoolean(candidate.statusHasChanged) ??
      toBoolean(candidate.status_has_changed);

    const labelFlag =
      toBoolean(candidate.labelPrinted) ??
      toBoolean(candidate.label_printed) ??
      toBoolean(candidate.labelStatus) ??
      toBoolean(candidate.label_status);

    const statusValue =
      candidate.status ??
      candidate.statusCode ??
      candidate.status_code ??
      candidate.state ??
      candidate.currentStatus ??
      candidate.current_status;

    if (
      statusFlag === true ||
      labelFlag === true ||
      indicatesPrintedStatus(statusValue)
    ) {
      changed.add(id);
    }
  };

  const traverse = (value: unknown): void => {
    if (value == null) {
      return;
    }

    if (Array.isArray(value)) {
      if (visited.has(value)) {
        return;
      }
      visited.add(value);
      value.forEach((entry) => {
        considerShipmentLike(entry);
        traverse(entry);
      });
      return;
    }

    if (typeof value !== "object") {
      return;
    }

    if (visited.has(value)) {
      return;
    }
    visited.add(value);

    const obj = value as Record<string, unknown>;
    considerShipmentLike(obj);

    Object.entries(obj).forEach(([key, child]) => {
      const normalizedKey = key.trim().toLowerCase();

      if (STATUS_INDICATOR_KEYS.has(normalizedKey)) {
        const boolValue = toBoolean(child);
        if (boolValue === true) {
          fallbackIds.forEach((id) => changed.add(id));
          return;
        }
        if (Array.isArray(child)) {
          child.forEach((entry) => pushId(entry));
        } else {
          pushId(child);
        }
        return;
      }

      if (SHIPMENT_COLLECTION_KEYS.has(normalizedKey)) {
        traverse(child);
        return;
      }

      traverse(child);
    });
  };

  traverse(payload);

  if (changed.size === 0) {
    if (Array.isArray(payload)) {
      payload.forEach((entry) => pushId(entry));
    } else {
      pushId(payload);
    }
  }

  return Array.from(changed.values());
};

type LabelGenerationResult = {
  statusChangedShipmentIds: number[];
  payload?: unknown;
};

const resolveInputTypeForSearchField = (
  field: SearchParameter
): "text" | "number" | "date" => {
  const type = field.type ? field.type.toLowerCase() : "";
  if (type.includes("date")) {
    return "date";
  }
  if (
    type.includes("number") ||
    type.includes("numeric") ||
    type.includes("decimal") ||
    type.includes("int")
  ) {
    return "number";
  }
  return "text";
};

type StatusApiStatus = {
  id: number;
  name: string;
  allowShipped: boolean;
  greenTick: boolean;
};

type StatusApiResponse = {
  success: boolean;
  statuses?: StatusApiStatus[];
};

type ApiSuccessResponse = {
  success: boolean;
  message?: string;
  [key: string]: unknown;
};

type OrderDateFieldConfig = {
  from: { key: string; column: string } | null;
  to: { key: string; column: string } | null;
  single: { key: string; column: string } | null;
};

type ShipmentDetailForQuote = NonNullable<ShipmentDetailResponse["shipment"]>;
type ShipmentQuoteDetail = NonNullable<
  ShipmentDetailForQuote["quotes"]
>[number];

const normalizeQuoteValue = (value?: string | null): string | null =>
  typeof value === "string" ? value.trim().toLowerCase() : null;

const findDefaultQuoteForShipment = (
  detail: ShipmentDetailForQuote
): ShipmentQuoteDetail | null => {
  const quotes = detail.quotes ?? [];

  if (quotes.length === 0) {
    return null;
  }

  const currentCarrier = normalizeQuoteValue(
    detail.carrierCode ?? detail.carrierCodeDesired ?? null
  );
  const currentService = normalizeQuoteValue(
    detail.serviceCode ?? detail.serviceCodeDesired ?? null
  );
  const desiredCarrier = normalizeQuoteValue(detail.carrierCodeDesired ?? null);
  const desiredService = normalizeQuoteValue(detail.serviceCodeDesired ?? null);
  const persistedQuoteId =
    typeof detail.selectedQuoteId === "number" &&
    !Number.isNaN(detail.selectedQuoteId)
      ? detail.selectedQuoteId
      : null;

  if (persistedQuoteId !== null) {
    const byId = quotes.find((quote) => quote.id === persistedQuoteId);
    if (byId) {
      return byId;
    }
  }

  if (currentCarrier) {
    const byCurrent = quotes.find((quote) => {
      const quoteCarrier = normalizeQuoteValue(quote.carrierCode);
      const quoteService = normalizeQuoteValue(quote.serviceCode);
      if (quoteCarrier !== currentCarrier) {
        return false;
      }
      if (currentService && quoteService !== currentService) {
        return false;
      }
      return true;
    });

    if (byCurrent) {
      return byCurrent;
    }
  }

  if (desiredCarrier) {
    const byDesired = quotes.find((quote) => {
      const quoteCarrier = normalizeQuoteValue(quote.carrierCode);
      const quoteService = normalizeQuoteValue(quote.serviceCode);
      if (quoteCarrier !== desiredCarrier) {
        return false;
      }
      if (desiredService && quoteService !== desiredService) {
        return false;
      }
      return true;
    });

    if (byDesired) {
      return byDesired;
    }
  }

  return quotes[0] ?? null;
};

type SortDirection = "ASC" | "DESC";
type SortTarget =
  | "shopifyOrderNumber"
  | "orderName"
  | "orderDate"
  | "totalPrice"
  | "lastApiUpdate";
type SortColumnConfig = Record<SortTarget, string>;
const SORT_FALLBACK_COLUMNS: Record<SortTarget, string> = {
  shopifyOrderNumber: "shopify_order_number",
  orderName: "order_name",
  orderDate: "order_date",
  totalPrice: "total_price",
  lastApiUpdate: "last_api_update",
};

const ORDER_BY_PARAM_KEYS = ["order_by", "orderBy"] as const;
const ORDER_DIRECTION_PARAM_KEYS = [
  "order_by_direction",
  "orderByDirection",
  "orderDirection",
] as const;

const RESERVED_QUERY_KEYS = new Set<string>([
  ...ORDER_BY_PARAM_KEYS,
  ...ORDER_DIRECTION_PARAM_KEYS,
]);

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === "string" && error.length > 0) {
    return error;
  }
  return fallback;
};

const defaultStatusOptions: StatusOption[] = [];

type ShipmentsTableProps = {
  setAction: React.Dispatch<React.SetStateAction<number>>; // ADDED ACTION TRACKER FOR ACTIONS ON SHIPMENTS DAT
  updateShipments: React.Dispatch<React.SetStateAction<Shipment[]>>;
  shipments: Shipment[];
  currentPage: number;
  itemsPerPage: number;
  totalItems: number;
  lastPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  setItemsPerPage: React.Dispatch<React.SetStateAction<number>>;
  selectedWarehouse: string | null;
  shipmentsAreLoading: boolean;
  searchParams: string;
  setSearchParams: React.Dispatch<React.SetStateAction<string>>;
};

type EdgePosition = "top" | "bottom" | "left" | "right";

type RefreshShipmentsResult = {
  successes: number[];
  failures: Array<{ id: number; message: string }>;
};

const MemoizedShipmentDetailView = React.memo(ShipmentDetailView);

export function ShipmentsTable({
  setSearchParams,
  setAction,
  updateShipments,
  shipments,
  currentPage,
  setCurrentPage,
  lastPage,
  selectedWarehouse,
  shipmentsAreLoading,
  searchParams,
}: ShipmentsTableProps) {
  const [selectedShipmentId, setSelectedShipmentId] = useState<number | null>(
    null
  );
  const [selectedRows, setSelectedRows] = useState<Record<number, boolean>>({});
  const [pdfUrl, setPdfUrl] = useState<string>("");
  const { toast } = useToast();
  const { requireAuthToken } = useAuth();
  const getSelectedShipmentIds = useCallback(() => {
    return Object.entries(selectedRows)
      .filter(([, isChecked]) => isChecked)
      .map(([id]) => Number(id));
  }, [selectedRows]);
  const getAuthToken = useCallback(() => {
    try {
      return requireAuthToken();
    } catch (error) {
      toast({
        title: "Authentication Error",
        description: "Your session has expired. Please log in again.",
        variant: "destructive",
      });
      throw error instanceof Error
        ? error
        : new Error("User is not authenticated.");
    }
  }, [requireAuthToken, toast]);

  const updateShipmentsByIds = useCallback(
    (ids: number[], updater: (shipment: Shipment) => Shipment) => {
      if (ids.length === 0) {
        return;
      }
      const idSet = new Set(ids);
      updateShipments((previous) =>
        previous.map((shipment) =>
          idSet.has(shipment.id) ? updater(shipment) : shipment
        )
      );
    },
    [updateShipments]
  );

  const [isPdfOpen, setIsPdfOpen] = useState(false);
  const [pdfTitle, setPdfTitle] = useState<string>("");
  const [detailedShipment, setDetailedShipment] =
    useState<ShipmentDetailResponse | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [statusOptions, setStatusOptions] =
    useState<StatusOption[]>(defaultStatusOptions);
  const [isLoadingStatuses, setIsLoadingStatuses] = useState(true);
  const [carrierColors, setCarrierColors] = useState<Record<string, string>>(
    {}
  );
  const [areSearchParamsLoading, setLoadingSearchParams] = useState(false);
  const [searchFields, setSearchFields] = useState<
    Record<string, SearchParameter>
  >({});
  const [selectedSearchFieldKey, setSelectedSearchFieldKey] = useState<
    string | null
  >(null);
  const [draftSearchValues, setDraftSearchValues] = useState<
    Record<string, string>
  >({});
  const [detailAction, setDetailAction] = useState(0);
  const [sortColumn, setSortColumn] = useState<SortTarget | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("ASC");
  const [currentTimeMs, setCurrentTimeMs] = useState<number | null>(null);

  useEffect(() => {
    const update = () => setCurrentTimeMs(Date.now());
    update();
    const intervalId = window.setInterval(update, 60000);
    return () => window.clearInterval(intervalId);
  }, []);

  const currentTimeSeconds = useMemo(
    () => (currentTimeMs == null ? null : Math.floor(currentTimeMs / 1000)),
    [currentTimeMs]
  );

  const formatRelativeTime = useCallback(
    (timestamp: number) => {
      if (currentTimeSeconds == null) {
        return "--";
      }

      const seconds = Math.max(0, currentTimeSeconds - timestamp);

      if (seconds < 60) return `${seconds}s`;
      if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
      if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
      if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d`;
      if (seconds < 31536000) return `${Math.floor(seconds / 2592000)}mo`;
      const years = Math.floor(seconds / 31536000);
      return `${years}y`;
    },
    [currentTimeSeconds]
  );

  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [edge, setEdge] = useState<EdgePosition>("bottom");
  const toolbarRef = useRef<HTMLDivElement>(null);
  const getDefaultToolbarPosition = useCallback(() => {
    if (!toolbarRef.current) {
      return null;
    }

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const toolbarWidth = toolbarRef.current.offsetWidth;
    const toolbarHeight = toolbarRef.current.offsetHeight;

    return {
      x: Math.max(20, (viewportWidth - toolbarWidth) / 2),
      y: viewportHeight - toolbarHeight - 20,
    };
  }, []);

  const repositionToolbar = useCallback(() => {
    const defaultPosition = getDefaultToolbarPosition();

    if (!defaultPosition) {
      return false;
    }

    setEdge("bottom");
    setPosition(defaultPosition);
    return true;
  }, [getDefaultToolbarPosition]);

  // Function to fetch shipments with search parameters
  const fetchShipments = useCallback(async () => {
    try {
      // Notify parent component that an action is being performed
      setAction((prev) => prev + 1);
    } catch (error: unknown) {
      console.error("Error in fetchShipments:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch shipments.",
      });
    }
  }, [setAction, toast]);

  const findSearchField = useCallback(
    (
      matchers: string[],
      options: { matchAll?: boolean } = {}
    ): { key: string; column: string } | null => {
      if (!searchFields || Object.keys(searchFields).length === 0) {
        return null;
      }

      const lowerMatchers = matchers.map((matcher) => matcher.toLowerCase());
      const entry = Object.entries(searchFields).find(([key, field]) => {
        const haystack = `${key} ${field.column} ${field.name}`.toLowerCase();
        if (options.matchAll) {
          return lowerMatchers.every((matcher) => haystack.includes(matcher));
        }
        return lowerMatchers.some((matcher) => haystack.includes(matcher));
      });

      return entry ? { key: entry[0], column: entry[1].column } : null;
    },
    [searchFields]
  );

  const fetchShipmentDetail = useCallback(
    async (shipmentId: number, signal?: AbortSignal) => {
      const token = getAuthToken();
      const response = await apiFetch(
        `/shipments/${shipmentId}?columns=otherShipments,orderLines,shipmentPackages,shipmentQuotes`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          signal,
        }
      );

      const responseData = (await response
        .json()
        .catch(() => null)) as ShipmentDetailResponse | null;

      if (!response.ok || !responseData) {
        const message =
          responseData &&
          typeof responseData === "object" &&
          responseData !== null &&
          "message" in responseData
            ? String((responseData as { message?: unknown }).message ?? "")
            : undefined;
        throw new Error(message || "Failed to fetch shipment details");
      }

      return responseData;
    },
    [getAuthToken]
  );

  const handleShipmentDetailFetchError = useCallback(
    (error: unknown) => {
      console.error("Error fetching shipment details:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: getErrorMessage(
          error,
          "Failed to fetch shipment details."
        ),
      });
    },
    [toast]
  );

  const refreshOpenShipmentDetail = useCallback(async () => {
    if (!selectedShipmentId) {
      return;
    }

    setIsLoadingDetail(true);
    try {
      const data = await fetchShipmentDetail(selectedShipmentId);
      setDetailedShipment(data);
    } catch (error: unknown) {
      handleShipmentDetailFetchError(error);
      setDetailedShipment(null);
    } finally {
      setIsLoadingDetail(false);
    }
  }, [fetchShipmentDetail, handleShipmentDetailFetchError, selectedShipmentId]);

  const orderDateFieldConfig = useMemo<OrderDateFieldConfig>(() => {
    if (!searchFields || Object.keys(searchFields).length === 0) {
      return { from: null, to: null, single: null };
    }

    const orderEntries = Object.entries(searchFields).filter(([key, field]) => {
      const combined = `${key} ${field.column} ${field.name}`.toLowerCase();
      return combined.includes("order") && combined.includes("date");
    });

    if (orderEntries.length === 0) {
      return { from: null, to: null, single: null };
    }

    const findEntry = (targets: string[]) =>
      orderEntries.find(([key, field]) => {
        const combined = `${key} ${field.column} ${field.name}`.toLowerCase();
        return targets.some((target) => combined.includes(target));
      });

    const fromEntry =
      findEntry(["from", "start", "after", ">="]) ??
      findEntry(["lower", "min"]);

    const toEntry =
      findEntry(["to", "end", "before", "<="]) ?? findEntry(["upper", "max"]);

    if (fromEntry && toEntry) {
      return {
        from: { key: fromEntry[0], column: fromEntry[1].column },
        to: { key: toEntry[0], column: toEntry[1].column },
        single: null,
      };
    }

    if (orderEntries.length === 1) {
      const [singleKey, singleField] = orderEntries[0];
      return {
        from: null,
        to: null,
        single: { key: singleKey, column: singleField.column },
      };
    }

    if (fromEntry && !toEntry) {
      const fallback = orderEntries.find(([key]) => key !== fromEntry[0]);
      if (fallback) {
        return {
          from: { key: fromEntry[0], column: fromEntry[1].column },
          to: { key: fallback[0], column: fallback[1].column },
          single: null,
        };
      }
    }

    if (!fromEntry && toEntry) {
      const fallback = orderEntries.find(([key]) => key !== toEntry[0]);
      if (fallback) {
        return {
          from: { key: fallback[0], column: fallback[1].column },
          to: { key: toEntry[0], column: toEntry[1].column },
          single: null,
        };
      }
    }

    const [singleKey, singleField] = orderEntries[0];
    return {
      from: null,
      to: null,
      single: { key: singleKey, column: singleField.column },
    };
  }, [searchFields]);

  const sortColumnConfig = useMemo<SortColumnConfig>(() => {
    const resolveColumn = (
      candidates: Array<{
        matchers: string[];
        options?: { matchAll?: boolean };
      }>
    ): string | null => {
      for (const candidate of candidates) {
        const match = findSearchField(candidate.matchers, candidate.options);
        if (match) {
          return match.column;
        }
      }
      return null;
    };

    const orderDateColumn =
      orderDateFieldConfig.single?.column ??
      orderDateFieldConfig.from?.column ??
      orderDateFieldConfig.to?.column ??
      resolveColumn([
        { matchers: ["order_date"] },
        { matchers: ["order", "date"], options: { matchAll: true } },
      ]);

    return {
      shopifyOrderNumber:
        resolveColumn([
          { matchers: ["shopify_order_number"] },
          { matchers: ["order_number"] },
          {
            matchers: ["shopify", "order", "number"],
            options: { matchAll: true },
          },
        ]) ?? SORT_FALLBACK_COLUMNS.shopifyOrderNumber,
      orderName:
        resolveColumn([
          { matchers: ["order_name"] },
          { matchers: ["order", "name"], options: { matchAll: true } },
        ]) ?? SORT_FALLBACK_COLUMNS.orderName,
      orderDate: orderDateColumn ?? SORT_FALLBACK_COLUMNS.orderDate,
      totalPrice:
        resolveColumn([
          { matchers: ["total_price"] },
          { matchers: ["order_total"] },
          { matchers: ["total", "price"], options: { matchAll: true } },
        ]) ?? SORT_FALLBACK_COLUMNS.totalPrice,
      lastApiUpdate:
        resolveColumn([
          { matchers: ["last_api_update"] },
          { matchers: ["api_update"] },
          {
            matchers: ["last", "api", "update"],
            options: { matchAll: true },
          },
        ]) ?? SORT_FALLBACK_COLUMNS.lastApiUpdate,
    };
  }, [findSearchField, orderDateFieldConfig]);

  const sortTargetByColumn = useMemo(() => {
    return (
      Object.entries(sortColumnConfig) as Array<[SortTarget, string]>
    ).reduce((acc, [target, column]) => {
      const resolved = column ?? SORT_FALLBACK_COLUMNS[target];
      acc[resolved] = target;
      return acc;
    }, {} as Record<string, SortTarget>);
  }, [sortColumnConfig]);

  const resolveSortColumn = useCallback(
    (target: SortTarget | null) =>
      target ? sortColumnConfig[target] ?? SORT_FALLBACK_COLUMNS[target] : null,
    [sortColumnConfig]
  );

  const searchParameterEntries = useMemo(() => {
    const entries = Object.entries(searchFields);
    if (entries.length === 0) {
      return [] as Array<[string, SearchParameter]>;
    }

    const weightOf = (field: SearchParameter) =>
      typeof field.weight === "number" && !Number.isNaN(field.weight)
        ? field.weight
        : Number.MAX_SAFE_INTEGER;

    return entries.sort((a, b) => {
      const weightDiff = weightOf(a[1]) - weightOf(b[1]);
      if (weightDiff !== 0) {
        return weightDiff;
      }
      const nameA = String(a[1].name ?? a[0]).toLowerCase();
      const nameB = String(b[1].name ?? b[0]).toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [searchFields]);

  const searchParameterOrder = useMemo(() => {
    const map = new Map<string, number>();
    searchParameterEntries.forEach(([key], index) => {
      map.set(key, index);
    });
    return map;
  }, [searchParameterEntries]);

  const normalizedOptionsByKey = useMemo(() => {
    const map: Record<string, NormalizedSearchOption[]> = {};
    Object.entries(searchFields).forEach(([key, field]) => {
      const normalized = normalizeSearchParameterOptions(field.options);
      if (normalized.length > 0) {
        map[key] = normalized;
      }
    });
    return map;
  }, [searchFields]);

  const activeFilters = useMemo(() => {
    const normalizedBase =
      searchParams && searchParams.startsWith("?")
        ? searchParams.slice(1)
        : searchParams ?? "";

    if (!normalizedBase) {
      return [] as Array<{
        key: string;
        value: string;
        parameter: SearchParameter;
      }>;
    }

    const params = new URLSearchParams(normalizedBase);
    const seenKeys = new Set<string>();
    const entries: Array<{
      key: string;
      value: string;
      parameter: SearchParameter;
    }> = [];

    params.forEach((_, key) => {
      if (seenKeys.has(key)) {
        return;
      }
      seenKeys.add(key);
      if (RESERVED_QUERY_KEYS.has(key)) {
        return;
      }
      const parameter = searchFields[key];
      if (!parameter) {
        return;
      }
      const value = params.get(key);
      if (value === null) {
        return;
      }
      entries.push({ key, value, parameter });
    });

    entries.sort((a, b) => {
      const orderA = searchParameterOrder.get(a.key) ?? Number.MAX_SAFE_INTEGER;
      const orderB = searchParameterOrder.get(b.key) ?? Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      const labelA = String(a.parameter.name ?? a.key).toLowerCase();
      const labelB = String(b.parameter.name ?? b.key).toLowerCase();
      return labelA.localeCompare(labelB);
    });

    return entries;
  }, [searchFields, searchParameterOrder, searchParams]);

  useEffect(() => {
    if (searchParameterEntries.length === 0) {
      if (selectedSearchFieldKey !== null) {
        setSelectedSearchFieldKey(null);
      }
      return;
    }

    if (selectedSearchFieldKey && searchFields[selectedSearchFieldKey]) {
      return;
    }

    const [firstKey] = searchParameterEntries[0];
    setSelectedSearchFieldKey(firstKey);
  }, [searchFields, searchParameterEntries, selectedSearchFieldKey]);

  useEffect(() => {
    const normalizedBase =
      searchParams && searchParams.startsWith("?")
        ? searchParams.slice(1)
        : searchParams ?? "";

    if (!normalizedBase) {
      setDraftSearchValues((previous) => {
        if (Object.keys(previous).length === 0) {
          return previous;
        }
        return {};
      });
      return;
    }

    const params = new URLSearchParams(normalizedBase);
    const next: Record<string, string> = {};
    params.forEach((value, key) => {
      if (searchFields[key]) {
        next[key] = value;
      }
    });

    setDraftSearchValues((previous) => {
      const prevKeys = Object.keys(previous);
      const nextKeys = Object.keys(next);
      if (
        prevKeys.length === nextKeys.length &&
        prevKeys.every((key) => previous[key] === next[key])
      ) {
        return previous;
      }
      return next;
    });
  }, [searchFields, searchParams]);

  const selectedSearchField = selectedSearchFieldKey
    ? searchFields[selectedSearchFieldKey] ?? null
    : null;

  const selectedFieldOptions: NormalizedSearchOption[] = selectedSearchFieldKey
    ? normalizedOptionsByKey[selectedSearchFieldKey] ?? []
    : [];

  const selectedFieldRawValue = selectedSearchFieldKey
    ? draftSearchValues[selectedSearchFieldKey] ?? ""
    : "";

  const hasOptionList = selectedFieldOptions.length > 0;
  const normalizedFieldValue = hasOptionList
    ? selectedFieldRawValue
    : selectedFieldRawValue.trim();
  const hasDraftValue = hasOptionList
    ? selectedFieldRawValue !== undefined && selectedFieldRawValue !== ""
    : normalizedFieldValue.length > 0;

  const selectedInputType = selectedSearchField
    ? resolveInputTypeForSearchField(selectedSearchField)
    : "text";

  const isApplyDisabled =
    areSearchParamsLoading || !selectedSearchFieldKey || !hasDraftValue;
  const isClearDisabled =
    areSearchParamsLoading || (activeFilters.length === 0 && !hasDraftValue);

  const updateSearchParamsWith = useCallback(
    (updater: (params: URLSearchParams) => void) => {
      const normalizedBase =
        searchParams && searchParams.startsWith("?")
          ? searchParams.slice(1)
          : searchParams ?? "";
      const params = new URLSearchParams(normalizedBase);
      const before = params.toString();

      updater(params);

      const nextQuery = params.toString();
      if (nextQuery === before) {
        return;
      }

      setSearchParams(nextQuery);
      setCurrentPage(1);
      fetchShipments();
    },
    [fetchShipments, searchParams, setCurrentPage, setSearchParams]
  );

  const handleDraftValueUpdate = useCallback(
    (value: string) => {
      if (!selectedSearchFieldKey) {
        return;
      }
      setDraftSearchValues((previous) => {
        if (previous[selectedSearchFieldKey] === value) {
          return previous;
        }
        return {
          ...previous,
          [selectedSearchFieldKey]: value,
        };
      });
    },
    [selectedSearchFieldKey, setDraftSearchValues]
  );

  const handleFilterSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!selectedSearchFieldKey) {
        return;
      }

      const rawValue = draftSearchValues[selectedSearchFieldKey] ?? "";
      const valueForQuery = hasOptionList ? rawValue : rawValue.trim();

      if (!valueForQuery) {
        updateSearchParamsWith((params) => {
          if (params.has(selectedSearchFieldKey)) {
            params.delete(selectedSearchFieldKey);
          }
        });
        setDraftSearchValues((previous) => {
          if (!(selectedSearchFieldKey in previous)) {
            return previous;
          }
          const next = { ...previous };
          delete next[selectedSearchFieldKey];
          return next;
        });
        return;
      }

      updateSearchParamsWith((params) => {
        params.delete(selectedSearchFieldKey);
        params.set(selectedSearchFieldKey, valueForQuery);
      });

      if (valueForQuery !== rawValue) {
        setDraftSearchValues((previous) => ({
          ...previous,
          [selectedSearchFieldKey]: valueForQuery,
        }));
      }
    },
    [
      draftSearchValues,
      hasOptionList,
      selectedSearchFieldKey,
      setDraftSearchValues,
      updateSearchParamsWith,
    ]
  );

  const handleRemoveFilter = useCallback(
    (key: string) => {
      setDraftSearchValues((previous) => {
        if (!(key in previous)) {
          return previous;
        }
        const next = { ...previous };
        delete next[key];
        return next;
      });
      updateSearchParamsWith((params) => {
        if (params.has(key)) {
          params.delete(key);
        }
      });
    },
    [setDraftSearchValues, updateSearchParamsWith]
  );

  const handleResetFilters = useCallback(() => {
    setDraftSearchValues((previous) => {
      if (Object.keys(previous).length === 0) {
        return previous;
      }
      return {};
    });
    updateSearchParamsWith((params) => {
      let modified = false;
      Object.keys(searchFields).forEach((key) => {
        if (params.has(key)) {
          params.delete(key);
          modified = true;
        }
      });

      if (
        !modified &&
        selectedSearchFieldKey &&
        params.has(selectedSearchFieldKey)
      ) {
        params.delete(selectedSearchFieldKey);
      }
    });
  }, [
    searchFields,
    selectedSearchFieldKey,
    setDraftSearchValues,
    updateSearchParamsWith,
  ]);

  const getFilterValueLabel = useCallback(
    (key: string, value: string) => {
      const options = normalizedOptionsByKey[key];
      if (options) {
        const match = options.find((option) => option.value === value);
        if (match) {
          return match.label;
        }
      }
      return value;
    },
    [normalizedOptionsByKey]
  );

  useEffect(() => {
    const raw = searchParams
      ? searchParams.startsWith("?")
        ? searchParams.slice(1)
        : searchParams
      : "";
    const params = new URLSearchParams(raw);

    let detectedTarget: SortTarget | null = null;
    for (const key of ORDER_BY_PARAM_KEYS) {
      const candidate = params.get(key);
      if (candidate) {
        const mapped = sortTargetByColumn[candidate];
        if (mapped) {
          detectedTarget = mapped;
          break;
        }
      }
    }

    let detectedDirection: SortDirection = "ASC";
    for (const key of ORDER_DIRECTION_PARAM_KEYS) {
      const candidate = params.get(key);
      if (candidate) {
        detectedDirection = candidate.toUpperCase() === "DESC" ? "DESC" : "ASC";
        break;
      }
    }

    setSortColumn(detectedTarget);
    setSortDirection(detectedDirection);
  }, [searchParams, sortTargetByColumn]);

  const orderDateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("en-AU", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Australia/Sydney",
      }),
    []
  );

  const [refreshingShipmentIds, setRefreshingShipmentIds] = useState<
    Set<number>
  >(new Set());
  const [invoiceProcessingShipmentIds, setInvoiceProcessingShipmentIds] =
    useState<Set<number>>(new Set());
  const [labelProcessingShipmentIds, setLabelProcessingShipmentIds] = useState<
    Set<number>
  >(new Set());

  const buildQueryWithSort = useCallback(
    (
      baseQuery: string,
      override?:
        | {
            target: SortTarget | null;
            direction: SortDirection;
          }
        | undefined
    ) => {
      const normalizedBase =
        baseQuery && baseQuery.startsWith("?") ? baseQuery.slice(1) : baseQuery;
      const params = new URLSearchParams(normalizedBase);

      ORDER_BY_PARAM_KEYS.forEach((key) => params.delete(key));
      ORDER_DIRECTION_PARAM_KEYS.forEach((key) => params.delete(key));

      const target = override !== undefined ? override.target : sortColumn;
      const direction =
        override !== undefined ? override.direction : sortDirection;

      const columnName = resolveSortColumn(target);

      if (columnName) {
        params.set("order_by", columnName);
        params.set("order_by_direction", direction);
      }

      return params.toString();
    },
    [resolveSortColumn, sortColumn, sortDirection]
  );

  useEffect(() => {
    if (!sortColumn) {
      return;
    }

    const columnName = resolveSortColumn(sortColumn);
    if (!columnName) {
      return;
    }

    const raw = searchParams
      ? searchParams.startsWith("?")
        ? searchParams.slice(1)
        : searchParams
      : "";
    const params = new URLSearchParams(raw);

    let currentOrderBy: string | null = null;
    for (const key of ORDER_BY_PARAM_KEYS) {
      const value = params.get(key);
      if (value) {
        currentOrderBy = value;
        break;
      }
    }

    if (currentOrderBy === columnName) {
      return;
    }

    const nextQuery = buildQueryWithSort(searchParams, {
      target: sortColumn,
      direction: sortDirection,
    });

    if (nextQuery !== searchParams) {
      setSearchParams(nextQuery);
    }
  }, [
    buildQueryWithSort,
    resolveSortColumn,
    searchParams,
    setSearchParams,
    sortColumn,
    sortDirection,
  ]);

  const handleSortChange = useCallback(
    (target: SortTarget) => {
      const isSameColumn = sortColumn === target;
      let nextTarget: SortTarget | null = target;
      let nextDirection: SortDirection = "ASC";

      if (isSameColumn) {
        if (sortDirection === "ASC") {
          nextDirection = "DESC";
        } else {
          nextTarget = null;
          nextDirection = "ASC";
        }
      }

      const nextQuery = buildQueryWithSort(searchParams, {
        target: nextTarget,
        direction: nextDirection,
      });

      setSortColumn(nextTarget);
      setSortDirection(nextDirection);
      setSearchParams(nextQuery);
      setCurrentPage(1);
      fetchShipments();
    },
    [
      buildQueryWithSort,
      fetchShipments,
      searchParams,
      setCurrentPage,
      setSearchParams,
      sortColumn,
      sortDirection,
    ]
  );

  const SortToggleButton = ({
    target,
    label,
    className,
  }: {
    target: SortTarget;
    label: string;
    className?: string;
  }) => {
    const isActive = sortColumn === target;
    const isDescending = isActive && sortDirection === "DESC";
    const isAscending = isActive && sortDirection === "ASC";

    return (
      <button
        type="button"
        onClick={() => handleSortChange(target)}
        className={cn(
          "flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500 hover:text-gray-900 transition-colors",
          isActive ? "text-gray-900" : "text-gray-500",
          className
        )}
      >
        <span>{label}</span>
        <span className="flex flex-col leading-none">
          <ChevronUpIcon
            className={cn(
              "h-3 w-3 transition-colors",
              isAscending ? "text-[#3D753A]" : "text-gray-400"
            )}
          />
          <ChevronDownIcon
            className={cn(
              "h-3 w-3 -mt-[2px] transition-colors",
              isDescending ? "text-[#3D753A]" : "text-gray-400"
            )}
          />
        </span>
      </button>
    );
  };

  useEffect(() => {
    let cancelled = false;

    const normalizeStatusOptionFromParam = (
      option: SearchParameterOption
    ): StatusOption | null => {
      if (option == null) {
        return null;
      }

      if (typeof option === "string" || typeof option === "number") {
        const value = String(option).trim();
        if (!value) {
          return null;
        }
        return {
          value,
          label: value,
          allowShipped: false,
          greenTick: false,
        };
      }

      if (typeof option === "object") {
        const record = option as Record<string, unknown>;
        const rawValue =
          record.value ??
          record.id ??
          record.code ??
          record.label ??
          record.name ??
          record.title ??
          null;
        const value =
          rawValue !== null && rawValue !== undefined
            ? String(rawValue).trim()
            : "";
        if (!value) {
          return null;
        }
        const labelSource =
          record.label ?? record.name ?? record.title ?? value;
        const label =
          labelSource !== null && labelSource !== undefined
            ? String(labelSource)
            : value;

        const allowShipped =
          record.allowShipped === true || record.allow_shipped === true;
        const greenTick =
          record.greenTick === true || record.green_tick === true;

        return {
          value,
          label,
          allowShipped,
          greenTick,
        };
      }

      return null;
    };

    const mergeStatusOptionWithBaseline = (
      option: StatusOption,
      baselineByValue: Map<string, StatusOption>,
      baselineByLabel: Map<string, StatusOption>
    ): StatusOption => {
      const byValue = baselineByValue.get(option.value);
      if (byValue) {
        return byValue;
      }

      const labelMatch = baselineByLabel.get(option.label.trim().toLowerCase());
      if (labelMatch) {
        return labelMatch;
      }

      return option;
    };

    const applyStatusOptionsFromParams = (
      params: Record<string, SearchParameter> | undefined,
      baselineByValue: Map<string, StatusOption>,
      baselineByLabel: Map<string, StatusOption>
    ): boolean => {
      if (!params) {
        return false;
      }

      const statusEntry = Object.values(params).find((field) => {
        const haystack = `${field.name ?? ""} ${
          field.column ?? ""
        }`.toLowerCase();
        return haystack.includes("status");
      });

      if (!statusEntry || !Array.isArray(statusEntry.options)) {
        return false;
      }

      const normalized = statusEntry.options
        .map((option) => normalizeStatusOptionFromParam(option))
        .map((option) =>
          option
            ? mergeStatusOptionWithBaseline(
                option,
                baselineByValue,
                baselineByLabel
              )
            : null
        )
        .filter((option): option is StatusOption => option !== null);

      if (normalized.length === 0) {
        return false;
      }

      if (!cancelled) {
        const unique = new Map<string, StatusOption>();
        normalized.forEach((option) => {
          if (!unique.has(option.value)) {
            unique.set(option.value, option);
          }
        });
        setStatusOptions(Array.from(unique.values()));
      }
      return true;
    };

    const fetchStatusBaseline = async () => {
      const empty = {
        options: [] as StatusOption[],
        byValue: new Map<string, StatusOption>(),
        byLabel: new Map<string, StatusOption>(),
      };

      if (cancelled) {
        return empty;
      }

      setIsLoadingStatuses(true);
      try {
        const token = getAuthToken();

        const response = await apiFetch("/platform/statuses", {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          throw new Error("Failed to fetch status options");
        }

        const data = (await response.json()) as StatusApiResponse;
        if (cancelled) {
          return empty;
        }

        if (data && data.success && data.statuses) {
          const baseline = data.statuses.map((status) => ({
            value: status.id.toString(),
            label: status.name,
            allowShipped: status.allowShipped,
            greenTick: status.greenTick,
          }));

          const byValue = new Map<string, StatusOption>();
          const byLabel = new Map<string, StatusOption>();
          baseline.forEach((option) => {
            byValue.set(option.value, option);
            byLabel.set(option.label.trim().toLowerCase(), option);
          });

          if (!cancelled) {
            setStatusOptions(baseline);
          }

          return { options: baseline, byValue, byLabel };
        }
      } catch (error: unknown) {
        if (!cancelled) {
          console.error("Error fetching status options:", error);
          setStatusOptions([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingStatuses(false);
        }
      }

      return empty;
    };

    const fetchSearchParameters = async (
      baselineOptions: StatusOption[],
      baselineByValue: Map<string, StatusOption>,
      baselineByLabel: Map<string, StatusOption>
    ) => {
      if (cancelled) {
        return;
      }

      setLoadingSearchParams(true);

      try {
        const token = getAuthToken();

        const response = await apiFetch("/shipments/search/parameters", {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          throw new Error("Failed to fetch search parameters");
        }

        const data = (await response.json()) as SearchParametersResponse;
        if (!cancelled && data && data.success && data.searchParameters) {
          setSearchFields(data.searchParameters);

          const appliedStatusOptions = applyStatusOptionsFromParams(
            data.searchParameters,
            baselineByValue,
            baselineByLabel
          );

          if (
            !appliedStatusOptions &&
            baselineOptions.length > 0 &&
            !cancelled
          ) {
            setStatusOptions(baselineOptions);
          }
        }
      } catch (error: unknown) {
        if (!cancelled) {
          console.error("Error fetching search parameters:", error);
          toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to fetch search parameters.",
          });
        }
      } finally {
        if (!cancelled) {
          setLoadingSearchParams(false);
        }
      }
    };

    const fetchCarrierSummaries = async () => {
      try {
        const token = getAuthToken();

        const response = await apiFetch("/platform/carriers", {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          throw new Error("Failed to fetch carriers");
        }

        const data = (await response.json()) as CarriersResponse;
        if (!cancelled && data.success && data.carriers) {
          const mapped = Object.values(data.carriers).reduce<
            Record<string, string>
          >((acc, carrier) => {
            if (carrier.code) {
              acc[carrier.code.toLowerCase()] =
                carrier.color?.trim() ?? acc[carrier.code.toLowerCase()] ?? "";
            }
            return acc;
          }, {});

          console.log("Fetched carrier colors:", mapped);
          setCarrierColors(mapped);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Error fetching carriers:", error);
          setCarrierColors({});
        }
      }
    };

    const runSearchBootstrap = async () => {
      const { options, byValue, byLabel } = await fetchStatusBaseline();
      await fetchSearchParameters(options, byValue, byLabel);
    };

    runSearchBootstrap();
    fetchCarrierSummaries();

    return () => {
      cancelled = true;
    };
  }, [getAuthToken, toast]);

  // Calculate which edge is closest and snap to it
  const snapToEdge = useCallback(
    (x: number, y: number) => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      if (!toolbarRef.current) return;

      const toolbarWidth = toolbarRef.current.offsetWidth;
      const toolbarHeight = toolbarRef.current.offsetHeight;

      // Calculate distances to each edge
      const distanceToLeft = x;
      const distanceToRight = viewportWidth - (x + toolbarWidth);
      const distanceToTop = y;
      const distanceToBottom = viewportHeight - (y + toolbarHeight);

      // Find the closest edge
      const minDistance = Math.min(
        distanceToLeft,
        distanceToRight,
        distanceToTop,
        distanceToBottom
      );

      let newEdge: EdgePosition;
      let newX: number;
      let newY: number;

      if (minDistance === distanceToLeft) {
        newEdge = "left";
        newX = 20;
        newY = Math.max(20, Math.min(y, viewportHeight - toolbarHeight - 20));
      } else if (minDistance === distanceToRight) {
        newEdge = "right";
        newX = viewportWidth - toolbarWidth - 20;
        newY = Math.max(20, Math.min(y, viewportHeight - toolbarHeight - 20));
      } else if (minDistance === distanceToTop) {
        newEdge = "top";
        newX = Math.max(20, Math.min(x, viewportWidth - toolbarWidth - 20));
        newY = 20;
      } else {
        newEdge = "bottom";
        newX = Math.max(20, Math.min(x, viewportWidth - toolbarWidth - 20));
        newY = viewportHeight - toolbarHeight - 20;
      }

      setEdge(newEdge);
      setPosition({ x: newX, y: newY });
    },
    [setEdge, setPosition, toolbarRef]
  ); // toolbarRef is stable, setEdge and setPosition are stable

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (toolbarRef.current) {
        const rect = toolbarRef.current.getBoundingClientRect();
        setDragOffset({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
        setIsDragging(true);
      }
    },
    [toolbarRef, setDragOffset, setIsDragging]
  );

  // Handle mouse move when dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && toolbarRef.current) {
        const newX = e.clientX - dragOffset.x;
        const newY = e.clientY - dragOffset.y;

        // Update position while dragging (free movement)
        setPosition({ x: newX, y: newY });
      }
    };

    const handleMouseUp = () => {
      if (isDragging) {
        // Snap to nearest edge when drag ends
        snapToEdge(position.x, position.y);
        setIsDragging(false);
      }
    };

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragOffset, position, snapToEdge]);

  // Initialize position on mount
  useLayoutEffect(() => {
    const didReposition = repositionToolbar();

    if (didReposition) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      repositionToolbar();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [repositionToolbar]);

  useLayoutEffect(() => {
    let frameId = 0;

    const applyPosition = () => {
      const didReposition = repositionToolbar();

      if (!didReposition) {
        frameId = window.requestAnimationFrame(applyPosition);
      }
    };

    applyPosition();

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [selectedWarehouse, shipments, shipmentsAreLoading, repositionToolbar]);

  const isVertical = edge === "left" || edge === "right";

  // Determine tooltip side based on toolbar position
  const getTooltipSide = useCallback(():
    | "top"
    | "right"
    | "bottom"
    | "left" => {
    switch (edge) {
      case "left":
        return "right";
      case "right":
        return "left";
      case "top":
        return "bottom";
      case "bottom":
        return "top";
      default:
        return "right";
    }
  }, [edge]);

  const selectedCount = useMemo(() => {
    if (!shipments || shipments.length === 0) {
      return 0;
    }
    return shipments.reduce(
      (count, shipment) => count + (selectedRows[shipment.id] ? 1 : 0),
      0
    );
  }, [selectedRows, shipments]);

  const headerCheckboxState = useMemo(() => {
    if (!shipments || shipments.length === 0) {
      return false;
    }
    if (selectedCount === 0) {
      return false;
    }
    if (selectedCount === shipments.length) {
      return true;
    }
    return "indeterminate" as const;
  }, [selectedCount, shipments]);

  const paginationPages = useMemo((): Array<number | "..."> => {
    if (!Number.isFinite(lastPage) || lastPage <= 1) {
      return [];
    }

    const pages: Array<number | "..."> = [];
    const windowSize = 2;
    const start = Math.max(1, currentPage - windowSize);
    const end = Math.min(lastPage, currentPage + windowSize);

    if (start > 1) {
      pages.push(1);
      if (start > 2) {
        pages.push("...");
      }
    }

    for (let page = start; page <= end; page += 1) {
      pages.push(page);
    }

    if (end < lastPage) {
      if (end < lastPage - 1) {
        pages.push("...");
      }
      pages.push(lastPage);
    }

    return pages;
  }, [currentPage, lastPage]);

  const handleSelectRow = useCallback(
    (id: number, checked: boolean) => {
      setSelectedRows((prev) => ({ ...prev, [id]: checked }));
    },
    [setSelectedRows]
  );

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (!shipments || shipments.length === 0) {
        setSelectedRows({});
        return;
      }

      if (!checked) {
        setSelectedRows({});
        return;
      }

      const newSelectedRows: Record<number, boolean> = {};
      shipments.forEach((shipment) => {
        newSelectedRows[shipment.id] = true;
      });
      setSelectedRows(newSelectedRows);
    },
    [shipments]
  );

  const handleStatusChange = useCallback(
    async (shipmentId: number | number[], newStatusId: string) => {
      const token = getAuthToken();

      const shipmentIdsString = Array.isArray(shipmentId)
        ? shipmentId.join(",")
        : String(shipmentId);
      const apiUrl = `/shipments/status/${newStatusId}?shipment_ids=${shipmentIdsString}`;

      try {
        const response = await apiFetch(apiUrl, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.message ||
              `Failed to update shipment status: ${response.statusText}`
          );
        }

        await response.json();
        toast({
          variant: "success",
          title: "Status Updated",
          description: "Shipment status has been updated successfully.",
        });
        const normalizedStatus =
          newStatusId === "-" || newStatusId === "" ? null : newStatusId;
        const ids = (Array.isArray(shipmentId) ? shipmentId : [shipmentId]).map(
          (id) => Number(id)
        );
        updateShipmentsByIds(ids, (shipment) => ({
          ...shipment,
          status: normalizedStatus,
        }));
      } catch (error: unknown) {
        //
        console.error("Error updating shipment status:", error);
        toast({
          variant: "destructive",
          title: "Update Failed",
          description: getErrorMessage(
            error,
            "Failed to update shipment status."
          ),
        });
      }
    },
    [getAuthToken, toast, updateShipmentsByIds]
  );

  const handleBulkStatusChange = useCallback(
    async (newStatusId: string) => {
      const selectedIds = Object.entries(selectedRows)
        .filter(([, isChecked]) => isChecked)
        .map(([id]) => parseInt(id, 10));

      if (selectedIds.length === 0) {
        toast({
          variant: "destructive",
          title: "No Shipments Selected",
          description: "Please select at least one shipment to update status.",
        });
        return;
      }
      await handleStatusChange(selectedIds, newStatusId);
    },
    [selectedRows, toast, handleStatusChange]
  );

  const refreshShipmentsByIds = useCallback(
    async (shipmentIds: number[]): Promise<RefreshShipmentsResult> => {
      if (shipmentIds.length === 0) {
        return { successes: [], failures: [] };
      }

      let token: string;
      try {
        token = getAuthToken();
      } catch (error: unknown) {
        const message = getErrorMessage(
          error,
          "Authentication failed. Please log in again."
        );
        return {
          successes: [],
          failures: shipmentIds.map((id) => ({ id, message })),
        };
      }

      setRefreshingShipmentIds((prev) => {
        const next = new Set(prev);
        shipmentIds.forEach((id) => next.add(id));
        return next;
      });

      const successes: number[] = [];
      const failures: Array<{ id: number; message: string }> = [];

      for (const shipmentId of shipmentIds) {
        try {
          const response = await apiFetch(`/shipments/refresh/${shipmentId}`, {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
            },
          });

          if (!response.ok) {
            let message = `Failed to refresh shipment: ${response.statusText}`;
            try {
              const errorData = await response.json();
              if (
                errorData &&
                typeof errorData === "object" &&
                "message" in errorData
              ) {
                const extracted = (errorData as { message?: unknown }).message;
                if (
                  typeof extracted === "string" &&
                  extracted.trim().length > 0
                ) {
                  message = extracted;
                }
              }
            } catch {
              // ignore non-JSON error bodies
            }
            console.error(`Failed to refresh shipment ${shipmentId}:`, message);
            failures.push({ id: shipmentId, message });
            continue;
          }

          await response.json().catch(() => null);
          successes.push(shipmentId);
        } catch (error: unknown) {
          console.error(`Error refreshing shipment ${shipmentId}:`, error);
          failures.push({
            id: shipmentId,
            message: getErrorMessage(error, "Failed to refresh shipment."),
          });
        }
      }

      setRefreshingShipmentIds((prev) => {
        const next = new Set(prev);
        shipmentIds.forEach((id) => next.delete(id));
        return next;
      });

      return { successes, failures };
    },
    [getAuthToken, setRefreshingShipmentIds]
  );

  const handleRefreshShipment = useCallback(
    async (shipmentId: number) => {
      const { successes, failures } = await refreshShipmentsByIds([shipmentId]);

      if (failures.length > 0) {
        toast({
          variant: "destructive",
          title: "Refresh Failed",
          description: failures[0]?.message ?? "Failed to refresh shipment.",
        });
        return;
      }

      if (successes.length > 0) {
        if (selectedShipmentId && successes.includes(selectedShipmentId)) {
          await refreshOpenShipmentDetail();
        }
        toast({
          variant: "success",
          title: "Shipment Refreshed",
          description: "Shipment data has been refreshed successfully.",
        });
      }
    },
    [
      refreshOpenShipmentDetail,
      refreshShipmentsByIds,
      selectedShipmentId,
      toast,
    ]
  );

  const handleRefreshSelectedShipments = useCallback(async () => {
    const selectedIds = getSelectedShipmentIds();

    if (selectedIds.length === 0) {
      toast({
        variant: "destructive",
        title: "No Shipments Selected",
        description: "Please select at least one shipment to refresh.",
      });
      return;
    }

    const { successes, failures } = await refreshShipmentsByIds(selectedIds);

    if (successes.length > 0) {
      if (selectedShipmentId && successes.includes(selectedShipmentId)) {
        await refreshOpenShipmentDetail();
      }
      toast({
        variant: "success",
        title: "Shipments Refreshed",
        description: `${successes.length} shipment${
          successes.length === 1 ? "" : "s"
        } refreshed successfully.`,
      });

      if (failures.length === 0) {
        setSelectedRows({});
      } else {
        const nextSelection: Record<number, boolean> = {};
        failures.forEach(({ id }) => {
          nextSelection[id] = true;
        });
        setSelectedRows(nextSelection);
      }
    }

    if (failures.length > 0) {
      const [firstFailure] = failures;
      const failureCount = failures.length;
      const description =
        failureCount === 1
          ? firstFailure.message
          : `${failureCount} shipments failed to refresh. ${firstFailure.message}`;

      toast({
        variant: "destructive",
        title: "Refresh Issues",
        description,
      });
    }
  }, [
    getSelectedShipmentIds,
    refreshOpenShipmentDetail,
    refreshShipmentsByIds,
    selectedShipmentId,
    setSelectedRows,
    toast,
  ]);

  const handleMarkShipmentsAsShipped = useCallback(async () => {
    const selectedIds = Object.entries(selectedRows)
      .filter(([, isChecked]) => isChecked)
      .map(([id]) => Number(id));

    if (selectedIds.length === 0) {
      toast({
        variant: "destructive",
        title: "No Shipments Selected",
        description: "Please select at least one shipment to mark as shipped.",
      });
      return;
    }

    const token = getAuthToken();

    try {
      const response = await apiFetch(
        `/shipments/shipped/1?shipment_ids=${selectedIds.join(",")}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message ||
            `Failed to mark shipments as shipped: ${response.statusText}`
        );
      }

      await response.json();
      toast({
        variant: "success",
        title: "Success",
        description: "Selected shipments have been marked as shipped.",
      });

      updateShipmentsByIds(selectedIds, (shipment) => ({
        ...shipment,
        sent: true,
      }));

      // Clear selected rows after successful update
      setSelectedRows({});

      // Trigger refresh if callback is provided
      // if (onStatusUpdateSuccess) {
      //   onStatusUpdateSuccess();
      // }
    } catch (error: unknown) {
      console.error("Error marking shipments as shipped:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: getErrorMessage(
          error,
          "Failed to mark shipments as shipped."
        ),
      });
    }
  }, [
    getAuthToken,
    selectedRows,
    setSelectedRows,
    toast,
    updateShipmentsByIds,
  ]);

  const handleMarkShipmentsAsNotShipped = useCallback(async () => {
    const selectedIds = Object.entries(selectedRows)
      .filter(([, isChecked]) => isChecked)
      .map(([id]) => Number(id));

    if (selectedIds.length === 0) {
      toast({
        variant: "destructive",
        title: "No Shipments Selected",
        description:
          "Please select at least one shipment to mark as not shipped.",
      });
      return;
    }

    const token = getAuthToken();

    try {
      const response = await apiFetch(
        `/shipments/shipped/0?shipment_ids=${selectedIds.join(",")}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message ||
            `Failed to mark shipments as not shipped: ${response.statusText}`
        );
      }

      await response.json();
      toast({
        title: "Success",
        description: "Selected shipments have been marked as not shipped.",
      });

      updateShipmentsByIds(selectedIds, (shipment) => ({
        ...shipment,
        sent: false,
      }));

      // Clear selected rows
      setSelectedRows({});
    } catch (error: unknown) {
      console.error("Error marking shipments as not shipped:", error);
      toast({
        variant: "destructive",
        title: "Operation Failed",
        description: getErrorMessage(
          error,
          "Failed to mark shipments as not shipped."
        ),
      });
    }
  }, [
    getAuthToken,
    selectedRows,
    setSelectedRows,
    toast,
    updateShipmentsByIds,
  ]);

  useEffect(() => {
    if (!selectedShipmentId) {
      setDetailedShipment(null);
      setIsLoadingDetail(false);
      return;
    }

    const abortController = new AbortController();
    let isActive = true;

    setIsLoadingDetail(true);

    fetchShipmentDetail(selectedShipmentId, abortController.signal)
      .then((data) => {
        if (!isActive || abortController.signal.aborted) {
          return;
        }
        setDetailedShipment(data);
      })
      .catch((error: unknown) => {
        if (
          abortController.signal.aborted ||
          (error instanceof DOMException && error.name === "AbortError")
        ) {
          return;
        }
        if (!isActive) {
          return;
        }
        handleShipmentDetailFetchError(error);
        setDetailedShipment(null);
      })
      .finally(() => {
        if (isActive) {
          setIsLoadingDetail(false);
        }
      });

    return () => {
      isActive = false;
      abortController.abort();
    };
  }, [
    detailAction,
    fetchShipmentDetail,
    handleShipmentDetailFetchError,
    selectedShipmentId,
  ]);

  const handleShipmentDetailClick = useCallback(
    (e: React.MouseEvent, shipmentId: number) => {
      e.stopPropagation();
      const newSelectedId =
        selectedShipmentId === shipmentId ? null : shipmentId;
      setSelectedShipmentId(newSelectedId);

      if (newSelectedId) {
        setIsLoadingDetail(true);
        setDetailedShipment(null);
      } else {
        setDetailedShipment(null);
        setIsLoadingDetail(false);
      }
    },
    [selectedShipmentId]
  );

  const handleUnlStatusUpdate = useCallback(
    async (shipment: Shipment) => {
      try {
        const token = getAuthToken();

        const response = await apiFetch(
          `/shipments/unlDone/${shipment.unlDone ? 0 : 1}?shipment_ids=${
            shipment.id
          }`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
            },
          }
        );

        if (!response.ok) {
          throw new Error("Failed to update UNL status");
        }

        const result = await response.json();

        if (result.shipments && result.shipments.length > 0) {
          toast({
            variant: "success",
            title: "Success",
            description: `UNL status ${
              !shipment.unlDone ? "completed" : "pending"
            }`,
          });
          setAction((prev) => prev + 1);
        }
      } catch (error: unknown) {
        console.error("Error updating UNL status:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to update UNL status",
        });
      }
    },
    [getAuthToken, setAction, toast]
  );

  const handleLockUnlockShipment = useCallback(
    async (shipment: Shipment) => {
      try {
        const token = getAuthToken();

        const endpoint = shipment.locked ? "unlock" : "lock";
        const response = await apiFetch(
          `/shipments/${endpoint}/${shipment.id}`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to ${endpoint} shipment`);
        }

        const result = await response.json();
        if (result.success) {
          toast({
            variant: "success",
            title: "Success",
            description: `Shipment ${
              shipment.locked ? "unlocked" : "locked"
            } successfully`,
          });
          setAction((prev) => prev + 1);
        }
      } catch (error: unknown) {
        console.error(
          `Error ${shipment.locked ? "unlocking" : "locking"} shipment:`,
          error
        );
        toast({
          variant: "destructive",
          title: "Error",
          description: `Failed to ${
            shipment.locked ? "unlock" : "lock"
          } shipment`,
        });
      }
    },
    [getAuthToken, setAction, toast]
  );

  const handleDeleteShipment = useCallback(
    async (shipmentId: number) => {
      const token = getAuthToken();

      const apiUrl = `/shipments/archive/${shipmentId}`;

      try {
        const response = await apiFetch(apiUrl, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          // Attempt to parse error message from response if available
          let errorMessage = `Failed to delete shipment: ${response.statusText}`;
          try {
            const errorData = await response.json();
            errorMessage = errorData.message || errorMessage;
          } catch {
            // Ignore if response is not JSON or empty
          }
          throw new Error(errorMessage);
        }

        // Assuming a successful DELETE request returns a 204 No Content or a success message
        // If it returns data, you can parse it: const result = await response.json();
        toast({
          variant: "success",
          title: "Shipment Deleted",
          description: "Shipment has been deleted successfully.",
        });
        setAction((prev) => prev + 1);

        // Trigger a refresh of the shipments list
        // if (onStatusUpdateSuccess) {
        //   onStatusUpdateSuccess();
        // }
      } catch (error: unknown) {
        console.error("Error deleting shipment:", error);
        toast({
          variant: "destructive",
          title: "Delete Failed",
          description: getErrorMessage(error, "Failed to delete shipment."),
        });
      }
    },
    [getAuthToken, setAction, toast]
  );

  const ensureQuotesSelected = useCallback(
    async (shipmentIds: number[]) => {
      if (shipmentIds.length === 0) {
        return;
      }

      const idsNeedingSelection = shipmentIds.filter((id) => {
        const shipment = shipments.find((item) => item.id === id);
        return !shipment || shipment.selectedQuoteId == null;
      });

      if (idsNeedingSelection.length === 0) {
        return;
      }

      const token = getAuthToken();
      const failures: string[] = [];

      for (const shipmentId of idsNeedingSelection) {
        try {
          const detailResponse = await apiFetch(
            `/shipments/${shipmentId}?columns=shipmentQuotes`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
              },
            }
          );

          const payload = (await detailResponse.json().catch(() => null)) as
            | (ShipmentDetailResponse & {
                message?: unknown;
              })
            | null;

          if (!detailResponse.ok || !payload) {
            const message =
              payload &&
              typeof payload === "object" &&
              payload !== null &&
              "message" in payload
                ? String((payload as { message?: unknown }).message ?? "")
                : `Failed to load shipment ${shipmentId}.`;
            throw new Error(message);
          }

          const detail = payload.shipment ?? null;
          if (!detail) {
            throw new Error("Shipment details were not available.");
          }

          const existingId =
            typeof detail.selectedQuoteId === "number" &&
            !Number.isNaN(detail.selectedQuoteId)
              ? detail.selectedQuoteId
              : null;

          if (existingId !== null) {
            updateShipmentsByIds([shipmentId], (shipment) => ({
              ...shipment,
              selectedQuoteId: existingId,
              carrierCode: detail.carrierCode ?? shipment.carrierCode,
              serviceCode: detail.serviceCode ?? shipment.serviceCode,
            }));
            continue;
          }

          const quote = findDefaultQuoteForShipment(detail);
          if (!quote) {
            throw new Error(
              "No quotes are available for this shipment. Please select one manually."
            );
          }

          const patchResponse = await apiFetch(
            `/shipments/quote/${shipmentId}?quote_id=${quote.id}`,
            {
              method: "PATCH",
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
              },
            }
          );

          const patchPayload = (await patchResponse
            .json()
            .catch(() => null)) as ApiSuccessResponse | null;

          if (!patchResponse.ok || patchPayload?.success === false) {
            const message =
              patchPayload?.message ??
              `Failed to select quote for shipment ${shipmentId}.`;
            throw new Error(message);
          }

          updateShipmentsByIds([shipmentId], (shipment) => ({
            ...shipment,
            selectedQuoteId: quote.id,
            carrierCode: quote.carrierCode ?? shipment.carrierCode,
            serviceCode: quote.serviceCode ?? shipment.serviceCode,
          }));
        } catch (error) {
          console.error(
            `Failed to auto-select quote for shipment ${shipmentId}:`,
            error
          );
          failures.push(
            getErrorMessage(
              error,
              `Failed to select a quote for shipment ${shipmentId}. Please choose one manually.`
            )
          );
        }
      }

      if (failures.length > 0) {
        throw new Error(failures.join("\n"));
      }
    },
    [getAuthToken, shipments, updateShipmentsByIds]
  );

  type QuickPrintOptions = {
    suppressSuccessToast?: boolean;
    title?: string;
    incrementAction?: boolean;
    includeAlreadyPrinted?: boolean;
  };

  const quickPrintShipments = useCallback(
    async (
      shipmentIds: number[],
      {
        suppressSuccessToast = false,
        title,
        incrementAction = false,
        includeAlreadyPrinted = false,
      }: QuickPrintOptions = {}
    ) => {
      if (shipmentIds.length === 0) {
        return;
      }

      const token = getAuthToken();

      const params = new URLSearchParams({
        shipment_ids: shipmentIds.join(","),
      });

      if (includeAlreadyPrinted) {
        params.set("include_already_printed", "true");
      }

      try {
        await ensureQuotesSelected(shipmentIds);

        const response = await apiFetch(
          `/pdf/labels/quickPrint?${params.toString()}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/pdf",
            },
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          throw new Error(
            (errorData && errorData.message) ||
              `Failed to quick print: ${response.statusText}`
          );
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        setPdfUrl((previous) => {
          if (previous) {
            window.URL.revokeObjectURL(previous);
          }
          return url;
        });
        setIsPdfOpen(true);
        setPdfTitle(title ?? "Quick Print Labels Preview");

        if (!suppressSuccessToast) {
          toast({
            variant: "success",
            title: "Quick Print Ready",
            description: "Labels are ready for printing.",
          });
        }

        if (incrementAction) {
          setAction((prev) => prev + 1);
        }
      } catch (error: unknown) {
        console.error("Error during quick print:", error);
        toast({
          variant: "destructive",
          title: "Quick Print Failed",
          description: getErrorMessage(error, "Failed to quick print labels."),
        });
        throw error;
      }
    },
    [ensureQuotesSelected, getAuthToken, setAction, toast]
  );

  const markLabelProcessing = useCallback(
    (shipmentIds: number[], isProcessing: boolean) => {
      if (shipmentIds.length === 0) {
        return;
      }
      setLabelProcessingShipmentIds((previous) => {
        const next = new Set(previous);
        shipmentIds.forEach((id) => {
          if (isProcessing) {
            next.add(id);
          } else {
            next.delete(id);
          }
        });
        return next;
      });
    },
    []
  );

  const handleLabelReprint = useCallback(async () => {
    const selectedIds = getSelectedShipmentIds();

    if (selectedIds.length === 0) {
      toast({
        variant: "destructive",
        title: "No Shipments Selected",
        description: "Select at least one shipment to reprint labels.",
      });
      return;
    }

    try {
      markLabelProcessing(selectedIds, true);
      await quickPrintShipments(selectedIds, {
        title: "Label Reprint Preview",
        incrementAction: false,
        includeAlreadyPrinted: true,
      });
    } catch {
      // quickPrintShipments already reports the failure
    } finally {
      markLabelProcessing(selectedIds, false);
    }
  }, [getSelectedShipmentIds, markLabelProcessing, quickPrintShipments, toast]);

  type InvoicePrintOptions = {
    previewTitle?: string;
    successToast?: {
      title: string;
      description?: string;
    };
    suppressSuccessToast?: boolean;
    incrementAction?: boolean;
    allowReprint?: boolean;
  };

  const markInvoiceProcessing = useCallback(
    (shipmentIds: number[], isProcessing: boolean) => {
      if (shipmentIds.length === 0) {
        return;
      }
      setInvoiceProcessingShipmentIds((previous) => {
        const next = new Set(previous);
        shipmentIds.forEach((id) => {
          if (isProcessing) {
            next.add(id);
          } else {
            next.delete(id);
          }
        });
        return next;
      });
    },
    []
  );

  const printInvoicesForShipments = useCallback(
    async (
      shipmentIds: number[],
      {
        previewTitle = "Invoice Preview",
        successToast: successToastContent = {
          title: "Invoice Generated",
          description: "The invoice PDF has been generated successfully.",
        },
        suppressSuccessToast = false,
        incrementAction = false,
        allowReprint = false,
      }: InvoicePrintOptions = {}
    ) => {
      if (shipmentIds.length === 0) {
        throw new Error("No shipment ids provided for invoice printing.");
      }

      const token = getAuthToken();

      const params = new URLSearchParams({
        shipment_ids: shipmentIds.join(","),
      });

      if (allowReprint) {
        params.set("only_if_printed", "0");
      }

      markInvoiceProcessing(shipmentIds, true);

      try {
        const response = await apiFetch(`/pdf/invoices?${params.toString()}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/pdf",
          },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          throw new Error(
            (errorData && errorData.message) ||
              `Failed to print Invoices: ${response.statusText}`
          );
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        setPdfUrl((previous) => {
          if (previous) {
            window.URL.revokeObjectURL(previous);
          }
          return url;
        });
        setIsPdfOpen(true);
        setPdfTitle(previewTitle);

        updateShipmentsByIds(shipmentIds, (shipment) => ({
          ...shipment,
          invoicePrinted: true,
        }));

        if (!suppressSuccessToast) {
          toast({
            variant: "success",
            title: successToastContent.title,
            description: successToastContent.description,
          });
        }

        if (incrementAction) {
          setAction((prev) => prev + 1);
        }
      } catch (error: unknown) {
        console.error("Error during Invoices print:", error);
        toast({
          variant: "destructive",
          title: "Invoice Generation Failed",
          description: getErrorMessage(
            error,
            "Failed to generate invoice PDF."
          ),
        });
        throw error;
      } finally {
        markInvoiceProcessing(shipmentIds, false);
      }
    },
    [
      getAuthToken,
      markInvoiceProcessing,
      setAction,
      setIsPdfOpen,
      setPdfTitle,
      setPdfUrl,
      toast,
      updateShipmentsByIds,
    ]
  );

  const handleInvoicePrint = useCallback(async () => {
    const selectedIds = getSelectedShipmentIds();

    if (selectedIds.length === 0) {
      toast({
        variant: "destructive",
        title: "No Shipments Selected",
        description: "Please select at least one shipment to print invoices.",
      });
      return;
    }

    try {
      await printInvoicesForShipments(selectedIds);
    } catch {
      // printInvoicesForShipments already reports the failure
    }
  }, [getSelectedShipmentIds, printInvoicesForShipments, toast]);

  const handleInvoiceReprint = useCallback(async () => {
    const selectedIds = getSelectedShipmentIds();

    if (selectedIds.length === 0) {
      toast({
        variant: "destructive",
        title: "No Shipments Selected",
        description: "Select at least one shipment to reprint invoices.",
      });
      return;
    }

    try {
      await printInvoicesForShipments(selectedIds, {
        previewTitle: "Invoice Reprint",
        successToast: {
          title: "Invoice Ready",
          description: "Invoices reopened for printing.",
        },
        incrementAction: false,
        allowReprint: true,
      });
    } catch {
      // printInvoicesForShipments already reports the failure
    }
  }, [getSelectedShipmentIds, printInvoicesForShipments, toast]);

  const handleSingleInvoicePrint = useCallback(
    async (shipmentId: number) => {
      try {
        await printInvoicesForShipments([shipmentId]);
      } catch {
        // printInvoicesForShipments already reports the failure
      }
    },
    [printInvoicesForShipments]
  );

  const handleSingleInvoiceReprint = useCallback(
    async (shipmentId: number) => {
      try {
        await printInvoicesForShipments([shipmentId], {
          previewTitle: "Invoice Reprint",
          successToast: {
            title: "Invoice Ready",
            description: "Invoice reopened for printing.",
          },
          incrementAction: false,
          allowReprint: true,
        });
      } catch {
        // printInvoicesForShipments already reports the failure
      }
    },
    [printInvoicesForShipments]
  );

  const handlePdfClose = useCallback(() => {
    setIsPdfOpen(false);
    if (pdfUrl) {
      window.URL.revokeObjectURL(pdfUrl);
      setPdfUrl("");
    }
  }, [pdfUrl]);

  const handleRestoreShipment = useCallback(
    async (shipmentId: number) => {
      try {
        const token = getAuthToken();

        const response = await apiFetch(`/shipments/unarchive/${shipmentId}`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.message ||
              `Failed to restore shipment: ${response.statusText}`
          );
        }

        toast({
          variant: "success",
          title: "Shipment Restored",
          description: `Shipment ${shipmentId} has been restored successfully.`,
        });
        setAction((prev) => prev + 1); // Refresh data
      } catch (error: unknown) {
        console.error("Error restoring shipment:", error);
        toast({
          variant: "destructive",
          title: "Restore Failed",
          description: getErrorMessage(error, "Failed to restore shipment."),
        });
      }
    },
    [getAuthToken, setAction, toast]
  );

  const handleDeleteLabel = useCallback(
    async (shipmentId: number) => {
      const token = getAuthToken();

      try {
        const response = await apiFetch(
          `/pdf/labels?shipment_ids=${shipmentId}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
            },
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.message ||
              `Failed to delete label: ${response.statusText}`
          );
        }

        toast({
          variant: "success",
          title: "Label Deleted",
          description: `Label for shipment ${shipmentId} has been deleted successfully.`,
        });
        setAction((prev) => prev + 1);
      } catch (error: unknown) {
        toast({
          variant: "destructive",
          title: "Delete Failed",
          description: getErrorMessage(error, "Failed to delete label."),
        });
      }
    },
    [getAuthToken, setAction, toast]
  );

  const generateLabelsForShipments = useCallback(
    async (shipmentIds: number[]): Promise<LabelGenerationResult> => {
      if (shipmentIds.length === 0) {
        throw new Error("No shipment ids provided for label generation.");
      }

      const token = getAuthToken();
      const baseUrl = "/pdf/labels/generateLabels";
      const query = `shipment_ids=${shipmentIds.join(",")}`;

      type LabelGenerationRequestSuccess = {
        ok: true;
        payload: unknown;
      };
      type LabelGenerationRequestFailure = {
        ok: false;
        status: number | null;
        message: string;
      };

      const performRequest = async (
        method: "POST" | "PUT"
      ): Promise<
        LabelGenerationRequestSuccess | LabelGenerationRequestFailure
      > => {
        try {
          const init: RequestInit = {
            method,
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
            },
          };

          if (method === "POST") {
            init.headers = {
              ...init.headers,
              "Content-Type": "application/json",
            };
            init.body = JSON.stringify({ shipment_ids: shipmentIds });
          }

          const response = await apiFetch(`${baseUrl}?${query}`, init);
          const contentType =
            response.headers.get("content-type")?.toLowerCase() ?? "";
          const payload =
            contentType.includes("application/json") ||
            contentType.includes("text/json")
              ? await response.json().catch(() => null)
              : null;

          if (!response.ok) {
            const message =
              (payload &&
              typeof payload === "object" &&
              payload !== null &&
              "message" in payload
                ? String(
                    (payload as { message?: unknown }).message ??
                      "Failed to generate labels."
                  )
                : undefined) ??
              `Failed to generate labels: ${response.status} ${response.statusText}`;

            return {
              ok: false,
              status: response.status,
              message,
            };
          }

          return {
            ok: true,
            payload,
          };
        } catch (error: unknown) {
          return {
            ok: false,
            status: null,
            message: getErrorMessage(
              error,
              "Failed to contact the label service."
            ),
          };
        }
      };

      let result = await performRequest("POST");

      if (
        !result.ok &&
        (result.status === null ||
          result.status === 405 ||
          result.status === 404)
      ) {
        result = await performRequest("PUT");
      }

      if (!result.ok) {
        throw new Error(result.message);
      }

      const statusChangedShipmentIds = extractStatusChangedShipmentIds(
        result.payload,
        shipmentIds
      );

      return {
        statusChangedShipmentIds,
        payload: result.payload,
      };
    },
    [getAuthToken]
  );

  const handleGenerateLabels = useCallback(async () => {
    const selectedIds = getSelectedShipmentIds();

    if (selectedIds.length === 0) {
      toast({
        variant: "destructive",
        title: "No Shipments Selected",
        description: "Please select at least one shipment to generate labels.",
      });
      return;
    }

    try {
      markLabelProcessing(selectedIds, true);
      const { statusChangedShipmentIds } = await generateLabelsForShipments(
        selectedIds
      );
      const didStatusChange = statusChangedShipmentIds.length > 0;

      if (didStatusChange) {
        updateShipmentsByIds(statusChangedShipmentIds, (shipment) => ({
          ...shipment,
          labelPrinted: true,
        }));
      }

      toast({
        variant: "success",
        title: "Labels Generated",
        description: "Labels have been generated successfully.",
      });
      setSelectedRows({});

      try {
        await quickPrintShipments(selectedIds, {
          suppressSuccessToast: true,
          incrementAction: false,
          title: "Generated Labels Preview",
        });
      } catch {
        // quick print helper already handles error reporting
      }

      if (didStatusChange) {
        setAction((prev) => prev + 1);
      }
    } catch (error: unknown) {
      console.error("Error generating labels:", error);
      toast({
        variant: "destructive",
        title: "Generation Failed",
        description: getErrorMessage(error, "Failed to generate labels."),
      });
    } finally {
      markLabelProcessing(selectedIds, false);
    }
  }, [
    generateLabelsForShipments,
    getSelectedShipmentIds,
    markLabelProcessing,
    setAction,
    quickPrintShipments,
    toast,
    updateShipmentsByIds,
  ]);

  const handlePrintLabel = useCallback(
    async (shipmentId: number) => {
      try {
        markLabelProcessing([shipmentId], true);
        const { statusChangedShipmentIds } = await generateLabelsForShipments([
          shipmentId,
        ]);
        const didStatusChange = statusChangedShipmentIds.includes(shipmentId);

        if (didStatusChange) {
          updateShipmentsByIds([shipmentId], (shipment) => ({
            ...shipment,
            labelPrinted: true,
          }));
          setAction((prev) => prev + 1);
        }
        toast({
          variant: "success",
          title: "Labels Generated",
          description: "Labels have been generated successfully.",
        });
      } catch (error: unknown) {
        console.error("Error generating labels:", error);
        toast({
          variant: "destructive",
          title: "Generation Failed",
          description: getErrorMessage(error, "Failed to generate labels."),
        });
      } finally {
        markLabelProcessing([shipmentId], false);
      }
    },
    [
      generateLabelsForShipments,
      markLabelProcessing,
      setAction,
      toast,
      updateShipmentsByIds,
    ]
  );

  const handleReprintLabel = useCallback(
    async (shipmentId: number) => {
      try {
        markLabelProcessing([shipmentId], true);
        await quickPrintShipments([shipmentId], {
          title: "Label Reprint Preview",
          incrementAction: false,
          includeAlreadyPrinted: true,
        });
      } catch {
        // quickPrintShipments already reports the failure
      } finally {
        markLabelProcessing([shipmentId], false);
      }
    },
    [markLabelProcessing, quickPrintShipments]
  );

  const resolveShipmentRowColor = useCallback(
    (shipment: Shipment): string => {
      const fallbackColor = "#9370db";
      const effectiveCode = (
        shipment.carrierCode?.trim() ??
        shipment.carrierCodeDesired?.trim() ??
        ""
      ).toLowerCase();

      if (!effectiveCode) {
        return fallbackColor;
      }

      const mappedColor = carrierColors[effectiveCode];
      if (mappedColor && mappedColor.trim().length > 0) {
        return mappedColor.trim();
      }

      return fallbackColor;
    },
    [carrierColors]
  );

  if (shipmentsAreLoading) {
    return (
      <div className="w-full space-y-4 p-6">
        <Skeleton className="h-12 w-full rounded-lg" />
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="flex items-center gap-3 rounded-lg border bg-card/40 p-3"
            >
              <Skeleton className="h-10 w-10 rounded-full" />
              <Skeleton className="h-4 flex-1 rounded-full" />
              <Skeleton className="h-4 w-24 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <PdfViewer
        isOpen={isPdfOpen}
        onClose={handlePdfClose}
        pdfUrl={pdfUrl}
        title={pdfTitle}
      />
      <div className="border-b border-gray-200 bg-white px-4 py-3">
        <form
          onSubmit={handleFilterSubmit}
          className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between"
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-3">
            <div className="w-full md:w-52">
              <Select
                value={selectedSearchFieldKey ?? undefined}
                onValueChange={(value) => setSelectedSearchFieldKey(value)}
                disabled={
                  areSearchParamsLoading || searchParameterEntries.length === 0
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose filter" />
                </SelectTrigger>
                <SelectContent>
                  {searchParameterEntries.map(([key, parameter]) => (
                    <SelectItem key={key} value={key}>
                      {parameter.name ?? key}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full md:w-60">
              {hasOptionList ? (
                <Select
                  value={
                    selectedFieldRawValue === ""
                      ? undefined
                      : selectedFieldRawValue
                  }
                  onValueChange={handleDraftValueUpdate}
                  disabled={areSearchParamsLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select value" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedFieldOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={selectedFieldRawValue}
                  onChange={(event) =>
                    handleDraftValueUpdate(event.target.value)
                  }
                  placeholder={
                    selectedSearchField?.name
                      ? `Search ${selectedSearchField.name}`
                      : "Enter value"
                  }
                  type={selectedInputType}
                  disabled={areSearchParamsLoading || !selectedSearchField}
                />
              )}
            </div>
          </div>
          <div className="flex gap-2 md:justify-end">
            <Button
              type="submit"
              size="sm"
              disabled={isApplyDisabled}
              className="flex items-center gap-2"
            >
              <Search className="h-4 w-4" />
              Apply
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isClearDisabled}
              onClick={handleResetFilters}
            >
              Clear
            </Button>
          </div>
        </form>
        {areSearchParamsLoading ? (
          <div className="mt-3 flex gap-2">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-6 w-24" />
          </div>
        ) : activeFilters.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {activeFilters.map((filter) => (
              <Badge
                key={`${filter.key}-${filter.value}`}
                variant="secondary"
                className="flex items-center gap-2"
              >
                <span className="text-xs font-medium text-gray-700">
                  {filter.parameter.name ?? filter.key}:
                </span>
                <span className="text-xs text-gray-700">
                  {getFilterValueLabel(filter.key, filter.value)}
                </span>
                <button
                  type="button"
                  className="rounded-full p-1 text-gray-500 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-1"
                  onClick={() => handleRemoveFilter(filter.key)}
                  aria-label={`Remove ${
                    filter.parameter.name ?? filter.key
                  } filter`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        ) : null}
        {!areSearchParamsLoading && searchParameterEntries.length === 0 ? (
          <p className="mt-3 text-xs text-gray-500">
            No searchable fields are available for this view yet.
          </p>
        ) : null}
      </div>
      <div
        ref={toolbarRef}
        className={cn(
          "fixed bg-background border rounded-lg shadow-lg p-1 select-none",
          isVertical ? "flex flex-col items-center" : "flex items-center",
          isDragging
            ? "cursor-grabbing transition-none"
            : "transition-all duration-300 ease-out"
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
              <GripVertical
                className={cn("h-4 w-4", isVertical && "transform rotate-90")}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent side={getTooltipSide()}>
            <p>Drag to move toolbar</p>
          </TooltipContent>
        </Tooltip>

        <div
          className={cn(
            isVertical ? "flex flex-col gap-2" : "flex flex-wrap gap-2"
          )}
        >
          <div className="flex-grow sm:flex-grow-0">
            <Select
              disabled={isLoadingStatuses || selectedWarehouse === "All"}
              onValueChange={handleBulkStatusChange}
            >
              <SelectTrigger className="w-full sm:w-[60px] text-xs sm:text-sm">
                <GrStatusGood />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="-" disabled>
                  Change Status
                </SelectItem>
                {statusOptions.map((option) => (
                  <SelectItem
                    className="-p-2"
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DropdownMenu>
            <Tooltip>
              <DropdownMenuTrigger asChild>
                <Button
                  disabled={isLoadingStatuses || selectedWarehouse === "All"}
                  variant="outline"
                  size="icon"
                  className="flex-grow-0"
                >
                  <FileText className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <TooltipContent side={getTooltipSide()}>
                <p>Invoice Options</p>
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Invoice Options</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => {
                  void handleInvoicePrint();
                }}
              >
                <Printer className="mr-2 h-4 w-4" />
                Print Default
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  void handleInvoiceReprint();
                }}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Reprint
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <Tooltip>
              <DropdownMenuTrigger asChild>
                <Button
                  disabled={isLoadingStatuses || selectedWarehouse === "All"}
                  variant="outline"
                  size="icon"
                >
                  <Tag className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <TooltipContent side={getTooltipSide()}>
                <p>Label Options</p>
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Label Options</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => {
                  void handleGenerateLabels();
                }}
              >
                <Printer className="mr-2 h-4 w-4" />
                Print Default
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  void handleLabelReprint();
                }}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Reprint
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={handleRefreshSelectedShipments}
              >
                <MdRefresh className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side={getTooltipSide()}>
              <p>Refresh Selected</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                disabled={isLoadingStatuses || selectedWarehouse === "All"}
                variant="outline"
                size="icon"
                onClick={handleMarkShipmentsAsShipped}
              >
                <Check className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side={getTooltipSide()}>
              <p>Mark Shipped</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                disabled={isLoadingStatuses || selectedWarehouse === "All"}
                variant="outline"
                size="icon"
                onClick={handleMarkShipmentsAsNotShipped}
              >
                <X className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side={getTooltipSide()}>
              <p>Mark Not Shipped</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon">
                <QrCode className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side={getTooltipSide()}>
              <p>Manifest Codes</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
      <div className="fixed bottom-6 right-6 z-50">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              aria-label="Manifest shipments"
              disabled={isLoadingStatuses || selectedWarehouse === "All"}
              variant="destructive"
              size="lg"
              className="shadow-2xl h-14 w-14 rounded-full"
            >
              <Send className="h-6 w-6" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>Manifest</p>
          </TooltipContent>
        </Tooltip>
      </div>
      <Table className="">
        <TableHeader>
          <TableRow>
            <TableHead className="px-3 pb-2">
              <div className="flex items-center gap-x-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                <div className="flex items-center gap-x-3">
                  <div className="w-8 flex items-center justify-start">
                    <Checkbox
                      checked={headerCheckboxState}
                      onCheckedChange={(checked) =>
                        handleSelectAll(Boolean(checked))
                      }
                      aria-label="Select all shipments"
                    />
                  </div>
                  <div className="w-16">
                    <SortToggleButton
                      target="shopifyOrderNumber"
                      label="Order #"
                      className="w-full justify-between pr-1"
                    />
                  </div>
                </div>
                <div className="min-w-[220px] text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  Actions
                </div>
                <div className="ml-5 w-56">
                  <SortToggleButton
                    target="orderName"
                    label="Customer"
                    className="w-full justify-between pr-1"
                  />
                </div>
                <div className="w-88 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  Address
                </div>
                <div className="w-20 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  &nbsp;
                </div>
                <div className="w-48">
                  <SortToggleButton
                    target="orderDate"
                    label="Order Date"
                    className="w-full justify-between pr-1"
                  />
                </div>
                <div className="w-28">
                  <SortToggleButton
                    target="totalPrice"
                    label="Total"
                    className="w-full justify-between pr-1"
                  />
                </div>
                <div className="w-16">
                  <SortToggleButton
                    target="lastApiUpdate"
                    label="Last Update"
                    className="w-full justify-between pr-1"
                  />
                </div>
              </div>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {shipments?.map((shipment) => {
            const isInvoiceProcessing = invoiceProcessingShipmentIds.has(
              shipment.id
            );
            const isLabelProcessing = labelProcessingShipmentIds.has(
              shipment.id
            );
            const originalRegionCode = extractOriginalRegionCode(
              shipment.originalAddress
            );
            const addressParts = [shipment.address1, shipment.suburb].filter(
              (part): part is string =>
                typeof part === "string" && part.trim().length > 0
            );
            const addressText = addressParts.join(", ");
            const truncatedAddressText =
              addressText.length > 45
                ? `${addressText.slice(0, 45)}...`
                : addressText;
            const displayRegionCode =
              originalRegionCode ??
              (typeof shipment.region === "string"
                ? shipment.region.trim() || null
                : null);
            return (
              <React.Fragment key={shipment.id}>
                <TableRow
                  key={shipment.id}
                  className="py-1" // Add vertical padding reduction
                >
                  <TableCell
                    id={`select-row-${shipment.id}`}
                    className="text-white py-0"
                    style={{
                      backgroundColor: resolveShipmentRowColor(shipment),
                    }}
                  >
                    <div className="flex flex-row gap-x-3 items-center">
                      <Checkbox
                        checked={selectedRows[shipment.id] || false}
                        onCheckedChange={(checked) =>
                          handleSelectRow(shipment.id, Boolean(checked))
                        }
                        aria-labelledby={`select-row-${shipment.id}`}
                      />
                      <p className="w-16">{shipment.shopifyOrderNumber}</p>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <a
                            target="_blank"
                            href={`https://admin.shopify.com/store/${
                              shipment.store?.shop ?? "vpa-australia"
                            }/orders/${shipment.shopifyId}`}
                          >
                            <FaLink className="w-5 h-5" />
                          </a>
                        </TooltipTrigger>
                        <TooltipContent>View in Shopify</TooltipContent>
                      </Tooltip>

                      <DropdownMenu>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                aria-label="Invoice actions"
                                aria-busy={isInvoiceProcessing}
                                className="flex items-center justify-center rounded-md p-1 transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-muted"
                                disabled={isInvoiceProcessing}
                              >
                                {isInvoiceProcessing ? (
                                  <Loader2 className="h-5 w-5 animate-spin text-white" />
                                ) : shipment.invoicePrinted ? (
                                  <Image
                                    alt="invoice printed"
                                    width={21}
                                    height={21}
                                    src={"/invoice-green.avif"}
                                  />
                                ) : (
                                  <Image
                                    alt="invoice not printed"
                                    width={21}
                                    height={21}
                                    src={"/invoice.avif"}
                                  />
                                )}
                              </button>
                            </DropdownMenuTrigger>
                          </TooltipTrigger>
                          <TooltipContent>
                            Invoice{" "}
                            {shipment.invoicePrinted
                              ? "Printed"
                              : "Not Printed"}
                          </TooltipContent>
                        </Tooltip>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuLabel>Invoice Options</DropdownMenuLabel>
                          <DropdownMenuItem
                            onSelect={() => {
                              void handleSingleInvoicePrint(shipment.id);
                            }}
                          >
                            <Printer className="mr-2 h-4 w-4" />
                            Print Invoice
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={!shipment.invoicePrinted}
                            onSelect={() => {
                              void handleSingleInvoiceReprint(shipment.id);
                            }}
                          >
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Reprint Invoice
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <DropdownMenu>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                aria-label="Label actions"
                                aria-busy={isLabelProcessing}
                                className="relative flex items-center justify-center rounded-md p-1 transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-muted"
                                disabled={isLabelProcessing}
                              >
                                {isLabelProcessing ? (
                                  <Loader2 className="h-5 w-5 animate-spin text-white" />
                                ) : (
                                  <>
                                    <Image
                                      alt={
                                        shipment.labelPrinted
                                          ? "label printed"
                                          : "label not printed"
                                      }
                                      width={20}
                                      height={20}
                                      src={
                                        shipment.labelPrinted
                                          ? "/label-green.avif"
                                          : "/label.avif"
                                      }
                                    />
                                    {shipment.potentialNewLabel ? (
                                      <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[8px] font-bold uppercase text-white">
                                        !
                                      </span>
                                    ) : null}
                                  </>
                                )}
                              </button>
                            </DropdownMenuTrigger>
                          </TooltipTrigger>
                          <TooltipContent>
                            {isLabelProcessing
                              ? "Processing Labels..."
                              : shipment.potentialNewLabel
                              ? "Potential Relabel"
                              : `Label ${
                                  shipment.labelPrinted
                                    ? "Printed"
                                    : "Not Printed"
                                }`}
                          </TooltipContent>
                        </Tooltip>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuLabel>Label Options</DropdownMenuLabel>
                          <DropdownMenuItem
                            onSelect={() => {
                              void handlePrintLabel(shipment.id);
                            }}
                          >
                            <Printer className="mr-2 h-4 w-4" />
                            Generate Label
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={!shipment.labelPrinted}
                            onSelect={() => {
                              void handleReprintLabel(shipment.id);
                            }}
                          >
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Reprint Label
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            disabled={!shipment.labelPrinted}
                            onSelect={() => {
                              void handleDeleteLabel(shipment.id);
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4 text-destructive" />
                            Delete Label
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div>
                            {shipment.manifested ? (
                              <Image
                                alt="manifest icon"
                                width={21}
                                height={21}
                                src={"/manifest-green.avif"}
                              />
                            ) : (
                              <Image
                                alt="maniffest icon"
                                width={21}
                                height={21}
                                src={"/manifest.avif"}
                              />
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          {shipment.manifested
                            ? "Manifested"
                            : "Not Manifested"}
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div>
                            {shipment.sent ? (
                              // <FaTruck className="w-5 h-5 text-green-500" />
                              <Image
                                alt="truck"
                                width={21}
                                height={21}
                                src={"/truck-green.avif"}
                              />
                            ) : (
                              <Image
                                alt="truck"
                                width={21}
                                height={21}
                                src={"/truck.avif"}
                              />
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          {shipment.sent ? "Sent" : "Not Sent"}
                        </TooltipContent>
                      </Tooltip>

                      {selectedWarehouse !== "Archived" ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className="h-8 w-8 flex items-center justify-center rounded-full text-white transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                              onClick={() => handleRefreshShipment(shipment.id)}
                              disabled={refreshingShipmentIds.has(shipment.id)}
                              aria-busy={refreshingShipmentIds.has(shipment.id)}
                            >
                              {refreshingShipmentIds.has(shipment.id) ? (
                                <Loader2 className="h-6 w-6 animate-spin" />
                              ) : (
                                <MdRefresh className="h-6 w-6" />
                              )}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {refreshingShipmentIds.has(shipment.id)
                              ? "Refreshing..."
                              : "Refresh Shipment"}
                          </TooltipContent>
                        </Tooltip>
                      ) : null}

                      {selectedWarehouse !== "Archived" ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              className="cursor-pointer"
                              onClick={() => handleDeleteShipment(shipment.id)}
                            >
                              <FaTimes className="w-5 h-5 text-white" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>Delete Shipment</TooltipContent>
                        </Tooltip>
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              className="cursor-pointer"
                              onClick={() => handleRestoreShipment(shipment.id)}
                            >
                              <FaTrashRestore className="w-5 h-5 text-white" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>Restore Shipment</TooltipContent>
                        </Tooltip>
                      )}

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div>
                            {statusOptions.filter(
                              (option) => option.value == shipment.status
                            )[0]?.greenTick == true ? (
                              <Image
                                alt="sent"
                                width={22}
                                height={22}
                                src={"/sent-green.avif"}
                              />
                            ) : (
                              <Image
                                alt="sent"
                                width={22}
                                height={22}
                                src={"/sent.avif"}
                              />
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>Status Check</TooltipContent>
                      </Tooltip>

                      <div className="ml-5 w-56 flex items-center gap-x-1">
                        {shipment.company ? (
                          <FaBuilding className="w-4 h-4" />
                        ) : (
                          <FaUser className="w-4 h-4" />
                        )}
                        <span className="font-medium">
                          {shipment.orderName.length > 45
                            ? `${shipment.orderName.substring(0, 45)}...`
                            : shipment.orderName.substring(0, 45)}
                        </span>
                      </div>
                      <div className="w-88 flex">
                        <FaLocationDot className="w-4 h-4" />
                        <span
                          className="font-medium"
                          title={addressText || undefined}
                        >
                          {truncatedAddressText || "-"}
                        </span>
                      </div>
                      <div className="w-20 flex items-center">
                        <span className="font-medium">
                          {displayRegionCode || "-"}
                        </span>
                      </div>
                      {/* <div className="text-xs">{shipment.suburb}, {shipment.region} {shipment.postCode} {shipment.country}</div> */}
                      <div className="w-48 flex gap-x-2">
                        <FaCalendarDay className="w-4 h-4" />
                        <span className="font-medium">
                          {orderDateFormatter.format(
                            new Date(shipment.orderDate * 1000)
                          )}
                        </span>
                      </div>
                      <div className="w-28 flex items-center">
                        <DollarSign className="w-4 h-4" />
                        <span className="font-medium">
                          {parseFloat(shipment.totalPrice).toFixed(2)}
                        </span>
                      </div>
                      {/* <div className='flex gap-x-2 items-center w-28'>
                      <Truck className='w-4 h-4' />
                      {shipment.carrierCode ? shipment.carrierCode?.charAt(0).toUpperCase() + shipment.carrierCode?.slice(1) : shipment.carrierCodeDesired?.charAt(0).toUpperCase() + shipment.carrierCodeDesired?.slice(1)}
                    </div> */}
                      <div className="flex gap-x-1 items-center w-16">
                        <Clock className="w-4 h-4" />
                        <span className="font-medium">
                          {formatRelativeTime(shipment.lastApiUpdate)}
                        </span>
                      </div>
                      {selectedWarehouse !== "Archived" ? (
                        <>
                          <div className="w-16 flex gap-x-3 items-center">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className="cursor-pointer"
                                  onClick={() =>
                                    handleUnlStatusUpdate(shipment)
                                  }
                                >
                                  {shipment.unlDone ? (
                                    <PiCubeFocusBold className="w-6 h-6 text-green-500" />
                                  ) : (
                                    <PiCubeFocusBold
                                      size={22}
                                      className="text-gray-700"
                                    />
                                  )}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                {shipment.unlDone
                                  ? "UNL Completed"
                                  : "UNL Pending"}
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className={
                                    shipment.locked ? "cursor-pointer" : ""
                                  }
                                  onClick={
                                    shipment.locked
                                      ? () => handleLockUnlockShipment(shipment)
                                      : undefined
                                  }
                                >
                                  {shipment.locked ? (
                                    <Lock size={17} className="text-red-500" />
                                  ) : (
                                    <Unlock
                                      size={17}
                                      className="text-gray-700"
                                    />
                                  )}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                {shipment.locked ? "Locked" : "Un-Locked"}
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <Select
                            defaultValue={`${
                              shipment.status ? shipment.status : "-"
                            }`}
                            onValueChange={(value) =>
                              handleStatusChange(shipment.id, value)
                            }
                            disabled={isLoadingStatuses}
                          >
                            <SelectTrigger size="sm" className="w-[180px]">
                              <SelectValue placeholder="Select Status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem key={"-"} value="-">
                                Select Status
                              </SelectItem>
                              {statusOptions.map((option) => (
                                <SelectItem
                                  key={option.value}
                                  value={option.value}
                                >
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </>
                      ) : null}
                      <Button
                        size={"icon"}
                        variant="link"
                        className="-p-3 ml-10 cursor-pointer"
                        onClick={(e) =>
                          handleShipmentDetailClick(e, shipment.id)
                        }
                      >
                        {selectedShipmentId === shipment.id ? (
                          <ChevronDownIcon className="h-7 w-7 text-white rounded" />
                        ) : (
                          <ChevronRightIcon className="h-7 w-7 text-white rounded" />
                        )}
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
                        <MemoizedShipmentDetailView
                          setAction={setDetailAction}
                          shipment={detailedShipment}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            );
          })}
        </TableBody>
      </Table>
      {lastPage > 1 ? (
        <div className="flex items-center justify-center gap-3 pt-3 px-4 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.max(currentPage - 1, 1))}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <div className="flex items-center gap-1">
            {paginationPages.map((page, index) =>
              page === "..." ? (
                <span
                  key={`ellipsis-${index}`}
                  className="px-2 text-sm text-muted-foreground"
                >
                  &hellip;
                </span>
              ) : (
                <Button
                  key={`page-${page}`}
                  variant={page === currentPage ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(page)}
                  disabled={page === currentPage}
                  aria-current={page === currentPage ? "page" : undefined}
                >
                  {page}
                </Button>
              )
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.min(currentPage + 1, lastPage))}
            disabled={currentPage === lastPage}
          >
            Next
          </Button>
        </div>
      ) : null}
    </>
  );
}


