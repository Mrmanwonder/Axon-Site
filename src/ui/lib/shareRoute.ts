// Hosts may redirect /share to /share/. Both URLs are the same public recipient route.
export function isAcademicSharePath(pathname: string): boolean {
  return pathname === "/share" || pathname === "/share/";
}
