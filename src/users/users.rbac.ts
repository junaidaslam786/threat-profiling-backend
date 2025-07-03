export type UserRole = 'admin' | 'viewer' | 'LE_ADMIN';

export function canEditOrg(user, org) {
  if (user.role === 'admin' && org.admins?.includes(user.userId)) return true;
  if (user.role === 'LE_ADMIN' && org.le_master === user.userId) return true;
  return false;
}

export function canViewOrg(user, org) {
  if (org.admins?.includes(user.userId) || org.viewers?.includes(user.userId))
    return true;
  if (org.le_master && org.le_master === user.userId) return true;
  return false;
}
