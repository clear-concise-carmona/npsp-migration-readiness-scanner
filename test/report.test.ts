import { expect } from "chai";
import { renderMarkdownReport } from "../src/lib/report";
import { ScanResult } from "../src/lib/scoring";

describe("renderMarkdownReport", () => {
  const baseResult: ScanResult = {
    overallScore: 62,
    scannedAt: "2026-09-13T00:00:00.000Z",
    checks: [
      { checkId: "legacyHouseholdModel", weight: 20, subscore: 100, blockers: [] },
    ],
    blockers: [
      {
        id: "sample-blocker",
        severity: "medium",
        title: "Sample blocker",
        detail: "Sample detail text.",
        recommendation: "Sample recommendation text.",
      },
    ],
  };

  it("includes the overall score in the heading", () => {
    const md = renderMarkdownReport(baseResult, "test-org");
    expect(md).to.include("Score: 62/100");
  });

  it("includes every blocker's title and recommendation", () => {
    const md = renderMarkdownReport(baseResult, "test-org");
    expect(md).to.include("Sample blocker");
    expect(md).to.include("Sample recommendation text.");
  });

  it("reports zero blockers cleanly when none are found", () => {
    const clean: ScanResult = { ...baseResult, blockers: [] };
    const md = renderMarkdownReport(clean, "test-org");
    expect(md).to.include("No blockers found by this scan");
  });

  it("links to the companion field-map repo", () => {
    const md = renderMarkdownReport(baseResult, "test-org");
    expect(md).to.include("npsp-to-nonprofit-cloud-field-map");
  });
});
