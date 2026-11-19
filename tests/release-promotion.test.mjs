import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const candidate = await import('../scripts/qa/release-candidate.mjs').catch(() => ({}));
const qualification = await import('../scripts/qa/release-qualification.mjs').catch(() => ({}));
const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const sha = n => String(n).repeat(40);
const hash = 'a'.repeat(64);
const now = new Date('2026-11-15T12:00:00Z');
function payload() { return { kind: 'factory.website.qualification.v1', repository: 'amineamanzou/ItArtStudio', taskId: 'c'.repeat(32), candidateId: 'b'.repeat(32), mode: 'code', devSha: sha(1), baseSha: sha(2), candidateSha: sha(3), treeSha: sha(4), imageRef: `ghcr.io/amineamanzou/it-art-studio@sha256:${hash}`, buildRunId: '1234', buildAttempt: 2, sourceRef: `refs/heads/codex/factory-promotion/${'b'.repeat(32)}`, publicationDate: '2026-11-15', configurationSha256: hash, recipeSha256: hash, evidenceSha256: hash, issuedAt: '2026-11-15T11:00:00Z', expiresAt: '2026-11-15T13:00:00Z', e2e: {passed:14,failed:0,skipped:0}, perf:{requests:120,errors:0,p95Ms:115,lcpMaxMs:1000,clsMax:0,payloadMaxBytes:100000}, staging:{released:true,idle:true}, review:{model:'gpt-6.1-sol',effort:'high',verdict:'approved',headSha:sha(3)} }; }
function envelope(p = payload()) { const bytes = Buffer.from(JSON.stringify(p)); return {schemaVersion:1,payload:bytes.toString('base64'),signature:sign(null,bytes,privateKey).toString('base64')}; }
function verify(e, options={}) { return qualification.verifyQualification(e,{publicKey, now, ...options}); }
test('production configuration preserves canonical URL and absent telemetry', () => {
 assert.equal(candidate.productionConfiguration({}).siteUrl,'https://itart.studio');
 assert.equal(candidate.productionConfiguration({}).productAnalyticsEnabled,false);
 assert.equal(candidate.productionConfiguration({}).browserObservabilityEnabled,false);
 assert.throws(()=>candidate.productionConfiguration({productAnalytics:true}),/telemetry/i);
 assert.throws(()=>candidate.publicationDate('2026-02-30'),/date/i);
 assert.equal(candidate.parisDate(new Date('2026-11-15T23:30:00Z')),'2026-11-16');
});
test('qualification verifies signed exact bytes and rejects tampering, wrong key and expiry', () => {
  assert.equal(typeof qualification.verifyQualification, 'function');
  assert.equal(verify(envelope()).candidateSha,sha(3));
  assert.throws(()=>verify({...envelope(),payload:Buffer.from(JSON.stringify({...payload(),buildRunId:'999'})).toString('base64')}),/signature/i);
  assert.throws(()=>verify(envelope(),{publicKey:generateKeyPairSync('ed25519').publicKey}),/signature/i);
  assert.throws(()=>verify(envelope(),{now:new Date('2026-11-15T13:00:00Z')}),/expir/i);
  assert.throws(()=>verify(envelope(),{now:new Date('2026-11-15T23:01:00Z')}),/date|expir/i);
});
for (const [field,value] of [['sourceRef','refs/heads/dev'],['imageRef',`ghcr.io/other/site@sha256:${hash}`],['buildRunId',1],['buildAttempt',0],['configurationSha256','bad']]) {
  test(`qualification rejects invalid ${field}`,()=>{assert.equal(typeof qualification.verifyQualification,'function');assert.throws(()=>verify(envelope({...payload(),[field]:value})));});
}
test('qualification rejects failing, skipped, missing or over-budget proof',()=>{
  assert.equal(typeof qualification.verifyQualification,'function');
  for(const patch of [{e2e:{passed:14,failed:1,skipped:0}},{e2e:{passed:13,failed:0,skipped:1}},{perf:{...payload().perf,requests:99}},{perf:{...payload().perf,p95Ms:751}},{staging:{released:true,idle:false}}]) assert.throws(()=>verify(envelope({...payload(),...patch})));
});
test('main release mapping checks actual merge parents and tree in Git',()=>{
  assert.equal(typeof qualification.verifyReleaseMapping,'function');
  const dir=mkdtempSync(join(tmpdir(),'release-map-'));
  try {
    const git=(...args)=>execFileSync('git',args,{cwd:dir,encoding:'utf8',env:{...process.env,GIT_AUTHOR_NAME:'Fixture',GIT_AUTHOR_EMAIL:'fixture@example.test',GIT_COMMITTER_NAME:'Fixture',GIT_COMMITTER_EMAIL:'fixture@example.test'}}).trim();
    git('init','-q'); writeFileSync(join(dir,'x'),'base');git('add','x');git('commit','-qm','base');const base=git('rev-parse','HEAD');
    git('checkout','-qb','dev');writeFileSync(join(dir,'x'),'dev');git('commit','-qam','dev');const dev=git('rev-parse','HEAD');const tree=git('rev-parse','HEAD^{tree}');
    const p=git('commit-tree',tree,'-p',base,'-p',dev,'-m','candidate');const r=git('commit-tree',tree,'-p',base,'-p',p,'-m','release');
    const q={...payload(),baseSha:base,devSha:dev,candidateSha:p,treeSha:tree};
    qualification.verifyReleaseMapping(q,r,{cwd:dir});
    const wrongTree=git('rev-parse',`${base}^{tree}`);const wrong=git('commit-tree',wrongTree,'-p',base,'-p',p,'-m','wrong');
    assert.throws(()=>qualification.verifyReleaseMapping(q,wrong,{cwd:dir}),/tree/i);
    assert.throws(()=>qualification.verifyReleaseMapping(q,base,{cwd:dir}),/parent|mapping/i);
  } finally {rmSync(dir,{recursive:true,force:true});}
});
test('original verified SLSA must bind candidate subject, ref, run and attempt',()=>{
  assert.equal(typeof qualification.verifyBuildProvenance,'function');
  const q=payload();const statement={subject:[{name:q.imageRef.split('@')[0],digest:{sha256:hash}}],predicateType:'https://slsa.dev/provenance/v1',predicate:{buildDefinition:{externalParameters:{workflow:{repository:'https://github.com/'+q.repository,path:'.github/workflows/build-staging.yml',ref:q.sourceRef}},resolvedDependencies:[{uri:`git+https://github.com/${q.repository}@${q.sourceRef}`,digest:{gitCommit:q.candidateSha}}]},runDetails:{metadata:{invocationId:`https://github.com/${q.repository}/actions/runs/${q.buildRunId}/attempts/${q.buildAttempt}`}}}};
  const certificate={issuer:'https://token.actions.githubusercontent.com',certificateIssuer:'CN=sigstore-intermediate,O=sigstore.dev',subjectAlternativeName:`https://github.com/${q.repository}/.github/workflows/build-staging.yml@${q.sourceRef}`,sourceRepositoryURI:`https://github.com/${q.repository}`,sourceRepositoryDigest:q.candidateSha,sourceRepositoryRef:q.sourceRef,runInvocationURI:`https://github.com/${q.repository}/actions/runs/${q.buildRunId}/attempts/${q.buildAttempt}`};
  const result=s=>[{verificationResult:{statement:s,signature:{certificate}}}];
  qualification.verifyBuildProvenance(result(statement),q);
  const badCertificate=structuredClone(result(statement));badCertificate[0].verificationResult.signature.certificate.runInvocationURI=certificate.runInvocationURI.replace('/1234/','/999/');
  assert.throws(()=>qualification.verifyBuildProvenance(badCertificate,q));
  const wrongOidcIssuer=structuredClone(result(statement));
  wrongOidcIssuer[0].verificationResult.signature.certificate.issuer='https://unexpected.invalid';
  assert.throws(()=>qualification.verifyBuildProvenance(wrongOidcIssuer,q));
  for(const mutate of [s=>s.subject[0].digest.sha256='b'.repeat(64),s=>s.predicate.buildDefinition.externalParameters.workflow.ref='refs/heads/main',s=>s.predicate.buildDefinition.resolvedDependencies[0].digest.gitCommit=sha(9),s=>s.predicate.runDetails.metadata.invocationId=s.predicate.runDetails.metadata.invocationId.replace('/1234/','/999/'),s=>s.predicate.runDetails.metadata.invocationId=s.predicate.runDetails.metadata.invocationId.replace('/2','/3')]) {const bad=structuredClone(statement);mutate(bad);assert.throws(()=>qualification.verifyBuildProvenance(result(bad),q));}
});
test('schedule and ordinary pushes request qualification; owned merged PR selects only its tag',()=>{
  assert.equal(typeof qualification.publicationRoute,'function');
  assert.deepEqual(qualification.publicationRoute({eventName:'schedule'}),{mode:'request'});
  assert.deepEqual(qualification.publicationRoute({eventName:'push',releaseSha:sha(5),pullRequests:[]}),{mode:'request'});
  const id='b'.repeat(32);const pr={merged_at:'2026-11-15T12:00:00Z',merge_commit_sha:sha(5),base:{ref:'main'},head:{ref:`codex/factory-promotion/${id}`,repo:{full_name:payload().repository}}};
  assert.deepEqual(qualification.publicationRoute({eventName:'push',releaseSha:sha(5),pullRequests:[pr]}),{mode:'publish',qualificationRef:`factory-qualification/${id}`});
  assert.throws(()=>qualification.publicationRoute({eventName:'workflow_dispatch',qualificationRef:'main'}));
});
test('release metadata enumerates built published paths and binds configuration',()=>{
  assert.equal(typeof candidate.releaseMetadata,'function');const dir=mkdtempSync(join(tmpdir(),'release-metadata-'));
  try {writeFileSync(join(dir,'index.html'),'hello');const config=candidate.productionConfiguration({});const metadata=candidate.releaseMetadata({VCS_REF:sha(3),TREE_SHA:sha(4),BUILD_RUN_ID:'1234',BUILD_ATTEMPT:'2',PUBLICATION_DATE:'2026-11-15',RELEASE_VARIANT:'production',RELEASE_CONFIGURATION:JSON.stringify(config)},dir);assert.deepEqual(metadata.publishedPaths,['/']);assert.equal(metadata.configurationSha256,candidate.configurationHash(config));assert.equal(metadata.buildAttempt,2);assert.deepEqual(JSON.parse(readFileSync(join(dir,'.well-known/release.json'))),metadata);}finally{rmSync(dir,{recursive:true,force:true});}
});
test('publisher has no rebuild or fabricated main SLSA and tags the qualified digest only',()=>{
  const workflow=readFileSync('.github/workflows/deploy-production.yml','utf8');
  assert.doesNotMatch(workflow,/docker\/build-push-action|npm run build|id: attest_provenance/);
  assert.match(workflow,/predicate-type: https:\/\/theunreliable.engineer\/attestations\/factory-promotion\/v1/);
  assert.match(workflow,/predicate-path: promotion-predicate.json/);
  assert.match(workflow,/factory-promotion-request/);assert.match(workflow,/qualification_ref:/);assert.doesNotMatch(workflow,/cron:/);
  assert.match(workflow,/imagetools create --prefer-index=false --tag "\$\{IMAGE_NAME\}:main" "\$IMAGE_REF"/);
  assert.ok(workflow.indexOf('release-qualification.mjs recheck')<workflow.indexOf('imagetools create'));
});
test('candidate preparation restricts production dispatch ref and preserves requested flags',()=>{
  const id='b'.repeat(32),env={GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_REF:`refs/heads/codex/factory-promotion/${id}`,INPUT_PROFILE:'production',INPUT_CANDIDATE_ID:id,INPUT_PUBLICATION_DATE:candidate.parisDate(),INPUT_PRODUCT_ANALYTICS:'false',INPUT_BROWSER_OBSERVABILITY:'false'};
  assert.equal(candidate.prepareCandidate(env).PRODUCT_ANALYTICS_ENABLED,'false');
  assert.equal(candidate.prepareCandidate({...env,INPUT_PRODUCT_ANALYTICS:undefined}).PRODUCT_ANALYTICS_ENABLED,'false');
  for(const patch of [{GITHUB_REF:'refs/heads/dev'},{INPUT_CANDIDATE_ID:'c'.repeat(32)},{GITHUB_EVENT_NAME:'push'},{INPUT_PUBLICATION_DATE:'2020-01-01'}])assert.throws(()=>candidate.prepareCandidate({...env,...patch}));
});
test('signed promotion predicate preserves original build identity and digest',()=>{
  assert.equal(typeof qualification.promotionPredicate,'function');
  const e=envelope(),q=verify(e);const result=qualification.promotionPredicate(e,q,{releaseSha:sha(5),releaseRunId:'5678',releaseAttempt:3});
  assert.deepEqual(result,{qualification:e,releaseSha:sha(5),releaseRunId:'5678',releaseAttempt:3});
  assert.equal(verify(result.qualification).imageRef,q.imageRef);assert.equal(verify(result.qualification).buildRunId,'1234');
});

