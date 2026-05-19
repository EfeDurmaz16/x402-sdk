import { formatSdkScaffoldReport, getSdkScaffoldStatus } from "./scaffold";

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ version: 1, sdks: getSdkScaffoldStatus() }, null, 2));
} else {
  console.log(formatSdkScaffoldReport());
}
