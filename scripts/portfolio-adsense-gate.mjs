#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { REVIEW_POSTS, REVIEW_POST_SET, REVIEW_MIN_EQUIVALENT_WORDS } from '../src/config/review-corpus.mjs';
const root=process.cwd(), dir=path.join(root,'src/content/posts');
const failures=[], rows=[], paras=new Map();
const banned=/\badsense\b|publishing\s+(?:run|workflow)|generated[- ]image\s+qa|deployment workflow|final readiness pass before publishing|\bGTI1[35]\b|raster (?:asset|illustration)|search engines can verify|source[- ]check workflow|자동 재검증|24시간 안에 반영|오류 제보/i;
const strip=x=>x.replace(/^import .*$/gm,' ').replace(/```[\s\S]*?```/g,' ').replace(/<[^>]+>/g,' ').replace(/!\[[^\]]*\]\([^)]+\)/g,' ').replace(/\[([^\]]+)\]\([^)]+\)/g,'$1').replace(/https?:\/\/\S+/g,' ').replace(/[`#*_>|{}]/g,' ').replace(/\s+/g,' ').trim();
const equivalent=x=>Math.max((x.match(/\b[\w-]+\b/gu)||[]).length,Math.round((x.match(/[가-힣ぁ-んァ-ヶ一-龯]/gu)||[]).length/2));
for(const file of fs.readdirSync(dir).filter(x=>x.endsWith('.mdx')).sort()){
 const slug=file.slice(0,-4), raw=fs.readFileSync(path.join(dir,file),'utf8'), m=raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
 if(!m){failures.push(`${file}: missing frontmatter`);continue;}
 const fm=m[1],body=raw.slice(m[0].length),draft=/^draft:\s*true\s*$/mi.test(fm);
 if(draft){if(REVIEW_POST_SET.has(slug)) failures.push(`${slug}: retained slug is drafted`);continue;}
 if(!REVIEW_POST_SET.has(slug)) failures.push(`${slug}: public but not retained`);
 const visible=strip(body), words=equivalent(visible);
 const sources=new Set([...raw.matchAll(/https?:\/\/[^\s)\]}>"']+/g)].map(x=>x[0])).size;
 const images=new Set([...body.matchAll(/(?:!\[[^\]]*\]\((\/images\/[^)]+)\)|["'](\/images\/[^"']+)["'])/g)].map(x=>x[1]||x[2]));
 if(words<REVIEW_MIN_EQUIVALENT_WORDS) failures.push(`${slug}: ${words} equivalent words < ${REVIEW_MIN_EQUIVALENT_WORDS}`);
 if(sources<8) failures.push(`${slug}: ${sources} source URLs < 8`);
 if(images.size<3) failures.push(`${slug}: ${images.size} article images < 3`);
 for(const image of images) if(!fs.existsSync(path.join(root,'public',image.slice(1)))) failures.push(`${slug}: missing ${image}`);
 const readerSurface=(fm.replace(/https?:\/\/\S+/g,' ')+'\n'+body.replace(/\/images\/[^\s)"']+/g,' '));
 if(banned.test(readerSurface)) failures.push(`${slug}: production-process language`);
 for(const hit of body.matchAll(/\/posts\/([a-z0-9-]+)\/?/g)) if(!REVIEW_POST_SET.has(hit[1])) failures.push(`${slug}: link to drafted post ${hit[1]}`);
 for(const block of body.split(/\n\s*\n+/)){
  if(block.trimStart().startsWith('#')||block.trimStart().startsWith('<')) continue;
  const p=strip(block).toLowerCase(); if(equivalent(p)<18) continue;
  const owners=paras.get(p)||[];owners.push(slug);paras.set(p,owners);
 }
 rows.push({slug,words,sources,images:images.size});
}
const publicSet=new Set(rows.map(x=>x.slug));
for(const slug of REVIEW_POSTS) if(!publicSet.has(slug)) failures.push(`${slug}: retained but not public`);
if(rows.length!==REVIEW_POSTS.length) failures.push(`public count ${rows.length} != ${REVIEW_POSTS.length}`);
for(const [p,owners] of paras){const unique=[...new Set(owners)];if(unique.length>1) failures.push(`duplicate paragraph: ${unique.join(', ')}`);}
const astro=fs.readFileSync(path.join(root,'astro.config.mjs'),'utf8');
for(const marker of ["pathname.startsWith('/tags/')","pathname !== '/search/'","pathname.startsWith('/posts/page/')"]) if(!astro.includes(marker)) failures.push(`sitemap filter missing ${marker}`);
for(const rel of ['src/pages/tags/[tag].astro','src/pages/posts/page/[page].astro']){const f=path.join(root,rel);if(fs.existsSync(f)&&!fs.readFileSync(f,'utf8').includes('noindex={true}')) failures.push(`${rel}: noindex missing`);}
if(process.argv.includes('--dist')){
 const sm=path.join(root,'dist/sitemap-0.xml'); if(!fs.existsSync(sm)) failures.push('dist sitemap missing'); else {
  const xml=fs.readFileSync(sm,'utf8'), urls=[...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(x=>x[1]);
  const posts=urls.filter(x=>{const s=new URL(x).pathname.split('/').filter(Boolean);return s.length===2&&s[0]==='posts'&&s[1]!=='page';});
  if(posts.length!==REVIEW_POSTS.length) failures.push(`dist post count ${posts.length} != ${REVIEW_POSTS.length}`);
  for(const u of urls){const p=new URL(u).pathname;if(p.startsWith('/tags/')||p==='/search/'||p.startsWith('/posts/page/')) failures.push(`inflated sitemap route ${p}`);}
 }
}
const result={status:failures.length?'FAIL':'PASS',publicCount:rows.length,minWords:rows.length?Math.min(...rows.map(x=>x.words)):0,minSources:rows.length?Math.min(...rows.map(x=>x.sources)):0,minImages:rows.length?Math.min(...rows.map(x=>x.images)):0,failures,rows};
console.log(JSON.stringify(result,null,2));if(failures.length)process.exit(1);
