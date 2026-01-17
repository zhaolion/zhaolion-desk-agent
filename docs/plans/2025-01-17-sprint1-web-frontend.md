# Sprint 1: Web Frontend Foundation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a functional React dashboard for Desk Agent with authentication, navigation, and core CRUD operations.

**Architecture:** Single-page application using React + Vite, communicating with existing Hono API via REST and SSE.

**Tech Stack:** React 18, TypeScript, Vite, React Router v6, TanStack Query, Tailwind CSS, Lucide Icons

---

## Task 1: Initialize Web App

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/index.html`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/tailwind.config.js`
- Create: `apps/web/postcss.config.js`
- Create: `apps/web/src/index.css`

**Step 1: Create package.json**

```json
{
  "name": "@desk-agent/web",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint . --ext ts,tsx"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.22.0",
    "@tanstack/react-query": "^5.17.0",
    "lucide-react": "^0.312.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.17",
    "postcss": "^8.4.33",
    "tailwindcss": "^3.4.1",
    "typescript": "^5.3.3",
    "vite": "^5.0.12"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

**Step 3: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3001,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
```

**Step 4: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Desk Agent</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Step 5: Create Tailwind config files and main.tsx**

Run: `cd apps/web && pnpm install`
Expected: Dependencies installed

**Step 6: Verify app starts**

Run: `cd apps/web && pnpm dev`
Expected: Vite dev server starts on port 3001

**Step 7: Commit**

```bash
git add apps/web/
git commit -m "feat(web): initialize React + Vite web application

- Add package.json with React, React Router, TanStack Query
- Configure Vite with API proxy to backend
- Set up Tailwind CSS
- Create basic App component

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: API Client Setup

**Files:**
- Create: `apps/web/src/lib/api.ts`
- Create: `apps/web/src/lib/utils.ts`
- Create: `apps/web/src/types/index.ts`

**Step 1: Create base API client**

```typescript
// apps/web/src/lib/api.ts
const API_BASE = '/api';

interface ApiError {
  message: string;
  code?: string;
}

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem('auth_token');
    }
    return this.token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        message: 'An error occurred',
      }));
      throw new Error(error.message);
    }

    return response.json();
  }

  get<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  post<T>(endpoint: string, data?: unknown) {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  patch<T>(endpoint: string, data?: unknown) {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  delete<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const api = new ApiClient();
```

**Step 2: Create utility functions**

```typescript
// apps/web/src/lib/utils.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(date));
}
```

**Step 3: Create shared types**

```typescript
// apps/web/src/types/index.ts
export interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
}