test('qualification requires hex task IDs and valid canonical second-precision UTC timestamps',()=>{
  for(const patch of [{taskId:'task-1'},{taskId:'C'.repeat(32)},{issuedAt:'2026-11-15T11:00:00.000Z'},{expiresAt:'2026-11-15T13:00:00+00:00'}])assert.throws(()=>verify(envelope({...payload(),...patch})));
  assert.throws(()=>verify(envelope({...payload(),publicationDate:'2026-12-01',issuedAt:'2026-11-31T12:00:00Z',expiresAt:'2026-12-01T13:00:00Z'}),{now:new Date('2026-12-01T12:30:00Z')}));
});
test('qualification cannot cross Paris midnight even while its time interval remains valid',()=>{
  assert.throws(()=>verify(envelope({...payload(),issuedAt:'2026-11-15T22:30:00Z',expiresAt:'2026-11-16T00:30:00Z'}),{now:new Date('2026-11-15T23:01:00Z')}),/date/i);
});
test('main route has explicit pull-request read permission without publishing capabilities',()=>{
  const workflow=JSON.parse(execFileSync('ruby',['-ryaml','-rjson','-e','puts JSON.generate(YAML.load_file(ARGV[0]))','.github/workflows/deploy-production.yml'],{encoding:'utf8'}));
  assert.deepEqual(workflow.jobs.route.permissions,{contents:'read','pull-requests':'read'});
});
test('production event and qualification requests retain extra contract fields at raw top level',()=>{
  const dir=mkdtempSync(join(tmpdir(),'raw-release-event-'));
  try {
    const out=join(dir,'event.json'),extra=join(dir,'extra.json');
    for(const [kind,details] of [['production-deploy',{factoryPromotion:{qualificationRef:`factory-qualification/${'b'.repeat(32)}`,candidateSha:sha(3),buildRunId:'1234',buildAttempt:2,treeSha:sha(4),configurationSha256:hash,publicationDate:'2026-11-15'}}],['factory-promotion-request',{publicationDate:'2026-11-15',browserObservability:false,productAnalytics:true}]]) {
      writeFileSync(extra,JSON.stringify(details));execFileSync(process.execPath,['scripts/qa/emit-cicd-event.mjs','--kind',kind,'--payload-file',extra,'--out',out]);const event=JSON.parse(readFileSync(out));
      assert.equal(event.payload,undefined);for(const [key,value]of Object.entries(details))assert.deepEqual(event[key],value);
    }
    writeFileSync(extra,JSON.stringify({sha:sha(9)}));assert.throws(()=>execFileSync(process.execPath,['scripts/qa/emit-cicd-event.mjs','--kind','production-deploy','--payload-file',extra,'--out',out],{stdio:'pipe'}));
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test('candidate raw event and publisher reader agree on top-level release metadata',()=>{
  assert.equal(typeof qualification.verifyBuildEvent,'function');const dir=mkdtempSync(join(tmpdir(),'candidate-event-'));
  try {
    writeFileSync(join(dir,'index.html'),'fixture');const configuration=candidate.productionConfiguration({});
    const m=candidate.releaseMetadata({VCS_REF:sha(3),TREE_SHA:sha(4),BUILD_RUN_ID:'1234',BUILD_ATTEMPT:'2',PUBLICATION_DATE:'2026-11-15',RELEASE_VARIANT:'production',RELEASE_CONFIGURATION:JSON.stringify(configuration)},dir);
    const event=JSON.parse(execFileSync(process.execPath,['scripts/qa/staging-event.mjs'],{encoding:'utf8',env:{...process.env,GITHUB_REPOSITORY:payload().repository,GITHUB_REF:payload().sourceRef,GITHUB_SHA:sha(3),GITHUB_RUN_ID:'1234',GITHUB_RUN_ATTEMPT:'2',GITHUB_EVENT_NAME:'workflow_dispatch',IMAGE_REF:payload().imageRef,RELEASE_METADATA_PATH:join(dir,'.well-known/release.json')}}));
    assert.equal(event.payload,undefined);assert.deepEqual(event.releaseMetadata,m);assert.equal(event.buildAttempt,2);assert.equal(event.treeSha,m.treeSha);
    const q={...payload(),configurationSha256:m.configurationSha256};assert.deepEqual(qualification.verifyBuildEvent(event,q),m);
    for(const patch of [{buildAttempt:3},{treeSha:sha(9)},{publicationDate:'2026-11-16'},{configurationSha256:hash},{releaseMetadata:{...m,sourceSha:sha(9)}}])assert.throws(()=>qualification.verifyBuildEvent({...event,...patch},q));
  }finally{rmSync(dir,{recursive:true,force:true});}
});
for (const field of ['taskId','candidateId']) {
  test(`qualification rejects array coercion for signed ${field}`,()=>{
    const p=payload();p[field]=[p[field]];
    assert.throws(()=>verify(envelope(p)),/identity/i);
  });
}
