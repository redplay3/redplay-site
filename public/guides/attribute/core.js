'use strict';
const ELEMENTS=['Огонь','Вода','Земля','Ветер','Тьма','Святость'];
function numeric(v){const n=Number(v);return Number.isFinite(n)?n:0;}
function deficit(target,current){return Math.max(0,numeric(target)-Math.max(0,numeric(current)));}
function planTotals(rows){return rows.filter(r=>r.enabled).reduce((a,r)=>({attack:a.attack+numeric(r.attack),defense:a.defense+numeric(r.defense),price:a.price+Math.max(0,numeric(r.price)),missingPrice:a.missingPrice+(r.price===''||r.price==null?1:0)}),{attack:0,defense:0,price:0,missingPrice:0});}
function zoneElements(zone){return (zone['Стихия']||'').split(',').map(x=>x.trim()).filter(x=>ELEMENTS.includes(x));}
function emptyBonus(){return {attack:0,defenses:Object.fromEntries(ELEMENTS.map(e=>[e,0]))};}
function bonusFor(source,entry,selections){
 if(!entry)return null;
 if(source.id===1){const weapon=selections[0];if(!weapon||![1,5].includes(Number(weapon.option)))return null;}
 if(source.id===25&&!selections[24])return null;
 if(source.kind==='options'||source.kind==='book')return source.options[Number(entry.option)]||null;
 const b=emptyBonus();
 if(source.kind==='manual'){
  const range=source.input_range;
  b.attack=range.attack_max==null?0:Math.min(range.attack_max,Math.max(range.attack_min,numeric(entry.attack)));
  for(const e of ELEMENTS)b.defenses[e]=range.defense_max==null?0:Math.min(range.defense_max,Math.max(range.defense_min,numeric(entry.defense)));
 }else if(source.kind==='armor'){
  const elements=[...new Set(entry.elements||[])].filter(e=>ELEMENTS.includes(e)).slice(0,3);
  if([['Огонь','Вода'],['Земля','Ветер'],['Тьма','Святость']].some(pair=>pair.every(e=>elements.includes(e))))return null;
  for(const e of elements)b.defenses[e]=Math.min(9999,Math.max(0,numeric(entry.defense)));
 }
 return b;
}
function assemblyTotals(selections){
 const total=emptyBonus();total.items=[];
 for(const source of DATA.sources){const entry=selections[source.id];const bonus=bonusFor(source,entry,selections);if(!bonus)continue;
  if(source.kind==='armor'&&source.id>=3&&source.id<=7&&Number(selections[2]?.option)===0)continue;
  total.attack+=bonus.attack;for(const e of ELEMENTS)total.defenses[e]+=bonus.defenses[e];
  total.items.push({id:source.id,title:source.title,label:(source.kind==='options'||source.kind==='book')?source.options[Number(entry.option)].label:source.kind==='armor'?'Вставки в броню':'Зачарование',...bonus});
 }
 if(Number(selections[2]?.option)===0){
  for(const id of [3,4,5,6,7]){const source=DATA.sources.find(s=>s.id===id);const b=emptyBonus();for(const e of id<=5?['Вода','Земля','Тьма']:['Огонь','Ветер','Святость']){b.defenses[e]=120;total.defenses[e]+=120;}total.items.push({id,title:source.title,label:'Благ. Почёт · фиксированные вставки',locked:true,...b});}
 }
 return total;
}
function chooseSource(previous,id,entry){
 const selections={...previous};const removed=[];const source=DATA.sources.find(s=>s.id===id);if(!source)return {selections,removed};
 if(entry){
  if(source.group)for(const [key,old] of Object.entries(selections)){const other=DATA.sources.find(s=>s.id===Number(key));if(Number(key)!==id&&old&&other?.group===source.group){delete selections[key];removed.push(Number(key));}}
  const ears=[19,20,21,22,218,219];if(ears.includes(id)&&!selections[id]){const worn=ears.filter(k=>selections[k]);if(worn.length>=2){delete selections[worn[0]];removed.push(worn[0]);}}
  selections[id]=entry;
 }else delete selections[id];
 if(![1,5].includes(Number(selections[0]?.option))&&selections[1]){delete selections[1];removed.push(1);}
 if(!selections[24]&&selections[25]){delete selections[25];removed.push(25);}
 return {selections,removed};
}
