import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { REVIEW_CORPUS_SLUGS } from '../src/config/review-corpus.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const postsDir = path.join(root, 'src/content/posts');
const publicDir = path.join(root, 'public');
const distDir = path.join(root, 'dist');
const checkDist = process.argv.includes('--dist');
const failures = [];
const metrics = [];
const hangul = /[가-힣]/;

function fail(code, detail) { failures.push({ code, detail }); }
function splitMdx(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) throw new Error('frontmatter boundary missing');
  return { frontmatter: match[1], body: match[2] };
}
function boolField(fm, key) { return new RegExp(`^${key}:\\s*true\\s*$`, 'mi').test(fm); }
function numberField(fm, key) {
  const match = fm.match(new RegExp(`^${key}:\\s*(\\d+)\\s*$`, 'mi'));
  return match ? Number(match[1]) : null;
}
function stringField(fm, key) {
  const match = fm.match(new RegExp(`^${key}:\\s*["']?([^"'\\r\\n]+)["']?\\s*$`, 'mi'));
  return match ? match[1].trim() : '';
}
function block(fm, key, nextKeys) {
  const stop = nextKeys.join('|');
  const match = fm.match(new RegExp(`^${key}:\\s*\\r?\\n([\\s\\S]*?)(?=^(?:${stop}):|$)`, 'mi'));
  return match ? match[1] : '';
}
function bodyWords(body) {
  let text = body
    .replace(/^import .*$/gm, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, ' $1 ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, ' $1 ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[|#>*_`~{}[\]()]/g, ' ');
  return text.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g)?.length ?? 0;
}
function paragraphText(raw) {
  return raw
    .replace(/^import .*$/gm, ' ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, ' $1 ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, ' $1 ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[|#>*_`~{}[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}
function imageRefs(fm, body) {
  const urls = [];
  const hero = stringField(fm, 'heroImage');
  if (hero) urls.push(hero);
  for (const match of body.matchAll(/!\[[^\]]*\]\((\/images\/[^)\s]+)(?:\s+[^)]*)?\)/g)) urls.push(match[1]);
  for (const match of body.matchAll(/<img[^>]+src=["'](\/images\/[^"']+)["']/gi)) urls.push(match[1]);
  return [...new Set(urls)];
}
function sourceUrls(fm) {
  return [...new Set([...fm.matchAll(/^\s*-?\s*url:\s*["']?([^"'\s]+)["']?\s*$/gmi)].map((m) => m[1].replace(/\/$/, '')))];
}
function internalPostLinks(text) {
  return [...text.matchAll(/(?:href=["']|\]\(|^\s*-\s*["']?)(\/posts\/([a-z0-9-]+)\/?)/gmi)].map((m) => ({ path: m[1], slug: m[2] }));
}
function pngDimensions(buffer) {
  if (buffer.length >= 24 && buffer.subarray(1,4).toString() === 'PNG') return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
  return [0,0];
}
function listFiles(dir, out=[]) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir,{withFileTypes:true})) {
    const full=path.join(dir,entry.name);
    if (entry.isDirectory()) listFiles(full,out); else out.push(full);
  }
  return out;
}

const expected = [...REVIEW_CORPUS_SLUGS].sort();
if (new Set(expected).size !== 11 || expected.length !== 11) fail('allowlist-count', `expected 11 unique slugs, got ${expected.length}/${new Set(expected).size}`);
const records=[];
for (const filename of fs.readdirSync(postsDir).filter((x)=>x.endsWith('.mdx')).sort()) {
  const slug=filename.slice(0,-4); const text=fs.readFileSync(path.join(postsDir,filename),'utf8');
  try { const {frontmatter,body}=splitMdx(text); records.push({slug,filename,text,frontmatter,body,draft:boolField(frontmatter,'draft')}); }
  catch (error) { fail('parse',`${filename}: ${error.message}`); }
}
const publicRecords=records.filter((r)=>!r.draft);
const publicSlugs=publicRecords.map((r)=>r.slug).sort();
if (JSON.stringify(publicSlugs)!==JSON.stringify(expected)) fail('public-set',`actual=${publicSlugs.join(',')}`);
for (const r of records) {
  const shouldDraft=!expected.includes(r.slug);
  if (r.draft!==shouldDraft) fail('draft-state',`${r.slug}: draft=${r.draft}, expected=${shouldDraft}`);
}

const bannedPatterns = [
  [/adsense/i,'AdSense production language'],[/\bseo\b/i,'SEO production language'],
  [/publishing (?:run|workflow)/i,'publishing workflow language'],[/\bcontent gap\b/i,'content-gap language'],
  [/helpful[- ]content/i,'helpful-content production language'],[/\bai detector\b/i,'AI detector language'],
  [/generated[- ]image/i,'generated-image language'],[/\braster asset\b/i,'raster-asset language'],
  [/veterinarian[- ]reviewed|vet[- ]reviewed/i,'unsupported review claim'],[/\bverified data\b/i,'unsupported verification claim'],
  [/\bpreserved guides\b/i,'production corpus language'],[/\bwe (?:tested|tried|used|verified|reviewed)\b/i,'unsupported first-person experience'],
  [/household, workplace, account, pet, or cash-flow routine/i,'cross-domain boilerplate'],
  [/manager, security administrator, dentist, counselor, insurer, bank, landlord, school, carrier, or emergency service/i,'cross-domain professional boilerplate'],
  [/\b(?:e-e-a-t|employer|workplace|financial counselor|security (?:owner|administrator|settings?)|seed phrases?|backup codes?|cash-flow|account (?:change|number|password|settings?)|serial numbers?|confidential work|lease clause|platform documentation)\b/i,'non-pet domain contamination'],
];
const paragraphOwners=new Map();
const paragraphPrefixOwners=new Map();
const sentenceOwners=new Map();
function proseForDuplicateChecks(raw) {
  return raw
    .replace(/^import .*$/gm, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, ' $1 ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[|#>*_`~{}[\]()]/g, ' ');
}
function proseWords(raw) {
  return paragraphText(proseForDuplicateChecks(raw)).match(/[a-z0-9]+(?:['’-][a-z0-9]+)*/g) ?? [];
}
const denyHosts=/(?:^|\.)(reddit\.com|quora\.com|pinterest\.com|medium\.com|blogspot\.com)$/i;
for (const r of publicRecords) {
  const words=bodyWords(r.body); const sources=sourceUrls(r.frontmatter); const images=imageRefs(r.frontmatter,r.body);
  const declaredWords=numberField(r.frontmatter,'wordCount'); const declaredVisuals=numberField(r.frontmatter,'visualsCount');
  metrics.push({slug:r.slug,words,sources:sources.length,images:images.length,declaredWords,declaredVisuals});
  if (words<1500) fail('word-floor',`${r.slug}: ${words}`);
  if (declaredWords!==words) fail('word-counter',`${r.slug}: declared ${declaredWords}, actual ${words}`);
  if (sources.length<8) fail('source-floor',`${r.slug}: ${sources.length}`);
  for (const url of sources) {
    try { const parsed=new URL(url); if (parsed.protocol!=='https:') fail('source-protocol',`${r.slug}: ${url}`); if (denyHosts.test(parsed.hostname)) fail('source-credibility',`${r.slug}: ${url}`); }
    catch { fail('source-url',`${r.slug}: ${url}`); }
  }
  if (images.length<5) fail('image-floor',`${r.slug}: ${images.length}`);
  if (declaredVisuals!==images.length) fail('visual-counter',`${r.slug}: declared ${declaredVisuals}, distinct local ${images.length}`);
  for (const url of images) {
    if (!/^\/images\/.+\.(png|jpe?g|webp)$/i.test(url)) { fail('image-local',`${r.slug}: ${url}`); continue; }
    const file=path.join(publicDir,url.replace(/^\//,''));
    if (!fs.existsSync(file)) { fail('image-missing',`${r.slug}: ${url}`); continue; }
    const bytes=fs.readFileSync(file); if (bytes.length<80000) fail('image-small',`${r.slug}: ${url} ${bytes.length} bytes`);
    if (/\.png$/i.test(url)) { const [w,h]=pngDimensions(bytes); if (w<480||h<270) fail('image-dimensions',`${r.slug}: ${url} ${w}x${h}`); }
  }
  for (const {slug:target} of internalPostLinks(r.frontmatter+'\n'+r.body)) if (!expected.includes(target)) fail('internal-post-link',`${r.slug} -> ${target}`);
  for (const [pattern,label] of bannedPatterns) if (pattern.test(r.body)) fail('banned-copy',`${r.slug}: ${label}`);
  if (hangul.test(r.frontmatter+'\n'+r.body)) fail('public-language',`${r.slug}: Hangul found`);
  const headingSeen=new Set();
  for (const headingMatch of r.body.matchAll(/^#{2,6}\s+(.+?)\s*$/gm)) {
    const heading=headingMatch[1].trim().toLowerCase();
    if (headingSeen.has(heading)) fail('duplicate-heading',`${r.slug}: ${heading}`);
    headingSeen.add(heading);
  }
  const localSeen=new Set();
  const localPrefixes=new Set();
  for (const raw of r.body.split(/\r?\n\s*\r?\n/)) {
    const normalized=paragraphText(raw); const count=normalized.match(/[a-z0-9]+(?:['’-][a-z0-9]+)*/g)?.length??0;
    if (count>=18) {
      if (localSeen.has(normalized)) fail('duplicate-paragraph',`${r.slug}: repeated within article: ${normalized.slice(0,100)}`);
      localSeen.add(normalized);
      if (paragraphOwners.has(normalized) && paragraphOwners.get(normalized)!==r.slug) fail('duplicate-paragraph',`${paragraphOwners.get(normalized)} <-> ${r.slug}: ${normalized.slice(0,100)}`);
      paragraphOwners.set(normalized,r.slug);
    }
    const words=proseWords(raw);
    if (words.length>=30) {
      const prefix=words.slice(0,14).join(' ');
      if (localPrefixes.has(prefix)) fail('duplicate-prefix',`${r.slug}: repeated paragraph prefix: ${prefix}`);
      localPrefixes.add(prefix);
      if (paragraphPrefixOwners.has(prefix) && paragraphPrefixOwners.get(prefix)!==r.slug) fail('duplicate-prefix',`${paragraphPrefixOwners.get(prefix)} <-> ${r.slug}: ${prefix}`);
      paragraphPrefixOwners.set(prefix,r.slug);
    }
  }
  const prose=proseForDuplicateChecks(r.body);
  for (const raw of prose.split(/(?<=[.!?])(?:["”’)]*)\s+|\r?\n+/)) {
    const normalized=paragraphText(raw); const words=proseWords(raw);
    if (words.length<12) continue;
    if (sentenceOwners.has(normalized)) fail('duplicate-sentence',`${sentenceOwners.get(normalized)} <-> ${r.slug}: ${normalized.slice(0,120)}`);
    else sentenceOwners.set(normalized,r.slug);
  }
  for (const [lineIndex,line] of r.body.split(/\r?\n/).entries()) {
    const words=proseWords(line); const windows=new Map();
    for (let i=0;i<=words.length-12;i++) {
      const window=words.slice(i,i+12).join(' ');
      if (windows.has(window) && i-windows.get(window)>=12) { fail('within-line-duplicate',`${r.slug}:${lineIndex+1}: ${window}`); break; }
      if (!windows.has(window)) windows.set(window,i);
    }
  }
}

const publicSurfaceRoots=['src/components','src/layouts','src/pages','src/content/config.ts'];
for (const rel of publicSurfaceRoots) {
  const target=path.join(root,rel); const files=fs.statSync(target).isDirectory()?listFiles(target):[target];
  for (const file of files.filter((f)=>/\.(astro|ts|js|mjs)$/.test(f))) {
    const text=fs.readFileSync(file,'utf8');
    const surfaceText=text.replace(/PUBLIC_ADSENSE[A-Z_]*/g,'');
    if (hangul.test(text)) fail('public-language',`${path.relative(root,file)}: Hangul found`);
    for (const [pattern,label] of bannedPatterns) if (pattern.test(surfaceText)) fail('banned-surface',`${path.relative(root,file)}: ${label}`);
  }
}
for (const rel of ['src/pages/about.astro','src/pages/editorial-process.astro','src/pages/editorial-standards.astro','src/pages/privacy.astro','src/pages/terms.astro','src/pages/disclaimer.astro','src/pages/affiliate-disclosure.astro','src/pages/contact.astro','src/pages/cookie-policy.astro']) if (!fs.existsSync(path.join(root,rel))) fail('trust-route-source',rel);

const config=fs.readFileSync(path.join(root,'astro.config.mjs'),'utf8');
for (const route of ['/category/cat-care/','/category/cat-safety/','/category/pet-care/','/category/pet-nutrition/','/category/pet-travel/','/category/veterinary-safety/']) if (!config.includes("pathname.startsWith('/category/')")) fail('sitemap-source-contract',`category filtering missing for ${route}`);
const excludedRoutesSource=config.match(/const excludedRoutes = new Set\(\[([^\]]*)\]\)/)?.[1] ?? '';
for (const route of ['/privacy/','/terms/','/affiliate-disclosure/']) if (excludedRoutesSource.includes(`'${route}'`) || excludedRoutesSource.includes(`"${route}"`)) fail('sitemap-trust-source',`${route} is excluded`);

if (checkDist) {
  if (!fs.existsSync(distDir)) fail('dist-missing','run npm run build before --dist');
  else {
    const sitemapFiles=listFiles(distDir).filter((f)=>/sitemap.*\.xml$/.test(path.basename(f)));
    const urls=new Set();
    for (const file of sitemapFiles) for (const m of fs.readFileSync(file,'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)) if (!m[1].endsWith('.xml')) urls.add(m[1]);
    const urlPaths=new Set([...urls].map((u)=>new URL(u).pathname));
    for (const slug of expected) if (!urlPaths.has(`/posts/${slug}/`)) fail('sitemap-retained',slug);
    for (const route of ['/privacy/','/terms/','/affiliate-disclosure/']) if (!urlPaths.has(route)) fail('sitemap-trust-route',route);
    for (const r of records.filter((x)=>x.draft)) if (urlPaths.has(`/posts/${r.slug}/`)) fail('sitemap-draft',r.slug);
    const blocked=['/category/cat-care/','/category/cat-safety/','/category/pet-care/','/category/pet-nutrition/','/category/pet-travel/','/category/veterinary-safety/','/category/cat-health/','/category/pet-health/'];
    for (const route of blocked) if (urlPaths.has(route)) fail('sitemap-noindex',route);
    for (const u of urls) {
      const pathname=new URL(u).pathname; const candidate=pathname==='/'?path.join(distDir,'index.html'):path.join(distDir,pathname,'index.html');
      if (fs.existsSync(candidate) && /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(fs.readFileSync(candidate,'utf8'))) fail('sitemap-noindex',pathname);
    }
    for (const slug of expected) {
      const file=path.join(distDir,'posts',slug,'index.html');
      if (!fs.existsSync(file)) { fail('dist-retained',slug); continue; }
      const html=fs.readFileSync(file,'utf8');
      const article=html.match(/<article\b[\s\S]*?<\/article>/i)?.[0]??html;
      const rasterUrls=[...new Set([...article.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)].map((m)=>new URL(m[1],'https://petwellhub.org').pathname).filter((x)=>/^\/images\/.+\.(png|jpe?g|webp)$/i.test(x)))];
      if (rasterUrls.length<5) fail('dist-image-floor',`${slug}: ${rasterUrls.length}`);
    }
    for (const r of records.filter((x)=>x.draft)) if (fs.existsSync(path.join(distDir,'posts',r.slug,'index.html'))) fail('dist-draft',r.slug);
    for (const rel of ['about','editorial-process','editorial-standards','privacy','terms','disclaimer','affiliate-disclosure','contact','cookie-policy']) {
      const file=path.join(distDir,rel,'index.html'); if (!fs.existsSync(file)) { fail('dist-trust-route',rel); continue; }
      const html=fs.readFileSync(file,'utf8'); if (hangul.test(html)) fail('dist-language',`${rel}: Hangul found`); if (/name=["']robots["'][^>]+noindex/i.test(html)) fail('trust-noindex',rel);
    }
    for (const file of listFiles(distDir).filter((f)=>f.endsWith('.html'))) if (hangul.test(fs.readFileSync(file,'utf8'))) fail('dist-language',`${path.relative(distDir,file)}: Hangul found`);
  }
}

metrics.sort((a,b)=>a.slug.localeCompare(b.slug)); failures.sort((a,b)=>a.code.localeCompare(b.code)||a.detail.localeCompare(b.detail));
const result={ok:failures.length===0,mode:checkDist?'source+dist':'source',totals:{files:records.length,public:publicRecords.length,draft:records.length-publicRecords.length,minWords:Math.min(...metrics.map((x)=>x.words)),minSources:Math.min(...metrics.map((x)=>x.sources)),minImages:Math.min(...metrics.map((x)=>x.images))},posts:metrics,failures};
console.log(JSON.stringify(result,null,2));
if (failures.length) process.exit(1);
