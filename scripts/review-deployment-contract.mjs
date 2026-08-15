import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const workflow = await readFile(".github/workflows/deploy-production.yml", "utf8");

for (const contract of [
  "Emit production CI/CD event",
  "scripts/emit-cicd-event.mjs",
  "cicd-event-production.json",
  "name: cicd-event-production"
]) {
  assert(workflow.includes(contract), `Production deployment handoff is missing: ${contract}`);
}

const directory = await mkdtemp(join(tmpdir(), "itart-cicd-event-"));
const output = join(directory, "cicd-event-production.json");

try {
  const result = spawnSync(
    process.execPath,
    [
      "scripts/emit-cicd-event.mjs",
      "--kind", "production-deploy",
      "--status", "completed",
      "--conclusion", "success",
      "--image-name", "ghcr.io/amineamanzou/it-art-studio",
      "--image-digest", "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "--image-ref", "ghcr.io/amineamanzou/it-art-studio@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "--check", "trivy=success",
      "--check", "cosign=success",
      "--check", "attestation=success",
      "--out", output
    ],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        GITHUB_REPOSITORY: "amineamanzou/ItArtStudio",
        GITHUB_WORKFLOW: "Deploy Production",
        GITHUB_JOB: "release",
        GITHUB_RUN_ID: "31912039785",
        GITHUB_RUN_ATTEMPT: "1",
        GITHUB_REF: "refs/heads/main",
        GITHUB_SHA: "aac5cbb3412daf006730a61f9dddc61999744ad8",
        GITHUB_ACTOR: "amineamanzou",
        GITHUB_EVENT_NAME: "push"
      }
    }
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const event = JSON.parse(await readFile(output, "utf8"));
  assert.deepEqual(
    {
      schemaVersion: event.schemaVersion,
      eventType: event.eventType,
      repository: event.repository,
      workflow: event.workflow,
      job: event.job,
      runId: event.runId,
      ref: event.ref,
      sha: event.sha,
      eventName: event.eventName,
      status: event.status,
      conclusion: event.conclusion,
      imageRef: event.imageRef,
      checks: event.checks
    },
    {
      schemaVersion: "1.0",
      eventType: "production-deploy",
      repository: "amineamanzou/ItArtStudio",
      workflow: "Deploy Production",
      job: "release",
      runId: "31912039785",
      ref: "refs/heads/main",
      sha: "aac5cbb3412daf006730a61f9dddc61999744ad8",
      eventName: "push",
      status: "completed",
      conclusion: "success",
      imageRef: "ghcr.io/amineamanzou/it-art-studio@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      checks: {
        plumber: "not_applicable",
        trivy: "success",
        codeql: "not_applicable",
        scorecard: "not_applicable",
        gitleaks: "not_applicable",
        cosign: "success",
        attestation: "success"
      }
    }
  );
} finally {
  await rm(directory, { recursive: true, force: true });
}

console.log("Production deployment handoff contract is complete.");
