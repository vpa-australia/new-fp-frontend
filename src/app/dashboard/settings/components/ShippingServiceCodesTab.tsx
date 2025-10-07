'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {useState, useEffect} from "react";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table";
import {Button} from "@/components/ui/button";
import {Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {Label} from "@/components/ui/label";
import {Input} from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {Package2} from "lucide-react";


interface ShippingServiceCode {
    id: number | string;
    carrier_code: string;
    service_code: string;
    name: string;
}

interface ShippingServiceCodeSuccess {
    success: boolean;
    carrier_service_code: ShippingServiceCode;
}

interface ShippingServiceCodeFailure {
    success: boolean;
    message: string;
}

interface Carrier {
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

interface ShippingCarrierSuccess {
    success: boolean;
    carriers: Record<string, Carrier>;
}

interface ShippingCarrierFailure {
    success: boolean;
    message: string;
}

interface ShippingServiceCodesSuccess {
    success: boolean;
    carriers: Record<string, ShippingServiceCode[]>;
}

interface UpdateServiceData {
    id: number | string;
    service_code: string;
    name: string;
    carrier_code: string;
}

export default function ShippingServiceCodesTab() {

    const [shippingServiceCodes, setShippingServiceCodes] =  useState<Record<string, ShippingServiceCode[]>>({});
    const [carriers, setCarriers] = useState<Carrier[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editServiceData, setEditServiceData] = useState<UpdateServiceData>({
        name: '',
        service_code: '',
        carrier_code: '',
        id: ''
    });
    const [isEditShippingServiceCodeDialogOpen, setIsEditShippingServiceCodeDialogOpen] = useState(false);
    const [commandType, setCommandType] = useState('add');

    useEffect(() => {
        if (!loaded) {
            loadAll(()=>{});

            const token = localStorage.getItem('authToken');

            fetch('https://ship-orders.vpa.com.au/api/platform/carriers', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            }).then(res => res.json()).then((data : ShippingCarrierSuccess ) => {
                if(data.success) {

                    const carriers : Carrier[] = [];
                    Object.keys(data['carriers']).forEach((k)=>{
                        carriers.push(data['carriers'][k])
                    })

                    setCarriers(carriers);
                }
            })


            setLoaded(true);
        }
    }, [loaded]);

    const loadAll = (callback : Function) =>{
        const token = localStorage.getItem('authToken');
        fetch('https://ship-orders.vpa.com.au/api/platform/carrier_service_codes', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        }).then(res => res.json()).then( (data : ShippingServiceCodesSuccess) =>{
            if(data.success) {
                console.log('CARRIERS ARE', data['carriers'])
                setShippingServiceCodes(data['carriers']);
                if (typeof callback === 'function') {
                    callback();
                }
            }
        });
    }

    const handleUpdateServiceCode  = (sc : ShippingServiceCode) : void =>{
        setEditServiceData(sc);
        setIsEditShippingServiceCodeDialogOpen(true);
    }
    const handleSubmitUpdate = (command : string) :void => {

        const token = localStorage.getItem('authToken');
        if(command === 'add'){

            const formData = new FormData();

            Object.keys(editServiceData).forEach((k)=>{
                formData.append(k, editServiceData[k]);
            })


            fetch('https://ship-orders.vpa.com.au/api/platform/carrier_service_code', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
                body: formData,
            }).then(res => res.json()).then( (data : ShippingServiceCodeSuccess | ShippingServiceCodeFailure) =>{
                if (data.success) {
                    loadAll(()=>{
                        setIsEditShippingServiceCodeDialogOpen(false);
                        setIsSubmitting(false);
                    });
                } else {
                    setIsSubmitting(false);
                }
            });
        }
        setCommandType(command);
        setIsSubmitting(true);
    }

    const handleDelete = (id : number) =>{

        const token = localStorage.getItem('authToken');

        fetch('https://ship-orders.vpa.com.au/api/platform/carrier_service_code/'+id, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
            }
        }).then(res => res.json()).then( (data : ShippingServiceCodeSuccess | ShippingServiceCodeFailure) =>{
            if (data.success) {
                loadAll(()=>{

                });
            } else {
            }
        });

    }

    const k = Object.keys(shippingServiceCodes);
    let tables;
    if(k.length > 0 && carriers.length > 0){

        tables = k.map((key: string)  => {
            const serviceCodes : ShippingServiceCode[] = shippingServiceCodes[key];

            if(typeof serviceCodes[0] === 'undefined'){
                return '';
            }


            let carrier = '';
            carriers.forEach((car : Carrier)=>{
                if(serviceCodes[0]['carrier_code'] == car.code){
                    carrier = car.name;
                }
            })



            return (<><Card className="mb-3" key={key}>
                <CardHeader>
                    <CardTitle>{carrier}</CardTitle>
                </CardHeader>
                <CardContent><Table key={key}>

                <TableHeader>
                    <TableRow>
                        <TableHead className="w-1/3">Name</TableHead>
                        <TableHead className="w-1/3">Service Code</TableHead>
                        <TableHead className="w-1/3">Command</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>

                    {serviceCodes.map((sc: ShippingServiceCode) => {
                        return (<TableRow key={sc['id']}>
                            <TableCell className="w-1/3">{sc['name']}</TableCell>
                            <TableCell className="w-1/3">{sc['service_code']}</TableCell>
                            <TableCell className="w-1/3">
                                <Button variant="ghost" size="sm" onClick={() => handleUpdateServiceCode(sc)}>Edit</Button>

                                <Button variant="ghost" size="sm" onClick={()=> { if(confirm('Do you really want to delete the service: ' + sc.name + ' ('+sc.service_code+').')){ handleDelete(sc.id); }}} >
                                    Delete
                                </Button>
                            </TableCell>
                        </TableRow>);
                    })}
                </TableBody>
                </Table></CardContent></Card></>);
        })
    }

    return (
        <>{carriers.length > 0 ? <div className="flex justify-end mb-4">
            <Button onClick={()=>{handleUpdateServiceCode({
                name: '',
                service_code: '',
                carrier_code: '',
                id: ''
            })}}>
                <Package2 className="mr-2 h-4 w-4" />
                Add New Service Code
            </Button>
        </div> : ''}


                {tables}

                {/* Edit Shipping Service Code */}


            {carriers.length > 0 ?
            <Dialog open={isEditShippingServiceCodeDialogOpen} onOpenChange={setIsEditShippingServiceCodeDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Edit Shipping Service Code</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="edit-name" className="text-right">
                                Carrier
                            </Label>
                            <Select value={editServiceData.carrier_code} onValueChange={(value: string)=>{ setEditServiceData({ ...editServiceData, carrier_code: value }) }}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Carriers" />
                                </SelectTrigger>
                                <SelectContent>
                                    {carriers.map((c: Carrier)=>{ return <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>;})}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="edit-service-name" className="text-right">
                                Service Name
                            </Label>
                            <Input
                                id="edit-service-name"
                                type="text"
                                value={editServiceData.name}
                                onChange={(e) => setEditServiceData({ ...editServiceData, name: e.target.value })}
                                className="col-span-3"
                                placeholder="Enter Name of Service"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="edit-service-code" className="text-right">
                                Service Code
                            </Label>
                            <Input
                                id="edit-service-code"
                                type="text"
                                value={editServiceData.service_code}
                                onChange={(e) => setEditServiceData({ ...editServiceData, service_code: e.target.value })}
                                className="col-span-3"
                                placeholder="Enter Service Code"
                            />
                        </div>

                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditShippingServiceCodeDialogOpen(false)}>
                            Cancel
                        </Button>

                        <Button onClick={()=> {handleSubmitUpdate("add") }} disabled={isSubmitting}>
                            {isSubmitting && commandType === 'add' ? 'Updating...' : 'Update Service'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog> : ''}</>
    );
}
