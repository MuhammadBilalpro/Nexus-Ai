import { describe, it, expect } from "vitest";
import { routeIntent, findProjectMention, INTENT_AGENT, FINANCIAL_INTENTS } from "@/server/assistant/intents";
import { titleFromQuestion, MAX_TITLE } from "@/server/assistant/service";

describe("assistant intent router", () => {
  it("routes the suggested executive questions deterministically", () => {
    expect(routeIntent("What is happening in my company today?")).toBe("status");
    expect(routeIntent("What requires my attention today?")).toBe("status");
    expect(routeIntent("Which projects are delayed?")).toBe("delayed");
    expect(routeIntent("What is blocking Helios Banking App?")).toBe("delayed");
    expect(routeIntent("Which project is generating the highest profit?")).toBe("profit");
    expect(routeIntent("What is our total revenue this month?")).toBe("revenue");
    expect(routeIntent("Which clients have pending payments?")).toBe("pending_payments");
    expect(routeIntent("Which team members are overloaded?")).toBe("workload");
    expect(routeIntent("Give me a complete company performance report")).toBe("report");
  });

  it("prefers specific finance intents over the broad report intent", () => {
    expect(routeIntent("report on overdue invoices")).toBe("pending_payments");
    expect(routeIntent("profit report")).toBe("profit");
  });

  it("falls back honestly on unrelated questions", () => {
    expect(routeIntent("Tell me a joke")).toBe("fallback");
    expect(routeIntent("")).toBe("fallback");
    expect(routeIntent("   ")).toBe("fallback");
  });

  it("maps every intent to an agent and marks money intents as financial", () => {
    for (const intent of ["status", "delayed", "profit", "revenue", "pending_payments", "workload", "report", "fallback", "forbidden"] as const) {
      expect(INTENT_AGENT[intent]).toBeTruthy();
    }
    expect(FINANCIAL_INTENTS.has("revenue")).toBe(true);
    expect(FINANCIAL_INTENTS.has("delayed")).toBe(false);
  });
});

describe("project mention detection", () => {
  const projects = [
    { id: "1", name: "Helios Banking App (iOS/Android)", slug: "helios-mobile" },
    { id: "2", name: "Helios Design System", slug: "helios-design-system" },
    { id: "3", name: "Internal Asset Pipeline Service", slug: "asset-pipeline" },
  ];
  it("matches the longest distinctive name", () => {
    expect(findProjectMention("what is blocking helios banking app?", projects)?.id).toBe("1");
    expect(findProjectMention("Why is the asset pipeline late", projects)?.id).toBe("3");
    expect(findProjectMention("status of helios-design-system", projects)?.id).toBe("2");
  });
  it("ignores generic words", () => {
    expect(findProjectMention("which mobile project is behind?", projects)).toBeNull();
    expect(findProjectMention("which projects are delayed?", projects)).toBeNull();
  });
});

describe("conversation titles", () => {
  it("collapses whitespace and truncates with an ellipsis", () => {
    expect(titleFromQuestion("  Which   projects are delayed? ")).toBe("Which projects are delayed?");
    const long = "x".repeat(200);
    const title = titleFromQuestion(long);
    expect(title.length).toBe(MAX_TITLE);
    expect(title.endsWith("…")).toBe(true);
  });
});
