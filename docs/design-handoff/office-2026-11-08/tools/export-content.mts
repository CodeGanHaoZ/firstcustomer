import { readFile,writeFile,mkdir,copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve,dirname } from 'node:path';
import { OFFICE_CHARACTERS } from '@/lib/brand';
import { getOfficeMembers,getOfficeScenes,OFFICE_TIMING,DEMO_DURATION } from '@/lib/office-showcase';
import { officeStory,OFFICE_PHASES } from '@/lib/office-story';
import { HOME_COPY,OFFICE_COPY } from '@/lib/home-copy';
import { officeGuidance,type OfficeGuideInput } from '@/domain/office-guide';
import { desks } from '@/components/office-map';

const repo=resolve('..');
const out=resolve(repo,'docs/design-handoff/office-2026-11-08');
const baseline=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const meta={date:'2026-11-08',timezone:'Asia/Shanghai',repository:'kongleiwork-art/firstcustomer',sourceCommit:baseline,designCommits:['b437d46','fe432a3','d3e1684','d2c09c9'],kind:'versioned design handoff snapshot'};
async function json(name:string,value:unknown){await writeFile(resolve(out,name),JSON.stringify(value,null,2)+'\n');}
const content:any={meta,characters:OFFICE_CHARACTERS,locales:{}};
for(const locale of ['zh','en'] as const){content.locales[locale]={office:HOME_COPY[locale].office,ui:OFFICE_COPY[locale],members:getOfficeMembers(locale),scenes:getOfficeScenes(locale).map((scene,index)=>({...scene,...officeStory(index,locale)})),serviceFlow:HOME_COPY[locale].flow,phaseLabels:OFFICE_PHASES[locale]};}
await json('content.zh-en.json',content);
const samples:[string,OfficeGuideInput][]=[
 ['research-queued',{status:'researching',paused:false,runningAgents:[],plan:'free'}],
 ['research-working',{status:'researching',paused:false,runningAgents:['research'],plan:'free'}],
 ['quote-operator-review',{status:'awaiting_quote',paused:false,runningAgents:[],plan:'pro'}],
 ['positioning-customer-approval',{status:'awaiting_positioning',paused:false,runningAgents:[],openGate:'positioning'}],
 ['feedback-waiting',{status:'collecting',paused:false,runningAgents:[]}],
 ['paused',{status:'researching',paused:true,runningAgents:[]}],
 ['pause-finishing',{status:'researching',paused:true,runningAgents:['research']}],
 ['failed',{status:'failed',paused:false,runningAgents:[],failedFrom:'preparing_page'}],
 ['delivered',{status:'delivered',paused:false,runningAgents:[],deliveryStatus:'accepted'}],
 ['closed',{status:'cancelled',paused:false,runningAgents:[]}],
];
await json('states.json',{meta,warning:'Synthetic presentation examples only; no customer project data. This file never advances workflows.',examples:samples.map(([id,input])=>({id,input,zh:officeGuidance(input,'zh'),en:officeGuidance(input,'en')}))});
const editorial=await readFile('src/app/editorial.css','utf8');
const root=editorial.match(/:root\s*\{([\s\S]*?)\n\}/)![1];
const properties=Object.fromEntries([...root.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(m=>[m[1],m[2].trim().replace(/\s+/g,' ')]));
const relayCss=await readFile('src/app/office-relay.css','utf8');
const relayRule=relayCss.match(/\.relay-exchange\s*\{([^}]+)\}/)![1].trim();
await json('tokens.json',{meta,scope:'Office presentation; implemented CSS takes priority over legacy prose values in DESIGN.md.',editorial:{source:'firstcustomer/src/app/editorial.css',properties},office:{source:'firstcustomer/src/app/office-relay.css',breakpoints:{tabletMax:900,mobileMax:600},sceneMinWidth:760,projectMapMinWidth:680,relayDesktopRule:relayRule,colors:{relayBackground:'#243b2d',paper:'#fbfaf8',paperSecondary:'#f7f5ef',relayText:'#fff9e9',relayMuted:'#d5ddcc',document:'#fff7df',workBadge:'#2e5138',activityBars:'#e6edc9'},type:{relayHeading:'clamp(25px,2.9vw,36px); mobile 24px',partyName:'25px; <=900px 21px; <=600px 25px',dialogue:'16px / 1.9',decision:'15px / 1.85',sceneNav:'15px; mobile 13px',serviceBody:'16px / 1.85; mobile 15px'}},motion:{demoDuration:DEMO_DURATION,...OFFICE_TIMING,canvasFPS:30,devicePixelRatioMax:1.5,canvasWorkScale:1.12,projectWorkHeight:'15.7%',idleProjectHeight:'14%',workBarsMs:900,documentTransitionMs:650},spriteAtlas:{map:{width:896,height:272,columns:8,rows:2,cellWidth:112,cellHeight:136},portrait:{columns:4,rows:2,backgroundSize:'400% 200%'},desks}});
const files=[
 'src/components/office-showcase.tsx','src/components/office-showcase-canvas.ts','src/components/office-relay.tsx','src/components/office-portrait.tsx','src/components/service-journey.tsx','src/components/office-map.tsx','src/components/office-stage.tsx','src/components/office-work-guide.tsx',
 'src/lib/brand.ts','src/lib/office-showcase.ts','src/lib/office-story.ts','src/lib/home-copy.ts','src/domain/office-guide.ts','src/domain/office.ts',
 'src/app/editorial.css','src/app/office-showcase.css','src/app/office-relay.css','src/app/admin/office.css',
];
const manifest=[];
for(const file of files){const dest=resolve(out,'source',file);await mkdir(dirname(dest),{recursive:true});await copyFile(file,dest);const bytes=await readFile(file);manifest.push({path:`firstcustomer/${file}`,snapshot:`source/${file}`,sha256:createHash('sha256').update(bytes).digest('hex'),url:`https://github.com/kongleiwork-art/firstcustomer/blob/${baseline}/firstcustomer/${file}`});}
await json('source-manifest.json',{meta,note:'Source excerpts for design review. Clone the actual repository to run the app; this is not a standalone application.',files:manifest});
console.log('Exported versioned bilingual content, tokens, synthetic states and 18 source excerpts:',baseline.slice(0,7));
