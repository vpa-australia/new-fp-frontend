"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {apiFetch} from "@/lib/api/client";
import {useAuth} from "@/contexts/AuthContext";
import {toMySQLDateTime} from "@/lib/utils";


interface Store{
    id: number;
    shop: string;
    name: string;
    country_code: string;
    active: number;
    weight_id: string;
    measurement_id: string;
}

export default function FreeShippingTab() {

    const { requireAuthToken } = useAuth();
    const [currentStore, setCurrentStore] = useState<string | null>(null);
    const [stores, setStores] = useState<Store[]>();
    const [loading, setLoading] = useState(true);
    const [fromDate, setFromDate] = useState<Record<string, string>>({});
    const [toDate, setToDate] = useState<Record<string, string>>({});
    const [fromTime, setFromTime] = useState<Record<string, string>>({});
    const [toTime, setToTime] = useState<Record<string, string>>({});




    const getStores = () =>{
        const token = requireAuthToken();
        apiFetch('platform/stores', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
            }
        }).then(response => { return response.json(); }).then((json: {success: boolean, stores: Store[]})=> {
            if (json.success) {
                setStores(json['stores']);
                setCurrentStore(json['stores'][0].shop);
            }
            setLoading(false);
        });
    }

    const getCurrentDates = () :void => {

        if(currentStore === null){
            return;
        }

        const token = requireAuthToken();
        apiFetch('platform/free_shipping/'+currentStore, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
            }
        }).then(response => { return response.json(); }).then((json)=>{
            if (json.success) {

                let start_datetime = json['data']['free_shipping_start'];
                let end_datetime = json['data']['free_shipping_end'];

                const today = new Date();
                if(start_datetime === null){
                    start_datetime = toMySQLDateTime(today);
                }
                if(end_datetime === null){

                    const twoDaysLater = new Date(today);
                    twoDaysLater.setDate(today.getDate() + 2);
                    end_datetime = toMySQLDateTime(twoDaysLater);
                }

                const start : string[] = start_datetime.split(' ');
                const end :string[] = end_datetime.split(' ');

                //set time string
                let fromT = {...fromTime};
                fromT[currentStore] = start[1];
                setFromTime(fromT);

                let toT = {...toTime};
                toT[currentStore] =end[1];
                setToTime(toT);

                //set date string
                let toD = {...toDate};
                toD[currentStore] = end[0];
                setToDate(toD);

                let fromD = {...fromDate};
                fromD[currentStore] = start[0];
                setFromDate(fromD);

                setLoading(false);

            }
        })
    }

    useEffect(()=>{
        if(currentStore === null){
            getStores();
        } else {
            getCurrentDates();
        }
    }, [currentStore]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Free Shipping</CardTitle>
      </CardHeader>
      <CardContent>
          {currentStore === null || typeof fromDate[currentStore] === "undefined" || loading ? <>Loading ...</> : <>
              {Array.isArray(stores) && stores.length > 0 ? <h4>Stores</h4> : ''}
              {stores?.map((store)=> {
              return <div key={store.shop} onClick={()=>{ setCurrentStore(store.shop)}} className={"inline-block rounded-full border text-sm m-2 px-2 py-2 " + ((currentStore === store.shop) ? "bg-gray-500 text-white" : "")}>{store.name}</div>
              })}

              <div className="flex gap-4">




              <div className="flex flex-col gap-3">
                  <Label htmlFor="date-picker-from" className="px-1">
                      From Date
                  </Label>
                  <Input
                    id="date-picker-from"
                    type="date" className="h-10 w-[150px] rounded-full border px-3 text-sm"
                    value={fromDate[currentStore]}
                    onChange={(ev)=>{ setFromDate({...fromDate, [currentStore]: ev.target.value})}}

                  />
              </div>
              <div className="flex flex-col gap-3">
                  <Label htmlFor="time-picker-from" className="px-1">
                      From Time
                  </Label>
                  <Input
                      id="time-picker-from"
                      type="time" className="h-10 w-[150px] rounded-full border px-3 text-sm"

                      value={fromTime[currentStore]}
                      onChange={(ev)=>{ setFromTime({...fromTime, [currentStore]:ev.target.value})}}

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
                      type="date" className="h-10 w-[150px] rounded-full border px-3 text-sm"
                      value={toDate[currentStore]}
                      onChange={(ev)=> {setToDate({...toDate, [currentStore]: ev.target.value})} }

                  />
              </div>
              <div className="flex flex-col gap-3">
                  <Label htmlFor="time-picker-to" className="px-1">
                      To Time
                  </Label>
                  <Input
                      id="time-picker-to"
                      type="time" className="h-10 w-[150px] rounded-full border px-3 text-sm"

                      value={toTime[currentStore]}
                      onChange={(ev)=>{ setToTime({...toTime, [currentStore]: ev.target.value})}}


                  />
              </div>
          </div></>}
      </CardContent>
    </Card>
  );
}
