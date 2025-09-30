'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { UsersIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';

interface UserRole {
  roles: string[];
  warehouses: string[];
}

interface User {
  data: {
    id: number;
    name: string;
    email: string;
    email_verified_at: string | null;
    created_at: string;
    updated_at: string;
  };
  roles: UserRole;
  availableRoles: UserRole;
}

interface UsersResponse {
  perPage: number;
  lastPage: number;
  totalRecords: number;
  users: User[];
}

interface UpdateUserData {
  name: string;
  password: string;
  confirmPassword: string;
}

export default function UsersTab() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    roles: [] as string[]
  });
  const [editUserData, setEditUserData] = useState<UpdateUserData>({
    name: '',
    password: '',
    confirmPassword: '',
  });
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch('https://ship-orders.vpa.com.au/api/users', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch users');
        }

        const data: UsersResponse = await response.json();
        setUsers(data.users);

        // Extract available roles from the first user's availableRoles
        if (data.users.length > 0 && data.users[0].availableRoles) {
          setAvailableRoles(data.users[0].availableRoles.roles);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    // Only run on the client side
    if (typeof window !== 'undefined') {
      fetchUsers();
    }
  }, []);

  const handleRoleChange = (role: string, checked: boolean) => {
    if (checked) {
      setNewUser(prev => ({
        ...prev,
        roles: [...prev.roles, role]
      }));
    } else {
      setNewUser(prev => ({
        ...prev,
        roles: prev.roles.filter(r => r !== role)
      }));
    }
  };

  const handleEditRoleChange = (role: string, checked: boolean) => {
    setEditUserData((prev) => ({
      ...prev,
      roles: checked
        ? Array.from(new Set([...prev.roles, role]))
        : prev.roles.filter((r) => r !== role),
    }));
  };

  const handleUpdateUser = (user: User) => {
    setSelectedUser(user);
    setEditUserData({
      name: user.data.name,
      password: '',
      confirmPassword: '',
      roles: user.roles.roles || [],
    });
    setIsEditUserDialogOpen(true);
  };

  const handleSubmitUpdate = async () => {
    if (!selectedUser) return;

    setIsSubmitting(true);

    const trimmedName = editUserData.name.trim();
    const hasNameChange = Boolean(trimmedName && trimmedName !== selectedUser.data.name);
    const hasPasswordChange = Boolean(editUserData.password);

    if (hasPasswordChange && editUserData.password !== editUserData.confirmPassword) {
      setIsSubmitting(false);
      toast({
        title: 'Validation error',
        description: 'Passwords do not match. Please try again.',
        variant: 'destructive',
      });
      return;
    }

    const existingRoles = selectedUser.roles?.roles ?? [];
    const sortedExistingRoles = [...existingRoles].sort();
    const sortedNewRoles = [...editUserData.roles].sort();
    const rolesChanged =
      sortedExistingRoles.length !== sortedNewRoles.length ||
      sortedExistingRoles.some((role, index) => role !== sortedNewRoles[index]);

    if (rolesChanged && editUserData.roles.length === 0) {
      setIsSubmitting(false);
      toast({
        title: 'Validation error',
        description: 'Select at least one role before saving.',
        variant: 'destructive',
      });
      return;
    }

    if (!hasNameChange && !hasPasswordChange && !rolesChanged) {
      setIsSubmitting(false);
      toast({
        title: 'No changes detected',
        description: 'Update the name, password, or roles before saving.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const token = localStorage.getItem('authToken');

      const params = new URLSearchParams();

      if (hasNameChange) {
        params.append('name', trimmedName);
      }

      if (hasPasswordChange) {
        params.append('password', editUserData.password);
        params.append('password_confirmation', editUserData.confirmPassword);
      }

      if (rolesChanged) {
        editUserData.roles.forEach((role, index) => {
          params.append(`roles[${index}]`, role);
        });
      }

      const response = await fetch(`https://ship-orders.vpa.com.au/api/users/${selectedUser.data.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        throw new Error('Failed to update user');
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to update user');
      }

      toast({
        title: 'Success',
        description: 'User updated successfully',
      });

      const updatedName = hasNameChange ? trimmedName : selectedUser.data.name;
      const updatedRoles = rolesChanged ? [...editUserData.roles] : existingRoles;

      const updatedUsers = users.map((user) => {
        if (user.data.id === selectedUser.data.id) {
          return {
            ...user,
            data: {
              ...user.data,
              name: updatedName,
            },
            roles: rolesChanged ? { ...user.roles, roles: updatedRoles } : user.roles,
          };
        }
        return user;
      });

      setUsers(updatedUsers);
      setSelectedUser((prev) =>
        prev
          ? {
              ...prev,
              data: { ...prev.data, name: updatedName },
              roles: rolesChanged ? { ...prev.roles, roles: updatedRoles } : prev.roles,
            }
          : prev
      );
      setEditUserData({
        name: updatedName,
        password: '',
        confirmPassword: '',
        roles: updatedRoles,
      });
      setIsEditUserDialogOpen(false);
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to update user',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('https://ship-orders.vpa.com.au/api/users/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newUser.name,
          email: newUser.email,
          password: newUser.password,
          roles: newUser.roles.filter(role => role !== '')
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create user');
      }

      const updatedResponse = await fetch('https://ship-orders.vpa.com.au/api/users', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!updatedResponse.ok) {
        throw new Error('Failed to refresh user list');
      }

      const updatedData: UsersResponse = await updatedResponse.json();
      setUsers(updatedData.users);

      // Reset form and close dialog
      setNewUser({
        name: '',
        email: '',
        password: '',
        roles: []
      });
      setIsAddUserDialogOpen(false);

      toast({
        title: 'Success',
        description: 'User created successfully',
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to create user',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>User Management</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex justify-end mb-4">
          <Dialog open={isAddUserDialogOpen} onOpenChange={setIsAddUserDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UsersIcon className="mr-2 h-4 w-4" />
                Add New User
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Add New User</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddUser}>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">
                      Name
                    </Label>
                    <Input
                      id="name"
                      value={newUser.name}
                      onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                      className="col-span-3"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="email" className="text-right">
                      Email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                      className="col-span-3"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="password" className="text-right">
                      Password
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      className="col-span-3"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-4 items-start gap-4">
                    <Label className="text-right pt-2">
                      Roles
                    </Label>
                    <div className="col-span-3 space-y-2">
                      {availableRoles.length > 0 ? (
                        availableRoles.map((role) => (
                          <div key={role} className="flex items-center space-x-2">
                            <Checkbox
                              id={`role-${role}`}
                              checked={newUser.roles.includes(role)}
                              onCheckedChange={(checked) => handleRoleChange(role, checked === true)}
                            />
                            <Label htmlFor={`role-${role}`}>{role}</Label>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500">No roles available</p>
                      )}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <svg className="w-4 h-4 mr-2 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Creating...
                      </>
                    ) : (
                      'Create User'
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center">Loading users...</TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-red-600">{error}</TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center">No users found</TableCell>
              </TableRow>
            ) : users.map((user) => (
              <TableRow key={user.data.id}>
                <TableCell>{user.data.name}</TableCell>
                <TableCell>{user.data.email}</TableCell>
                <TableCell>{user.roles.roles.join(', ') || 'No roles assigned'}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => handleUpdateUser(user)}>Edit</Button>
                  {/* <Button variant="ghost" size="sm" className="text-red-600">Delete</Button> */}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Edit User Dialog */}
        <Dialog open={isEditUserDialogOpen} onOpenChange={setIsEditUserDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-name" className="text-right">
                  Name
                </Label>
                <Input
                  id="edit-name"
                  value={editUserData.name}
                  onChange={(e) => setEditUserData({ ...editUserData, name: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-password" className="text-right">
                  New Password
                </Label>
                <Input
                  id="edit-password"
                  type="password"
                  value={editUserData.password}
                  onChange={(e) => setEditUserData({ ...editUserData, password: e.target.value })}
                  className="col-span-3"
                  placeholder="Leave blank to keep current password"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-confirm-password" className="text-right">
                  Confirm Password
                </Label>
                <Input
                  id="edit-confirm-password"
                  type="password"
                  value={editUserData.confirmPassword}
                  onChange={(e) => setEditUserData({ ...editUserData, confirmPassword: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-start gap-4">
                <Label className="text-right pt-2">Roles</Label>
                <div className="col-span-3 space-y-2">
                  {availableRoles.length > 0 ? (
                    availableRoles.map((role) => (
                      <div key={`edit-role-${role}`} className="flex items-center space-x-2">
                        <Checkbox
                          id={`edit-role-${role}`}
                          checked={editUserData.roles.includes(role)}
                          onCheckedChange={(checked) =>
                            handleEditRoleChange(role, checked === true)
                          }
                        />
                        <Label htmlFor={`edit-role-${role}`}>{role}</Label>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">No roles available</p>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditUserDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmitUpdate} disabled={isSubmitting}>
                {isSubmitting ? 'Updating...' : 'Update User'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}





