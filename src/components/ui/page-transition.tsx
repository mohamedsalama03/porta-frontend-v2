'use client';
import * as m from 'motion/react-m';
import type { ReactNode } from 'react';
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <m.div initial={false} animate={{ opacity: 1 }} className="page-enter">
      {children}
    </m.div>
  );
}
