import { describe, it, expect } from "vitest";
import { slug, colorToHex, solidFillHex, channel } from "./util.js";
import type { Paint } from "./types.js";

describe("figma/util", () => {
  describe("slug", () => {
    it("converts strings to slugs", () => {
      expect(slug("Checkout / Payment")).toBe("checkout-payment");
      expect(slug("Login Button")).toBe("login-button");
      expect(slug("Frame 123")).toBe("frame-123");
    });

    it("handles special characters", () => {
      expect(slug("Test!@#$%")).toBe("test");
      expect(slug("Multiple   Spaces")).toBe("multiple-spaces");
    });
  });

  describe("colorToHex", () => {
    it("converts Figma colors to hex", () => {
      expect(colorToHex({ r: 1, g: 0, b: 0, a: 1 })).toBe("#ff0000");
      expect(colorToHex({ r: 0, g: 1, b: 0, a: 1 })).toBe("#00ff00");
      expect(colorToHex({ r: 0, g: 0, b: 1, a: 1 })).toBe("#0000ff");
    });

    it("handles alpha transparency", () => {
      expect(colorToHex({ r: 1, g: 0, b: 0, a: 0.5 })).toBe("#ff000080");
      expect(colorToHex({ r: 0, g: 0, b: 0, a: 0 })).toBe("#00000000");
    });

    it("applies opacity parameter", () => {
      expect(colorToHex({ r: 1, g: 0, b: 0, a: 1 }, 0.5)).toBe("#ff000080");
    });
  });

  describe("channel", () => {
    it("converts 0-1 to 00-ff hex", () => {
      expect(channel(0)).toBe("00");
      expect(channel(1)).toBe("ff");
      expect(channel(0.5)).toBe("80");
    });

    it("clamps values", () => {
      expect(channel(-0.1)).toBe("00");
      expect(channel(1.1)).toBe("ff");
    });
  });

  describe("solidFillHex", () => {
    it("returns undefined for empty fills", () => {
      expect(solidFillHex(undefined)).toBeUndefined();
      expect(solidFillHex([])).toBeUndefined();
    });

    it("extracts solid fill", () => {
      const fills: Paint[] = [{ type: "SOLID", color: { r: 1, g: 0, b: 0, a: 1 }, visible: true }];
      expect(solidFillHex(fills)).toBe("#ff0000");
    });

    it("returns last visible fill", () => {
      const fills: Paint[] = [
        { type: "SOLID", color: { r: 0, g: 0, b: 1, a: 1 }, visible: true },
        { type: "SOLID", color: { r: 1, g: 0, b: 0, a: 1 }, visible: true },
      ];
      expect(solidFillHex(fills)).toBe("#ff0000");
    });

    it("skips invisible fills", () => {
      const fills: Paint[] = [
        { type: "SOLID", color: { r: 0, g: 0, b: 1, a: 1 }, visible: false },
        { type: "SOLID", color: { r: 1, g: 0, b: 0, a: 1 }, visible: true },
      ];
      expect(solidFillHex(fills)).toBe("#ff0000");
    });

    it("returns undefined for non-solid fills", () => {
      const fills: Paint[] = [{ type: "GRADIENT", visible: true }];
      expect(solidFillHex(fills)).toBeUndefined();
    });
  });
});
