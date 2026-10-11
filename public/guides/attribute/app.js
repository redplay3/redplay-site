'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const format=n=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(n);

const FILES=['fire','water','earth','wind','dark','holy'];
let state={mode:"assembly",selections:{},target:null,attack:0,defenses:Object.fromEntries(ELEMENTS.map(e=>[e,0]))};
try{const saved=JSON.parse(localStorage.getItem('redplay-attribute-v2'));if(saved&&typeof saved==='object'){state.mode='assembly';if(saved.selections&&typeof saved.selections==='object'){for(const source of DATA.sources){const entry=saved.selections[source.id];if(!entry||typeof entry!=='object')continue;if(['options','book'].includes(source.kind)&&(!Number.isInteger(entry.option)||!source.options[entry.option]))continue;state.selections=chooseSource(state.selections,source.id,entry).selections;}}state.attack=Math.max(0,numeric(saved.attack));for(const e of ELEMENTS)state.defenses[e]=Math.max(0,numeric(saved.defenses?.[e]));state.target=DATA.zones.some(z=>z.id===saved.target)?saved.target:null;}}catch{}
const persist=()=>{try{localStorage.setItem('redplay-attribute-v2',JSON.stringify(state));}catch{}};
let zoneLimit=20,sourceLimit=18,calcSourceLimit=18;
function iconMarkup(source){
 const selected=state.selections[source.id];
 const icon=selected&&source.options[selected.option]?.icon||source.icon;
 if(source.materials?.length)return `<span class="icon-mosaic" aria-label="Предметы состава">${source.materials.slice(0,4).map(m=>`<img src="/guides/attribute/icons/${esc(m.icon)}" alt="${esc(m.label)}" loading="lazy">`).join('')}</span>`;
 return icon?`<img src="/guides/attribute/icons/${esc(icon)}" alt="" loading="lazy">`:`<span class="fallback" aria-hidden="true">${esc(source.title[0])}</span>`;
}
function materialMarkup(source){return source.materials?.length?`<details class="material-details"><summary>Состав (${source.materials.length}) — предметы и количество</summary><ul class="material-list">${source.materials.map(m=>`<li><img src="/guides/attribute/icons/${esc(m.icon)}" alt="" loading="lazy"><span>${esc(m.label)}</span></li>`).join('')}</ul></details>`:'';}
function renderZones(){const q=$('zone-search').value.toLocaleLowerCase('ru').replaceAll('ё','е');const cat=$('zone-category').value;const min=numeric($('level-min').value);const rows=DATA.zones.filter(z=>(!cat||z['Категория']===cat)&&z['Уровень']>=min&&[z['Название'],z['Группа']].join(' ').toLocaleLowerCase('ru').replaceAll('ё','е').includes(q));$('zone-rows').innerHTML=rows.slice(0,zoneLimit).map(z=>`<tr class="${state.target===z.id?'selected':''}"><td>${esc(z['Название'])}<div class="zone-meta">${esc(z['Категория'])} ${z['Группа']?'· '+esc(z['Группа']):''} · ${esc(z['Тип'])}</div></td><td>${z['Уровень']}</td><td><strong>${format(z['Атака'])}</strong></td><td><strong>${format(z['Защита'])}</strong></td><td><div class="elements">${zoneElements(z).map(e=>`<img src="/guides/attribute/icons/${FILES[ELEMENTS.indexOf(e)]}.webp" alt="${e}" title="${e}">`).join('')}</div></td><td><button class="outline choose-zone" type="button" data-zone="${z.id}">${state.target===z.id?'Выбрана':'Рассчитать'}</button></td></tr>`).join('');$('zone-count').textContent=`Показано ${Math.min(rows.length,zoneLimit)} из ${rows.length} строк · пороги максимального бонуса`;$('zone-more').hidden=rows.length<=zoneLimit;}
function resultLine(label,need){return `<div class="result-line ${need===0?'ok':''}"><span>${esc(label)}</span><strong>${need===0?'Достаточно':'−'+format(need)}</strong></div>`;}
function currentTotals(){return state.mode==='assembly'?assemblyTotals(state.selections):{attack:state.attack,defenses:state.defenses,items:[]};}
function bonusText(b){const parts=[];if(b.attack)parts.push('атака +'+format(b.attack));const values=ELEMENTS.map(e=>b.defenses[e]);if(values.every(n=>n===values[0])&&values[0])parts.push('защита от всех +'+format(values[0]));else for(const e of ELEMENTS)if(b.defenses[e])parts.push(e+' +'+format(b.defenses[e]));return parts.join(' · ')||'АТТ +0';}
function sourceValues(s,compact=false){
 const lines=s.reference_lines||s.variants;
 if(!lines.length)return `<p>${esc(s.details[0]||'Значение не подтверждено.')}</p>`;
 const limit=compact?5:lines.length;
 const list=values=>'<ul class="source-value-list">'+values.map(value=>{const index=lines.indexOf(value);const icon=s.kind==='options'?s.options[index]?.icon:null;return '<li>'+(icon?'<img class="value-icon" src="/guides/attribute/icons/'+esc(icon)+'" alt="" loading="lazy">':'')+esc(value)+'</li>';}).join('')+'</ul>';
 return list(lines.slice(0,limit))+(lines.length>limit?`<details class="all-source-values"><summary>Все остальные ступени (${lines.length-limit})</summary>${list(lines.slice(limit))}</details>`:'');
}
function choiceControls(s,prefix='card'){
 const entry=state.selections[s.id];const locked=s.kind==='armor'&&s.id>=3&&s.id<=7&&Number(state.selections[2]?.option)===0;
 const blocked=s.id===1&&![1,5].includes(Number(state.selections[0]?.option))||s.id===25&&!state.selections[24];
 if(locked)return '<p class="chosen-note">Почёт: фиксированные вставки учтены вместе с сетом.</p>';
 if(s.kind==='options'){
  return `<div class="item-options" role="group" aria-label="${esc(s.title)}"><button type="button" class="item-option ${!entry?'is-selected':''}" data-pick-source="${s.id}" data-pick-option="" aria-pressed="${!entry}">Не учитывать</button>${s.options.map((v,i)=>`<button type="button" class="item-option ${entry&&Number(entry.option)===i?'is-selected':''}" data-pick-source="${s.id}" data-pick-option="${i}" aria-pressed="${!!entry&&Number(entry.option)===i}" ${blocked?'disabled':''}><span class="option-caption">${v.icon?`<img src="/guides/attribute/icons/${esc(v.icon)}" alt="" loading="lazy">`:""}<span>${esc(v.label)}</span></span><strong>${esc(bonusText(v))}</strong></button>`).join('')}</div>`+(blocked?`<p class="muted">${s.id===1?'Сначала выбери оружие R110 или L-грейда.':'Сначала выбери Кольцо Ангела.'}</p>`:'');
 }
 if(s.kind==='book'){
  const select=`<label for="${prefix}-choice-${s.id}">${s.kind==='book'?'Уровень книги':'Выбери предмет / ступень'}<select class="assembly-choice" id="${prefix}-choice-${s.id}" data-choice="${s.id}" ${blocked?'disabled':''}><option value="">Не выбрано</option>${s.options.map((v,i)=>`<option value="${i}" ${Number(entry?.option)===i&&entry?'selected':''}>${esc(v.label)}</option>`).join('')}</select></label>`;
  return select+(blocked?`<p class="muted">${s.id===1?'Сначала выбери оружие R110 или L-грейда.':'Сначала выбери Кольцо Ангела.'}</p>`:'');
 }
 const value=entry||{};let fields='';
 if(s.kind==='manual'){
  fields=sourceValues(s);
  const r=s.input_range;for(const [field,label] of [['attack','Атака'],['defense','Защита от всех']])if(r[field+'_max']!=null)fields+=`<label>${label}<input class="assembly-manual" type="number" data-manual="${s.id}" data-field="${field}" min="${r[field+'_min']}" max="${r[field+'_max']}" value="${value[field]??r[field+'_min']}"></label>`;
 }else{fields=`${sourceValues(s)}<label>Защита за одну выбранную стихию<input type="number" class="assembly-manual" data-manual="${s.id}" data-field="defense" min="0" max="9999" value="${value.defense??0}"></label><div class="armor-elements">${ELEMENTS.map(e=>`<label><input type="checkbox" data-manual="${s.id}" data-field="element" value="${e}" ${(value.elements||[]).includes(e)?'checked':''}>${e}</label>`).join('')}</div><p class="muted">До трёх стихий. Внеси значение из описания предмета.</p>`;}
 return `<div class="manual-source" data-manual-box="${s.id}">${fields}<label class="check-build"><input type="checkbox" class="assembly-enable" data-enable="${s.id}" ${entry?'checked':''}>В сборку</label></div>`;
}
function renderAssembly(){
 const total=currentTotals();$('manual-pane').hidden=state.mode!=='manual';$('assembly-pane').hidden=state.mode!=='assembly';
 document.querySelectorAll('[name="calc-mode"]').forEach(r=>r.checked=r.value===state.mode);
 $('assembly-result').innerHTML=`<div class="assembly-attack"><span>Атака стихией</span><strong>${format(total.attack)}</strong></div><div class="assembly-defenses">${ELEMENTS.map((e,i)=>`<div><img src="/guides/attribute/icons/${FILES[i]}.webp" alt=""><span>${e}</span><strong>${format(total.defenses[e])}</strong></div>`).join('')}</div>`;
 $('assembly-count').textContent=state.mode==='assembly'?`Выбрано источников: ${total.items.length}`:'Используются введённые итоговые параметры.';
 $('build-selected').innerHTML=state.mode==='assembly'?total.items.map(item=>`<div class="selected-item"><div><strong>${esc(item.title)}</strong><small>${esc(item.label)}<br>${esc(bonusText(item))}</small></div>${item.locked?'<span class="muted">Сет Почёта</span>':`<button class="text-button remove-source" type="button" data-remove-source="${item.id}" aria-label="Убрать ${esc(item.title)}">Убрать ×</button>`}</div>`).join(''):'';
 $('build-selected-empty').hidden=total.items.length>0||state.mode!=='assembly';
 $('clear-build').hidden=state.mode!=='assembly'||total.items.length===0;
 $('build-sticky').innerHTML=`<a href="#calculator"><span>${state.mode==='assembly'?'Сборка':'Параметры'} · атака стихией</span><strong>${format(total.attack)}</strong></a><a href="#calc-controls">Выбрать предметы ↑</a>`;
}
function renderCalc(){renderAssembly();const total=currentTotals();const zone=DATA.zones.find(z=>z.id===state.target);if(!zone){$('target-name').textContent='Сравнение с локацией';$('calc-result').innerHTML='<p>Итоги сборки обновляются при выборе предметов. Для расчёта дефицита выбери локацию.</p>';return;}$('target-name').textContent=zone['Название'];let s=`<p class="muted">Цель: ${format(zone['Атака'])} атаки · ${format(zone['Защита'])} защиты по стихии зоны</p>`;s+=resultLine('Не хватает атаки',deficit(zone['Атака'],total.attack));for(const e of zoneElements(zone))s+=resultLine('Защита: '+e,deficit(zone['Защита'],total.defenses[e]));$('calc-result').innerHTML=s;}
function renderSources(){const q=$('source-search').value.toLocaleLowerCase('ru').replaceAll('ё','е');const cat=$('source-category').value;const rows=DATA.sources.filter(s=>(!cat||s.section===cat)&&[s.title,...s.variants,...s.details,...(s.materials||[]).map(m=>m.label)].join(' ').toLocaleLowerCase('ru').replaceAll('ё','е').includes(q));$('source-cards').innerHTML=rows.slice(0,sourceLimit).map(s=>`<article class="reference-item"><div class="source-head">${iconMarkup(s)}<div><div class="category">${esc(s.section)}</div><h3>${esc(s.title)}</h3></div></div><div class="reference-bonuses">${sourceValues(s,true)}${materialMarkup(s)}${s.warning?'<p class="source-warning">'+esc(s.warning)+'</p>':''}</div><button class="outline show-source" type="button" data-source="${s.id}">Все бонусы и условия ↗</button></article>`).join('');$('source-count').textContent=`Показано ${Math.min(rows.length,sourceLimit)} из ${rows.length} источников`;$('source-more').hidden=rows.length<=sourceLimit;}
function renderCalculatorSources(){
 const activeCategory=$('calc-source-category').value;
 const total=assemblyTotals(state.selections);
 $('calc-category-tabs').innerHTML=[...new Set(DATA.sources.map(s=>s.section))].map(cat=>{
  const items=total.items.filter(item=>DATA.sources.find(source=>source.id===item.id)?.section===cat);
  const attack=items.reduce((sum,item)=>sum+item.attack,0);
  return `<button class="loadout-slot ${activeCategory===cat?'is-selected':''} ${items.length?'is-equipped':''}" type="button" data-calc-category="${esc(cat)}" aria-pressed="${activeCategory===cat}"><strong>${esc(cat)}</strong><span>${items.length?items.length+' выбрано'+(attack?' · атака +'+format(attack):''):'Не выбрано'}</span><small>${items.length?esc(items.slice(0,2).map(item=>item.title+': '+item.label).join(' · ')):'Нажми, чтобы выбрать'}</small></button>`;
 }).join('');
 $('equipment-editor-heading').textContent='Выбор предметов: '+(activeCategory||'все разделы');
 const q=$('calc-source-search').value.toLocaleLowerCase('ru').replaceAll('ё','е');const cat=$('calc-source-category').value;const rows=DATA.sources.filter(s=>(!cat||s.section===cat)&&[s.title,...s.variants,...s.details,...(s.materials||[]).map(m=>m.label)].join(' ').toLocaleLowerCase('ru').replaceAll('ё','е').includes(q));$('calc-source-cards').innerHTML=rows.slice(0,calcSourceLimit).map(s=>`<article class="calc-source ${state.selections[s.id]?'in-build':''}"><div class="category">${esc(s.section)}</div><div class="source-head">${iconMarkup(s)}<h3>${esc(s.title)}</h3></div>${choiceControls(s)}${materialMarkup(s)}${state.selections[s.id]&&bonusFor(s,state.selections[s.id],state.selections)?`<p class="chosen-note">В сборке: ${esc(bonusText(bonusFor(s,state.selections[s.id],state.selections)))}${lastChange?.id===s.id&&lastChange.delta?' · изменение атаки '+(lastChange.delta>0?'+':'')+format(lastChange.delta):''}</p>`:''}${s.id===0?'<p class="muted">R110: 450 АТТ · Дракона 2–4 ур.: 999 АТТ. Выбирается одно оружие, значения не складываются.</p>':''}${s.warning?`<p class="source-warning">${esc(s.warning)}</p>`:''}<button class="outline show-source" type="button" data-source="${s.id}">Условия и описание ↗</button></article>`).join('');$('calc-source-count').textContent=`Показано ${Math.min(rows.length,calcSourceLimit)} из ${rows.length} источников`;$('calc-source-more').hidden=rows.length<=calcSourceLimit;}
