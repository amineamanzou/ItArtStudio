import assert from "node:assert/strict";

const origin = process.env.CONTAINER_URL ?? "http://127.0.0.1:8080";

async function request(path) {
  return fetch(`${origin}${path}`, { redirect: "manual" });
}

const health = await request("/healthz");
assert.equal(health.status, 200, "Health endpoint must return 200");

const home = await request("/");
assert.equal(home.status, 200, "Home must return 200");
assert((await home.text()).includes("IT Art Studio"), "Home must contain the legal name");
assert.equal(home.headers.get("x-content-type-options"), "nosniff", "Security headers are missing");
assert.equal(home.headers.get("x-frame-options"), "SAMEORIGIN", "Frame policy is missing");

const legal = await request("/mentions-legales/");
assert.equal(legal.status, 200, "Legal page must return 200");
assert((await legal.text()).includes("915 019 129"), "Legal page must contain the SIREN");

const staticAsset = await request("/assets/hero-it.avif");
assert.equal(staticAsset.status, 200, "Hero asset must return 200");
assert.match(staticAsset.headers.get("cache-control") ?? "", /immutable/, "Static assets must be immutable");

const missing = await request("/ce-lien-ne-doit-pas-exister");
assert.equal(missing.status, 404, "Unknown routes must return 404");

console.log(JSON.stringify({ passed: true, origin, checks: 9 }, null, 2));
