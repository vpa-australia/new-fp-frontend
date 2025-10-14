"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { toMySQLDateTime } from "@/lib/utils";

interface Store {
  id: number;
  shop: string;
  name: string;
  country_code: string;
  active: number;
  weight_id: string;
  measurement_id: string;
}

type FreeShippingResponse = {
  success: boolean;
  data: {
    free_shipping_start: string | null;
    free_shipping_end: string | null;
  };
};

export default function FreeShippingTab() {
  const { requireAuthToken } = useAuth();

  const [currentStore, setCurrentStore] = useState<string | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState<Record<string, string>>({});
  const [toDate, setToDate] = useState<Record<string, string>>({});
  const [fromTime, setFromTime] = useState<Record<string, string>>({});
  const [toTime, setToTime] = useState<Record<string, string>>({});

  const hydrateWindowForStore = useCallback((
    storeKey: string,
    payload: FreeShippingResponse["data"]
  ) => {
    let startDatetime = payload.free_shipping_start;
    let endDatetime = payload.free_shipping_end;

    const today = new Date();

    if (!startDatetime) {
      startDatetime = toMySQLDateTime(today);
    }

    if (!endDatetime) {
      const twoDaysLater = new Date(today);
      twoDaysLater.setDate(today.getDate() + 2);
      endDatetime = toMySQLDateTime(twoDaysLater);
    }

    const [startDate, startTime] = startDatetime.split(" ");
    const [endDate, endTime] = endDatetime.split(" ");

    setFromDate((prev) => ({ ...prev, [storeKey]: startDate }));
    setToDate((prev) => ({ ...prev, [storeKey]: endDate }));
    setFromTime((prev) => ({ ...prev, [storeKey]: startTime }));
    setToTime((prev) => ({ ...prev, [storeKey]: endTime }));
  }, []);

  const saveDates = async () => {
    if (!currentStore) {
      return;
    }

    const currentFromDate = fromDate[currentStore];
    const currentToDate = toDate[currentStore];
    const currentFromTime = fromTime[currentStore];
    const currentToTime = toTime[currentStore];

    if (
      !currentFromDate ||
      !currentToDate ||
      !currentFromTime ||
      !currentToTime
    ) {
      return;
    }

    const token = requireAuthToken();
    const formData = new FormData();

    formData.append(
      "free_shipping_start",
      `${currentFromDate} ${currentFromTime}`
    );
    formData.append("free_shipping_end", `${currentToDate} ${currentToTime}`);

    setLoading(true);

    try {
      const response = await apiFetch(
        `platform/free_shipping/${currentStore}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      const json = (await response.json()) as FreeShippingResponse;
      if (json.success) {
        hydrateWindowForStore(currentStore, json.data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const token = requireAuthToken();
      setLoading(true);

      try {
        if (currentStore === null) {
          const response = await apiFetch("platform/stores", {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          const json = (await response.json()) as {
            success: boolean;
            stores: Store[];
          };

          if (
            !cancelled &&
            json.success &&
            Array.isArray(json.stores) &&
            json.stores.length > 0
          ) {
            setStores(json.stores);
            setCurrentStore((prev) => prev ?? json.stores[0].shop);
          }
        } else {
          const response = await apiFetch(
            `platform/free_shipping/${currentStore}`,
            {
              method: "GET",
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );

          const json = (await response.json()) as FreeShippingResponse;
          if (!cancelled && json.success) {
            hydrateWindowForStore(currentStore, json.data);
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [currentStore, hydrateWindowForStore, requireAuthToken]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Free Shipping</CardTitle>
      </CardHeader>
      <CardContent>
        {currentStore === null ||
        typeof fromDate[currentStore] === "undefined" ||
        loading ? (
          <>Loading ...</>
        ) : (
          <>
            {stores.length > 0 ? <h4>Stores</h4> : null}
            {stores.map((store) => (
              <div
                key={store.shop}
                onClick={() => {
                  setCurrentStore(store.shop);
                }}
                className={`inline-block rounded-full border text-sm m-2 px-2 py-2 ${
                  currentStore === store.shop ? "bg-gray-500 text-white" : ""
                }`}
              >
                {store.name}
              </div>
            ))}

            <div className="flex gap-4 mt-6">
              <div className="flex flex-col gap-3">
                <Label htmlFor="date-picker-from" className="px-1">
                  From Date
                </Label>
                <Input
                  id="date-picker-from"
                  type="date"
                  className="h-10 w-[150px] rounded-full border px-3 text-sm"
                  value={fromDate[currentStore]}
                  onChange={(ev) => {
                    setFromDate((prev) => ({
                      ...prev,
                      [currentStore]: ev.target.value,
                    }));
                  }}
                />
              </div>
              <div className="flex flex-col gap-3">
                <Label htmlFor="time-picker-from" className="px-1">
                  From Time
                </Label>
                <Input
                  id="time-picker-from"
                  type="time"
                  className="h-10 w-[150px] rounded-full border px-3 text-sm"
                  value={fromTime[currentStore]}
                  onChange={(ev) => {
                    setFromTime((prev) => ({
                      ...prev,
                      [currentStore]: ev.target.value,
                    }));
                  }}
                />
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex flex-col gap-3">
                <Label htmlFor="date-picker-to" className="px-1">
                  To Date
                </Label>
                <Input
                  id="date-picker-to"
                  type="date"
                  className="h-10 w-[150px] rounded-full border px-3 text-sm"
                  value={toDate[currentStore]}
                  onChange={(ev) => {
                    setToDate((prev) => ({
                      ...prev,
                      [currentStore]: ev.target.value,
                    }));
                  }}
                />
              </div>
              <div className="flex flex-col gap-3">
                <Label htmlFor="time-picker-to" className="px-1">
                  To Time
                </Label>
                <Input
                  id="time-picker-to"
                  type="time"
                  className="h-10 w-[150px] rounded-full border px-3 text-sm"
                  value={toTime[currentStore]}
                  onChange={(ev) => {
                    setToTime((prev) => ({
                      ...prev,
                      [currentStore]: ev.target.value,
                    }));
                  }}
                />
              </div>
            </div>

            <Button
              variant="default"
              className="mt-6"
              onClick={() => void saveDates()}
            >
              Save Dates
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
