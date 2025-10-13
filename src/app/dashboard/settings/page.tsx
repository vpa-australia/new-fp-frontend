'use client';

import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UsersIcon, ArrowLeftIcon, HouseIcon, ActivityIcon, Package2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import UsersTab from './components/UsersTab';
import WarehousesTab from './components/WarehousesTab';
import CarriersTab from './components/CarriersTab';
import ActionsTab from './components/ActionsTab';
import ShippingServiceCodesTab from "./components/ShippingServiceCodesTab";
import FreeShippingTab from "./components/FreeShippingTab";

export default function SettingsPage() {
  const router = useRouter();

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <Button
          variant="ghost"
          className="flex items-center"
          onClick={() => router.push("/dashboard")}
        >
          <ArrowLeftIcon className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
        <h1 className="text-3xl font-bold">Settings</h1>
      </div>

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="mb-8">
          <TabsTrigger value="users" className="flex items-center">
            <UsersIcon className="mr-2 h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="warehouses" className="flex items-center">
            <HouseIcon className="mr-2 h-4 w-4" />
            Warehouses
          </TabsTrigger>
          <TabsTrigger value="actions" className="flex items-center">
            <ActivityIcon className="mr-2 h-4 w-4" />
            Actions
          </TabsTrigger>
          <TabsTrigger value="carriers" className="flex items-center">
            <Package2 className="mr-2 h-4 w-4" />
            Carriers
          </TabsTrigger>
          <TabsTrigger
            value="shipping-service-codes"
            className="flex items-center"
          >
            <Package2 className="mr-2 h-4 w-4" />
            Shipping Service Codes
          </TabsTrigger>
          <TabsTrigger value="free-shipping" className="flex items-center">
            <Package2 className="mr-2 h-4 w-4" />
            Free Shipping
          </TabsTrigger>
        </TabsList>
        <TabsContent value="warehouses">
          <WarehousesTab />
        </TabsContent>
        <TabsContent value="actions">
          <ActionsTab />
        </TabsContent>
        <TabsContent value="carriers">
          <CarriersTab />
        </TabsContent>

        <TabsContent value="users">
          <UsersTab />
        </TabsContent>

        <TabsContent value="shipping-service-codes">
          <ShippingServiceCodesTab />
        </TabsContent>

        <TabsContent value="free-shipping">
          <FreeShippingTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}