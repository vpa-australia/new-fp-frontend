'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserIcon, UsersIcon, ArrowLeftIcon, HouseIcon, ActivityIcon, Package2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import UsersTab from './components/UsersTab';

export default function SettingsPage() {
  const router = useRouter();


  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <Button
          variant="ghost"
          className="flex items-center"
          onClick={() => router.push('/dashboard')}
        >
          <ArrowLeftIcon className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
        <h1 className="text-3xl font-bold">Settings</h1>
      </div>
      
      <Tabs defaultValue="account" className="w-full">
        <TabsList className="mb-8">
          <TabsTrigger value="account" className="flex items-center">
            <UserIcon className="mr-2 h-4 w-4" />
            Account
          </TabsTrigger>
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
        </TabsList>

        <TabsContent value="account">
          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" placeholder="Your name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input disabled id="email" type="email" placeholder="your.email@example.com" />
              </div>
              <Button>Save Changes</Button>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="warehouses"></TabsContent>
        <TabsContent value="actions"></TabsContent>
        <TabsContent value="carriers"></TabsContent>

        <TabsContent value="users">
          <UsersTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}