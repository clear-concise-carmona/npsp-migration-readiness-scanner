import * as fs from "node:fs";
import * as path from "node:path";
import { SfCommand, Flags } from "@salesforce/sf-plugins-core";
import { Messages } from "@salesforce/core";
import { runAllChecks } from "../../lib/scoring";
import { renderMarkdownReport } from "../../lib/report";

// __dirname here (commonjs build output) resolves to lib/commands/npsp at
// runtime, so walk up to the package root to find messages/.
Messages.importMessagesDirectory(path.join(__dirname, "..", "..", ".."));
const messages = Messages.loadMessages("npsp-migration-readiness-scanner", "scan");

export type ScanCommandResult = {
  overallScore: number;
  blockerCount: number;
  reportPath: string;
};

/**
 * `sf npsp scan`
 *
 * Runs every readiness check against the target org (read-only - no data is
 * modified) and writes a Markdown report. See README.md for the full list of
 * checks and the scoring methodology.
 */
export default class NpspScan extends SfCommand<ScanCommandResult> {
  public static readonly summary = messages.getMessage("summary");
  public static readonly description = messages.getMessage("description");
  public static readonly examples = messages.getMessages("examples");

  public static readonly flags = {
    "target-org": Flags.requiredOrg({
      summary: messages.getMessage("flags.target-org.summary"),
    }),
    "output-file": Flags.file({
      char: "f",
      summary: messages.getMessage("flags.output-file.summary"),
      default: "npsp-migration-readiness-report.md",
    }),
    json: Flags.boolean({
      summary: messages.getMessage("flags.json.summary"),
      default: false,
    }),
  };

  public async run(): Promise<ScanCommandResult> {
    const { flags } = await this.parse(NpspScan);
    const org = flags["target-org"];
    const conn = org.getConnection();

    this.spinner.start("Scanning org for NPSP -> Nonprofit Cloud migration readiness");
    const result = await runAllChecks(conn);
    this.spinner.stop();

    const orgLabel = org.getUsername() ?? org.getOrgId();
    const reportMarkdown = renderMarkdownReport(result, orgLabel ?? "unknown org");
    const outputPath = path.resolve(flags["output-file"]);
    fs.writeFileSync(outputPath, reportMarkdown, "utf8");

    this.log("");
    this.log(`Score: ${result.overallScore}/100`);
    this.log(`Blockers found: ${result.blockers.length}`);
    this.log(`Report written to: ${outputPath}`);
    this.log("");
    this.log(
      "For field-level migration detail on any blocker above, see: " +
        "https://github.com/clear-concise-carmona/npsp-to-nonprofit-cloud-field-map"
    );

    return {
      overallScore: result.overallScore,
      blockerCount: result.blockers.length,
      reportPath: outputPath,
    };
  }
}
