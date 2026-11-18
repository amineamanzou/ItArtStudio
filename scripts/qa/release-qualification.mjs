import { verify } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { configurationHash, productionConfiguration, IMAGE_NAME, parisDate, REPOSITORY } from './release-candidate.mjs';
export const PREDICATE_TYPE='https://theunreliable.engineer/attestations/factory-promotion/v1';
const sha=/^[a-f0-9]{40}$/, hash=/^[a-f0-9]{64}$/, id=/^[a-f0-9]{32}$/, run=/^[1-9][0-9]*$/;
const requireValue=(ok,message)=>{if(!ok)throw new Error(message);};
function exactKeys(object,keys,name) {requireValue(object&&typeof object==='object'&&!Array.isArray(object)&&Object.keys(object).sort().join(',')===[...keys].sort().join(','),`Invalid ${name} fields`);}
function base64(value) {requireValue(typeof value==='string' && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)&&value.length>0,'Invalid base64');return Buffer.from(value,'base64');}
export function verifyQualification(envelope,{publicKey,now=new Date(),configurationSha256,qualificationRef}={}) {
  exactKeys(envelope,['schemaVersion','payload','signature'],'envelope');requireValue(envelope.schemaVersion===1,'Invalid envelope version');
  const bytes=base64(envelope.payload), signature=base64(envelope.signature);
  requireValue(signature.length===64&&verify(null,bytes,publicKey,signature),'Invalid qualification signature');
  const q=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  exactKeys(q,['kind','repository','taskId','candidateId','mode','devSha','baseSha','candidateSha','treeSha','imageRef','buildRunId','buildAttempt','sourceRef','publicationDate','configurationSha256','recipeSha256','evidenceSha256','issuedAt','expiresAt','e2e','perf','staging','review'],'qualification');
  requireValue(q.kind==='factory.website.qualification.v1'&&q.repository===REPOSITORY&&typeof q.taskId==='string'&&id.test(q.taskId)&&typeof q.candidateId==='string'&&id.test(q.candidateId)&&['code','dated'].includes(q.mode),'Invalid qualification identity');
  for(const field of ['devSha','baseSha','candidateSha','treeSha'])requireValue(sha.test(q[field]),`Invalid ${field}`);
  for(const field of ['configurationSha256','recipeSha256','evidenceSha256'])requireValue(hash.test(q[field]),`Invalid ${field}`);
  requireValue(q.imageRef.startsWith(`${IMAGE_NAME}@sha256:`)&&hash.test(q.imageRef.slice(`${IMAGE_NAME}@sha256:`.length)),'Invalid image subject');
  requireValue(typeof q.buildRunId==='string'&&run.test(q.buildRunId)&&Number.isSafeInteger(q.buildAttempt)&&q.buildAttempt>0,'Invalid build run/attempt');
  requireValue(q.sourceRef===`refs/heads/codex/factory-promotion/${q.candidateId}`,'Invalid candidate source ref');
  if(qualificationRef!==undefined)requireValue(qualificationRef===`factory-qualification/${q.candidateId}`,'Qualification tag mismatch');
  const canonicalUtc = value => typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value.slice(0,-1)+'.000Z';
  const issued=Date.parse(q.issuedAt),expires=Date.parse(q.expiresAt);
  requireValue(canonicalUtc(q.issuedAt)&&canonicalUtc(q.expiresAt)&&Number.isFinite(issued)&&Number.isFinite(expires)&&issued<=now.getTime()&&expires>issued&&expires-issued<=7200000,'Invalid qualification validity interval');
  requireValue(now.getTime()<expires,'Qualification expired');
  requireValue(q.publicationDate===parisDate(now)&&q.publicationDate===parisDate(new Date(issued)),'Qualification publication date mismatch');
  if(configurationSha256!==undefined)requireValue(q.configurationSha256===configurationSha256,'Qualification configuration mismatch');
  exactKeys(q.e2e,['passed','failed','skipped'],'e2e');requireValue(Number.isSafeInteger(q.e2e.passed)&&q.e2e.passed>=14&&q.e2e.failed===0&&q.e2e.skipped===0,'E2E proof failed');
  exactKeys(q.perf,['requests','errors','p95Ms','lcpMaxMs','clsMax','payloadMaxBytes'],'perf');
  requireValue(Number.isSafeInteger(q.perf.requests)&&q.perf.requests>=100&&q.perf.errors===0,'Performance sample proof failed');
  for(const [field,max] of Object.entries({p95Ms:750,lcpMaxMs:2500,clsMax:0.1,payloadMaxBytes:2000000}))requireValue(Number.isFinite(q.perf[field])&&q.perf[field]>=0&&q.perf[field]<=max,`Performance budget ${field} failed`);
  exactKeys(q.staging,['released','idle'],'staging');requireValue(q.staging.released===true&&q.staging.idle===true,'Staging cleanup proof failed');
  exactKeys(q.review,['model','effort','verdict','headSha'],'review');requireValue(q.review.model==='gpt-6.1-sol'&&q.review.effort==='high'&&q.review.verdict==='approved'&&q.review.headSha===q.candidateSha,'Review proof failed');
  return q;
}
export function verifyReleaseMapping(q,releaseSha,{cwd=process.cwd()}={}) {
  requireValue(sha.test(releaseSha),'Invalid release SHA');const git=(...args)=>execFileSync('git',args,{cwd,encoding:'utf8'}).trim();
  const candidateParents=git('show','-s','--format=%P',q.candidateSha).split(' ');
  requireValue(candidateParents.join(' ')===(q.mode==='code'?[q.baseSha,q.devSha]:[q.baseSha]).join(' '),'Candidate parent mapping mismatch');
  requireValue(git('rev-parse',`${q.candidateSha}^{tree}`)===q.treeSha,'Candidate tree mismatch');
  if(q.mode==='code') requireValue(git('show','-s','--format=%P',releaseSha)===`${q.baseSha} ${q.candidateSha}`,'Release parent mapping mismatch');
  else requireValue(releaseSha===q.baseSha,'Dated release main mapping mismatch');
  requireValue(git('rev-parse',`${releaseSha}^{tree}`)===q.treeSha,'Release tree mismatch');
}
export function verifyBuildProvenance(results,q) {
  requireValue(Array.isArray(results),'Expected verified attestation results');
  const ok=results.some(result=>{
    const s=result.verificationResult?.statement,p=s?.predicate,b=p?.buildDefinition,w=b?.externalParameters?.workflow;
    const c=result.verificationResult?.signature?.certificate;
    const invocation=`https://github.com/${REPOSITORY}/actions/runs/${q.buildRunId}/attempts/${q.buildAttempt}`;
    if(c?.issuer!=='https://token.actions.githubusercontent.com'||c?.subjectAlternativeName!==`https://github.com/${REPOSITORY}/.github/workflows/build-staging.yml@${q.sourceRef}`||c?.sourceRepositoryURI!==`https://github.com/${REPOSITORY}`||c?.sourceRepositoryDigest!==q.candidateSha||c?.sourceRepositoryRef!==q.sourceRef||c?.runInvocationURI!==invocation)return false;
    return s?.predicateType==='https://slsa.dev/provenance/v1'&&s.subject?.some(s=>s.name===IMAGE_NAME&&s.digest?.sha256===q.imageRef.split('sha256:')[1])&&w?.repository===`https://github.com/${REPOSITORY}`&&w?.path==='.github/workflows/build-staging.yml'&&w?.ref===q.sourceRef&&b?.resolvedDependencies?.some(d=>d.uri===`git+https://github.com/${REPOSITORY}@${q.sourceRef}`&&d.digest?.gitCommit===q.candidateSha)&&p?.runDetails?.metadata?.invocationId===`https://github.com/${REPOSITORY}/actions/runs/${q.buildRunId}/attempts/${q.buildAttempt}`;
  }); requireValue(ok,'Original candidate provenance subject/ref/source/run/attempt mismatch');
}
export function verifyBuildEvent(event,q) {
  const metadata=event.releaseMetadata;
  requireValue(event.repository===REPOSITORY&&event.sha===q.candidateSha&&event.ref===q.sourceRef&&event.runId===q.buildRunId&&Number(event.runAttempt)===q.buildAttempt&&event.imageRef===q.imageRef&&event.conclusion==='success','Original build event identity mismatch');
  requireValue(event.variant==='production'&&event.publicationDate===q.publicationDate&&event.treeSha===q.treeSha&&event.configurationSha256===q.configurationSha256&&event.buildAttempt===q.buildAttempt,'Original build event configuration mismatch');
  requireValue(metadata?.schemaVersion===1&&metadata.variant==='production'&&metadata.sourceSha===q.candidateSha&&metadata.treeSha===q.treeSha&&metadata.buildRunId===q.buildRunId&&metadata.buildAttempt===q.buildAttempt&&metadata.publicationDate===q.publicationDate&&metadata.configurationSha256===q.configurationSha256,'Original image metadata mismatch');
  requireValue(configurationHash(event.configuration)===q.configurationSha256&&configurationHash(metadata.configuration)===q.configurationSha256,'Original build configuration hash mismatch');
  return metadata;
}
export function promotionPredicate(envelope, qualification, {releaseSha,releaseRunId,releaseAttempt}) {
  requireValue(sha.test(releaseSha)&&typeof releaseRunId==='string'&&run.test(releaseRunId)&&Number.isSafeInteger(releaseAttempt)&&releaseAttempt>0,'Invalid main publication identity');
  requireValue(qualification.imageRef.startsWith(`${IMAGE_NAME}@sha256:`),'Invalid promotion subject');
  return {qualification:envelope,releaseSha,releaseRunId,releaseAttempt};
}
export function publicationRoute({eventName,qualificationRef,releaseSha,pullRequests=[]}) {
  if(eventName==='workflow_dispatch'&&qualificationRef){requireValue(/^factory-qualification\/[a-f0-9]{32}$/.test(qualificationRef),'Invalid qualification ref');return {mode:'publish',qualificationRef};}
  if(eventName==='push') {
    const ids=pullRequests.filter(pr=>pr.merged_at&&pr.merge_commit_sha===releaseSha&&pr.base?.ref==='main'&&pr.head?.repo?.full_name===REPOSITORY&&/^codex\/factory-promotion\/[a-f0-9]{32}$/.test(pr.head?.ref??''));
    requireValue(ids.length<=1,'Ambiguous promotion PR');if(ids.length===1)return {mode:'publish',qualificationRef:`factory-qualification/${ids[0].head.ref.split('/').at(-1)}`};
  }
  return {mode:'request'};
}
function gh(...args){return execFileSync('gh',args,{encoding:'utf8'}).trim();}
function currentMain(releaseSha){requireValue(JSON.parse(gh('api',`repos/${REPOSITORY}/git/ref/heads/main`)).object.sha===releaseSha,'Current main drift');}
function loadQualification(ref){requireValue(/^factory-qualification\/[a-f0-9]{32}$/.test(ref),'Invalid qualification ref');execFileSync('git',['fetch','--no-tags','origin',`refs/tags/${ref}`],{stdio:'pipe'});const files=execFileSync('git',['ls-tree','--name-only','FETCH_HEAD'],{encoding:'utf8'}).trim();requireValue(files==='qualification.json','Qualification tag must contain only qualification.json');return JSON.parse(execFileSync('git',['show','FETCH_HEAD:qualification.json'],{encoding:'utf8'}));}
function runCli(command){
  if(command==='route') {
    const prs=process.env.GITHUB_EVENT_NAME==='push'?JSON.parse(gh('api',`repos/${REPOSITORY}/commits/${process.env.GITHUB_SHA}/pulls`)):[];
    const route=publicationRoute({eventName:process.env.GITHUB_EVENT_NAME,qualificationRef:process.env.QUALIFICATION_REF,releaseSha:process.env.GITHUB_SHA,pullRequests:prs});
    for(const [key,value]of Object.entries(route))appendFileSync(process.env.GITHUB_OUTPUT,`${key}=${value}\n`);
  } else if(command==='prepare'||command==='recheck') {
    const ref=process.env.QUALIFICATION_REF,envelope=loadQualification(ref);
    const preliminary=verifyQualification(envelope,{publicKey:readFileSync('policy/promotion-qualification-public.pem'),qualificationRef:ref});
    if(command==='prepare')execFileSync('gh',['run','download',preliminary.buildRunId,'--repo',REPOSITORY,'--name','cicd-event-staging','--dir','original-build'],{stdio:'pipe'});
    const event=JSON.parse(readFileSync('original-build/cicd-event-staging.json','utf8'));
    const metadata=verifyBuildEvent(event,preliminary);
    const config=productionConfiguration({browserObservability:metadata.configuration.browserObservabilityEnabled,productAnalytics:metadata.configuration.productAnalyticsEnabled,browserObservabilityUrl:process.env.PUBLIC_BROWSER_OBSERVABILITY_URL,posthogKey:process.env.PUBLIC_POSTHOG_KEY});
    requireValue(configurationHash(metadata.configuration)===configurationHash(config)&&metadata.configurationSha256===preliminary.configurationSha256,'Current configuration drift');
    const q=verifyQualification(envelope,{publicKey:readFileSync('policy/promotion-qualification-public.pem'),qualificationRef:ref,configurationSha256:configurationHash(config)});
    verifyReleaseMapping(q,process.env.GITHUB_SHA);currentMain(process.env.GITHUB_SHA);
    const build=JSON.parse(gh('api',`repos/${REPOSITORY}/actions/runs/${q.buildRunId}/attempts/${q.buildAttempt}`));
    requireValue(build.id.toString()===q.buildRunId&&build.run_attempt===q.buildAttempt&&build.head_sha===q.candidateSha&&build.head_branch===q.sourceRef.slice(11)&&build.path==='.github/workflows/build-staging.yml'&&build.status==='completed'&&build.conclusion==='success'&&build.event==='workflow_dispatch','Original GitHub build run mismatch');
    writeFileSync('qualification.json',JSON.stringify(envelope)+'\n');writeFileSync('qualified-release.json',JSON.stringify(q)+'\n');
    if(command==='prepare') {for(const [key,value]of Object.entries({image_ref:q.imageRef,digest:q.imageRef.split('@')[1],source_ref:q.sourceRef,candidate_sha:q.candidateSha,build_run_id:q.buildRunId,build_attempt:q.buildAttempt}))appendFileSync(process.env.GITHUB_OUTPUT,`${key}=${value}\n`);}
    else writeFileSync('promotion-predicate.json',JSON.stringify(promotionPredicate(envelope,q,{releaseSha:process.env.GITHUB_SHA,releaseRunId:process.env.GITHUB_RUN_ID,releaseAttempt:Number(process.env.GITHUB_RUN_ATTEMPT)}))+'\n');
  } else if(command==='provenance') verifyBuildProvenance(JSON.parse(readFileSync('verified-provenance.json','utf8')),JSON.parse(readFileSync('qualified-release.json','utf8')));
  else throw new Error('Unknown release qualification command');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))runCli(process.argv[2]);