export interface Agent {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  model: string;
  systemPrompt: string | null;
  maxTokens: number;
  tools: string[];
  config: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  userId: string;
  agentId: string;
  name: string;
  description: string | null;
  prompt: string;
  variables: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskRun {
  id: string;
  taskId: string;
  userId: string;
  agentId: string;
  prompt: string;
  variables: Record<string, unknown> | null;
  status: TaskRunStatus;
  progress: number;
  result: string | null;
  error: string | null;
  tokensInput: number;
  tokensOutput: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export type TaskRunStatus =
  | 'pending'
  | 'queued'
  | 'running'
  | 'waiting_input'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface AuthResponse {
  token: string;
  user: User;
}
```

**Step 4: Commit**

```bash
git add apps/web/src/lib apps/web/src/types
git commit -m "feat(web): add API client and shared types

- Create fetch-based API client with JWT support
- Add utility functions (cn, formatDate)
- Define TypeScript interfaces for all entities

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Authentication Context & Pages

**Files:**
- Create: `apps/web/src/contexts/AuthContext.tsx`
- Create: `apps/web/src/hooks/useAuth.ts`
- Create: `apps/web/src/pages/Login.tsx`
- Create: `apps/web/src/pages/Register.tsx`

**Step 1: Create AuthContext**

```typescript
// apps/web/src/contexts/AuthContext.tsx
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '@/lib/api';
import { User, AuthResponse } from '@/types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = api.getToken();
    if (token) {
      api.get<User>('/users/me')
        .then(setUser)
        .catch(() => api.setToken(null))
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const response = await api.post<AuthResponse>('/auth/login', { email, password });
    api.setToken(response.token);
    setUser(response.user);
  };

  const register = async (email: string, password: string, name?: string) => {
    const response = await api.post<AuthResponse>('/auth/register', { email, password, name });
    api.setToken(response.token);
    setUser(response.user);
  };

  const logout = () => {
    api.setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
```

**Step 2: Create Login page**

```typescript
// apps/web/src/pages/Login.tsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <div>
          <h2 className="text-center text-3xl font-bold text-gray-900">
            Sign in to Desk Agent
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 text-red-500 p-3 rounded-md text-sm">
              {error}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {isLoading ? 'Signing in...' : 'Sign in'}
          </button>
          <p className="text-center text-sm text-gray-600">
            Don't have an account?{' '}
            <Link to="/register" className="text-blue-600 hover:text-blue-500">
              Register
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
```

**Step 3: Create Register page**

```typescript
// apps/web/src/pages/Register.tsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await register(email, password, name || undefined);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <div>
          <h2 className="text-center text-3xl font-bold text-gray-900">
            Create your account
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 text-red-500 p-3 rounded-md text-sm">
              {error}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Name (optional)
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {isLoading ? 'Creating account...' : 'Create account'}
          </button>
          <p className="text-center text-sm text-gray-600">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-600 hover:text-blue-500">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add apps/web/src/contexts apps/web/src/pages
git commit -m "feat(web): add authentication context and pages

- Create AuthContext with login/register/logout
- Add Login page with form and error handling
- Add Register page with name/email/password

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Dashboard Layout

**Files:**
- Create: `apps/web/src/layouts/DashboardLayout.tsx`
- Create: `apps/web/src/components/Sidebar.tsx`
- Create: `apps/web/src/components/Header.tsx`
- Create: `apps/web/src/pages/Dashboard.tsx`
- Create: `apps/web/src/components/ProtectedRoute.tsx`

**Step 1: Create Sidebar component**

```typescript
// apps/web/src/components/Sidebar.tsx
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Bot, ListTodo, Settings, Webhook } from 'lucide-react';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Agents', href: '/agents', icon: Bot },
  { name: 'Tasks', href: '/tasks', icon: ListTodo },
  { name: 'Webhooks', href: '/webhooks', icon: Webhook },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  return (
    <div className="flex flex-col w-64 bg-gray-900">
      <div className="flex items-center h-16 px-4">
        <span className="text-xl font-bold text-white">Desk Agent</span>
      </div>
      <nav className="flex-1 px-2 py-4 space-y-1">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            className={({ isActive }) =>
              cn(
                'flex items-center px-4 py-2 text-sm font-medium rounded-md',
                isActive
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              )
            }
          >
            <item.icon className="mr-3 h-5 w-5" />
            {item.name}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
```

**Step 2: Create Header component**

```typescript
// apps/web/src/components/Header.tsx
import { useAuth } from '@/contexts/AuthContext';
import { LogOut, User } from 'lucide-react';

export function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-end px-6">
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <User className="h-5 w-5 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">
            {user?.name || user?.email}
          </span>
        </div>
        <button
          onClick={logout}
          className="flex items-center space-x-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <LogOut className="h-4 w-4" />
          <span>Logout</span>
        </button>
      </div>
    </header>
  );
}
```

**Step 3: Create DashboardLayout**

```typescript
// apps/web/src/layouts/DashboardLayout.tsx
import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';

export function DashboardLayout() {
  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
```

**Step 4: Create ProtectedRoute**

```typescript
// apps/web/src/components/ProtectedRoute.tsx
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
```

**Step 5: Create Dashboard page**

```typescript
// apps/web/src/pages/Dashboard.tsx
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Agent, Task, TaskRun } from '@/types';
import { Bot, ListTodo, Activity } from 'lucide-react';

