'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { createQueryClient } from '@/lib/query/client';

export function PublicOrderQueryProvider({ children }: { children: ReactNode }) {
  // A public mount owns its cache; it never inherits or shares a staff session cache.
  const [client] = useState(createQueryClient);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
