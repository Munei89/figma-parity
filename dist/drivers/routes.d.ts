/** "/orders/:id" -> /^\/orders\/[^/]+\/?$/ */
export declare function routeToRegExp(route: string): RegExp;
export declare function hasParams(route: string): boolean;
export declare function matchesPath(pathname: string, route: string | RegExp): boolean;
