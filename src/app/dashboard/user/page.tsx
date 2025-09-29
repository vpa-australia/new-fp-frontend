'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { fetchCurrentUser, updateUser, type UpdateUserPayload } from '@/lib/api/users';

interface UserProfileResponse {
  data: {
    id: number;
    name: string;
    email: string;
  };
}

export default function UserProfilePage() {
  const router = useRouter();
  const { toast } = useToast();

  const [userId, setUserId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [initialName, setInitialName] = useState('');
  const [initialEmail, setInitialEmail] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response: UserProfileResponse = await fetchCurrentUser();
        if (!isMounted) return;

        setUserId(response.data.id);
        setName(response.data.name || '');
        setEmail(response.data.email || '');
        setInitialName(response.data.name || '');
        setInitialEmail(response.data.email || '');
      } catch (err) {
        if (!isMounted) return;
        setErrorMessage(err instanceof Error ? err.message : 'Unable to load profile.');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, []);

  const hasProfileChanges = useMemo(() => {
    return (
      name.trim() !== initialName.trim() ||
      email.trim() !== initialEmail.trim() ||
      Boolean(password)
    );
  }, [email, initialEmail, initialName, name, password]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!userId) {
      setErrorMessage('User ID not found. Please refresh and try again.');
      return;
    }

    if (password && password !== confirmPassword) {
      setErrorMessage('New password and confirmation do not match.');
      return;
    }

    const payload: UpdateUserPayload = {};

    if (name.trim() && name.trim() !== initialName.trim()) {
      payload.name = name.trim();
    }

    if (email.trim() && email.trim() !== initialEmail.trim()) {
      payload.email = email.trim();
    }

    if (password) {
      payload.password = password;
      payload.password_confirmation = confirmPassword;
    }

    if (Object.keys(payload).length === 0) {
      setErrorMessage('No changes to save.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const updated = await updateUser(userId, payload);

      if (payload.name) {
        setInitialName(payload.name);
      }

      if (payload.email) {
        setInitialEmail(payload.email);
      }

      setPassword('');
      setConfirmPassword('');

      toast({
        title: 'Profile updated',
        description: 'Your user settings have been saved successfully.',
      });

      if (updated?.data) {
        setName(updated.data.name ?? name);
        setEmail(updated.data.email ?? email);
        setInitialName(updated.data.name ?? payload.name ?? initialName);
        setInitialEmail(updated.data.email ?? payload.email ?? initialEmail);
      }

      if (typeof window !== 'undefined') {
        window.localStorage.setItem('userData', JSON.stringify(updated));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update user profile.';
      setErrorMessage(message);
      toast({
        title: 'Update failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="container mx-auto flex max-w-3xl flex-col gap-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Your Profile</h1>
          <p className="text-muted-foreground">Update your personal information and password.</p>
        </div>
        <Button variant="outline" onClick={() => router.push('/dashboard')}>
          Back to Dashboard
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account Details</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-6 text-sm text-muted-foreground">Loading your profile...</div>
          ) : errorMessage && !hasProfileChanges && !isSaving ? (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {errorMessage}
            </div>
          ) : (
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Jane Smith"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="jane@example.com"
                  />
                </div>
              </div>

              <div className="border-t" />

              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold">Change Password</h2>
                  <p className="text-sm text-muted-foreground">
                    Leave the fields blank if you do not want to update your password.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">New Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="********"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="********"
                  />
                </div>
              </div>

              {errorMessage && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {errorMessage}
                </div>
              )}

              <CardFooter className="px-0">
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? 'Saving changes...' : 'Save changes'}
                </Button>
              </CardFooter>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
