'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { createQueryClient } from './client';

export function QueryProvider({ children }: { children: ReactNode }) {
  // One in-memory cache per mounted session. No module-level SSR cache or persistence.
  const [client] = useState(createQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
