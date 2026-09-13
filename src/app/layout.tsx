import type { Metadata } from 'next';
import { Cairo } from 'next/font/google';
import { MotionProvider } from '@/components/ui/motion-provider';
import './globals.css';

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-cairo',
});

export const metadata: Metadata = {
  title: { default: 'Porta Delivery | إدارة الشحن والتوصيل', template: '%s | Porta Delivery' },
  description: 'مساحة إدارة الشحنات والرحلات والتوصيل بين المدن.',
  robots: { index: false, follow: false, noarchive: true },
};

const preferenceScript = `(function(){try{var t=localStorage.getItem('porta-theme');var d=t==='dark'||((!t||t==='system')&&matchMedia('(prefers-color-scheme:dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';var n=localStorage.getItem('porta-density');document.documentElement.dataset.density=n==='comfortable'?'comfortable':'compact'}catch(e){document.documentElement.dataset.theme=matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" className={cairo.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: preferenceScript }} />
      </head>
      <body>
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
