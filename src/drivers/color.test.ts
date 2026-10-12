import { describe, it, expect } from "vitest";
import { cssColorToHex, hexToRgba, colorDistance } from "./color.js";

describe("drivers/color", () => {
  describe("cssColorToHex", () => {
    it("parses hex colors", () => {
      expect(cssColorToHex("#ff0000")).toBe("#ff0000");
      expect(cssColorToHex("#f00")).toBe("#ff0000");
      expect(cssColorToHex("#ff0000ff")).toBe("#ff0000");
    });

    it("handles alpha channel", () => {
      expect(cssColorToHex("#ff000080")).toBe("#ff000080");
      expect(cssColorToHex("#f008")).toBe("#ff000088");
    });

    it("parses rgb/rgba", () => {
      expect(cssColorToHex("rgb(255, 0, 0)")).toBe("#ff0000");
      expect(cssColorToHex("rgba(255, 0, 0, 0.5)")).toBe("#ff000080");
      expect(cssColorToHex("rgb(255 0 0)")).toBe("#ff0000");
      expect(cssColorToHex("rgb(255 0 0 / 0.5)")).toBe("#ff000080");
    });

    it("parses percentages", () => {
      expect(cssColorToHex("rgb(100%, 0%, 0%)")).toBe("#ff0000");
      expect(cssColorToHex("rgba(100%, 0%, 0%, 50%)")).toBe("#ff000080");
    });

    it("parses color(srgb)", () => {
      expect(cssColorToHex("color(srgb 1 0 0)")).toBe("#ff0000");
      expect(cssColorToHex("color(srgb 1 0 0 / 0.5)")).toBe("#ff000080");
    });

    it("handles transparent", () => {
      expect(cssColorToHex("transparent")).toBe("#00000000");
    });

    it("returns undefined for invalid", () => {
      expect(cssColorToHex("invalid")).toBeUndefined();
      expect(cssColorToHex(null)).toBeUndefined();
      expect(cssColorToHex(undefined)).toBeUndefined();
    });
  });

  describe("hexToRgba", () => {
    it("converts hex to rgba", () => {
      expect(hexToRgba("#ff0000")).toEqual([255, 0, 0, 255]);
      expect(hexToRgba("#00ff00")).toEqual([0, 255, 0, 255]);
      expect(hexToRgba("#0000ff")).toEqual([0, 0, 255, 255]);
    });

    it("handles alpha channel", () => {
      expect(hexToRgba("#ff000080")).toEqual([255, 0, 0, 128]);
      expect(hexToRgba("#00000000")).toEqual([0, 0, 0, 0]);
    });
  });

  describe("colorDistance", () => {
    it("returns 0 for identical colors", () => {
      expect(colorDistance("#ff0000", "#ff0000")).toBe(0);
      expect(colorDistance("#000000", "#000000")).toBe(0);
    });

    it("returns max channel difference", () => {
      expect(colorDistance("#ff0000", "#00ff00")).toBeGreaterThan(200);
      expect(colorDistance("#000000", "#ffffff")).toBeGreaterThan(200);
    });

    it("handles similar colors", () => {
      expect(colorDistance("#ff0000", "#fe0000")).toBeLessThan(2);
      expect(colorDistance("#abcdef", "#abcdf0")).toBeLessThan(2);
    });

    it("handles alpha-premultiplied comparison", () => {
      // Fully transparent colors should have 0 distance (both premultiply to white)
      const d1 = colorDistance("#ff000000", "#00000000");
      expect(d1).toBe(0);
      // And should be less than the distance between different opaque colors
      const d2 = colorDistance("#ff0000ff", "#00ff00ff");
      expect(d1).toBeLessThan(d2);
    });
  });
});
