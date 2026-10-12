/** "/orders/:id" -> /^\/orders\/[^/]+\/?$/ */
export function routeToRegExp(route: string): RegExp {
  const path = route.split(/[?#]/)[0] ?? "/";
  const pattern = path
    .split("/")
    .map((seg) => (seg.startsWith(":") ? "[^/]+" : seg === "*" ? ".*" : seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
    .join("/")
    .replace(/\/$/, "");
  return new RegExp(`^${pattern || ""}/?$`);
}

export function hasParams(route: string): boolean {
  return /\/:[^/]+/.test(route) || route.includes("*");
}

export function matchesPath(pathname: string, route: string | RegExp): boolean {
  return (typeof route === "string" ? routeToRegExp(route) : route).test(pathname);
}
