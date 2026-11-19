#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = process.argv.slice(2);

const readOption = (name, fallback = "") => {
  const index = args.indexOf(`--${name}`);
  if (index === -1) {
    return fallback;
  }

  return args[index + 1] ?? fallback;
};

const readRepeatedOption = (name) => {
  const values = [];
  args.forEach((arg, index) => {
    if (arg === `--${name}` && args[index + 1]) {
      values.push(args[index + 1]);
    }
  });
  return values;
};

const now = new Date().toISOString();
const eventType = readOption("kind", readOption("event-type"));
const allowedEventTypes = new Set(["security", "production-deploy", "factory-promotion-request"]);

if (!allowedEventTypes.has(eventType)) {
  console.error(`Invalid --kind value: ${eventType || "<empty>"}`);
  console.error(`Expected one of: ${Array.from(allowedEventTypes).join(", ")}`);
  process.exit(1);
}

const parseChecks = () =>
  Object.fromEntries(
    readRepeatedOption("check").map((value) => {
      const separatorIndex = value.indexOf("=");
      if (separatorIndex === -1) {
        return [value, "unknown"];
      }

      const key = value.slice(0, separatorIndex);
      const status = value.slice(separatorIndex + 1);
      return [key, status || "unknown"];
    }),
  );

const cleanEmpty = (value) => {
  if (Array.isArray(value)) {
    return value.map(cleanEmpty);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entryValue]) => entryValue !== "")
        .map(([key, entryValue]) => [key, cleanEmpty(entryValue)]),
    );
  }

  return value;
};

const startedAt = readOption("started-at", process.env.CICD_STARTED_AT || process.env.GITHUB_RUN_STARTED_AT || now);
const completedAt = readOption("completed-at", now);
const repository = process.env.GITHUB_REPOSITORY || readOption("repository");
const imageName = readOption("image-name");
const imageDigest = readOption("image-digest");
const imageRef = readOption("image-ref", imageName && imageDigest ? `${imageName}@${imageDigest}` : "");

const details = readOption("payload-file") ? JSON.parse(readFileSync(readOption("payload-file"), "utf8")) : {};
const detailKeys = eventType === "production-deploy" ? ["factoryPromotion"] :
  eventType === "factory-promotion-request" ? ["publicationDate", "browserObservability", "productAnalytics"] : [];
if (!details || typeof details !== "object" || Array.isArray(details) ||
    Object.keys(details).some((key) => !detailKeys.includes(key))) {
  throw new Error("Invalid additional event fields; release identity cannot be overridden");
}
const event = cleanEmpty({
  ...details,
  schemaVersion: "2.0",
  version: JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")).version,
  eventType,
  repository,
  workflow: process.env.GITHUB_WORKFLOW || readOption("workflow"),
  job: process.env.GITHUB_JOB || readOption("job"),
  runId: process.env.GITHUB_RUN_ID || readOption("run-id"),
  runAttempt: process.env.GITHUB_RUN_ATTEMPT || readOption("run-attempt"),
  ref: process.env.GITHUB_REF || readOption("ref"),
  sha: process.env.GITHUB_SHA || readOption("sha"),
  actor: process.env.GITHUB_ACTOR || readOption("actor"),
  eventName: process.env.GITHUB_EVENT_NAME || readOption("event-name"),
  status: readOption("status", "completed"),
  conclusion: readOption("conclusion", "unknown"),
  startedAt,
  completedAt,
  imageName,
  imageDigest,
  imageRef,
  checks: {
    plumber: "not_applicable",
    trivy: "not_applicable",
    codeql: "not_applicable",
    scorecard: "not_applicable",
    gitleaks: "not_applicable",
    cosign: "not_applicable",
    attestation: "not_applicable",
    ...parseChecks(),
  },
});

const outPath = readOption("out", `artifacts/cicd-event-${eventType}.json`);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(event, null, 2)}\n`);

console.log(`Wrote CI/CD event to ${outPath}`);
