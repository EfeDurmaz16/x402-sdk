import { formatInteropProbeReport, getInteropProbePlan } from "./probes";

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(getInteropProbePlan(), null, 2));
} else {
  console.log(formatInteropProbeReport());
}
