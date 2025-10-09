'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';

const API_BASE_URL = 'https://ship-orders.vpa.com.au/api';
const AUTH_TOKEN_KEY = 'authToken';
const USER_EMAIL_KEY = 'userEmail';
const USER_DATA_KEY = 'userData';

export interface AuthUserRolesInfo {
  roles: string[];
  warehouses: string[];
}

export interface AuthUserProfile {
  id: number;
  name: string;
  title: string;
  email: string;
  email_verified_at: string | null;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

export interface AuthUser {
  status: boolean;
  message?: string;
  data: AuthUserProfile;
  roles: AuthUserRolesInfo;
  availableRoles?: AuthUserRolesInfo;
  [key: string]: unknown;
}

type LoginParams = {
  token: string;
  user?: AuthUser | null;
  email?: string;
};

type LogoutOptions = {
  redirectTo?: string;
};

type AuthContextValue = {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  initializing: boolean;
  loadingUser: boolean;
  login: (params: LoginParams) => Promise<void>;
  logout: (options?: LogoutOptions) => void;
  refreshUser: () => Promise<AuthUser | null>;
  requireAuthToken: () => string;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const readJsonFromStorage = <T,>(key: string): T | null => {
  if (typeof window === "undefined") {
    return null;
  }
  const rawValue = window.localStorage.getItem(key);
  if (!rawValue) {
    return null;
  }
  try {
    return JSON.parse(rawValue) as T;
  } catch (error) {
    console.warn(`Failed to parse localStorage value for key "${key}".`, error);
    return null;
  }
};

const resolveUserEmail = (user: AuthUser | null | undefined): string | null =>
  user?.data?.email ?? null;

const ensureBrowserStorageLoaded = () => typeof window !== "undefined";

const normalizeRoles = (input: unknown): AuthUserRolesInfo => {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { roles: [], warehouses: [] };
  }
  const candidate = input as { roles?: unknown; warehouses?: unknown };
  const roles = Array.isArray(candidate.roles)
    ? candidate.roles.map((value) => String(value))
    : [];
  const warehouses = Array.isArray(candidate.warehouses)
    ? candidate.warehouses.map((value) => String(value))
    : [];
  return { roles, warehouses };
};

const normalizeProfile = (input: unknown): AuthUserProfile => {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {
      id: 0,
      name: "",
      title: "",
      email: "",
      email_verified_at: null,
      created_at: "",
      updated_at: "",
    };
  }


  const source = input as Record<string, unknown>;


  return {
    id: typeof source.id === "number" ? source.id : Number(source.id ?? 0),
    name: typeof source.name === "string" ? source.name : "",
    title: typeof source.title === "string" ? source.title : "",
    email: typeof source.email === "string" ? source.email : "",
    email_verified_at:
      typeof source.email_verified_at === "string" ||
      source.email_verified_at === null
        ? (source.email_verified_at as string | null)
        : null,
    created_at: typeof source.created_at === "string" ? source.created_at : "",
    updated_at: typeof source.updated_at === "string" ? source.updated_at : "",
  };
};

