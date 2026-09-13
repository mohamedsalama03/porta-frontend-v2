'use client';
import type { ReactNode } from 'react';
import { QueryProvider } from '@/lib/query/provider';
import { AuthProvider } from '@/lib/auth/provider';
import {
  portaSessionContract,
  portaLoginContract,
  portaLogoutContract,
} from '@/lib/auth/porta-adapters';
export function AuthProviders({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <AuthProvider
        sessionContract={portaSessionContract}
        loginContract={portaLoginContract}
        logoutContract={portaLogoutContract}
      >
        {children}
      </AuthProvider>
    </QueryProvider>
  );
}