export function Dashboard() {
  const { data: agents } = useQuery({
    queryKey: ['agents'],
    queryFn: () => api.get<Agent[]>('/agents'),
  });

  const { data: tasks } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => api.get<Task[]>('/tasks'),
  });

  const stats = [
    { name: 'Agents', value: agents?.length ?? 0, icon: Bot },
    { name: 'Tasks', value: tasks?.length ?? 0, icon: ListTodo },
    { name: 'Recent Runs', value: '-', icon: Activity },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {stats.map((stat) => (
          <div
            key={stat.name}
            className="bg-white p-6 rounded-lg shadow flex items-center"
          >
            <div className="p-3 bg-blue-100 rounded-lg">
              <stat.icon className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">{stat.name}</p>
              <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Quick Start</h2>
        <p className="text-gray-600">
          Welcome to Desk Agent! Get started by creating an Agent configuration,
          then define Tasks with prompts for your agent to execute.
        </p>
      </div>
    </div>
  );
}
```

**Step 6: Commit**

```bash
git add apps/web/src/layouts apps/web/src/components apps/web/src/pages/Dashboard.tsx
git commit -m "feat(web): add dashboard layout with sidebar and header

- Create Sidebar with navigation links
- Create Header with user menu and logout
- Create DashboardLayout wrapping Outlet
- Add ProtectedRoute for auth guard
- Create Dashboard page with stats overview

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Update App Router

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/main.tsx`

**Step 1: Update App.tsx with routes**

```typescript
// apps/web/src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { Login } from '@/pages/Login';
import { Register } from '@/pages/Register';
import { Dashboard } from '@/pages/Dashboard';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="agents" element={<div>Agents (Coming Soon)</div>} />
              <Route path="tasks" element={<div>Tasks (Coming Soon)</div>} />
              <Route path="webhooks" element={<div>Webhooks (Coming Soon)</div>} />
              <Route path="settings" element={<div>Settings (Coming Soon)</div>} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
```

**Step 2: Update main.tsx**

```typescript
// apps/web/src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

**Step 3: Create index.css with Tailwind**

```css
/* apps/web/src/index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**Step 4: Verify routing works**

Run: `cd apps/web && pnpm dev`
Expected: App loads, redirects to /login, can navigate after login

**Step 5: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/main.tsx apps/web/src/index.css
git commit -m "feat(web): configure routing with protected routes

- Set up React Router with nested routes
- Configure QueryClient for TanStack Query
- Add placeholder pages for navigation items
- Wire up auth flow with protected dashboard

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Agents CRUD Pages

**Files:**
- Create: `apps/web/src/api/agents.ts`
- Create: `apps/web/src/pages/Agents.tsx`
- Create: `apps/web/src/pages/AgentDetail.tsx`
- Create: `apps/web/src/components/AgentForm.tsx`
- Modify: `apps/web/src/App.tsx` (add routes)

**Step 1: Create agents API module**

```typescript
// apps/web/src/api/agents.ts
import { api } from '@/lib/api';
import { Agent } from '@/types';

export interface CreateAgentInput {
  name: string;
  description?: string;
  model?: string;
  systemPrompt?: string;
  maxTokens?: number;
  tools?: string[];
}

export interface UpdateAgentInput extends Partial<CreateAgentInput> {}

export const agentsApi = {
  list: () => api.get<Agent[]>('/agents'),
  get: (id: string) => api.get<Agent>(`/agents/${id}`),
  create: (data: CreateAgentInput) => api.post<Agent>('/agents', data),
  update: (id: string, data: UpdateAgentInput) => api.patch<Agent>(`/agents/${id}`, data),
  delete: (id: string) => api.delete<void>(`/agents/${id}`),
};
```

**Step 2: Create Agents list page**

```typescript
// apps/web/src/pages/Agents.tsx
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { agentsApi } from '@/api/agents';
import { Plus, Bot, Trash2, Pencil } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export function Agents() {
  const queryClient = useQueryClient();
  const { data: agents, isLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: agentsApi.list,
  });

  const deleteMutation = useMutation({
    mutationFn: agentsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
  });

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Delete agent "${name}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) {
    return <div className="animate-pulse">Loading...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Agents</h1>
        <Link
          to="/agents/new"
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Agent
        </Link>
      </div>

      {agents?.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <Bot className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No agents</h3>
          <p className="mt-1 text-sm text-gray-500">
            Get started by creating a new agent.
          </p>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Model</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {agents?.map((agent) => (
                <tr key={agent.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <Link to={`/agents/${agent.id}`} className="text-blue-600 hover:text-blue-800 font-medium">
                      {agent.name}
                    </Link>
                    {agent.description && (
                      <p className="text-sm text-gray-500 truncate max-w-xs">{agent.description}</p>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{agent.model}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{formatDate(agent.createdAt)}</td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <Link
                      to={`/agents/${agent.id}/edit`}
                      className="inline-flex items-center p-1 text-gray-400 hover:text-gray-600"
                    >
                      <Pencil className="h-4 w-4" />
                    </Link>
                    <button
                      onClick={() => handleDelete(agent.id, agent.name)}
                      className="inline-flex items-center p-1 text-gray-400 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

**Step 3: Create AgentForm component**

```typescript
// apps/web/src/components/AgentForm.tsx
import { useState } from 'react';
import { Agent } from '@/types';
import { CreateAgentInput } from '@/api/agents';

interface AgentFormProps {
  agent?: Agent;
  onSubmit: (data: CreateAgentInput) => void;
  isLoading?: boolean;
}

const MODELS = [
  'claude-sonnet-4-20250514',
  'claude-opus-4-20250514',
];

export function AgentForm({ agent, onSubmit, isLoading }: AgentFormProps) {
  const [formData, setFormData] = useState<CreateAgentInput>({
    name: agent?.name ?? '',
    description: agent?.description ?? '',
    model: agent?.model ?? 'claude-sonnet-4-20250514',
    systemPrompt: agent?.systemPrompt ?? '',
    maxTokens: agent?.maxTokens ?? 4096,
    tools: agent?.tools ?? [],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700">Name</label>
        <input
          type="text"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Description</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={2}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Model</label>
        <select
          value={formData.model}
          onChange={(e) => setFormData({ ...formData, model: e.target.value })}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        >
          {MODELS.map((model) => (
            <option key={model} value={model}>{model}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">System Prompt</label>
        <textarea
          value={formData.systemPrompt}
          onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
          rows={4}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Max Tokens</label>
        <input
          type="number"
          value={formData.maxTokens}
          onChange={(e) => setFormData({ ...formData, maxTokens: parseInt(e.target.value) })}
          min={1}
          max={100000}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? 'Saving...' : agent ? 'Update' : 'Create'}
        </button>
      </div>
    </form>
  );
}
```

**Step 4: Create AgentDetail page (view/edit)**

```typescript
// apps/web/src/pages/AgentDetail.tsx
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { agentsApi, CreateAgentInput } from '@/api/agents';
import { AgentForm } from '@/components/AgentForm';
import { ArrowLeft } from 'lucide-react';

export function AgentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = id === 'new';

  const { data: agent, isLoading } = useQuery({
    queryKey: ['agent', id],
    queryFn: () => agentsApi.get(id!),
    enabled: !isNew && !!id,
  });

  const createMutation = useMutation({
    mutationFn: agentsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      navigate('/agents');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: CreateAgentInput) => agentsApi.update(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      queryClient.invalidateQueries({ queryKey: ['agent', id] });
      navigate('/agents');
    },
  });

  const handleSubmit = (data: CreateAgentInput) => {
    if (isNew) {
      createMutation.mutate(data);
    } else {
      updateMutation.mutate(data);
    }
  };

  if (!isNew && isLoading) {
    return <div className="animate-pulse">Loading...</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <Link to="/agents" className="flex items-center text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Agents
        </Link>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          {isNew ? 'Create Agent' : `Edit ${agent?.name}`}
        </h1>
        <AgentForm
          agent={agent}
          onSubmit={handleSubmit}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      </div>
    </div>
  );
}
```

**Step 5: Update App.tsx with agent routes**

Add these routes inside the protected route:
```typescript
<Route path="agents" element={<Agents />} />
<Route path="agents/:id" element={<AgentDetail />} />
<Route path="agents/:id/edit" element={<AgentDetail />} />
```

**Step 6: Commit**

```bash
git add apps/web/src/api/agents.ts apps/web/src/pages/Agents.tsx apps/web/src/pages/AgentDetail.tsx apps/web/src/components/AgentForm.tsx apps/web/src/App.tsx
git commit -m "feat(web): add agents CRUD pages

- Create agents API module
- Add Agents list page with table
- Add AgentDetail page for create/edit
- Add AgentForm component with all fields

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Tasks CRUD Pages

**Files:**
- Create: `apps/web/src/api/tasks.ts`
- Create: `apps/web/src/pages/Tasks.tsx`
- Create: `apps/web/src/pages/TaskDetail.tsx`
- Create: `apps/web/src/components/TaskForm.tsx`
- Modify: `apps/web/src/App.tsx` (add routes)

**Step 1: Create tasks API module**

```typescript
// apps/web/src/api/tasks.ts
import { api } from '@/lib/api';
import { Task, TaskRun } from '@/types';

export interface CreateTaskInput {
  name: string;
  description?: string;
  agentId: string;
  prompt: string;
  variables?: Record<string, unknown>;
}

export interface UpdateTaskInput extends Partial<CreateTaskInput> {}

export interface RunTaskInput {
  variables?: Record<string, unknown>;
}

export const tasksApi = {
  list: () => api.get<Task[]>('/tasks'),
  get: (id: string) => api.get<Task>(`/tasks/${id}`),
  create: (data: CreateTaskInput) => api.post<Task>('/tasks', data),
  update: (id: string, data: UpdateTaskInput) => api.patch<Task>(`/tasks/${id}`, data),
  delete: (id: string) => api.delete<void>(`/tasks/${id}`),
  run: (id: string, data?: RunTaskInput) => api.post<TaskRun>(`/tasks/${id}/runs`, data),
  listRuns: (id: string) => api.get<TaskRun[]>(`/tasks/${id}/runs`),
};
```

**Step 2: Create Tasks list page**

```typescript
// apps/web/src/pages/Tasks.tsx
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksApi } from '@/api/tasks';
import { agentsApi } from '@/api/agents';
import { Plus, ListTodo, Trash2, Pencil, Play } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

export function Tasks() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: tasksApi.list,
  });

  const { data: agents } = useQuery({
    queryKey: ['agents'],
    queryFn: agentsApi.list,
  });

  const deleteMutation = useMutation({
    mutationFn: tasksApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const runMutation = useMutation({
    mutationFn: (taskId: string) => tasksApi.run(taskId),
    onSuccess: (run) => {
      navigate(`/runs/${run.id}`);
    },
  });

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Delete task "${name}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  const getAgentName = (agentId: string) => {
    return agents?.find((a) => a.id === agentId)?.name ?? 'Unknown';
  };

  if (isLoading) {
    return <div className="animate-pulse">Loading...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
        <Link
          to="/tasks/new"
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Task
        </Link>
      </div>

      {tasks?.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <ListTodo className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No tasks</h3>
          <p className="mt-1 text-sm text-gray-500">
            Get started by creating a new task.
          </p>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Agent</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tasks?.map((task) => (
                <tr key={task.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <Link to={`/tasks/${task.id}`} className="text-blue-600 hover:text-blue-800 font-medium">
                      {task.name}
                    </Link>
                    {task.description && (
                      <p className="text-sm text-gray-500 truncate max-w-xs">{task.description}</p>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{getAgentName(task.agentId)}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{formatDate(task.createdAt)}</td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button
                      onClick={() => runMutation.mutate(task.id)}
                      disabled={runMutation.isPending}
                      className="inline-flex items-center p-1 text-green-600 hover:text-green-800"
                      title="Run"
                    >
                      <Play className="h-4 w-4" />
                    </button>
                    <Link
                      to={`/tasks/${task.id}/edit`}
                      className="inline-flex items-center p-1 text-gray-400 hover:text-gray-600"
                    >
                      <Pencil className="h-4 w-4" />
                    </Link>
                    <button
                      onClick={() => handleDelete(task.id, task.name)}
                      className="inline-flex items-center p-1 text-gray-400 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

**Step 3: Create TaskForm component**

```typescript
// apps/web/src/components/TaskForm.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Task, Agent } from '@/types';
import { CreateTaskInput } from '@/api/tasks';
import { agentsApi } from '@/api/agents';

interface TaskFormProps {
  task?: Task;
  onSubmit: (data: CreateTaskInput) => void;
  isLoading?: boolean;
}

export function TaskForm({ task, onSubmit, isLoading }: TaskFormProps) {
  const { data: agents } = useQuery({
    queryKey: ['agents'],
    queryFn: agentsApi.list,
  });

  const [formData, setFormData] = useState<CreateTaskInput>({
    name: task?.name ?? '',
    description: task?.description ?? '',
    agentId: task?.agentId ?? '',
    prompt: task?.prompt ?? '',
    variables: task?.variables ?? undefined,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700">Name</label>
        <input
          type="text"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Description</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={2}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Agent</label>
        <select
          required
          value={formData.agentId}
          onChange={(e) => setFormData({ ...formData, agentId: e.target.value })}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Select an agent</option>
          {agents?.map((agent) => (
            <option key={agent.id} value={agent.id}>{agent.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Prompt</label>
        <textarea
          required
          value={formData.prompt}
          onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
          rows={6}
          placeholder="Enter the prompt for the agent..."
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
        />
        <p className="mt-1 text-sm text-gray-500">
          Use {"{{variable}}"} syntax for dynamic values.
        </p>
      </div>

      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? 'Saving...' : task ? 'Update' : 'Create'}
        </button>
      </div>
    </form>
  );
}
```

**Step 4: Create TaskDetail page**

```typescript
// apps/web/src/pages/TaskDetail.tsx
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksApi, CreateTaskInput } from '@/api/tasks';
import { TaskForm } from '@/components/TaskForm';
import { ArrowLeft } from 'lucide-react';

export function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = id === 'new';

  const { data: task, isLoading } = useQuery({
    queryKey: ['task', id],
    queryFn: () => tasksApi.get(id!),
    enabled: !isNew && !!id,
  });

  const createMutation = useMutation({
    mutationFn: tasksApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      navigate('/tasks');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: CreateTaskInput) => tasksApi.update(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task', id] });
      navigate('/tasks');
    },
  });

  const handleSubmit = (data: CreateTaskInput) => {
    if (isNew) {
      createMutation.mutate(data);
    } else {
      updateMutation.mutate(data);
    }
  };

  if (!isNew && isLoading) {
    return <div className="animate-pulse">Loading...</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <Link to="/tasks" className="flex items-center text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Tasks
        </Link>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          {isNew ? 'Create Task' : `Edit ${task?.name}`}
        </h1>
        <TaskForm
          task={task}
          onSubmit={handleSubmit}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      </div>
    </div>
  );
}
```

**Step 5: Update App.tsx with task routes**

Add these routes inside the protected route:
```typescript
<Route path="tasks" element={<Tasks />} />
<Route path="tasks/:id" element={<TaskDetail />} />
<Route path="tasks/:id/edit" element={<TaskDetail />} />
```

**Step 6: Commit**

```bash
git add apps/web/src/api/tasks.ts apps/web/src/pages/Tasks.tsx apps/web/src/pages/TaskDetail.tsx apps/web/src/components/TaskForm.tsx apps/web/src/App.tsx
git commit -m "feat(web): add tasks CRUD pages

- Create tasks API module with run support
- Add Tasks list page with run button
- Add TaskDetail page for create/edit
- Add TaskForm component with agent selection

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 8: Task Run Viewer with SSE

**Files:**
- Create: `apps/web/src/api/runs.ts`
- Create: `apps/web/src/hooks/useSSE.ts`
- Create: `apps/web/src/pages/TaskRun.tsx`
- Create: `apps/web/src/components/LogViewer.tsx`
- Create: `apps/web/src/components/HumanInputForm.tsx`
- Modify: `apps/web/src/App.tsx` (add route)

**Step 1: Create runs API module**

```typescript
// apps/web/src/api/runs.ts
import { api } from '@/lib/api';
import { TaskRun } from '@/types';

export interface SubmitInputData {
  approved: boolean;
  input?: string;
}

export const runsApi = {
  get: (id: string) => api.get<TaskRun>(`/runs/${id}`),
  submitInput: (id: string, data: SubmitInputData) =>
    api.post<void>(`/runs/${id}/input`, data),
  cancel: (id: string) => api.post<void>(`/runs/${id}/cancel`),
  getLogs: (id: string) => api.get<{ logs: string }>(`/runs/${id}/logs`),
};
```

**Step 2: Create useSSE hook**

```typescript
// apps/web/src/hooks/useSSE.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';

export interface TaskEvent {
  type: string;
  data: Record<string, unknown>;
  id: string;
  timestamp: string;
}

export function useSSE(runId: string | undefined) {
  const [events, setEvents] = useState<TaskEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (!runId) return;

    const token = api.getToken();
    const url = `/api/runs/${runId}/events?token=${token}`;

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      setError(null);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setEvents((prev) => [...prev, {
          type: data.type,
          data: data,
          id: event.lastEventId,
          timestamp: new Date().toISOString(),
        }]);
      } catch (e) {
        console.error('Failed to parse SSE event:', e);
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
      setError('Connection lost. Reconnecting...');
      eventSource.close();
      setTimeout(connect, 3000);
    };

    return () => {
      eventSource.close();
    };
  }, [runId]);

  useEffect(() => {
    const cleanup = connect();
    return () => {
      cleanup?.();
      eventSourceRef.current?.close();
    };
  }, [connect]);

  const disconnect = useCallback(() => {
    eventSourceRef.current?.close();
    setIsConnected(false);
  }, []);

  return { events, isConnected, error, disconnect };
}
```

**Step 3: Create LogViewer component**

```typescript
// apps/web/src/components/LogViewer.tsx
import { useEffect, useRef } from 'react';
import { TaskEvent } from '@/hooks/useSSE';

interface LogViewerProps {
  events: TaskEvent[];
}

export function LogViewer({ events }: LogViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [events]);

  const getEventColor = (type: string) => {
    switch (type) {
      case 'TASK_STARTED':
        return 'text-blue-600';
      case 'TASK_COMPLETED':
        return 'text-green-600';
      case 'TASK_FAILED':
        return 'text-red-600';
      case 'STEP_STARTED':
      case 'STEP_COMPLETED':
        return 'text-purple-600';
      case 'HUMAN_INPUT_NEEDED':
        return 'text-yellow-600';
      case 'LOG_APPENDED':
        return 'text-gray-600';
      default:
        return 'text-gray-500';
    }
  };

  return (
    <div
      ref={containerRef}
      className="bg-gray-900 rounded-lg p-4 h-96 overflow-y-auto font-mono text-sm"
    >
      {events.length === 0 ? (
        <div className="text-gray-500">Waiting for events...</div>
      ) : (
        events.map((event, index) => (
          <div key={index} className="mb-1">
            <span className="text-gray-500">[{new Date(event.timestamp).toLocaleTimeString()}]</span>
            {' '}
            <span className={getEventColor(event.type)}>{event.type}</span>
            {event.data.line && (
              <span className="text-gray-300">: {String(event.data.line)}</span>
            )}
            {event.data.step && (
              <span className="text-gray-300">: {String((event.data.step as { name?: string })?.name)}</span>
            )}
            {event.data.error && (
              <span className="text-red-400">: {String(event.data.error)}</span>
            )}
          </div>
        ))
      )}
    </div>
  );
}
```

**Step 4: Create HumanInputForm component**

```typescript
// apps/web/src/components/HumanInputForm.tsx
import { useState } from 'react';

interface HumanInputFormProps {
  prompt: string;
  onSubmit: (approved: boolean, input?: string) => void;
  isLoading?: boolean;
}

export function HumanInputForm({ prompt, onSubmit, isLoading }: HumanInputFormProps) {
  const [input, setInput] = useState('');

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
      <h3 className="text-lg font-medium text-yellow-800 mb-2">
        Human Input Required
      </h3>
      <p className="text-yellow-700 mb-4">{prompt}</p>
      <div className="space-y-4">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter your response (optional)..."
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        />
        <div className="flex space-x-3">
          <button
            onClick={() => onSubmit(true, input || undefined)}
            disabled={isLoading}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
          >
            Approve
          </button>
          <button
            onClick={() => onSubmit(false)}
            disabled={isLoading}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 5: Create TaskRun page**

```typescript
// apps/web/src/pages/TaskRun.tsx
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { runsApi, SubmitInputData } from '@/api/runs';
import { useSSE } from '@/hooks/useSSE';
import { LogViewer } from '@/components/LogViewer';
import { HumanInputForm } from '@/components/HumanInputForm';
import { ArrowLeft, Circle, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const statusConfig: Record<string, { icon: typeof Circle; color: string; label: string }> = {
  pending: { icon: Clock, color: 'text-gray-500', label: 'Pending' },
  queued: { icon: Clock, color: 'text-blue-500', label: 'Queued' },
  running: { icon: Loader2, color: 'text-blue-500', label: 'Running' },
  waiting_input: { icon: Clock, color: 'text-yellow-500', label: 'Waiting for Input' },
  completed: { icon: CheckCircle, color: 'text-green-500', label: 'Completed' },
  failed: { icon: XCircle, color: 'text-red-500', label: 'Failed' },
  cancelled: { icon: XCircle, color: 'text-gray-500', label: 'Cancelled' },
};

export function TaskRunPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: run, isLoading } = useQuery({
    queryKey: ['run', id],
    queryFn: () => runsApi.get(id!),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'completed' || status === 'failed' || status === 'cancelled') {
        return false;
      }
      return 2000;
    },
  });

  const { events, isConnected } = useSSE(id);

  const inputMutation = useMutation({
    mutationFn: (data: SubmitInputData) => runsApi.submitInput(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['run', id] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => runsApi.cancel(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['run', id] });
    },
  });

  if (isLoading) {
    return <div className="animate-pulse">Loading...</div>;
  }

  if (!run) {
    return <div>Run not found</div>;
  }

  const status = statusConfig[run.status] ?? statusConfig.pending;
  const StatusIcon = status.icon;
  const waitingEvent = events.find((e) => e.type === 'HUMAN_INPUT_NEEDED');

  return (
    <div>
      <div className="mb-6">
        <Link to="/tasks" className="flex items-center text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Tasks
        </Link>
      </div>

      <div className="space-y-6">
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">Task Run</h1>
            <div className="flex items-center space-x-4">
              <div className={cn('flex items-center', status.color)}>
                <StatusIcon className={cn('h-5 w-5 mr-2', run.status === 'running' && 'animate-spin')} />
                <span className="font-medium">{status.label}</span>
              </div>
              {isConnected && (
                <span className="flex items-center text-sm text-green-600">
                  <Circle className="h-2 w-2 mr-1 fill-current" />
                  Live
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Progress:</span>
              <span className="ml-2 font-medium">{run.progress}%</span>
            </div>
            <div>
              <span className="text-gray-500">Tokens:</span>
              <span className="ml-2 font-medium">{run.tokensInput + run.tokensOutput}</span>
            </div>
          </div>

          {(run.status === 'running' || run.status === 'waiting_input') && (
            <div className="mt-4">
              <button
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
                className="px-4 py-2 border border-red-300 text-red-600 rounded-md hover:bg-red-50 disabled:opacity-50"
              >
                Cancel Run
              </button>
            </div>
          )}
        </div>

        {run.status === 'waiting_input' && waitingEvent && (
          <HumanInputForm
            prompt={String(waitingEvent.data.prompt ?? 'Please provide input')}
            onSubmit={(approved, input) => inputMutation.mutate({ approved, input })}
            isLoading={inputMutation.isPending}
          />
        )}

        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Execution Log</h2>
          <LogViewer events={events} />
        </div>

        {run.result && (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Result</h2>
            <pre className="bg-gray-50 p-4 rounded-md text-sm overflow-x-auto">
              {run.result}
            </pre>
          </div>
        )}

        {run.error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-lg font-medium text-red-800 mb-2">Error</h2>
            <pre className="text-red-700 text-sm whitespace-pre-wrap">{run.error}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 6: Update App.tsx with run route**

Add this route inside the protected route:
```typescript
<Route path="runs/:id" element={<TaskRunPage />} />
```

**Step 7: Commit**

```bash
git add apps/web/src/api/runs.ts apps/web/src/hooks/useSSE.ts apps/web/src/pages/TaskRun.tsx apps/web/src/components/LogViewer.tsx apps/web/src/components/HumanInputForm.tsx apps/web/src/App.tsx
git commit -m "feat(web): add task run viewer with SSE streaming

- Create runs API module with input/cancel support
- Add useSSE hook for real-time event streaming
- Add LogViewer component with colored events
- Add HumanInputForm for human-in-loop
- Add TaskRunPage with status display and controls

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 9: Update Root Package.json and Build

**Files:**
- Modify: `package.json` (root)
- Modify: `turbo.json`

**Step 1: Update root package.json**

Add web to workspaces if not present:
```json
"workspaces": ["apps/*", "packages/*"]
```

**Step 2: Update turbo.json**

Ensure build pipeline includes web:
```json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

**Step 3: Test full build**

Run: `pnpm install && pnpm build`
Expected: All packages build successfully

**Step 4: Test dev mode**

Run: `pnpm dev`
Expected: API on 3000, Web on 3001

**Step 5: Commit**

```bash
git add package.json turbo.json apps/web/
git commit -m "feat(web): complete Sprint 1 - Web Frontend Foundation

Sprint 1 delivers:
- React + Vite web application
- Authentication (login/register)
- Dashboard layout with sidebar navigation
- Agents CRUD (list, create, edit, delete)
- Tasks CRUD (list, create, edit, delete)
- Task run viewer with SSE real-time updates
- Human input form for agent interactions

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Verification Checklist

After completing all tasks, verify:

- [ ] `pnpm install` succeeds in root
- [ ] `pnpm build` builds all packages including web
- [ ] `pnpm dev` starts both API and web
- [ ] Can access web at http://localhost:3001
- [ ] Can register a new user
- [ ] Can login with registered user
- [ ] Dashboard shows with sidebar navigation
- [ ] Can create, edit, delete agents
- [ ] Can create, edit, delete tasks
- [ ] Can run a task and see SSE events
- [ ] Human input form appears when needed

---

## Next Steps

After Sprint 1 completion:
1. **Sprint 2:** Stripe Payment Integration
2. **Sprint 3:** S3 Storage & Custom Tools
3. **Sprint 4:** OAuth & Polish
