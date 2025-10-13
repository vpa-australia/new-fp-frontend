'use client';

import React, { useState, useEffect, useRef, useCallback, useLayoutEffect, useMemo } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Check,
  ChevronDownIcon,
  ChevronRightIcon,
  Clock,
  DollarSign,
  GripVertical,
  FileText,
  QrCode,
  SearchIcon,
  Send,
  Tag,
  Truck,
  X,
  Zap,
  Lock,
  Unlock,
  Loader,
  Settings,
  Loader2,
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
import { AiFillHdd } from "react-icons/ai";
import { PiCubeFocusBold } from "react-icons/pi";
import {
  FaLink,
  FaTimes,
  FaTrashRestore,
  FaUser,
  FaCalendarDay,
  FaBuilding,
} from "react-icons/fa";
import { FaLocationDot } from "react-icons/fa6";
import { Input } from "./ui/input";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { MdRefresh } from "react-icons/md";
import { GrStatusGood } from "react-icons/gr";
import { PdfViewer } from "./ui/pdf-viewer";
import Image from "next/image";
import { useAuth } from "@/contexts/AuthContext";

interface Shipment {
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

type SearchParameter = {
  name: string;
  column: string;
  type: string;
  weight: number;
};

type SearchParametersResponse = {
  success: boolean;
  searchParameters?: Record<string, SearchParameter>;
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

type OrderDatePresetKey =
  | "today"
  | "yesterday"
  | "last7"
  | "last30"
  | "thisMonth"
  | "lastMonth";

type OrderDateRange = {
  from: string;
  to: string;
};

type OrderDateFieldConfig = {
  from: { key: string; column: string } | null;
  to: { key: string; column: string } | null;
  single: { key: string; column: string } | null;
};

const formatDateForApi = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return [year, month, day].join("-");
};

const ORDER_DATE_PRESETS: Record<
  OrderDatePresetKey,
  { label: string; getRange: () => OrderDateRange }
> = {
  today: {
    label: "Today",
    getRange: () => {
      const now = new Date();
      return { from: formatDateForApi(now), to: formatDateForApi(now) };
    },
  },
  yesterday: {
    label: "Yesterday",
    getRange: () => {
      const now = new Date();
      now.setDate(now.getDate() - 1);
      return { from: formatDateForApi(now), to: formatDateForApi(now) };
    },
  },
  last7: {
    label: "Last 7 Days",
    getRange: () => {
      const now = new Date();
      const start = new Date(now);
      start.setDate(start.getDate() - 6);
      return { from: formatDateForApi(start), to: formatDateForApi(now) };
    },
  },
  last30: {
    label: "Last 30 Days",
    getRange: () => {
      const now = new Date();
      const start = new Date(now);
      start.setDate(start.getDate() - 29);
      return { from: formatDateForApi(start), to: formatDateForApi(now) };
    },
  },
  thisMonth: {
    label: "This Month",
    getRange: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: formatDateForApi(start), to: formatDateForApi(now) };
    },
  },
  lastMonth: {
    label: "Last Month",
    getRange: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: formatDateForApi(start), to: formatDateForApi(end) };
    },
  },
};

const ORDER_DATE_PRESET_KEYS = Object.keys(
  ORDER_DATE_PRESETS
) as OrderDatePresetKey[];
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
  shipments: Shipment[];
  currentPage: number;
  itemsPerPage: number;
  totalItems: number;
  lastPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  setItemsPerPage: React.Dispatch<React.SetStateAction<number>>;
  selectedWarehouse: string | null;
  shipmentsAreLoading: boolean;
  setSearchParams: React.Dispatch<React.SetStateAction<string>>;
};

type EdgePosition = "top" | "bottom" | "left" | "right";

type PdfFormState = {
  file: File | null;
  name: string;
  title: string;
  trackingCode: string;
  carrierCode: string;
};

const MemoizedShipmentDetailView = React.memo(ShipmentDetailView);