function showSource(id){const s=DATA.sources.find(x=>x.id===id);if(!s)return;activeDialogSource=id;$('item-dialog').classList.remove('presenting');$('presentation').textContent='Крупный вид для ролика';$('dialog-content').innerHTML=`<div class="eyebrow">LINEAGE 2 MAIN / ${esc(s.section)}</div><div class="dialog-title">${iconMarkup(s)}<h2>${esc(s.title)}</h2></div>${s.warning?`<p class="source-warning">${esc(s.warning)}</p>`:''}${sourceValues(s)}${materialMarkup(s)}${s.details.map(v=>'<p>'+esc(v)+'</p>').join('')}<p class="muted">Выбирай применимые к персонажу умения и действующие бафы. Проверяй условия действия и совместимость бонусов.</p>`;if(!$('item-dialog').open)$('item-dialog').showModal();}
function applySelection(id,entry){const before=assemblyTotals(state.selections);const result=chooseSource(state.selections,id,entry);state.selections=result.selections;state.mode='assembly';const after=assemblyTotals(state.selections);const delta=after.attack-before.attack;lastChange={id,delta};const source=DATA.sources.find(s=>s.id===id);let text=entry?`Выбрано: ${source.title}. Атака сборки: ${format(after.attack)}${delta?' ('+(delta>0?'+':'')+format(delta)+')':''}.`:`Убрано: ${source.title}.`;if(result.removed.length)text+=' Заменены несовместимые варианты: '+result.removed.map(key=>DATA.sources.find(s=>s.id===key).title).join(', ')+'.';$('build-feedback').textContent=text;persist();renderCalculatorSources();renderCalc();if($('item-dialog').open)showSource(activeDialogSource);}
function readManualBox(id,box){const source=DATA.sources.find(s=>s.id===id);const entry={};if(source.kind==='manual'){for(const field of ['attack','defense']){const input=box.querySelector(`[data-field="${field}"]`);if(input){const r=source.input_range;entry[field]=Math.min(r[field+'_max'],Math.max(r[field+'_min'],numeric(input.value)));}}}else{entry.defense=Math.min(9999,Math.max(0,numeric(box.querySelector('[data-field="defense"]').value)));entry.elements=[...box.querySelectorAll('[data-field="element"]:checked')].map(x=>x.value);if(entry.elements.length>3||[['Огонь','Вода'],['Земля','Ветер'],['Тьма','Святость']].some(pair=>pair.every(e=>entry.elements.includes(e))))return null;}return entry;}
let activeDialogSource=null;let lastChange=null;

