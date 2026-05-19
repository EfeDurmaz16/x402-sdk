import { formatCapabilityJson, formatCapabilitySummary } from "./capabilities";

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(formatCapabilityJson(), null, 2));
  process.exit(0);
}

for (const line of formatCapabilitySummary()) {
  console.log(line);
}