export function ShipmentsTable({
  setSearchParams,
  setAction,
  shipments,
  currentPage,
  itemsPerPage,
  setCurrentPage,
  setItemsPerPage,
  lastPage,
  selectedWarehouse,
  shipmentsAreLoading,
}: ShipmentsTableProps) {
  const [selectedShipmentId, setSelectedShipmentId] = useState<number | null>(
    null
  );
  const [selectedRows, setSelectedRows] = useState<Record<number, boolean>>({});
  const [pdfUrl, setPdfUrl] = useState<string>("");
  const { toast } = useToast();
  const { requireAuthToken } = useAuth();
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

  const handlePdfUpload = useCallback(
    async ({
      file,
      shipmentId,
      trackingCode,
      carrierCode,
      name,
      title,
    }: {
      file: File;
      shipmentId: number;
      trackingCode: string;
      carrierCode: string;
      name: string;
      title: string;
    }): Promise<void> => {
      const token = getAuthToken();

      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", name || file.name);
      formData.append("title", title || "Uploaded PDF");
      formData.append("tracking_code", trackingCode || "");
      formData.append("manual_carrier_code", carrierCode || "");

      const response = await fetch(
        `https://ship-orders.vpa.com.au/api/shipments/pdf/${shipmentId}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        let message = "Failed to upload PDF.";
        try {
          const errorData = await response.json();
          if (errorData?.message) {
            message = errorData.message;
          }
        } catch {
          // ignore JSON parsing errors
        }

        toast({
          title: "Upload Failed",
          description: message,
          variant: "destructive",
        });

        throw new Error(message);
      }

      toast({
        title: "Upload Successful",
        description: "PDF has been uploaded successfully.",
        variant: "success",
      });
    },
    [getAuthToken, toast]
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
  const [loadingSearchParams, setLoadingSearchParams] = useState(false);
  const [searchFields, setSearchFields] = useState<
    Record<string, SearchParameter>
  >({});
  const [searchValues, setSearchValues] = useState<Record<string, string>>({});
  const [initialSearchValues, setInitialSearchValues] = useState<
    Record<string, string>
  >({});
  const pendingSearchValuesRef = useRef<Record<string, string> | null>(null);
  const [selectedOrderDateRange, setSelectedOrderDateRange] = useState<
    "all" | "custom" | OrderDatePresetKey
  >("all");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("all");
  const [selectedCarrierFilter, setSelectedCarrierFilter] = useState("all");
  const [selectedManifestFilter, setSelectedManifestFilter] = useState("all");
  const [selectedStateFilter, setSelectedStateFilter] = useState("all");
  const [visibleFields, setVisibleFields] = useState<Record<string, boolean>>(
    {}
  );
  const [detailAction, setDetailAction] = useState(0);
  const [stillInProgress, setStillInProgress] = useState(false);
  const [openPdfDialogId, setOpenPdfDialogId] = useState<number | null>(null);
  const [pdfFormState, setPdfFormState] = useState<PdfFormState>({
    file: null,
    name: "",
    title: "",
    trackingCode: "",
    carrierCode: "",
  });
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

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

  const statusField = useMemo(
    () =>
      findSearchField(["status_id"], { matchAll: true }) ??
      findSearchField(["status"]),
    [findSearchField]
  );

  const carrierField = useMemo(
    () =>
      findSearchField(["carrier_code"], { matchAll: true }) ??
      findSearchField(["carrier", "shipping"]),
    [findSearchField]
  );

  const manifestField = useMemo(
    () => findSearchField(["manifest"], { matchAll: false }),
    [findSearchField]
  );

  const stateField = useMemo(
    () =>
      findSearchField(["state"], { matchAll: true }) ??
      findSearchField(["region"], { matchAll: true }) ??
      findSearchField(["state", "region"]),
    [findSearchField]
  );

  const carrierOptions = useMemo(() => {
    if (!shipments || shipments.length === 0) {
      return [] as string[];
    }

    const carriers = shipments
      .map((shipment) => shipment.carrierCode)
      .filter((code): code is string =>
        Boolean(code && code.trim().length > 0)
      );

    return Array.from(new Set(carriers)).sort((a, b) => a.localeCompare(b));
  }, [shipments]);

  const stateOptions = useMemo(() => {
    if (!shipments || shipments.length === 0) {
      return [] as string[];
    }

    const states = shipments
      .map((shipment) => shipment.region)
      .filter((state): state is string =>
        Boolean(state && state.trim().length > 0)
      );

    return Array.from(new Set(states)).sort((a, b) => a.localeCompare(b));
  }, [shipments]);

  const statusFilterLabel = useMemo(() => {
    if (selectedStatusFilter === "all") {
      return "All Status";
    }

    const match = statusOptions.find(
      (option) => option.value === selectedStatusFilter
    );

    return match?.label ?? "Custom Status";
  }, [selectedStatusFilter, statusOptions]);

  const carrierFilterLabel = useMemo(() => {
    if (selectedCarrierFilter === "all") {
      return "All Shipping";
    }
    return selectedCarrierFilter.toUpperCase();
  }, [selectedCarrierFilter]);

  const manifestFilterLabel = useMemo(() => {
    if (selectedManifestFilter === "all") {
      return "All Manifest";
    }

    return selectedManifestFilter === "true" ? "Manifested" : "Not Manifested";
  }, [selectedManifestFilter]);

  const stateFilterLabel = useMemo(() => {
    if (selectedStateFilter === "all") {
      return "All States";
    }

    return selectedStateFilter.toUpperCase();
  }, [selectedStateFilter]);

  const orderDateLabel = useMemo(() => {
    if (selectedOrderDateRange === "all") {
      return "Order Date";
    }
    if (selectedOrderDateRange === "custom") {
      return "Custom Range";
    }
    return ORDER_DATE_PRESETS[selectedOrderDateRange].label;
  }, [selectedOrderDateRange]);

  const orderDateFromKey = orderDateFieldConfig.from?.key ?? null;
  const orderDateToKey = orderDateFieldConfig.to?.key ?? null;
  const orderDateSingleKey = orderDateFieldConfig.single?.key ?? null;

  const orderDateFromValue = orderDateFromKey
    ? searchValues[orderDateFromKey] ?? ""
    : "";
  const orderDateToValue = orderDateToKey
    ? searchValues[orderDateToKey] ?? ""
    : "";
  const orderDateSingleValue = orderDateSingleKey
    ? searchValues[orderDateSingleKey] ?? ""
    : "";

  const orderDateInputsDisabled =
    loadingSearchParams ||
    (!orderDateFromKey && !orderDateToKey && !orderDateSingleKey);

  const [orderDateDraftFrom, setOrderDateDraftFrom] = useState("");
  const [orderDateDraftTo, setOrderDateDraftTo] = useState("");
  const [orderDateDraftSingle, setOrderDateDraftSingle] = useState("");
  const [refreshingShipmentIds, setRefreshingShipmentIds] = useState<
    Set<number>
  >(new Set());

  useEffect(() => {
    if (orderDateFromKey && orderDateToKey) {
      setOrderDateDraftFrom(orderDateFromValue);
      setOrderDateDraftTo(orderDateToValue);
      setOrderDateDraftSingle("");
      return;
    }

    if (orderDateSingleKey) {
      setOrderDateDraftSingle(orderDateSingleValue);
      setOrderDateDraftFrom("");
      setOrderDateDraftTo("");
      return;
    }

    setOrderDateDraftFrom("");
    setOrderDateDraftTo("");
    setOrderDateDraftSingle("");
  }, [
    orderDateFromKey,
    orderDateToKey,
    orderDateSingleKey,
    orderDateFromValue,
    orderDateToValue,
    orderDateSingleValue,
  ]);

  const orderDateDraftApplyDisabled =
    orderDateInputsDisabled ||
    (orderDateFromKey && orderDateToKey
      ? orderDateDraftFrom === orderDateFromValue &&
        orderDateDraftTo === orderDateToValue
      : orderDateSingleKey
      ? orderDateDraftSingle === orderDateSingleValue
      : true);

  const executeSearch = useCallback(
    (values: Record<string, string>) => {
      if (!searchFields || Object.keys(searchFields).length === 0) {
        setSearchParams("");
        setCurrentPage(1);
        fetchShipments();
        return;
      }

      const filters = Object.entries(values)
        .filter(([key, value]) => {
          if (!searchFields[key]) {
            return false;
          }

          if (value === undefined || value === null) {
            return false;
          }

          if (typeof value === "string") {
            return value.trim().length > 0;
          }

          return true;
        })
        .reduce((acc, [key, value]) => {
          const column = searchFields[key]?.column;
          if (column) {
            acc[column] = typeof value === "string" ? value.trim() : value;
          }
          return acc;
        }, {} as Record<string, string>);

      const queryString = Object.entries(filters)
        .map(
          ([key, value]) =>
            `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
        )
        .join("&");

      setSearchParams(queryString);
      setCurrentPage(1);
      fetchShipments();
    },
    [fetchShipments, searchFields, setCurrentPage, setSearchParams]
  );

  const applyAndExecute = useCallback(
    (updater: (current: Record<string, string>) => Record<string, string>) => {
      setSearchValues((current) => {
        const next = updater(current);
        pendingSearchValuesRef.current = next;
        return next;
      });
    },
    [setSearchValues]
  );

  const updateSearchValue = useCallback(
    (fieldKey: string, value: string) =>
      applyAndExecute((current) => ({
        ...current,
        [fieldKey]: value,
      })),
    [applyAndExecute]
  );

  // Run searches after state updates commit to avoid parent updates during render
  useEffect(() => {
    if (!pendingSearchValuesRef.current) {
      return;
    }

    const nextValues = pendingSearchValuesRef.current;
    pendingSearchValuesRef.current = null;
    executeSearch(nextValues);
  }, [searchValues, executeSearch]);

  const handleClearFilters = useCallback(() => {
    const template =
      Object.keys(initialSearchValues).length > 0
        ? initialSearchValues
        : searchValues;

    const clearedValues = Object.keys(template).reduce((acc, key) => {
      acc[key] = "";
      return acc;
    }, {} as Record<string, string>);

    setSelectedOrderDateRange("all");
    setSelectedStatusFilter("all");
    setSelectedCarrierFilter("all");
    setSelectedManifestFilter("all");
    setSelectedStateFilter("all");

    applyAndExecute(() => ({ ...clearedValues }));
  }, [applyAndExecute, initialSearchValues, searchValues]);

  const handleOrderDateFilterChange = useCallback(
    (value: string) => {
      if (value === "custom") {
        setSelectedOrderDateRange("custom");
        return;
      }

      const nextSelected =
        value === "all" ? "all" : (value as OrderDatePresetKey);

      setSelectedOrderDateRange(nextSelected);

      if (
        !orderDateFieldConfig.from &&
        !orderDateFieldConfig.to &&
        !orderDateFieldConfig.single
      ) {
        return;
      }

      applyAndExecute((current) => {
        const next = { ...current };

        if (orderDateFieldConfig.from) {
          next[orderDateFieldConfig.from.key] = "";
        }
        if (orderDateFieldConfig.to) {
          next[orderDateFieldConfig.to.key] = "";
        }
        if (orderDateFieldConfig.single) {
          next[orderDateFieldConfig.single.key] = "";
        }

        if (nextSelected !== "all") {
          const range =
            ORDER_DATE_PRESETS[nextSelected as OrderDatePresetKey].getRange();

          if (range) {
            if (orderDateFieldConfig.from && orderDateFieldConfig.to) {
              next[orderDateFieldConfig.from.key] = range.from;
              next[orderDateFieldConfig.to.key] = range.to;
            } else if (orderDateFieldConfig.single) {
              next[orderDateFieldConfig.single.key] = range.from;
            }
          }
        }

        return next;
      });
    },
    [applyAndExecute, orderDateFieldConfig]
  );

  const handleOrderDateInputChange = useCallback(
    (field: "from" | "to" | "single", value: string) => {
      if (field === "from") {
        setOrderDateDraftFrom(value);
        return;
      }
      if (field === "to") {
        setOrderDateDraftTo(value);
        return;
      }
      setOrderDateDraftSingle(value);
    },
    []
  );

  const handleApplyOrderDateInputs = useCallback(() => {
    if (orderDateFromKey && orderDateToKey) {
      const hasValues = Boolean(orderDateDraftFrom || orderDateDraftTo);
      setSelectedOrderDateRange(hasValues ? "custom" : "all");
      applyAndExecute((current) => ({
        ...current,
        [orderDateFromKey]: orderDateDraftFrom,
        [orderDateToKey]: orderDateDraftTo,
      }));
      return;
    }

    if (orderDateSingleKey) {
      const hasValue = Boolean(orderDateDraftSingle);
      setSelectedOrderDateRange(hasValue ? "custom" : "all");
      applyAndExecute((current) => ({
        ...current,
        [orderDateSingleKey]: orderDateDraftSingle,
      }));
    }
  }, [
    applyAndExecute,
    orderDateDraftFrom,
    orderDateDraftSingle,
    orderDateDraftTo,
    orderDateFromKey,
    orderDateSingleKey,
    orderDateToKey,
  ]);

  const handleStatusFilterChange = useCallback(
    (value: string) => {
      setSelectedStatusFilter(value);
      if (!statusField) {
        return;
      }

      applyAndExecute((current) => ({
        ...current,
        [statusField.key]: value === "all" ? "" : value,
      }));
    },
    [applyAndExecute, statusField]
  );

  const handleCarrierFilterChange = useCallback(
    (value: string) => {
      setSelectedCarrierFilter(value);
      if (!carrierField) {
        return;
      }

      applyAndExecute((current) => ({
        ...current,
        [carrierField.key]: value === "all" ? "" : value,
      }));
    },
    [applyAndExecute, carrierField]
  );

  const handleManifestFilterChange = useCallback(
    (value: string) => {
      setSelectedManifestFilter(value);
      if (!manifestField) {
        return;
      }

      applyAndExecute((current) => ({
        ...current,
        [manifestField.key]: value === "all" ? "" : value,
      }));
    },
    [applyAndExecute, manifestField]
  );

  const handleStateFilterChange = useCallback(
    (value: string) => {
      setSelectedStateFilter(value);
      if (!stateField) {
        return;
      }

      applyAndExecute((current) => ({
        ...current,
        [stateField.key]: value === "all" ? "" : value,
      }));
    },
    [applyAndExecute, stateField]
  );

  useEffect(() => {
    if (!statusField) {
      return;
    }

    const value = searchValues[statusField.key] ?? "";

    if (!value && selectedStatusFilter !== "all") {
      setSelectedStatusFilter("all");
      return;
    }

    if (value && value !== selectedStatusFilter) {
      setSelectedStatusFilter(value);
    }
  }, [searchValues, statusField, selectedStatusFilter]);

  useEffect(() => {
    if (!carrierField) {
      return;
    }

    const value = searchValues[carrierField.key] ?? "";

    if (!value && selectedCarrierFilter !== "all") {
      setSelectedCarrierFilter("all");
      return;
    }

    if (value && value !== selectedCarrierFilter) {
      setSelectedCarrierFilter(value);
    }
  }, [carrierField, searchValues, selectedCarrierFilter]);

  useEffect(() => {
    if (!manifestField) {
      return;
    }

    const value = searchValues[manifestField.key] ?? "";
    let normalized = value.trim().toLowerCase();
    if (normalized === "1") {
      normalized = "true";
    } else if (normalized === "0") {
      normalized = "false";
    }

    if (!normalized && selectedManifestFilter !== "all") {
      setSelectedManifestFilter("all");
      return;
    }

    if (normalized && normalized !== selectedManifestFilter) {
      setSelectedManifestFilter(normalized);
    }
  }, [manifestField, searchValues, selectedManifestFilter]);

  useEffect(() => {
    if (!stateField) {
      return;
    }

    const value = searchValues[stateField.key] ?? "";

    if (!value && selectedStateFilter !== "all") {
      setSelectedStateFilter("all");
      return;
    }

    if (value && value !== selectedStateFilter) {
      setSelectedStateFilter(value);
    }
  }, [searchValues, selectedStateFilter, stateField]);

  useEffect(() => {
    const hasOrderFields =
      orderDateFieldConfig.from ||
      orderDateFieldConfig.to ||
      orderDateFieldConfig.single;

    if (!hasOrderFields) {
      return;
    }

    let fromValue = "";
    let toValue = "";

    if (orderDateFieldConfig.from && orderDateFieldConfig.to) {
      fromValue = searchValues[orderDateFieldConfig.from.key] ?? "";
      toValue = searchValues[orderDateFieldConfig.to.key] ?? "";
    } else if (orderDateFieldConfig.single) {
      const singleValue = searchValues[orderDateFieldConfig.single.key] ?? "";
      fromValue = singleValue;
      toValue = singleValue;
    }

    if (!fromValue && !toValue) {
      if (selectedOrderDateRange !== "all") {
        setSelectedOrderDateRange("all");
      }
      return;
    }

    const matchedPreset = ORDER_DATE_PRESET_KEYS.find((key) => {
      const range = ORDER_DATE_PRESETS[key].getRange();
      return range.from === fromValue && range.to === toValue;
    });

    if (matchedPreset) {
      if (selectedOrderDateRange !== matchedPreset) {
        setSelectedOrderDateRange(matchedPreset);
      }
      return;
    }

    const customValue: typeof selectedOrderDateRange = "custom";
    if (selectedOrderDateRange !== customValue) {
      setSelectedOrderDateRange(customValue);
    }
  }, [orderDateFieldConfig, searchValues, selectedOrderDateRange]);

  useEffect(() => {
    const fetchSearchParameters = async () => {
      setLoadingSearchParams(true);
      try {
        const token = getAuthToken();

        const response = await fetch(
          "https://ship-orders.vpa.com.au/api/shipments/search/parameters",
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
            },
          }
        );

        if (!response.ok) {
          throw new Error("Failed to fetch search parameters");
        }

        const data = (await response.json()) as SearchParametersResponse;
        if (data && data.success && data.searchParameters) {
          setSearchFields(data.searchParameters);

          const parameterEntries = Object.entries(data.searchParameters);

          // Prefer standard customer/address fields when deciding defaults
          const essentialFieldKeywords = [
            "customer",
            "address",
            "first_name",
            "last_name",
            "firstname",
            "lastname",
          ];
          const defaultFieldKeywords = [
            "customer",
            "address",
            "suburb",
            "postcode",
            "city",
            "state",
            "first_name",
            "last_name",
            "firstname",
            "lastname",
          ];

          const findMatchingKeys = (keywords: string[]) =>
            parameterEntries
              .filter(([key, field]) => {
                const haystack =
                  `${key} ${field.name} ${field.column}`.toLowerCase();
                return keywords.some((keyword) => haystack.includes(keyword));
              })
              .map(([key]) => key);

          const essentialFieldKeys = new Set(
            findMatchingKeys(essentialFieldKeywords)
          );

          const defaultFieldKeys = new Set(
            findMatchingKeys(defaultFieldKeywords)
          );

          const topWeightedKeys = parameterEntries
            .slice()
            .sort(([, a], [, b]) => b.weight - a.weight)
            .slice(0, 5)
            .map(([key]) => key);

          topWeightedKeys.forEach((key) => defaultFieldKeys.add(key));
          essentialFieldKeys.forEach((key) => defaultFieldKeys.add(key));

          const applyDefaultVisibility = (
            target: Record<string, boolean>
          ): Record<string, boolean> => {
            parameterEntries.forEach(([key]) => {
              target[key] = defaultFieldKeys.has(key);
            });
            return target;
          };

          // Initialize visible fields and search values
          let initialVisibleFields: Record<string, boolean> = {};
          const initialSearchValueMap: Record<string, string> = {};

          // Try to load saved visible fields from localStorage
          const savedVisibleFields = localStorage.getItem(
            "searchVisibleFields"
          );

          if (savedVisibleFields) {
            try {
              // Parse saved fields and validate they still exist in the API response
              const parsedFields = JSON.parse(savedVisibleFields);
              initialVisibleFields = parameterEntries.reduce((acc, [key]) => {
                acc[key] = parsedFields[key] === true;
                return acc;
              }, {} as Record<string, boolean>);

              // If no fields are visible (all false), show defaults
              if (
                !Object.values(initialVisibleFields).some(
                  (value) => value === true
                )
              ) {
                initialVisibleFields =
                  applyDefaultVisibility(initialVisibleFields);
              }
            } catch (error: unknown) {
              console.error("Error parsing saved search fields:", error);
              initialVisibleFields = applyDefaultVisibility({});
            }
          } else {
            initialVisibleFields = applyDefaultVisibility({});
          }

          // Always ensure essential fields remain visible
          essentialFieldKeys.forEach((key) => {
            if (key in initialVisibleFields) {
              initialVisibleFields[key] = true;
            }
          });

          localStorage.setItem(
            "searchVisibleFields",
            JSON.stringify(initialVisibleFields)
          );

          // Initialize all search values as empty
          parameterEntries.forEach(([key]) => {
            initialSearchValueMap[key] = ""; // Empty values by default
          });

          setVisibleFields({ ...initialVisibleFields });
          const blankValues = { ...initialSearchValueMap };
          setInitialSearchValues(blankValues);
          setSearchValues(blankValues);
        }
      } catch (error: unknown) {
        console.error("Error fetching search parameters:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to fetch search parameters.",
        });
      } finally {
        setLoadingSearchParams(false);
      }
    };

    fetchSearchParameters();

    const fetchStatusOptions = async () => {
      setIsLoadingStatuses(true);
      try {
        const token = getAuthToken();

        const response = await fetch(
          "https://ship-orders.vpa.com.au/api/platform/statuses",
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
            },
          }
        );

        if (!response.ok) {
          throw new Error("Failed to fetch status options");
        }

        const data = (await response.json()) as StatusApiResponse;
        if (data && data.success && data.statuses) {
          const formattedStatuses = data.statuses.map((status) => ({
            value: status.id.toString(),
            label: status.name,
            allowShipped: status.allowShipped,
            greenTick: status.greenTick,
          }));

          setStatusOptions(formattedStatuses);
        }
      } catch (error: unknown) {
        console.error("Error fetching status options:", error);
        setStatusOptions([]);
      } finally {
        setIsLoadingStatuses(false);
      }
    };

    fetchStatusOptions();

    const fetchCarrierSummaries = async () => {
      try {
        const token = getAuthToken();

        const response = await fetch(
          "https://ship-orders.vpa.com.au/api/platform/carriers",
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
            },
          }
        );

        if (!response.ok) {
          throw new Error("Failed to fetch carriers");
        }

        const data = (await response.json()) as CarriersResponse;
        if (data.success && data.carriers) {
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
        console.error("Error fetching carriers:", error);
        setCarrierColors({});
      }
    };

    fetchCarrierSummaries();
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

  const isAllSelected =
    shipments?.length > 0 &&
    shipments.every((shipment) => selectedRows[shipment.id]);

  const handleSelectRow = useCallback(
    (id: number, checked: boolean) => {
      setSelectedRows((prev) => ({ ...prev, [id]: checked }));
    },
    [setSelectedRows]
  );

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      const newSelectedRows: Record<number, boolean> = {};
      if (checked) {
        shipments?.forEach((shipment) => {
          newSelectedRows[shipment.id] = true;
        });
      }
      setSelectedRows(newSelectedRows);
    },
    [shipments, setSelectedRows]
  );

  const handleStatusChange = useCallback(
    async (shipmentId: number | number[], newStatusId: string) => {
      const token = getAuthToken();

      const shipmentIdsString = Array.isArray(shipmentId)
        ? shipmentId.join(",")
        : String(shipmentId);
      const apiUrl = `https://ship-orders.vpa.com.au/api/shipments/status/${newStatusId}?shipment_ids=${shipmentIdsString}`;

      try {
        const response = await fetch(apiUrl, {
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

        setAction((prev) => prev + 1);
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
    [getAuthToken, setAction, toast]
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

  const handleRefreshShipment = useCallback(
    async (shipmentId: number) => {
      const token = getAuthToken();

      const apiUrl = `https://ship-orders.vpa.com.au/api/shipments/refresh/${shipmentId}`;

      setRefreshingShipmentIds((prev) => {
        const next = new Set(prev);
        next.add(shipmentId);
        return next;
      });

      try {
        const response = await fetch(apiUrl, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.message ||
              `Failed to refresh shipment: ${response.statusText}`
          );
        }

        await response.json();
        toast({
          variant: "success",
          title: "Shipment Refreshed",
          description: "Shipment data has been refreshed successfully.",
        });

        setAction((prev) => prev + 1);
      } catch (error: unknown) {
        console.error("Error refreshing shipment:", error);
        toast({
          variant: "destructive",
          title: "Refresh Failed",
          description: getErrorMessage(error, "Failed to refresh shipment."),
        });
      } finally {
        setRefreshingShipmentIds((prev) => {
          const next = new Set(prev);
          next.delete(shipmentId);
          return next;
        });
      }
    },
    [getAuthToken, setAction, toast]
  );

  const handleMarkShipmentsAsShipped = useCallback(async () => {
    const checkedIds = Object.entries(selectedRows)
      .filter(([, isChecked]) => isChecked)
      .map(([id]) => id.toString());

    if (checkedIds.length === 0) {
      toast({
        variant: "destructive",
        title: "No Shipments Selected",
        description: "Please select at least one shipment to mark as shipped.",
      });
      return;
    }

    const token = getAuthToken();

    try {
      const response = await fetch(
        `https://ship-orders.vpa.com.au/api/shipments/shipped/1?shipment_ids=${checkedIds.join(
          ","
        )}`,
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
      setAction((prev) => prev + 1);

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
  }, [getAuthToken, selectedRows, setAction, setSelectedRows, toast]);

  const handleMarkShipmentsAsNotShipped = useCallback(async () => {
    const checkedIds = Object.entries(selectedRows)
      .filter(([, isChecked]) => isChecked)
      .map(([id]) => id.toString());

    if (checkedIds.length === 0) {
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
      const response = await fetch(
        `https://ship-orders.vpa.com.au/api/shipments/shipped/0?shipment_ids=${checkedIds.join(
          ","
        )}`,
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

      setAction((prev) => prev + 1);

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
  }, [getAuthToken, selectedRows, setAction, setSelectedRows, toast]);

  useEffect(() => {
    if (!selectedShipmentId) {
      return;
    }

    const abortController = new AbortController();
    let isActive = true;

    setIsLoadingDetail(true);

    (async () => {
      try {
        const token = getAuthToken();

        const response = await fetch(
          `https://ship-orders.vpa.com.au/api/shipments/${selectedShipmentId}?columns=otherShipments,orderLines,shipmentPackages,shipmentQuotes`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
            },
            signal: abortController.signal,
          }
        );

        if (abortController.signal.aborted || !isActive) {
          return;
        }

        if (!response.ok) {
          throw new Error("Failed to fetch shipment details");
        }

        const data = (await response.json()) as ShipmentDetailResponse;
        if (!isActive) {
          return;
        }
        setDetailedShipment(data);
      } catch (error: unknown) {
        if (
          abortController.signal.aborted ||
          (error instanceof DOMException && error.name === "AbortError")
        ) {
          return;
        }
        console.error("Error fetching shipment details:", error);
        if (!isActive) {
          return;
        }
        setDetailedShipment(null);
        toast({
          variant: "destructive",
          title: "Error",
          description: getErrorMessage(
            error,
            "Failed to fetch shipment details."
          ),
        });
      } finally {
        if (isActive) {
          setIsLoadingDetail(false);
        }
      }
    })();

    return () => {
      isActive = false;
      abortController.abort();
    };
  }, [detailAction, getAuthToken, selectedShipmentId, toast]);

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

        const response = await fetch(
          `https://ship-orders.vpa.com.au/api/shipments/unlDone/${
            shipment.unlDone ? 0 : 1
          }?shipment_ids=${shipment.id}`,
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
        const response = await fetch(
          `https://ship-orders.vpa.com.au/api/shipments/${endpoint}/${shipment.id}`,
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

      const apiUrl = `https://ship-orders.vpa.com.au/api/shipments/archive/${shipmentId}`;

      try {
        const response = await fetch(apiUrl, {
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

  type QuickPrintOptions = {
    suppressSuccessToast?: boolean;
    title?: string;
    incrementAction?: boolean;
  };

  const quickPrintShipments = useCallback(
    async (
      shipmentIds: number[],
      {
        suppressSuccessToast = false,
        title,
        incrementAction = true,
      }: QuickPrintOptions = {}
    ) => {
      if (shipmentIds.length === 0) {
        return;
      }

      const token = getAuthToken();

      try {
        const response = await fetch(
          `https://ship-orders.vpa.com.au/api/pdf/labels/quickPrint?shipment_ids=${shipmentIds.join(
            ","
          )}`,
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
    [getAuthToken, setAction, toast]
  );

  const handleQuickPrint = useCallback(async () => {
    const selectedIds = Object.entries(selectedRows)
      .filter(([, isChecked]) => isChecked)
      .map(([id]) => Number(id));

    if (selectedIds.length === 0) {
      toast({
        variant: "destructive",
        title: "No Shipments Selected",
        description: "Please select at least one shipment to quick print.",
      });
      return;
    }

    try {
      await quickPrintShipments(selectedIds);
    } catch {
      // quickPrintShipments already reports the failure
    }
  }, [quickPrintShipments, selectedRows, toast]);

  const handleInvoicePrint = useCallback(async () => {
    const selectedIds = Object.entries(selectedRows)
      .filter(([, isChecked]) => isChecked)
      .map(([id]) => id);

    if (selectedIds.length === 0) {
      toast({
        variant: "destructive",
        title: "No Shipments Selected",
        description: "Please select at least one shipment to quick print.",
      });
      return;
    }

    const token = getAuthToken();

    try {
      const response = await fetch(
        `https://ship-orders.vpa.com.au/api/pdf/invoices?shipment_ids=${selectedIds.join(
          ","
        )}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/pdf",
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message ||
            `Failed to print Invoices: ${response.statusText}`
        );
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      setPdfUrl(url);
      setIsPdfOpen(true);
      setPdfTitle("Invoice Preview");

      toast({
        variant: "success",
        title: "Invoice Generated",
        description: "The invoice PDF has been generated successfully.",
      });
      setAction((prev) => prev + 1);
    } catch (error: unknown) {
      console.error("Error during Invoices print:", error);
      toast({
        variant: "destructive",
        title: "Invoice Generation Failed",
        description: getErrorMessage(error, "Failed to generate invoice PDF."),
      });
    }
  }, [getAuthToken, selectedRows, setAction, toast]);

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

        const response = await fetch(
          `https://ship-orders.vpa.com.au/api/shipments/unarchive/${shipmentId}`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

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
        const response = await fetch(
          `https://ship-orders.vpa.com.au/api/pdf/labels?shipment_ids=${shipmentId}`,
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
    async (shipmentIds: number[]) => {
      if (shipmentIds.length === 0) {
        throw new Error("No shipment ids provided for label generation.");
      }

      const token = getAuthToken();
      const baseUrl =
        "https://ship-orders.vpa.com.au/api/pdf/labels/generateLabels";
      const query = `shipment_ids=${shipmentIds.join(",")}`;

      const performRequest = async (
        method: "POST" | "PUT"
      ): Promise<{
        ok: boolean;
        status: number | null;
        message?: string;
      }> => {
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

          const response = await fetch(`${baseUrl}?${query}`, init);

          if (response.ok) {
            return { ok: true, status: response.status };
          }

          const errorData = await response.json().catch(() => null);
          const message =
            (errorData &&
            typeof errorData === "object" &&
            errorData !== null &&
            "message" in errorData
              ? String(
                  (errorData as { message?: unknown }).message ??
                    "Failed to generate labels."
                )
              : undefined) ??
            `Failed to generate labels: ${response.status} ${response.statusText}`;

          return {
            ok: false,
            status: response.status,
            message,
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
    },
    [getAuthToken]
  );

  const handleGenerateLabels = useCallback(async () => {
    const selectedIds = Object.entries(selectedRows)
      .filter(([, isChecked]) => isChecked)
      .map(([id]) => Number(id));

    if (selectedIds.length === 0) {
      toast({
        variant: "destructive",
        title: "No Shipments Selected",
        description: "Please select at least one shipment to generate labels.",
      });
      return;
    }

    try {
      setStillInProgress(true);
      await generateLabelsForShipments(selectedIds);

      toast({
        variant: "success",
        title: "Labels Generated",
        description: "Labels have been generated successfully.",
      });
      setAction((prev) => prev + 1);
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
    } catch (error: unknown) {
      console.error("Error generating labels:", error);
      toast({
        variant: "destructive",
        title: "Generation Failed",
        description: getErrorMessage(error, "Failed to generate labels."),
      });
    } finally {
      setStillInProgress(false);
    }
  }, [
    generateLabelsForShipments,
    quickPrintShipments,
    selectedRows,
    setAction,
    setStillInProgress,
    toast,
  ]);

  const handlePrintLabel = useCallback(
    async (shipmentId: number) => {
      try {
        await generateLabelsForShipments([shipmentId]);

        toast({
          variant: "success",
          title: "Labels Generated",
          description: "Labels have been generated successfully.",
        });
        setAction((prev) => prev + 1);
      } catch (error: unknown) {
        console.error("Error generating labels:", error);
        toast({
          variant: "destructive",
          title: "Generation Failed",
          description: getErrorMessage(error, "Failed to generate labels."),
        });
      }
    },
    [generateLabelsForShipments, setAction, toast]
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
      <div className="flex flex-1 justify-center items-center h-[90vh] w-full">
        <Loader className="animate-spin" />
      </div>
    );
  }

  if (stillInProgress) {
    return (
      <div className="flex flex-1 justify-center items-center h-[90vh] w-full">
        <p>
          <Loader className="animate-spin" />
        </p>
        <p>Still in progress...</p>
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
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                disabled={isLoadingStatuses || selectedWarehouse === "All"}
                onClick={handleInvoicePrint}
                variant="outline"
                size="icon"
                className="flex-grow-0"
              >
                <FileText className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side={getTooltipSide()}>
              <p>Print Invoices</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                disabled={isLoadingStatuses || selectedWarehouse === "All"}
                variant="outline"
                size="icon"
                onClick={handleGenerateLabels}
              >
                <Tag className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side={getTooltipSide()}>
              <p>Generate Labels</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                disabled={isLoadingStatuses || selectedWarehouse === "All"}
                variant="outline"
                size="icon"
                onClick={handleQuickPrint}
              >
                <Zap className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side={getTooltipSide()}>
              <p>Quick Print</p>
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
                <Send className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side={getTooltipSide()}>
              <p>Manifest</p>
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
      <Table className="">
        <TableHeader>
          <TableRow className="">
            <TableHead className="mb-3">
              <div className="flex items-center space-x-10 pb-3 px-3">
                <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={(checked) =>
                    handleSelectAll(Boolean(checked))
                  }
                  aria-label="Select all rows"
                  className="h-8 w-8 rounded-full data-[state=checked]:bg-[#3D753A] data-[state=checked]:text-primary-foreground border-gray-300 focus-visible:ring-sky-500"
                />
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="cursor-pointer rounded-full h-10 w-10 bg-[#3D753A] text-white hover:text-white hover:bg-black"
                    >
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
                      <Button
                        variant="outline"
                        type="button"
                        onClick={handleClearFilters}
                      >
                        CLEAR
                      </Button>
                    </div>
                    <div className="py-4 pt-0 space-y-4">
                      {loadingSearchParams ? (
                        <div className="flex justify-center items-center py-4">
                          <Loader className="h-6 w-6 animate-spin mr-2" />
                          <span>Loading search fields...</span>
                        </div>
                      ) : (
                        <>
                          <div className="grid gap-4 sm:grid-cols-2">
                            {Object.entries(searchFields)
                              .sort((a, b) => b[1].weight - a[1].weight) // Sort by weight (highest first)
                              .filter(([key]) => visibleFields[key])
                              .map(([key, field]) => (
                                <div key={key} className="flex flex-col gap-2">
                                  <div className="flex justify-between items-center">
                                    <Label htmlFor={key}>{field.name}</Label>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        const updatedFields = {
                                          ...visibleFields,
                                          [key]: false,
                                        };
                                        setVisibleFields(updatedFields);
                                        // Save to localStorage
                                        localStorage.setItem(
                                          "searchVisibleFields",
                                          JSON.stringify(updatedFields)
                                        );
                                        applyAndExecute((current) => ({
                                          ...current,
                                          [key]: "",
                                        }));
                                      }}
                                      className="h-6 w-6 p-0"
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                  {field.type === "date" ? (
                                    <Input
                                      id={key}
                                      type="date"
                                      value={searchValues[key] || ""}
                                      className="w-full"
                                      onChange={(e) => {
                                        updateSearchValue(key, e.target.value);
                                      }}
                                    />
                                  ) : field.type === "boolean" ? (
                                    <Select
                                      value={searchValues[key] || ""}
                                      onValueChange={(value) => {
                                        updateSearchValue(key, value);
                                      }}
                                    >
                                      <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select..." />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="true">
                                          Yes
                                        </SelectItem>
                                        <SelectItem value="false">
                                          No
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <Input
                                      id={key}
                                      placeholder={field.name}
                                      value={searchValues[key] || ""}
                                      className="w-full"
                                      onChange={(e) => {
                                        updateSearchValue(key, e.target.value);
                                      }}
                                    />
                                  )}
                                </div>
                              ))}
                          </div>

                          {!loadingSearchParams &&
                            Object.keys(searchFields).some(
                              (key) => !visibleFields[key]
                            ) && (
                              <div className="mt-2">
                                <Select
                                  onValueChange={(value) => {
                                    const updatedFields = {
                                      ...visibleFields,
                                      [value]: true,
                                    };
                                    setVisibleFields(updatedFields);
                                    // Save to localStorage
                                    localStorage.setItem(
                                      "searchVisibleFields",
                                      JSON.stringify(updatedFields)
                                    );
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
                        </>
                      )}
                    </div>
                    <DialogFooter className="justify-end space-x-2">
                      <DialogClose asChild>
                        <Button variant="outline">CLOSE</Button>
                      </DialogClose>
                      <Button
                        variant="outline"
                        type="button"
                        onClick={() => {
                          handleClearFilters();
                          if (searchFields) {
                            const topFields = Object.entries(searchFields)
                              .sort((a, b) => b[1].weight - a[1].weight)
                              .slice(0, 5)
                              .map(([k]) => k);
                            const initialVisibility = Object.keys(
                              searchFields
                            ).reduce((acc, key) => {
                              acc[key] = topFields.includes(key);
                              return acc;
                            }, {} as Record<string, boolean>);
                            setVisibleFields(initialVisibility);
                            localStorage.setItem(
                              "searchVisibleFields",
                              JSON.stringify(initialVisibility)
                            );
                          }
                        }}
                      >
                        CLEAR
                      </Button>
                      <Button
                        type="button"
                        className="bg-[#3D753A] hover:bg-black text-white"
                        onClick={() => executeSearch(searchValues)}
                      >
                        SEARCH
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <Select
                  value={String(itemsPerPage)}
                  onValueChange={(value) => setItemsPerPage(Number(value))}
                >
                  <SelectTrigger className="h-10 rounded-full bg-[#3D753A] text-white hover:bg-black px-4 text-sm w-auto">
                    <SelectValue className="text-white" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                  <Select
                    value={selectedOrderDateRange}
                    onValueChange={handleOrderDateFilterChange}
                    disabled={
                      loadingSearchParams ||
                      (!orderDateFieldConfig.from &&
                        !orderDateFieldConfig.to &&
                        !orderDateFieldConfig.single)
                    }
                  >
                    <SelectTrigger className="h-10 rounded-full bg-[#3D753A] text-white hover:bg-black px-4 text-sm w-auto">
                      <div className="text-white flex items-center">
                        <FaCalendarDay className="h-5 w-5 mr-2 text-white" />
                        {orderDateLabel}
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Order Dates</SelectItem>
                      {ORDER_DATE_PRESET_KEYS.map((key) => (
                        <SelectItem key={key} value={key}>
                          {ORDER_DATE_PRESETS[key].label}
                        </SelectItem>
                      ))}
                      {selectedOrderDateRange === "custom" && (
                        <SelectItem value="custom" disabled>
                          Custom Range
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {orderDateFromKey && orderDateToKey ? (
                    <>
                      <Input
                        type="date"
                        value={orderDateDraftFrom}
                        onChange={(event) =>
                          handleOrderDateInputChange("from", event.target.value)
                        }
                        disabled={orderDateInputsDisabled}
                        className="h-10 w-[150px] rounded-full border px-3 text-sm"
                      />
                      <span className="text-sm text-gray-500">to</span>
                      <Input
                        type="date"
                        value={orderDateDraftTo}
                        onChange={(event) =>
                          handleOrderDateInputChange("to", event.target.value)
                        }
                        disabled={orderDateInputsDisabled}
                        className="h-10 w-[150px] rounded-full border px-3 text-sm"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleApplyOrderDateInputs}
                        disabled={orderDateDraftApplyDisabled}
                        className="h-10 px-4"
                      >
                        Apply
                      </Button>
                    </>
                  ) : orderDateSingleKey ? (
                    <>
                      <Input
                        type="date"
                        value={orderDateDraftSingle}
                        onChange={(event) =>
                          handleOrderDateInputChange(
                            "single",
                            event.target.value
                          )
                        }
                        disabled={orderDateInputsDisabled}
                        className="h-10 w-[150px] rounded-full border px-3 text-sm"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleApplyOrderDateInputs}
                        disabled={orderDateDraftApplyDisabled}
                        className="h-10 px-4"
                      >
                        Apply
                      </Button>
                    </>
                  ) : null}
                </div>
                <Select
                  value={selectedStatusFilter}
                  onValueChange={handleStatusFilterChange}
                  disabled={isLoadingStatuses || !statusField}
                >
                  <SelectTrigger className="h-10 rounded-full bg-[#3D753A] text-white hover:bg-black px-4 text-sm w-auto">
                    <div className="text-white flex items-center">
                      <GrStatusGood className="h-5 w-5 mr-2 text-white" />
                      {statusFilterLabel}
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    {statusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={selectedCarrierFilter}
                  onValueChange={handleCarrierFilterChange}
                  disabled={
                    loadingSearchParams ||
                    !carrierField ||
                    carrierOptions.length === 0
                  }
                >
                  <SelectTrigger className="h-10 rounded-full bg-[#3D753A] text-white hover:bg-black px-4 text-sm w-auto">
                    <div className="text-white flex items-center">
                      <Truck className="h-5 w-5 mr-2 text-white" />{" "}
                      {carrierFilterLabel}
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Shipping</SelectItem>
                    {carrierOptions.map((carrier) => (
                      <SelectItem key={carrier} value={carrier}>
                        {carrier.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={selectedManifestFilter}
                  onValueChange={handleManifestFilterChange}
                  disabled={!manifestField}
                >
                  <SelectTrigger className="h-10 rounded-full bg-[#3D753A] text-white hover:bg-black px-4 text-sm w-auto">
                    <div className="text-white flex items-center">
                      <AiFillHdd className="h-5 w-5 mr-2 text-white" />{" "}
                      {manifestFilterLabel}
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Manifest</SelectItem>
                    <SelectItem value="true">Manifested</SelectItem>
                    <SelectItem value="false">Not Manifested</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={selectedStateFilter}
                  onValueChange={handleStateFilterChange}
                  disabled={
                    loadingSearchParams ||
                    !stateField ||
                    stateOptions.length === 0
                  }
                >
                  <SelectTrigger className="h-10 rounded-full bg-[#3D753A] text-white hover:bg-black px-4 text-sm w-auto">
                    <div className="text-white flex items-center">
                      <Settings className="text-white" />
                      <span className="ml-2">{stateFilterLabel}</span>
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All States</SelectItem>
                    {stateOptions.map((state) => (
                      <SelectItem key={state} value={state}>
                        {state.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-full h-10 w-10 bg-white text-gray-700 hover:bg-gray-50"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-6 h-6"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z"
                    />
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
                <TableCell
                  id={`select-row-${shipment.id}`}
                  className="text-white py-0"
                  style={{ backgroundColor: resolveShipmentRowColor(shipment) }}
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
                          href={`https://admin.shopify.com/store/vpa-australia/orders/${shipment.shopifyId}`}
                        >
                          <FaLink className="w-5 h-5" />
                        </a>
                      </TooltipTrigger>
                      <TooltipContent>View in Shopify</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>
                          {shipment.invoicePrinted ? (
                            <Image
                              alt="invoice print"
                              width={21}
                              height={21}
                              src={"/invoice-green.avif"}
                            />
                          ) : (
                            <Image
                              alt="invoice print"
                              width={21}
                              height={21}
                              src={"/invoice.avif"}
                            />
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        Invoice{" "}
                        {shipment.invoicePrinted ? "Printed" : "Not Printed"}
                      </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className="cursor-pointer"
                          onClick={() =>
                            shipment.labelPrinted
                              ? handleDeleteLabel(shipment.id)
                              : handlePrintLabel(shipment.id)
                          }
                        >
                          {shipment.labelPrinted ? (
                            <Image
                              alt="label print"
                              width={20}
                              height={20}
                              src={"/label-green.avif"}
                            />
                          ) : (
                            <Image
                              alt="label"
                              width={20}
                              height={20}
                              src={"/label.avif"}
                            />
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        Label{" "}
                        {shipment.labelPrinted ? "Printed" : "Not Printed"}
                      </TooltipContent>
                    </Tooltip>

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
                        {shipment.manifested ? "Manifested" : "Not Manifested"}
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
                            className="h-8 w-8 flex items-center justify-center rounded-full text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
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

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Dialog
                          open={openPdfDialogId === shipment.id}
                          onOpenChange={(open) => {
                            if (open) {
                              setOpenPdfDialogId(shipment.id);
                              setPdfFormState({
                                file: null,
                                name: "",
                                title: "",
                                trackingCode: shipment.tracking_code || "",
                                carrierCode: shipment.carrierCode || "",
                              });
                            } else {
                              setOpenPdfDialogId((current) =>
                                current === shipment.id ? null : current
                              );
                              setPdfFormState({
                                file: null,
                                name: "",
                                title: "",
                                trackingCode: "",
                                carrierCode: "",
                              });
                            }
                          }}
                        >
                          <DialogTrigger asChild>
                            <div
                              className="cursor-pointer"
                              onClick={() => {
                                setOpenPdfDialogId(shipment.id);
                                setPdfFormState({
                                  file: null,
                                  name: "",
                                  title: "",
                                  trackingCode: shipment.tracking_code || "",
                                  carrierCode: shipment.carrierCode || "",
                                });
                              }}
                            >
                              {statusOptions.filter(
                                (option) => option.value == shipment.status
                              )[0]?.greenTick == true ? (
                                <Image
                                  alt="upload pdf"
                                  width={22}
                                  height={22}
                                  src={"/upload-green.avif"}
                                />
                              ) : (
                                <Image
                                  alt="upload pdf"
                                  width={22}
                                  height={22}
                                  src={"/upload.avif"}
                                />
                              )}
                            </div>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Upload PDF for Shipment</DialogTitle>
                            </DialogHeader>
                            <form
                              className="space-y-4"
                              onSubmit={async (event) => {
                                event.preventDefault();
                                if (!pdfFormState.file) {
                                  toast({
                                    title: "Error",
                                    description: "Please select a PDF file",
                                    variant: "destructive",
                                  });
                                  return;
                                }

                                try {
                                  await handlePdfUpload({
                                    file: pdfFormState.file,
                                    shipmentId: shipment.id,
                                    trackingCode: pdfFormState.trackingCode,
                                    carrierCode: pdfFormState.carrierCode,
                                    name:
                                      pdfFormState.name ||
                                      pdfFormState.file.name,
                                    title: pdfFormState.title || "Uploaded PDF",
                                  });

                                  setPdfFormState({
                                    file: null,
                                    name: "",
                                    title: "",
                                    trackingCode: shipment.tracking_code || "",
                                    carrierCode: shipment.carrierCode || "",
                                  });
                                  setOpenPdfDialogId(null);
                                } catch {
                                  // errors handled in handlePdfUpload
                                }
                              }}
                            >
                              <div className="grid gap-4 py-4">
                                <div className="space-y-4">
                                  <div>
                                    <Label>Document Name</Label>
                                    <Input
                                      placeholder="Enter document name"
                                      className="mt-1"
                                      value={pdfFormState.name}
                                      onChange={(event) =>
                                        setPdfFormState((prev) => ({
                                          ...prev,
                                          name: event.target.value,
                                        }))
                                      }
                                      required
                                    />
                                  </div>
                                  <div>
                                    <Label>Document Title</Label>
                                    <Input
                                      placeholder="Enter document title"
                                      className="mt-1"
                                      value={pdfFormState.title}
                                      onChange={(event) =>
                                        setPdfFormState((prev) => ({
                                          ...prev,
                                          title: event.target.value,
                                        }))
                                      }
                                      required
                                    />
                                  </div>
                                  <div>
                                    <Label>Tracking Code</Label>
                                    <Input
                                      placeholder="Enter tracking code"
                                      className="mt-1"
                                      value={pdfFormState.trackingCode}
                                      onChange={(event) =>
                                        setPdfFormState((prev) => ({
                                          ...prev,
                                          trackingCode: event.target.value,
                                        }))
                                      }
                                      required
                                    />
                                  </div>
                                  <div>
                                    <Label>Carrier Code</Label>
                                    <Input
                                      placeholder="Enter carrier code"
                                      className="mt-1"
                                      value={pdfFormState.carrierCode}
                                      onChange={(event) =>
                                        setPdfFormState((prev) => ({
                                          ...prev,
                                          carrierCode: event.target.value,
                                        }))
                                      }
                                      required
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <input
                                      ref={(node) => {
                                        fileInputRefs.current[shipment.id] =
                                          node;
                                      }}
                                      type="file"
                                      accept=".pdf"
                                      className="hidden"
                                      onChange={(event) => {
                                        const file =
                                          event.target.files?.[0] || null;
                                        setPdfFormState((prev) => ({
                                          ...prev,
                                          file,
                                          name:
                                            file && !prev.name
                                              ? file.name.replace(
                                                  /\.[^/.]+$/,
                                                  ""
                                                )
                                              : prev.name,
                                        }));
                                      }}
                                      required
                                    />
                                    <Button
                                      type="button"
                                      variant="outline"
                                      className="w-full justify-start"
                                      onClick={() =>
                                        fileInputRefs.current[
                                          shipment.id
                                        ]?.click()
                                      }
                                    >
                                      <FileText className="h-4 w-4 mr-2" />
                                      {pdfFormState.file
                                        ? pdfFormState.file.name
                                        : "Choose PDF File"}
                                    </Button>
                                    <p
                                      className={`text-sm mt-1 ${
                                        pdfFormState.file
                                          ? "text-green-600 font-medium"
                                          : "text-muted-foreground"
                                      }`}
                                    >
                                      {pdfFormState.file
                                        ? `Selected: ${pdfFormState.file.name}`
                                        : "No file selected"}
                                    </p>
                                  </div>
                                </div>
                              </div>
                              <DialogFooter className="justify-end space-x-2">
                                <DialogClose asChild>
                                  <Button variant="outline" type="button">
                                    Close
                                  </Button>
                                </DialogClose>
                                <Button type="submit">Upload PDF</Button>
                              </DialogFooter>
                            </form>
                          </DialogContent>
                        </Dialog>
                      </TooltipTrigger>
                      <TooltipContent>Upload PDF</TooltipContent>
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
                      <span className="font-medium">
                        {(shipment.address1 + ", " + shipment.suburb).length >
                        45
                          ? `${(
                              shipment.address1 +
                              ", " +
                              shipment.suburb
                            ).substring(0, 45)}...`
                          : (
                              shipment.address1 +
                              ", " +
                              shipment.suburb
                            ).substring(0, 45)}
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
                                onClick={() => handleUnlStatusUpdate(shipment)}
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
                                  <Unlock size={17} className="text-gray-700" />
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
                      onClick={(e) => handleShipmentDetailClick(e, shipment.id)}
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
