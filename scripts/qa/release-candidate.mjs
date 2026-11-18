import { createHash } from 'node:crypto';
import { appendFileSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
export const REPOSITORY = 'amineamanzou/ItArtStudio';
export const IMAGE_NAME = 'ghcr.io/amineamanzou/it-art-studio';
export const sha256 = value => createHash('sha256').update(value).digest('hex');
export function parisDate(now = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(p=>[p.type,p.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
export function publicationDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '') || new Date(`${value}T00:00:00Z`).toISOString().slice(0,10)!==value) throw new Error('Invalid publication date');
  return value;
}
function flag(value, fallback) { if (value===undefined || value==='') return fallback; if ([true,'true'].includes(value)) return true; if ([false,'false'].includes(value)) return false; throw new Error('Invalid boolean flag'); }

export function productionConfiguration(input={}) {
  if(flag(input.browserObservability,false)||flag(input.productAnalytics,false)) throw new Error('Unsupported telemetry configuration');
  return {siteUrl:'https://itart.studio',basePath:'/',deploymentEnvironment:'production',browserObservabilityEnabled:false,productAnalyticsEnabled:false,browserObservabilityOrigin:'',browserPublicKeySha256:sha256(''),posthogOrigin:'',posthogPublicKeySha256:sha256('')};
}
export function configurationHash(configuration) {return sha256(JSON.stringify(configuration));}
export function releaseMetadata(env, directory='dist') {
  const configuration=JSON.parse(env.RELEASE_CONFIGURATION);
  if(!/^[a-f0-9]{40}$/.test(env.VCS_REF??'')||!/^[a-f0-9]{40}$/.test(env.TREE_SHA??'')||!/^[1-9][0-9]*$/.test(env.BUILD_RUN_ID??'')||!/^[1-9][0-9]*$/.test(env.BUILD_ATTEMPT??'')||!['production','staging'].includes(env.RELEASE_VARIANT)) throw new Error('Invalid release build identity');
  const publishedPaths=[];
  function walk(dir) {for(const entry of readdirSync(dir,{withFileTypes:true})) {const name=join(dir,entry.name);if(entry.isDirectory())walk(name);else if(entry.isFile()&&entry.name.endsWith('.html')) {const path='/'+relative(directory,name).split('\\').join('/');publishedPaths.push(path.endsWith('/index.html')?path.slice(0,-10):path);}}}
  walk(directory);
  const metadata={schemaVersion:1,sourceSha:env.VCS_REF,treeSha:env.TREE_SHA,buildRunId:env.BUILD_RUN_ID,buildAttempt:Number(env.BUILD_ATTEMPT),publicationDate:publicationDate(env.PUBLICATION_DATE),variant:env.RELEASE_VARIANT,configurationSha256:configurationHash(configuration),configuration,publishedPaths:publishedPaths.sort()};
  mkdirSync(join(directory,'.well-known'),{recursive:true});writeFileSync(join(directory,'.well-known/release.json'),JSON.stringify(metadata)+'\n');return metadata;
}
export function prepareCandidate(env=process.env) {
  const production=env.INPUT_PROFILE==='production';
  if(production && (!/^[a-f0-9]{32}$/.test(env.INPUT_CANDIDATE_ID??'') || env.GITHUB_REF!==`refs/heads/codex/factory-promotion/${env.INPUT_CANDIDATE_ID}` || env.GITHUB_EVENT_NAME!=='workflow_dispatch')) throw new Error('Production candidates require their exact reserved ref');
  if(!production && env.GITHUB_REF!=='refs/heads/dev') throw new Error('Staging build requires dev');
  const config=production?productionConfiguration({browserObservability:env.INPUT_BROWSER_OBSERVABILITY,productAnalytics:env.INPUT_PRODUCT_ANALYTICS,browserObservabilityUrl:env.PUBLIC_BROWSER_OBSERVABILITY_URL,posthogKey:env.PUBLIC_POSTHOG_KEY}):{...productionConfiguration({productAnalytics:false}),deploymentEnvironment:'staging'};
  const date=publicationDate(production?env.INPUT_PUBLICATION_DATE:parisDate());
  if(production&&date!==parisDate())throw new Error('Candidate date must be the current Paris date');
  return {PUBLICATION_DATE:date,RELEASE_VARIANT:production?'production':'staging',RELEASE_CONFIGURATION:JSON.stringify(config),BROWSER_OBSERVABILITY_ENABLED:String(config.browserObservabilityEnabled),PRODUCT_ANALYTICS_ENABLED:String(config.productAnalyticsEnabled),DEPLOYMENT_ENVIRONMENT:config.deploymentEnvironment};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  if(process.argv[2]==='metadata')releaseMetadata(process.env,process.argv[3]??'dist');
  else {const values=prepareCandidate();if(!process.env.GITHUB_ENV)throw new Error('GITHUB_ENV is required');for(const [key,value] of Object.entries(values))appendFileSync(process.env.GITHUB_ENV,`${key}=${value}\n`);writeFileSync('release-configuration.json',values.RELEASE_CONFIGURATION+'\n');}
}