const normalizeAuthUser = (input: unknown): AuthUser | null => {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return null;
  }

  const candidate = input as Record<string, unknown>;

  const normalized: AuthUser = {
    status: Boolean(candidate.status),
    message:
      typeof candidate.message === "string" ? candidate.message : undefined,
    data: normalizeProfile(candidate.data),
    roles: normalizeRoles(candidate.roles),
  };

  const availableRoles = normalizeRoles(candidate.availableRoles);
  if (availableRoles.roles.length > 0 || availableRoles.warehouses.length > 0) {
    normalized.availableRoles = availableRoles;
  }

  return normalized;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    if (!ensureBrowserStorageLoaded()) {
      return null;
    }
    return window.localStorage.getItem(AUTH_TOKEN_KEY);
  });
  const [user, setUser] = useState<AuthUser | null>(() => {
    if (!ensureBrowserStorageLoaded()) {
      return null;
    }
    const storedUserRaw = readJsonFromStorage<unknown>(USER_DATA_KEY);
    return normalizeAuthUser(storedUserRaw);
  });
  const [initializing, setInitializing] = useState(true);
  const [loadingUser, setLoadingUser] = useState(false);
  const initializationStartedRef = useRef(false);
  const router = useRouter();

  const persistUser = useCallback((nextUser: AuthUser | null) => {
    if (!ensureBrowserStorageLoaded()) {
      return;
    }
    if (nextUser) {
      window.localStorage.setItem(USER_DATA_KEY, JSON.stringify(nextUser));
      const email = resolveUserEmail(nextUser);
      if (email) {
        window.localStorage.setItem(USER_EMAIL_KEY, email);
      }
    } else {
      window.localStorage.removeItem(USER_DATA_KEY);
      window.localStorage.removeItem(USER_EMAIL_KEY);
    }
  }, []);

  const clearAuthState = useCallback(() => {
    if (ensureBrowserStorageLoaded()) {
      window.localStorage.removeItem(AUTH_TOKEN_KEY);
      window.localStorage.removeItem(USER_EMAIL_KEY);
      window.localStorage.removeItem(USER_DATA_KEY);
    }
    setToken(null);
    setUser(null);
  }, []);

  const fetchAndStoreUser = useCallback(
    async (authToken: string) => {
      setLoadingUser(true);
      try {
        const response = await fetch(`${API_BASE_URL}/users/auth/me`, {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch user profile: ${response.status}`);
        }

        const payload = await response.json();
        const profile = normalizeAuthUser(payload);
        if (!profile) {
          throw new Error("Failed to parse user profile.");
        }
        setUser(profile);
        persistUser(profile);
        return profile;
      } catch (error) {
        clearAuthState();
        throw error;
      } finally {
        setLoadingUser(false);
      }
    },
    [clearAuthState, persistUser]
  );

  useEffect(() => {
    if (!ensureBrowserStorageLoaded()) {
      setInitializing(false);
      return;
    }

    if (!token) {
      clearAuthState();
      setInitializing(false);
      return;
    }

    if (initializationStartedRef.current) {
      return;
    }

    initializationStartedRef.current = true;

    if (user) {
      setInitializing(false);
      return;
    }

    let cancelled = false;

    fetchAndStoreUser(token)
      .catch(() => {
        if (!cancelled) {
          // fetchAndStoreUser already clears auth state
        }
      })
      .finally(() => {
        if (!cancelled) {
          setInitializing(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token, user, clearAuthState, fetchAndStoreUser]);

  const login = useCallback(
    async ({ token: nextToken, user: maybeUser, email }: LoginParams) => {
      if (!nextToken) {
        throw new Error("Attempted to login without a token.");
      }

      if (ensureBrowserStorageLoaded()) {
        window.localStorage.setItem(AUTH_TOKEN_KEY, nextToken);
        if (email) {
          window.localStorage.setItem(USER_EMAIL_KEY, email);
        }
      }

      setToken(nextToken);

      if (maybeUser) {
        const normalized = normalizeAuthUser(maybeUser);
        if (normalized) {
          setUser(normalized);
          persistUser(normalized);
          return;
        }
      }

      await fetchAndStoreUser(nextToken);
    },
    [fetchAndStoreUser, persistUser]
  );

  const logout = useCallback(
    (options?: LogoutOptions) => {
      clearAuthState();
      if (options?.redirectTo) {
        router.push(options.redirectTo);
      }
    },
    [clearAuthState, router]
  );

  const refreshUser = useCallback(async () => {
    if (!token) {
      clearAuthState();
      return null;
    }
    try {
      return await fetchAndStoreUser(token);
    } catch {
      return null;
    }
  }, [clearAuthState, fetchAndStoreUser, token]);

  const requireAuthToken = useCallback(() => {
    if (token) {
      return token;
    }
    throw new Error("User is not authenticated.");
  }, [token]);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      isAuthenticated: Boolean(token),
      initializing,
      loadingUser,
      login,
      logout,
      refreshUser,
      requireAuthToken,
    }),
    [
      initializing,
      loadingUser,
      login,
      logout,
      refreshUser,
      requireAuthToken,
      token,
      user,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }
  return context;
};

type AuthGuardProps = {
  children: React.ReactNode;
  redirectTo?: string;
  fallback?: React.ReactNode;
};

export function AuthGuard({
  children,
  redirectTo = '/login',
  fallback,
}: AuthGuardProps) {
  const { isAuthenticated, initializing } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const hasRedirectedRef = useRef(false);

  useEffect(() => {
    if (initializing || isAuthenticated || hasRedirectedRef.current) {
      return;
    }

    hasRedirectedRef.current = true;
    const params = new URLSearchParams();
    if (pathname) {
      params.set('redirect', pathname);
    }
    router.replace(`${redirectTo}?${params.toString()}`);
  }, [initializing, isAuthenticated, pathname, redirectTo, router]);

  if (initializing || (!isAuthenticated && !hasRedirectedRef.current)) {
    if (fallback !== undefined) {
      return <>{fallback}</>;
    }

    return (
      <div className="flex min-h-[160px] items-center justify-center text-sm text-muted-foreground">
        Checking your session…
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
