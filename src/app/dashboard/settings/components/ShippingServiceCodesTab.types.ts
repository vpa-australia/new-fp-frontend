export interface ShippingServiceCode {
  id: number | string;
  carrier_code: string;
  service_code: string;
  name: string;
}

export interface ShippingServiceCodeSuccess {
  success: boolean;
  carrier_service_code: ShippingServiceCode;
}

export interface ShippingServiceCodeFailure {
  success: boolean;
  message: string;
}

export interface Carrier {
  id: number;
  code: string;
  name: string;
  description: string | null;
  maxParcelWeight: number | null;
  active: boolean;
  manual: boolean;
  color: string | null;
  warehouses: string[];
}

export interface ShippingCarrierSuccess {
  success: boolean;
  carriers: Record<string, Carrier>;
}

export interface ShippingServiceCodesSuccess {
  success: boolean;
  carriers: Record<string, ShippingServiceCode[]>;
}

export interface UpdateServiceData {
  id: number | string;
  service_code: string;
  name: string;
  carrier_code: string;
}

export type ShippingServiceCodeMap = Record<string, ShippingServiceCode[]>;

