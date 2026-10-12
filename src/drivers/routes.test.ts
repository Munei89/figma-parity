import { describe, it, expect } from "vitest";
import { routeToRegExp, hasParams, matchesPath } from "./routes.js";

describe("drivers/routes", () => {
  describe("routeToRegExp", () => {
    it("converts simple routes", () => {
      const re = routeToRegExp("/login");
      expect(re.test("/login")).toBe(true);
      expect(re.test("/login/")).toBe(true);
      expect(re.test("/logout")).toBe(false);
    });

    it("handles route parameters", () => {
      const re = routeToRegExp("/orders/:id");
      expect(re.test("/orders/123")).toBe(true);
      expect(re.test("/orders/abc")).toBe(true);
      expect(re.test("/orders")).toBe(false);
      expect(re.test("/orders/123/items")).toBe(false);
    });

    it("handles wildcards", () => {
      const re = routeToRegExp("/api/*");
      expect(re.test("/api/users")).toBe(true);
      expect(re.test("/api/users/123")).toBe(true);
      expect(re.test("/api")).toBe(false);
    });

    it("handles query strings and fragments", () => {
      const re = routeToRegExp("/login?redirect=/home");
      expect(re.test("/login")).toBe(true);
      expect(re.test("/login/")).toBe(true);
    });
  });

  describe("hasParams", () => {
    it("detects route parameters", () => {
      expect(hasParams("/orders/:id")).toBe(true);
      expect(hasParams("/users/:userId/posts/:postId")).toBe(true);
      expect(hasParams("/login")).toBe(false);
    });

    it("detects wildcards", () => {
      expect(hasParams("/api/*")).toBe(true);
      expect(hasParams("/static")).toBe(false);
    });
  });

  describe("matchesPath", () => {
    it("matches exact paths", () => {
      expect(matchesPath("/login", "/login")).toBe(true);
      expect(matchesPath("/login/", "/login")).toBe(true);
      expect(matchesPath("/logout", "/login")).toBe(false);
    });

    it("matches parameterized routes", () => {
      expect(matchesPath("/orders/123", "/orders/:id")).toBe(true);
      expect(matchesPath("/orders/abc", "/orders/:id")).toBe(true);
      expect(matchesPath("/orders", "/orders/:id")).toBe(false);
    });

    it("works with RegExp patterns", () => {
      const pattern = /^\/orders\/\d+$/;
      expect(matchesPath("/orders/123", pattern)).toBe(true);
      expect(matchesPath("/orders/abc", pattern)).toBe(false);
    });
  });
});
