import { describe, it, expect, vi } from "vitest";
import { VERSION } from "./version.js";

describe("version", () => {
  it("exports a version string", () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("matches package.json version", () => {
    expect(VERSION).toBe("0.1.0");
  });
});
