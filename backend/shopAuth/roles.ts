import type { ShopRole } from './models.js';

/** Stored roles are trusted; public registration may never grant wholesale access. */
export function storedShopRoles(raw: unknown): ShopRole[] {
  const roles = (Array.isArray(raw) ? raw.map(String) : [])
    .map(role => role === 'wholesale' ? 'si' : role)
    .filter((role): role is ShopRole => role === 'customer' || role === 'ctv' || role === 'si');
  return roles.length ? [...new Set(roles)] : ['customer'];
}

export function registrationShopRoles(raw: unknown): ShopRole[] {
  const roles = storedShopRoles(raw).filter(role => role !== 'si');
  return roles.length ? roles : ['customer'];
}

export function isWholesaleAccount(account: unknown): boolean {
  return Boolean(account && typeof account === 'object' && 'roles' in account && storedShopRoles(account.roles).includes('si'));
}
