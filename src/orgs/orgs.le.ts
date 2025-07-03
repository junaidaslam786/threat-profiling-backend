export function generateLeOrgClientName(leDomain: string, orgDomain: string) {
  return `LE_${leDomain.replace(/\./g, '_')}_${orgDomain.replace(/\./g, '_')}`;
}
