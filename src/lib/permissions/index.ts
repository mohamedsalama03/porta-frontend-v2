export interface PermissionSubject {
  permissions: readonly string[];
}

/** Presentation only. Every protected backend operation still requires authorization. */
export function can(subject: PermissionSubject | null | undefined, permission: string): boolean {
  if (!subject || !permission || permission.includes('*')) return false;
  return subject.permissions.includes(permission);
}

export function createPermissionChecker(subject: PermissionSubject | null | undefined) {
  return (permission: string): boolean => can(subject, permission);
}
