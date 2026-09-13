type Filters = Readonly<Record<string, string | number | boolean | null | undefined>>;

function resourceKeys(resource: string) {
  return {
    all: [resource] as const,
    lists: () => [resource, 'list'] as const,
    list: (filters: Filters = {}) => [resource, 'list', filters] as const,
    details: () => [resource, 'detail'] as const,
    detail: (id: string) => [resource, 'detail', id] as const,
  };
}

// Naming conventions, not declarations of available endpoints or response fields.
export const shipmentKeys = resourceKeys('shipments');
export const tripKeys = resourceKeys('trips');
export const driverKeys = resourceKeys('drivers');
export const pricingKeys = resourceKeys('pricing');
export const paymentKeys = resourceKeys('payments');
export const reportKeys = resourceKeys('reports');
export const dashboardKeys = {
  all: ['dashboard'] as const,
  overview: () => ['dashboard', 'overview'] as const,
};
export const sessionKeys = {
  all: ['session'] as const,
  current: () => ['session', 'current'] as const,
};
