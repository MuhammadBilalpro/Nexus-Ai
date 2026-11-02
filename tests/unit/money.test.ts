import { describe, it, expect } from "vitest";
import { money, sum, subtract, toFixed, percentChange, marginPercent } from "@/server/finance/money";

describe("money arithmetic", () => {
  it("sums decimal strings exactly (no float drift)", () => {
    expect(toFixed(sum(["0.10", "0.20", "0.30"]))).toBe("0.60");
    expect(toFixed(sum(Array.from({ length: 1000 }, () => "0.01")))).toBe("10.00");
  });
  it("subtracts and formats", () => {
    expect(toFixed(subtract(money("100.00"), money("33.33")))).toBe("66.67");
    expect(toFixed(money(null))).toBe("0.00");
  });
  it("computes percentage change with safe baselines", () => {
    expect(percentChange(money("150"), money("100"))).toBe(50);
    expect(percentChange(money("0"), money("0"))).toBe(0);
    expect(percentChange(money("10"), money("0"))).toBeNull();
  });
  it("computes margin", () => {
    expect(marginPercent(money("25"), money("100"))).toBe(25);
    expect(marginPercent(money("25"), money("0"))).toBeNull();
  });
});
