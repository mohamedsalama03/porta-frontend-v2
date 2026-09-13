import {
  Activity,
  BarChart3,
  Building2,
  CircleDollarSign,
  LayoutDashboard,
  MapPin,
  Package,
  Route,
  Settings2,
  Shapes,
  ShieldCheck,
  Truck,
  UsersRound,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ModuleKey } from '@/lib/navigation';

export const navigationIcons: Record<ModuleKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  shipments: Package,
  trips: Route,
  drivers: Truck,
  cities: MapPin,
  branches: Building2,
  'shipment-types': Shapes,
  pricing: CircleDollarSign,
  payments: ShieldCheck,
  reports: BarChart3,
  users: UsersRound,
  audit: Activity,
  settings: Settings2,
};
