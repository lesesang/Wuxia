import {readFileSync} from "node:fs";
import {loadData,DB} from "../../www/js/data.js";
import {validateEvents,validateChains} from "../../www/js/events.js";
await loadData(async n=>JSON.parse(readFileSync(`${decodeURIComponent(new URL("../../", import.meta.url).pathname)}www/data/${n}.json`,"utf8")));
console.log("validate",validateEvents?.().length, validateChains?.().length);
const setFlags=new Map(), useFlags=new Map();
const add=(m,k,w)=>{if(!m.has(k))m.set(k,[]);m.get(k).push(w)};
const probs=[];
const refs={skill:new Set(),item:new Set(),enemy:new Set(),trait:new Set()};
function scan(n,w){
  if(Array.isArray(n))return n.forEach(x=>scan(x,w));
  if(!n||typeof n!=="object")return;
  for(const[k,v]of Object.entries(n)){
    if(k==="flags"&&Array.isArray(v))v.forEach(f=>add(setFlags,f,w));
    if(k==="flag"&&typeof v==="string")add(useFlags,v,w);
    if(k==="no_flag"&&typeof v==="string")add(useFlags,v,w);
    if(k==="flags_any"||k==="flags_all"){(v||[]).forEach(f=>add(useFlags,f,w))}
    if(k==="trait"&&typeof v==="string"&&!DB.traits[v])probs.push(["없는 자질",v,w]);
    if(k==="origin"&&typeof v==="string"&&!DB.origins.origins[v]&&!["origin"].includes(v))probs.push(["없는 출신",v,w]);
    if((k==="skill"||k==="no_skill")&&typeof v==="string"&&!DB.skills[v])probs.push(["없는 무공",v,w]);
    if((k==="item"||k==="equip"||k==="consume_item"||k==="has_item")&&typeof v==="string"&&!DB.market[v])probs.push(["없는 물건",k,v,w]);
    if(k==="battle"&&typeof v==="string"&&!DB.enemies[v])probs.push(["없는 적",v,w]);
    if(k==="unlocked"&&!DB.karma.content[v])probs.push(["없는 인연",v,w]);
    scan(v,w);
  }
}
for(const[k,e]of Object.entries(DB.events))scan(e,"ev:"+k);
for(const[k,e]of Object.entries(DB.enemies))scan(e,"en:"+k);
scan(DB.endings,"endings");scan(DB.fortunes,"fortunes");
console.log("probs",probs);
console.log("쓰이지 않는 깃발(세우기만)",[...setFlags.keys()].filter(f=>!useFlags.has(f)).length,[...setFlags.keys()].filter(f=>!useFlags.has(f)).join(" "));
console.log("세우지 않는데 요구하는 깃발",[...useFlags.keys()].filter(f=>!setFlags.has(f)).map(f=>f+":"+useFlags.get(f)[0]).join(" "));
// 요구 키 종류
const reqKeys=new Map();function rq(n){if(Array.isArray(n))return n.forEach(rq);if(!n||typeof n!=="object")return;for(const[k,v]of Object.entries(n)){if(k==="requires"&&v&&typeof v==="object")for(const a of Object.keys(v))reqKeys.set(a,(reqKeys.get(a)||0)+1);rq(v)}}
rq(DB.events);console.log([...reqKeys].join(" "));
const eff=new Map();function ef(n){if(Array.isArray(n))return n.forEach(ef);if(!n||typeof n!=="object")return;for(const[k,v]of Object.entries(n)){if(k==="effects"&&v&&!Array.isArray(v))for(const a of Object.keys(v))eff.set(a,(eff.get(a)||0)+1);ef(v)}}
ef(DB.events);ef(DB.enemies);console.log([...eff].join(" "));
// 적이 사건에서 쓰이는데 장 범위
const unusedEnemies=Object.keys(DB.enemies).filter(k=>!JSON.stringify(DB.events).includes(`"${k}"`)&&!(DB.enemies[k].chapters||[]).length);
console.log("쓰이지 않는 적",unusedEnemies);
const allJ=JSON.stringify(DB.events)+JSON.stringify(DB.enemies)+JSON.stringify(DB.fortunes)+JSON.stringify(DB.karma)+JSON.stringify(DB.traits)+JSON.stringify(DB.origins);
console.log("쓰이지 않는 물건",Object.keys(DB.market).filter(k=>!(DB.market[k].markets||[]).length&&!allJ.includes(`"${k}"`)&&!readFileSync(decodeURIComponent(new URL("../../", import.meta.url).pathname) + "www/js/events.js","utf8").includes(k)));
console.log("얻을 길 없는 무공",Object.keys(DB.skills).filter(k=>{const s=JSON.stringify(k);return !allJ.includes(s)&&!Object.values(DB.market).some(i=>i.effects?.some(e=>e.skill===k))&&!Object.values(DB.sects).some(x=>JSON.stringify(x).includes(s))&&!readFileSync(decodeURIComponent(new URL("../../", import.meta.url).pathname) + "www/js/events.js","utf8").includes(k)}));
// 문파 무공 등
const cats={};for(const[k,s]of Object.entries(DB.skills))if(s.type==="공격무공"){cats[s.category]=(cats[s.category]||0)+1}console.log(cats);
// 장별 사건 수와 계열
const ch={1:0,2:0,3:0,4:0,5:0};for(const e of Object.values(DB.randomEvents))for(const c of e.chapters||[])ch[c]++;console.log("장별 사건",ch);
// 사건 형태 이상
for(const[k,e]of Object.entries(DB.events)){
 if(!e.title||!e.text)console.log("제목본문없음",k);
 for(const c of e.choices||[]){if(!c.label)console.log("라벨없음",k);if(!c.outcomes?.length)console.log("결과없음",k,c.label);
  for(const o of c.outcomes||[])if(!o.text)console.log("결과문장없음",k,c.label)}
 const labels=(e.choices||[]).map(c=>c.label);if(new Set(labels).size!==labels.length)console.log("같은 라벨",k);
 for(const v of e.variants||[]){if(!v.requires)console.log("조건없는변형",k);if(!v.text&&!v.choices)console.log("빈변형",k)}
 if(e.chapters&&e.requires?.realm_min){}
}
