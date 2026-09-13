'use client';
import { LazyMotion, MotionConfig } from 'motion/react';
import type { ReactNode } from 'react';
const loadMotionFeatures = () => import('@/lib/motion/features').then((loaded) => loaded.default);
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}>
      <LazyMotion features={loadMotionFeatures} strict>
        {children}
      </LazyMotion>
    </MotionConfig>
  );
}
