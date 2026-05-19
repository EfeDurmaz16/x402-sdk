import { formatPromotionPlan, getPromotionPlan } from "./promotion";

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(getPromotionPlan(), null, 2));
} else {
  console.log(formatPromotionPlan());
}
