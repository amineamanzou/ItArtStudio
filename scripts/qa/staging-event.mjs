import { readFileSync } from 'node:fs';
import { configurationHash } from './release-candidate.mjs';

// Invoked only after the exact digest passes scan, signature and provenance verification.
const { IMAGE_REF, GITHUB_SHA, GITHUB_RUN_ID, GITHUB_RUN_ATTEMPT,
  GITHUB_REPOSITORY, GITHUB_REF, GITHUB_EVENT_NAME } = process.env;
if (GITHUB_REPOSITORY !== 'amineamanzou/ItArtStudio' || !(GITHUB_REF === 'refs/heads/dev' || /^refs\/heads\/release\/factory-promotion\/[a-f0-9]{32}$/.test(GITHUB_REF ?? '')) ||
    !['push', 'workflow_dispatch'].includes(GITHUB_EVENT_NAME) ||
    !/^ghcr\.io\/amineamanzou\/it-art-studio@sha256:[a-f0-9]{64}$/.test(IMAGE_REF ?? '') ||
    !/^[a-f0-9]{40}$/.test(GITHUB_SHA ?? '') || !/^[1-9][0-9]*$/.test(GITHUB_RUN_ID ?? '') ||
    !/^[1-9][0-9]*$/.test(GITHUB_RUN_ATTEMPT ?? '')) throw new Error('Invalid staging release identity');
const production = GITHUB_REF !== 'refs/heads/dev';
const metadata = process.env.RELEASE_METADATA_PATH ? JSON.parse(readFileSync(process.env.RELEASE_METADATA_PATH,'utf8')) : undefined;
if (production && (!metadata || GITHUB_EVENT_NAME !== 'workflow_dispatch')) throw new Error('Production candidate metadata required');
if (metadata && (metadata.schemaVersion !== 1 || metadata.sourceSha !== GITHUB_SHA || metadata.buildRunId !== GITHUB_RUN_ID || metadata.buildAttempt !== Number(GITHUB_RUN_ATTEMPT) || metadata.variant !== (production ? 'production' : 'staging') || metadata.configurationSha256 !== configurationHash(metadata.configuration))) throw new Error('Release metadata identity mismatch');
const payload = metadata ? {variant:metadata.variant,publicationDate:metadata.publicationDate,treeSha:metadata.treeSha,configurationSha256:metadata.configurationSha256,configuration:metadata.configuration,releaseMetadata:metadata,buildAttempt:metadata.buildAttempt} : undefined;
const timestamp = new Date().toISOString();
process.stdout.write(JSON.stringify({
  schemaVersion: '2.0', ...payload, eventType: 'staging-deploy', environment: 'staging',
  repository: GITHUB_REPOSITORY, workflow: 'Build and Deploy Staging', job: 'release',
  runId: GITHUB_RUN_ID, sourceRunId: GITHUB_RUN_ID, runAttempt: GITHUB_RUN_ATTEMPT,
  version: JSON.parse(readFileSync(new URL('../../package.json', import.meta.url))).version,
  ref: GITHUB_REF, sha: GITHUB_SHA, eventName: GITHUB_EVENT_NAME,
  status: 'completed', conclusion: 'success', startedAt: timestamp, completedAt: timestamp,
  imageName: IMAGE_REF.split('@')[0], imageDigest: IMAGE_REF.split('@')[1], imageRef: IMAGE_REF,
  checks: { plumber: 'not_applicable', trivy: 'success', codeql: 'not_applicable',
    scorecard: 'not_applicable', gitleaks: 'not_applicable', cosign: 'success', attestation: 'success' },
}) + '\n');
