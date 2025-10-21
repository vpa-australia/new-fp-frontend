import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiFetch } from "@/lib/api/client";
import { useAuth } from '@/contexts/AuthContext';
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table";
import {Button} from "@/components/ui/button";
import {Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {Label} from "@/components/ui/label";
import {Input} from "@/components/ui/input";
import {Checkbox} from "@/components/ui/checkbox";

interface Warehouse {
    id: number;
    code: string;
    description: string | null;
    international: boolean;
    international_rank: number | null;
    country: string;
    active: boolean;
}

interface WarehousesResponse {
    success: boolean;
    warehouses: Record<string, Warehouse>;
}


interface PackageResponse {
    success: boolean;
    packages: Package[]
}

interface Package {
    id: number;
    code: string;
    name: string;
    description: string;
    minWeight: string;
    maxWeight: string;
    length: string;
    height: string;
    width: string;
    active: number;
    warehouses: string[];
}

interface PackagePost{
    min_weight :string;
    max_weight :string;
    height :string;
    width :string;
    length :string;
    code :string;
    name : string;
    description : string;
    active : number;
}

export default function PackageTab() {

    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [packages, setPackages] = useState<Package[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editPackage, setEditPackage] = useState<Package>({
        id: 0,
        code: '',
        name: '',
        description:'',
        minWeight: '',
        maxWeight: '',
        length: '',
        height: '',
        width: '',
        active: 1,
        warehouses: []
    });
    const [isEditPackageDialogOpen, setIsEditPackageDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [addedActionDone, setAddedActionDone] = useState(false);
    const [deletedActionDone, setDeletedActionDone] = useState(false);
    const { requireAuthToken } = useAuth();



    const getPackages = async () => {

        const token = requireAuthToken();

        const response = await apiFetch('/platform/packages', {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            throw new Error('Failed to fetch packages');
        }

        const data: PackageResponse = await response.json();

        if (!data.success) {
            throw new Error('API returned unsuccessful response');
        }

        // Convert the warehouses object to an array
        const packagesArray = data.packages;
        setPackages(packagesArray);
    }

    const handleUpdatePackage = (pack: Package) => {
        setEditPackage(pack);
        setIsEditPackageDialogOpen(true);
    }

    const addNewPackage = () => {
        setEditPackage({
            id: 0,
            code: '',
            name: '',
            description: '',
            minWeight: '',
            maxWeight: '',
            length: '',
            height: '',
            width: '',
            active: 1,
            warehouses: []

        });
        setIsEditPackageDialogOpen(true);
    }

    const handleSubmitUpdate =  () =>{
        //is a new package
        setAddedActionDone(false);
        setDeletedActionDone(false);
        setIsSubmitting(true);

        const data: {package: PackagePost} = {package: {
            min_weight: '',
            max_weight: '',
            height:'',
            width: '',
            length:'',
            code:'',
            name:'',
            description:'',
            active: 0
            }
        };
        data['package']['min_weight'] = editPackage.minWeight;
        data['package']['max_weight'] = editPackage.maxWeight;
        data['package']['height'] = editPackage.height;
        data['package']['width'] = editPackage.width;
        data['package']['length'] = editPackage.length;
        data['package']['code'] = editPackage.code;
        data['package']['name'] = editPackage.name;
        data['package']['description'] = editPackage.description;
        data['package']['active'] = 1;

        const countries: string[] = [];
        const deleted: Warehouse[] = [];
        const added : Warehouse[] = [];
        warehouses.forEach(item => {
            if(editPackage.warehouses.includes(item.code)){
                countries.push(item.country);
                added.push(item);
            } else {
                packages.forEach((pack: Package)  => {
                    console.log('editPackage.id', editPackage.id, 'pack.id', pack.id)
                    if(editPackage.id === pack.id){
                        if(pack.warehouses.includes(item.code)){
                            if(!countries.includes(item.country)){
                                countries.push(item.country);
                            }
                            deleted.push(item);
                        }
                    }
                })
            }
        });

        const token = requireAuthToken();

        countries.forEach(country => {





           apiFetch('/platform/box/'+country+'/new', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(data),
            }).then(res => {
               const wh: string[] = [];
               added.forEach((i: Warehouse) => {
                   if(i.country === country){
                      wh.push('locations[]='+i.code);
                   }
               });

                if(wh.length > 0){

                    apiFetch('/platform/box/'+editPackage.code + '/' +country + '/add?'+wh.join('&'), {
                        method: "POST",
                        headers: {
                            'Authorization': `Bearer ${token}`,
                        }

                    }).finally(() => {
                        setAddedActionDone(true);

                });

                } else {
                    setAddedActionDone(true);
                }


                const whd: string[] = [];
                deleted.forEach((i: Warehouse) => {
                    if(i.country === country){
                        whd.push('locations[]='+i.code);
                    }
                });

                if(whd.length > 0){

                    apiFetch('/platform/box/'+editPackage.code + '/' +country + '/remove?'+whd.join('&'), {
                        method: "POST",
                        headers: {
                            'Authorization': `Bearer ${token}`,
                        }

                    }).finally(() => {

                        setDeletedActionDone(true);
                    });

                } else {
                    setDeletedActionDone(true);

                }





        })



    });

        /*
        //if no warehouses were selected
        if(countries.length === 0){

            const c: string[] = [];

            deleted.forEach((i: Warehouse) => {
                if(!c.includes(i.country)){
                    c.push(i.country);
                }
            });

            c.forEach(country =>{



            const whd: string[] = [];
            deleted.forEach((i: Warehouse) => {
                if(i.country === country){
                    whd.push('locations[]='+i.code);
                }
            });

            if(whd.length > 0){

                apiFetch('/platform/box/'+editPackage.code + '/' +country + '/remove?'+whd.join('&'), {
                    method: "POST",
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    }

                }).finally(() => {
                    setAddedActionDone(true);
                    setDeletedActionDone(true);
                });

            } else {
                setAddedActionDone(true);
                setDeletedActionDone(true);

            }
            });
        }
*/

    }

    const handleDeletePackage = async (pack : Package) => {
        setIsDeleting(true);

        const countries = ['AU', 'US'];
        const token = requireAuthToken();

        try {
            // Create an array of DELETE requests
            const deletePromises = countries.map(country =>
                apiFetch(`/platform/box/${pack.code}/${country}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                })
            );

            // Wait for all requests to complete (resolve or reject)
            await Promise.allSettled(deletePromises);
        } catch (error) {
            console.error('Error deleting package:', error);
            setIsDeleting(false);
            getPackages();
        } finally {
            setIsDeleting(false);
            getPackages();
        }
    };


    useEffect(()=>{

        if(isSubmitting && deletedActionDone && addedActionDone){
            setIsSubmitting(false);
            setIsEditPackageDialogOpen(false);
            getPackages();
        }

    }, [deletedActionDone, addedActionDone, isSubmitting, getPackages])

    useEffect(() => {
        const fetchWarehouses = async () => {
            try {
                const token = requireAuthToken();
                const response = await apiFetch('/platform/warehouses', {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                });

                if (!response.ok) {
                    throw new Error('Failed to fetch warehouses');
                }

                const data: WarehousesResponse = await response.json();

                if (!data.success) {
                    throw new Error('API returned unsuccessful response');
                }

                // Convert the warehouses object to an array
                const warehousesArray = Object.values(data.warehouses);
                setWarehouses(warehousesArray);
                await getPackages();
            } catch (err) {
                setError(err instanceof Error ? err.message : 'An error occurred');
            } finally {
                setLoading(false);
            }
        };

        // Only run on the client side
        if (typeof window !== 'undefined') {
            fetchWarehouses();
        }
    }, [requireAuthToken]);


    return  <Card>
        <CardHeader>
            <CardTitle>Warehouse Management</CardTitle>
        </CardHeader>
        <CardContent>
            <Button onClick={()=>{ addNewPackage(); }}>Add New Package</Button>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Height</TableHead>
                        <TableHead>Width</TableHead>
                        <TableHead>Length</TableHead>
                        <TableHead>Min Weight</TableHead>
                        <TableHead>Max Weight</TableHead>
                        <TableHead>Commands</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                        <TableRow>
                            <TableCell colSpan={7} className="text-center">Loading packages...</TableCell>
                        </TableRow>
                    ) : error ? (
                        <TableRow>
                            <TableCell colSpan={7} className="text-center text-red-600">{error}</TableCell>
                        </TableRow>
                    ) : packages.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={7} className="text-center">No packages found</TableCell>
                        </TableRow>
                    ) : packages.map((pack) => (
                        <TableRow key={pack.id} className={(pack.active == 1 ? '' : 'text-gray-500')}>
                            <TableCell>{pack.code}</TableCell>
                            <TableCell>{pack.name || 'N/A'}</TableCell>
                            <TableCell>{pack.height}</TableCell>
                            <TableCell>{pack.width}</TableCell>
                            <TableCell>{pack.length}</TableCell>
                            <TableCell>{pack.minWeight}</TableCell>
                            <TableCell>{pack.maxWeight}</TableCell>
                            <TableCell>
                                <Button variant="ghost" size="sm" onClick={() => handleUpdatePackage(pack)}>Edit</Button>
                                <Button variant="ghost" size="sm" className="text-red-600" onClick={() => {if(confirm('Do you really want to diable this package.')){ handleDeletePackage(pack)}}} >Disable</Button>
                            </TableCell>
                        </TableRow>))
                    }
                </TableBody>
            </Table>

            {/* Edit User Dialog */}
            <Dialog open={isEditPackageDialogOpen} onOpenChange={(b)=>{setIsEditPackageDialogOpen(b)}} >
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Edit Package</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="edit-code" className="text-right">
                                Code
                            </Label>
                            <Input
                                id="edit-code"
                                value={editPackage.code}
                                onChange={(e) => setEditPackage({ ...editPackage, code: e.target.value })}
                                className="col-span-3"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="edit-name" className="text-right">
                                Name
                            </Label>
                            <Input
                                id="edit-name"
                                value={editPackage.name ? editPackage.name : ''}
                                onChange={(e) => setEditPackage({ ...editPackage, name: e.target.value })}
                                className="col-span-3"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="edit-description" className="text-right">
                                Description
                            </Label>
                            <Input
                                id="edit-description"
                                value={editPackage.description ? editPackage.description : ''}
                                onChange={(e) => setEditPackage({ ...editPackage, description: e.target.value })}
                                className="col-span-3"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="edit-height" className="text-right">
                                Height (cm)
                            </Label>
                            <Input
                                id="edit-height"
                                value={editPackage.height ? editPackage.height: ''}
                                onChange={(e) => setEditPackage({ ...editPackage, height: e.target.value })}
                                className="col-span-3"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="edit-width" className="text-right">
                                Width (cm)
                            </Label>
                            <Input
                                id="edit-width"
                                value={editPackage.width ? editPackage.width: ''}
                                onChange={(e) => setEditPackage({ ...editPackage, width: e.target.value })}
                                className="col-span-3"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="edit-length" className="text-right">
                                Length (cm)
                            </Label>
                            <Input
                                id="edit-width"
                                value={editPackage.length ? editPackage.length: ''}
                                onChange={(e) => setEditPackage({ ...editPackage, length: e.target.value })}
                                className="col-span-3"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="edit-min-weight" className="text-right">
                                Min Weight (Kg)
                            </Label>
                            <Input
                                id="edit-min-weight"
                                value={editPackage.minWeight ? editPackage.minWeight: ''}
                                onChange={(e) => setEditPackage({ ...editPackage, minWeight: e.target.value })}
                                className="col-span-3"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="edit-max-weight" className="text-right">
                                Max Weight (Kg)
                            </Label>
                            <Input
                                id="edit-max-weight"
                                value={editPackage.maxWeight ? editPackage.maxWeight: ''}
                                onChange={(e) => setEditPackage({ ...editPackage, maxWeight: e.target.value })}
                                className="col-span-3"
                            />
                        </div>

                        <div className="grid grid-cols-4 items-start gap-4">
                            <Label className="text-right pt-2">Warehouses</Label>
                            <div className="col-span-3 space-y-2">
                                {warehouses.length > 0 ? (
                                    warehouses.map((warehouse) => (
                                        <div key={`edit-wh-${warehouse.code}`} className="flex items-center space-x-2">
                                            <Checkbox
                                                id={`edit-wh-${warehouse.code}`}
                                                checked={editPackage.warehouses.includes(warehouse.code)}
                                                onCheckedChange={(checked) => {
                                                    let wh = [...editPackage.warehouses]
                                                    if(checked){

                                                        if(!wh.includes(warehouse.code) ){
                                                            wh.push(warehouse.code);
                                                        }
                                                    } else {
                                                        wh = wh.filter(item => item !== warehouse.code);
                                                    }
                                                    setEditPackage({ ...editPackage, warehouses: wh })}
                                                }
                                            />
                                            <Label htmlFor={`edit-wh-${warehouse}`}>{warehouse.code}</Label>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-sm text-gray-500">No warehouses available</p>
                                )}
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditPackageDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSubmitUpdate} disabled={isSubmitting}>
                            {isSubmitting ? 'Updating...' : 'Update Package'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </CardContent>
    </Card>
}