$('defense-fields').innerHTML=ELEMENTS.map((e,i)=>`<label>${e}<input id="def-${i}" type="number" min="0" max="99999" value="${state.defenses[e]}" aria-label="Твоя защита: ${e}"></label>`).join('');
$('current-attack').value=state.attack;
for(const cat of [...new Set(DATA.zones.map(z=>z['Категория']))])$('zone-category').insertAdjacentHTML('beforeend',`<option>${esc(cat)}</option>`);
for(const cat of [...new Set(DATA.sources.map(s=>s.section))])$('source-category').insertAdjacentHTML('beforeend',`<option>${esc(cat)}</option>`);
for(const cat of [...new Set(DATA.sources.map(s=>s.section))])$('calc-source-category').insertAdjacentHTML('beforeend',`<option>${esc(cat)}</option>`);
$('calc-source-category').value='Оружие';
for(const id of ['calc-source-search','calc-source-category'])$(id).addEventListener('input',()=>{calcSourceLimit=18;renderCalculatorSources();});
$('calc-source-more').addEventListener('click',()=>{calcSourceLimit+=24;renderCalculatorSources();});
$('calc-source-cards').addEventListener('click',e=>{
 const pick=e.target.closest('[data-pick-source]');
 if(pick&&!pick.disabled){applySelection(Number(pick.dataset.pickSource),pick.dataset.pickOption===''?null:{option:Number(pick.dataset.pickOption)});return;}
 const b=e.target.closest('.show-source');if(b)showSource(Number(b.dataset.source));
});
$('calc-category-tabs').addEventListener('click',e=>{const b=e.target.closest('[data-calc-category]');if(!b)return;$('calc-source-category').value=b.dataset.calcCategory;$('calc-source-search').value='';calcSourceLimit=18;renderCalculatorSources();$('equipment-editor-heading').scrollIntoView({behavior:'smooth',block:'start'});});
for(const id of ['zone-search','zone-category','level-min'])$(id).addEventListener('input',()=>{zoneLimit=20;renderZones();});
for(const id of ['source-search','source-category'])$(id).addEventListener('input',()=>{sourceLimit=18;renderSources();});
$('zone-more').addEventListener('click',()=>{zoneLimit+=30;renderZones();});$('source-more').addEventListener('click',()=>{sourceLimit+=24;renderSources();});
$('zone-rows').addEventListener('click',e=>{const b=e.target.closest('.choose-zone');if(!b)return;state.target=Number(b.dataset.zone);persist();renderZones();renderCalc();$('calculator').scrollIntoView({behavior:'smooth'});});
$('source-cards').addEventListener('click',e=>{const b=e.target.closest('.show-source');if(b)showSource(Number(b.dataset.source));});
$('current-attack').addEventListener('input',e=>{state.attack=Math.max(0,numeric(e.target.value));persist();renderCalc();});
ELEMENTS.forEach((e,i)=>$('def-'+i).addEventListener('input',event=>{state.defenses[e]=Math.max(0,numeric(event.target.value));persist();renderCalc();}));
$('item-dialog').querySelector('.dialog-close').addEventListener('click',()=>$('item-dialog').close());
$('presentation').addEventListener('click',()=>{const large=$('item-dialog').classList.toggle('presenting');$('presentation').textContent=large?'Обычный вид':'Крупный вид для ролика';});
document.querySelectorAll('[name="calc-mode"]').forEach(r=>r.addEventListener('change',()=>{state.mode=r.value;persist();renderCalc();}));
document.addEventListener('change',e=>{
 if(e.target.matches('[data-choice]')){const id=Number(e.target.dataset.choice);applySelection(id,e.target.value===''?null:{option:Number(e.target.value)});}
 if(e.target.matches('[data-manual],[data-enable]')){const id=Number(e.target.dataset.manual??e.target.dataset.enable);const box=e.target.closest('[data-manual-box]');const entry=readManualBox(id,box);if(entry===null){e.target.checked=false;$('build-feedback').textContent='В одной части брони — до трёх стихий, без противоположных пар: огонь/вода, земля/ветер, тьма/святость.';return;}applySelection(id,e.target.matches('[data-enable]')&&!e.target.checked?null:entry);}
});
$('build-selected').addEventListener('click',e=>{const b=e.target.closest('[data-remove-source]');if(b)applySelection(Number(b.dataset.removeSource),null);});
$('clear-build').addEventListener('click',()=>{state.selections={};persist();renderCalculatorSources();renderCalc();$('build-feedback').textContent='Сборка очищена.';});
renderZones();renderSources();renderCalculatorSources();renderCalc();

