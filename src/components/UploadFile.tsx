'use client';

import {useState, useEffect} from 'react';
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Alert,
    AlertDescription,
    AlertTitle,
} from "@/components/ui/alert"
import { AlertCircleIcon } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface ManualUpload{
    tracking_code: string;
    manual_carrier_code: string;
}

interface Shipment {
    id: number;
    shopifyId: number;
    shopifyOrderNumber: string;
    orderName: string;
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
    manualCarrierCode: string;
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
    }>;
    orderDate: number;
    totalPrice: string;
    lastApiUpdate: number;
    statusId?: number | null;
}

export function UploadFile({shipment, onChangeMessage} : {shipment: Shipment | undefined, onChangeMessage: Function | undefined}) {

    const [manualUpload, setManualUpload] = useState<ManualUpload | undefined>(typeof shipment !== 'undefined' ? {tracking_code: shipment['tracking_code'], manual_carrier_code: shipment['manualCarrierCode']} : undefined);
    const [isSubmitting, setIsSubmitting]  = useState<boolean>(false);
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [files, setFiles] = useState<FileList | null>(null);
    const [error, setError] = useState<string>('');
    useEffect(() => {
        if (typeof manualUpload === 'undefined' && typeof shipment !== 'undefined') {
            setManualUpload({tracking_code: shipment['tracking_code'], manual_carrier_code: shipment['manualCarrierCode']});
        }
    }, [shipment, manualUpload]);

    const saveFile = () => {

        if(typeof manualUpload === 'undefined' || typeof shipment === 'undefined') {
            return;
        }

        if(files === null){
            return;
        }


        setIsSubmitting(true);
        const token = localStorage.getItem('authToken');
        const formData = new FormData();

        formData.append('tracking_code', manualUpload['tracking_code']);
        formData.append('manual_carrier_code', manualUpload['manual_carrier_code']);
        if (files && files.length > 0) {
            for (let i = 0; i < files.length; i++) {
                formData.append('files[]', files[i]);
            }
        }

        fetch('https://ship-orders.vpa.com.au/api/shipments/pdf/'+shipment['id'], {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
            body: formData,
        }).then(res => res.json()).then( (data : {success: boolean, message: string} | {success: boolean, message: string, comments: string}) =>{
            if (data.success) {
                if(typeof onChangeMessage === 'function'){
                    if(typeof data.comments !== 'undefined') {
                        onChangeMessage(data.comments);
                    }
                    setIsSubmitting(false);
                    setIsOpen(false);
                }
            } else {
                setError(data.message);
                setIsSubmitting(false);
            }
        });
    }


    if (typeof manualUpload === 'undefined') {
        return '';
    }
    return (
        <Dialog open={isOpen}>
            <form>
                <DialogTrigger asChild>
                    <Button variant="outline">Upload File</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Upload Label</DialogTitle>
                        <DialogDescription>
                            Upload a label manually to this order.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4">
                        {error.length > 0 ? <Alert variant="destructive">
                            <AlertCircleIcon />
                            <AlertTitle>There was an error uploading the PDF/s</AlertTitle>
                            <AlertDescription>
                                <p>{error}</p>
                            </AlertDescription>
                        </Alert> : ''}

                        <div className="grid gap-3">
                            <Label htmlFor="tracking_code">Tracking Code</Label>
                            <Input id="tracking_code" name="name" defaultValue={manualUpload['tracking_code']} onChange={(e)=>setManualUpload({...manualUpload, 'tracking_code': e.target.value })} />
                        </div>
                        <div className="grid gap-3">
                            <Label htmlFor="manual_carrier_code">Carrier Name</Label>
                            <Input id="manual_carrier_code" name="manual_carrier_code" defaultValue={manualUpload['manual_carrier_code']} onChange={(e)=>setManualUpload({...manualUpload, 'manual_carrier_code': e.target.value })}  />
                        </div>
                        <div className="grid gap-3">
                            <Label htmlFor="files">PDF File/s</Label>
                            <Input id="files" multiple={true} type="file" accept="application/pdf"
                                   onChange={(e) => setFiles(e.target.files)} name="files[]"  />
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline" onClick={()=>{setIsOpen(false)}}>Cancel</Button>
                        </DialogClose>
                        <Button type="submit" disabled={isSubmitting} onClick={()=> { if(!isSubmitting){ saveFile();} }}>Save changes</Button>
                    </DialogFooter>
                </DialogContent>
            </form>
        </Dialog>
    )
}
