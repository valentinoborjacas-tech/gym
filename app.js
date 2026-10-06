(function(){
"use strict";
const CHECK='<svg viewBox="0 0 24 24" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const uid=()=>Math.random().toString(36).slice(2,9);
const r0=n=>Math.round(n);
const fmt=n=>r0(n).toLocaleString("es-PE");
const num=v=>{const x=parseFloat(String(v).replace(",","."));return isFinite(x)?x:null};
const isoDate=d=>{const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),dd=String(d.getDate()).padStart(2,"0");return `${y}-${m}-${dd}`};
const parseISO=s=>{const [y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d)};
const todayISO=()=>isoDate(new Date());
const dayKeyFor=iso=>["com","lun","mar","mie","jue","vie","com"][parseISO(iso).getDay()];
const shortDate=iso=>parseISO(iso).toLocaleDateString("es-PE",{day:"numeric",month:"short"});

const ex=(name,sets,reps)=>({id:uid(),name,sets,reps});
function defaultRoutine(){return{order:["lun","mar","mie","jue","vie","com"],days:{
  lun:{label:"Lun",name:"Lunes",focus:"Pecho + Tríceps",cardio:"15–20 min caminadora inclinada",exercises:[
    ex("Press de banca plano",3,"8-10"),ex("Press inclinado con mancuernas",3,"10-12"),ex("Aperturas en Pec Deck / Polea",3,"12"),
    ex("Tríceps en polea alta con cuerda",3,"12"),ex("Extensión de tríceps tras nuca",3,"10-12")]},
  mar:{label:"Mar",name:"Martes",focus:"Espalda + Bíceps + Lumbar",cardio:"15–20 min caminadora inclinada",exercises:[
    ex("Jalón al pecho en polea alta",3,"10-12"),ex("Remo parado con barra (prono/supino)",3,"8-10"),ex("Remo en polea baja / unilateral",3,"10-12"),
    ex("Curl de bíceps con barra Z",3,"10-12"),ex("Curl martillo con mancuernas",3,"10-12"),ex("Extensiones lumbares en banco romano",3,"12-15")]},
  mie:{label:"Mié",name:"Miércoles",focus:"Pierna suave + Core",cardio:"15 min bicicleta estática",exercises:[
    ex("Prensa de piernas",3,"12-15"),ex("Extensión de cuádriceps",3,"12-15"),ex("Curl femoral sentado",3,"12"),
    ex("Elevación de talones en máquina",3,"15"),ex("Plancha frontal",3,"30-45 s"),ex("Dead bug",3,"10 por lado")]},
  jue:{label:"Jue",name:"Jueves",focus:"Hombro + Core",cardio:"15–20 min caminadora inclinada",exercises:[
    ex("Press de hombro con mancuernas (sentado)",3,"10-12"),ex("Elevaciones laterales",3,"12-15"),ex("Pájaros en Pec Deck invertido",3,"12-15"),
    ex("Face pull en polea",3,"15"),ex("Pallof press",3,"10 por lado"),ex("Crunch en polea",3,"12-15")]},
  vie:{label:"Vie",name:"Viernes",focus:"Full body técnico",cardio:"20 min elíptica",exercises:[
    ex("Sentadilla goblet",3,"10-12"),ex("Peso muerto rumano con mancuernas",3,"10-12"),ex("Press de pecho en máquina",3,"10-12"),
    ex("Remo con mancuerna a una mano",3,"10-12"),ex("Puente de glúteo / Hip thrust",3,"12"),ex("Paseo del granjero",3,"30 m")]},
  com:{label:"Comodín",name:"Comodín",focus:"Sábado o domingo",cardio:"Caminata o bici suave 40–60 min",note:"Úsalo para recuperar una sesión que faltó. Si no faltaste a ninguna: cardio suave y movilidad.",exercises:[
    ex("Movilidad de cadera y columna torácica",1,"10 min"),ex("Estiramientos de isquios y flexores de cadera",1,"10 min")]}
}}}
const defaultProfile=()=>({peso:85,estatura:175,edad:30,sexo:"h",actividad:1.55,protKg:1.9,favs:[],example:true});

const S={profile:defaultProfile(),routine:defaultRoutine(),logs:{},date:todayISO(),tab:"nutri",dayKey:null,editing:false,confirmReset:false,touched:false};
S.dayKey=dayKeyFor(S.date);

/* ---------- storage (localStorage, solo en este dispositivo) ---------- */
const LKEY="vueltaGym.v1";
let saveTimer=null;
function loadLocal(){try{const raw=localStorage.getItem(LKEY);if(!raw)return;const d=JSON.parse(raw);
  if(d.profile)S.profile=Object.assign(defaultProfile(),d.profile);if(d.routine)S.routine=d.routine;if(d.logs)S.logs=d.logs;S.touched=!!d.touched}catch(e){}}
function saveLocal(){try{localStorage.setItem(LKEY,JSON.stringify({version:1,profile:S.profile,routine:S.routine,logs:S.logs,touched:S.touched}));return true}catch(e){return false}}
function setStatus(kind,text){const el=$("#status");el.className="status "+kind;el.querySelector("span").textContent=text}
function idleStatus(){setStatus("","Guardado en este dispositivo")}
function persist(){
  S.touched=true;
  if(!saveLocal()){setStatus("err","No se pudo guardar (¿modo privado?)");return}
  setStatus("","Guardado");clearTimeout(saveTimer);saveTimer=setTimeout(idleStatus,1500);
}
function exportData(){
  const data=JSON.stringify({app:"vuelta-al-gym",version:1,exportedAt:new Date().toISOString(),profile:S.profile,routine:S.routine,logs:S.logs},null,2);
  const blob=new Blob([data],{type:"application/json"});const url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;a.download="vuelta-al-gym-"+todayISO()+".json";document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
  try{localStorage.setItem(LKEY+".lastBackup",todayISO())}catch(e){}renderBackup();
}
function importData(file){
  const fr=new FileReader();
  fr.onload=()=>{try{const d=JSON.parse(fr.result);if(!d||!d.routine||!d.profile)throw new Error("formato");
      S.profile=Object.assign(defaultProfile(),d.profile);S.routine=d.routine;S.logs=d.logs||{};persist();pickDay();renderAll();
      $("#bkMsg").textContent="Copia restaurada: "+Object.keys(S.logs).length+" días de registros.";}
    catch(e){$("#bkMsg").textContent="Ese archivo no es una copia válida de Vuelta al Gym."}};
  fr.readAsText(file);
}
function renderBackup(){let last=null;try{last=localStorage.getItem(LKEY+".lastBackup")}catch(e){}
  $("#bkLast").textContent=last?"Última copia: "+shortDate(last):"Aún no has exportado ninguna copia."}

/* ---------- calculations ---------- */
function targets(){
  const p=S.profile,w=num(p.peso)||0,h=num(p.estatura)||0,a=num(p.edad)||0;
  const bmr=10*w+6.25*h-5*a+(p.sexo==="m"?-161:5);
  const tdee=bmr*(num(p.actividad)||1.2);
  const kcal=Math.max(0,tdee-400);
  const P=w*(num(p.protKg)||1.9),G=w*0.8;
  const C=(kcal-P*4-G*9)/4;
  return{bmr,tdee,kcal,P,G,C:Math.max(0,C),neg:C<0,w};
}
function log(d){if(!S.logs[d])S.logs[d]={};return S.logs[d]}
function eaten(d){const f=(S.logs[d]&&S.logs[d].food)||[];return f.reduce((a,x)=>({kcal:a.kcal+(x.kcal||0),p:a.p+(x.p||0),c:a.c+(x.c||0),g:a.g+(x.g||0)}),{kcal:0,p:0,c:0,g:0})}

/* ---------- header / tabs ---------- */
function renderHeader(){
  const isToday=S.date===todayISO();
  const lbl=parseISO(S.date).toLocaleDateString("es-PE",{weekday:"short",day:"numeric",month:"short"});
  $("#dateLabel").textContent=isToday?"Hoy · "+lbl:lbl;
  $("#todayBtn").hidden=isToday;
  $("#trackEyebrow").textContent=isToday?"Registro de hoy":"Registro del "+lbl;
  ["nutri","train","prog"].forEach(t=>{$("#t-"+t).setAttribute("aria-selected",S.tab===t);$("#v-"+t).hidden=S.tab!==t});
}

/* ---------- nutrition ---------- */
function fillProfile(){
  const p=S.profile;$("#p-peso").value=p.peso??"";$("#p-est").value=p.estatura??"";$("#p-edad").value=p.edad??"";
  $("#p-sexo").value=p.sexo||"h";$("#p-act").value=String(p.actividad||1.55);$("#p-prot").value=p.protKg||1.9;
}
function renderTargets(){
  const t=targets(),p=S.profile;
  $("#protLbl").textContent=(+p.protKg).toFixed(2)+" g/kg";
  $("#exampleNote").hidden=!p.example;
  $("#goalKcal").textContent=t.w?fmt(t.kcal):"–";
  $("#gP").textContent=fmt(t.P)+" g";$("#gPk").textContent=fmt(t.P*4)+" kcal";
  $("#gC").textContent=fmt(t.C)+" g";$("#gCk").textContent=fmt(t.C*4)+" kcal";
  $("#gG").textContent=fmt(t.G)+" g";$("#gGk").textContent=fmt(t.G*9)+" kcal";
  $("#math").innerHTML=`TMB = 10×${esc(p.peso)} + 6.25×${esc(p.estatura)} − 5×${esc(p.edad)} ${p.sexo==="m"?"− 161":"+ 5"} = <b>${fmt(t.bmr)}</b><br>
  Mantenimiento = ${fmt(t.bmr)} × ${esc(p.actividad)} = <b>${fmt(t.tdee)}</b><br>Meta = ${fmt(t.tdee)} − 400 = <b>${fmt(t.kcal)} kcal</b>`+
  (t.neg?`<br><span style="color:var(--warn)">Proteína + grasas ya superan la meta; revisa los datos.</span>`:"");
  renderBars();
}
function renderBars(){
  const t=targets(),e=eaten(S.date);
  const rows=[["Calorías",e.kcal,t.kcal,"kcal","--plate-green"],["Proteína",e.p,t.P,"g","--plate-red"],["Carbohidratos",e.c,t.C,"g","--plate-blue"],["Grasas",e.g,t.G,"g","--plate-yellow"]];
  $("#bars").innerHTML=rows.map(([n,v,g,u,c])=>{
    const pct=g>0?Math.min(100,v/g*100):0,over=g>0&&v>g*1.03,rest=g-v;
    return `<div style="--c:var(${c})"><div class="bar-head"><b>${n}</b><span class="num">${fmt(v)} / ${fmt(g)} ${u}</span></div>
    <div class="bar ${over?"over":""}" role="progressbar" aria-label="${n}" aria-valuemin="0" aria-valuemax="${r0(g)}" aria-valuenow="${r0(v)}"><span style="width:${pct}%"></span></div>
    <div class="left ${over?"over":""}">${over?`Te pasaste por ${fmt(-rest)} ${u}`:rest>0?`Faltan ${fmt(rest)} ${u} · ${r0(pct)}%`:"Meta cumplida"}</div></div>`}).join("");
}
function renderFood(){
  const f=(S.logs[S.date]&&S.logs[S.date].food)||[];
  const favs=S.profile.favs||[];
  $("#favWrap").innerHTML=favs.length?`<div class="eyebrow" style="margin-bottom:6px">Comidas frecuentes · toca para añadir</div><div class="chips">${favs.map((x,i)=>
    `<span class="chip"><button class="btn ghost" style="padding:0;font-size:13px" data-act="favadd" data-i="${i}">${esc(x.name)} <span class="muted num">${fmt(x.kcal)}</span></button><button class="x" data-act="favdel" data-i="${i}" aria-label="Quitar ${esc(x.name)} de frecuentes">×</button></span>`).join("")}</div>`:"";
  $("#foodList").innerHTML=f.length?`<div class="foodlist">${f.map((x,i)=>`<div class="food"><div><div class="nm">${esc(x.name)}</div>
    <div class="mc">P ${fmt(x.p)} · C ${fmt(x.c)} · G ${fmt(x.g)}</div></div><span class="kc">${fmt(x.kcal)}</span>
    <span class="ops"><button class="btn ghost icon" data-act="fav" data-i="${i}" title="Guardar como frecuente" aria-label="Guardar ${esc(x.name)} como frecuente">★</button><button class="btn ghost icon danger" data-act="fdel" data-i="${i}" aria-label="Borrar ${esc(x.name)}">×</button></span></div>`).join("")}</div>`
    :`<div class="empty">Aún no hay comidas registradas este día. Añade la primera arriba (ej. desayuno: 3 huevos + 2 panes).</div>`;
}

/* ---------- workout ---------- */
function workout(d,k,create){const L=create?log(d):S.logs[d];if(!L)return null;if(!L.workouts){if(!create)return null;L.workouts={}}
  if(!L.workouts[k]){if(!create)return null;L.workouts[k]={entries:{},cardio:{min:"",done:false},notes:""}}return L.workouts[k]}
function lastPerf(exId,before){
  const dates=Object.keys(S.logs).filter(d=>d<before).sort().reverse();
  for(const d of dates){const ws=S.logs[d].workouts;if(!ws)continue;for(const k in ws){const sets=(ws[k].entries||{})[exId];
    if(sets&&sets.some(s=>s.done))return{date:d,sets:sets.filter(s=>s.done)}}}
  return null;
}
function sessionStats(w,day){let done=0,total=0,vol=0;day.exercises.forEach(e=>{total+=+e.sets||0;const s=(w&&w.entries[e.id])||[];
  s.forEach((x,i)=>{if(x.done&&i<(+e.sets||0)){done++;vol+=(num(x.kg)||0)*(num(x.reps)||0)}})});return{done,total,vol}}
function renderDayTabs(){
  const tk=dayKeyFor(S.date);
  $("#dayTabs").innerHTML=S.routine.order.map(k=>{const d=S.routine.days[k];
    return `<button class="day ${k===tk?"today":""}" role="tab" aria-selected="${k===S.dayKey}" data-act="day" data-k="${k}"><b>${esc(d.label)}</b><small>${esc(d.focus)}</small></button>`}).join("");
}
function renderDay(){
  renderDayTabs();
  const k=S.dayKey,day=S.routine.days[k];
  if(S.editing){renderEdit(day);return}
  const w=workout(S.date,k,false),st=sessionStats(w,day),pct=st.total?st.done/st.total*100:0;
  const isTodayKey=k===dayKeyFor(S.date);
  let h=`<div class="dayhead"><div><div class="eyebrow">${esc(day.name)}${isTodayKey?"":" · registrando en "+esc(shortDate(S.date))}</div><h2>${esc(day.focus)}</h2></div>
  <button class="btn" data-act="edit">Editar rutina</button></div>
  <div class="sessbar"><span class="small num">${st.done}/${st.total} series</span><div class="bar" style="--c:var(--plate-green)"><span style="width:${pct}%"></span></div><span class="small num">${fmt(st.vol)} kg vol.</span></div>`;
  if(day.note)h+=`<p class="tip">${esc(day.note)}</p>`;
  h+=`<div class="exlist">`;
  day.exercises.forEach(e=>{
    const sets=(w&&w.entries[e.id])||[],lp=lastPerf(e.id,S.date),n=+e.sets||0;
    const allDone=n>0&&Array.from({length:n},(_,i)=>sets[i]&&sets[i].done).every(Boolean);
    h+=`<article class="ex ${allDone?"done":""}"><header><h3>${esc(e.name)}</h3><span class="rx">${n} × ${esc(e.reps)}</span></header>
    <p class="last">${lp?`Última vez (${esc(shortDate(lp.date))}): ${lp.sets.map(s=>`${esc(s.kg||"–")} kg × ${esc(s.reps||"–")}`).join(" · ")}`:"Sin registro previo. Empieza con un peso que te deje 2–3 reps en reserva."}</p><div class="sets">`;
    for(let i=0;i<n;i++){const s=sets[i]||{},ph=lp&&lp.sets[Math.min(i,lp.sets.length-1)];
      h+=`<div class="set"><span class="n">${i+1}</span>
      <span class="fld"><input class="num" type="number" step="0.5" min="0" inputmode="decimal" id="kg-${e.id}-${i}" data-act="setv" data-ex="${e.id}" data-i="${i}" data-f="kg" value="${esc(s.kg??"")}" placeholder="${esc(ph?ph.kg:"")}" aria-label="Kilos serie ${i+1}"><em>kg</em></span>
      <span class="fld"><input class="num" type="number" step="1" min="0" inputmode="numeric" id="rp-${e.id}-${i}" data-act="setv" data-ex="${e.id}" data-i="${i}" data-f="reps" value="${esc(s.reps??"")}" placeholder="${esc(ph?ph.reps:String(e.reps).split(/[-\s]/)[0])}" aria-label="Repeticiones serie ${i+1}"><em>reps</em></span>
      <button class="chk" aria-pressed="${!!s.done}" data-act="tick" data-ex="${e.id}" data-i="${i}" aria-label="Marcar serie ${i+1} como hecha">${CHECK}</button></div>`}
    h+=`</div></article>`;
  });
  const c=(w&&w.cardio)||{};
  h+=`<article class="ex cardio"><header><h3>Cardio final</h3><span class="rx">${esc(day.cardio||"–")}</span></header>
    <div class="set" style="grid-template-columns:minmax(0,1fr) 40px"><span class="fld"><input class="num" type="number" min="0" step="1" id="cardio-min" data-act="cardio" value="${esc(c.min??"")}" placeholder="Minutos hechos" aria-label="Minutos de cardio"><em>min</em></span>
    <button class="chk" aria-pressed="${!!c.done}" data-act="cardiotick" aria-label="Marcar cardio como hecho">${CHECK}</button></div></article>
    <article class="ex notes"><header><h3>Notas de la sesión</h3></header><textarea id="sess-notes" data-act="notes" placeholder="Molestias en hombro, rodilla o lumbar, sensación general, energía…">${esc((w&&w.notes)||"")}</textarea></article></div>
    <p class="tip">Progresión: cuando completes todas las series en el tope del rango de reps con buena técnica, sube 2.5 kg (tren superior) o 5 kg (pierna) la siguiente semana. Si notas molestia lumbar o articular, mantén el peso.</p>`;
  $("#dayPanel").innerHTML=h;
}
function renderEdit(day){
  let h=`<div class="dayhead"><div><div class="eyebrow">Editando ${esc(day.name)}</div><h2>${esc(day.focus)}</h2></div><button class="btn primary" data-act="editdone">Listo</button></div>
  <div class="panel" style="margin-top:14px"><div class="fields">
    <label>Enfoque del día<input id="ed-focus" data-act="edday" data-f="focus" value="${esc(day.focus)}"></label>
    <label>Cardio final<input id="ed-cardio" data-act="edday" data-f="cardio" value="${esc(day.cardio||"")}"></label>
  </div><div>`;
  day.exercises.forEach((e,i)=>{h+=`<div class="editrow">
    <label>Ejercicio<input id="ed-n-${e.id}" data-act="edex" data-ex="${e.id}" data-f="name" value="${esc(e.name)}"></label>
    <label>Series<input class="num" type="number" min="1" max="10" id="ed-s-${e.id}" data-act="edex" data-ex="${e.id}" data-f="sets" value="${esc(e.sets)}"></label>
    <label>Reps<input class="num" id="ed-r-${e.id}" data-act="edex" data-ex="${e.id}" data-f="reps" value="${esc(e.reps)}"></label>
    <span class="ops"><button class="btn icon" data-act="mv" data-ex="${e.id}" data-d="-1" ${i===0?"disabled":""} aria-label="Subir">↑</button><button class="btn icon" data-act="mv" data-ex="${e.id}" data-d="1" ${i===day.exercises.length-1?"disabled":""} aria-label="Bajar">↓</button><button class="btn icon danger" data-act="exdel" data-ex="${e.id}" aria-label="Quitar ${esc(e.name)}">×</button></span></div>`});
  h+=`</div><div class="row"><button class="btn" data-act="exadd">+ Añadir ejercicio</button><span style="flex:1"></span><button class="btn ghost danger" data-act="reset">Restaurar rutina original</button></div>`;
  if(S.confirmReset)h+=`<div class="confirm">Se reemplazan los 6 días por la rutina original. Tu historial de series se conserva, pero los ejercicios editados pierden el vínculo con su historial. <button class="btn danger" data-act="resetyes">Restaurar</button><button class="btn" data-act="resetno">Cancelar</button></div>`;
  h+=`<p class="small muted" style="margin:0">Cambiar el nombre mantiene el historial del ejercicio. Los cambios se guardan al salir de cada campo.</p></div>`;
  $("#dayPanel").innerHTML=h;
}

/* ---------- progress ---------- */
function renderProgress(){
  const L=S.logs[S.date]||{};
  $("#wDateLbl").textContent=S.date===todayISO()?"hoy":shortDate(S.date);
  $("#w-in").value=L.weight??"";
  const pts=Object.keys(S.logs).filter(d=>num(S.logs[d].weight)).sort().map(d=>({d,v:num(S.logs[d].weight)}));
  if(pts.length<2){$("#wChart").innerHTML=`<div class="empty">${pts.length?"Un registro guardado. ":""}Registra tu peso en ayunas 2–3 veces por semana y aquí verás la tendencia.</div>`}
  else{
    const W=640,H=200,pl=44,pr=16,pt=14,pb=26;
    let mn=Math.min(...pts.map(p=>p.v)),mx=Math.max(...pts.map(p=>p.v));mn=Math.floor(mn-0.5);mx=Math.ceil(mx+0.5);
    const t0=parseISO(pts[0].d).getTime(),t1=parseISO(pts[pts.length-1].d).getTime(),span=Math.max(1,t1-t0);
    const X=d=>pl+(parseISO(d).getTime()-t0)/span*(W-pl-pr),Y=v=>pt+(mx-v)/(mx-mn)*(H-pt-pb);
    const ticks=[];const step=Math.max(1,Math.ceil((mx-mn)/4));for(let v=mn;v<=mx;v+=step)ticks.push(v);
    const line=pts.map((p,i)=>(i?"L":"M")+X(p.d).toFixed(1)+" "+Y(p.v).toFixed(1)).join(" ");
    const area=line+` L${X(pts[pts.length-1].d).toFixed(1)} ${H-pb} L${X(pts[0].d).toFixed(1)} ${H-pb} Z`;
    const last=pts[pts.length-1],diff=last.v-pts[0].v;
    $("#wChart").innerHTML=`<p style="margin:0" class="small"><b class="num" style="font-size:20px">${last.v.toFixed(1)} kg</b> <span class="muted">· ${diff<=0?"−":"+"}${Math.abs(diff).toFixed(1)} kg desde el ${esc(shortDate(pts[0].d))}</span></p>
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolución del peso corporal">
    ${ticks.map(v=>`<line class="grid" x1="${pl}" x2="${W-pr}" y1="${Y(v)}" y2="${Y(v)}"/><text class="lbl" x="${pl-8}" y="${Y(v)+4}" text-anchor="end">${v}</text>`).join("")}
    <path class="ar" d="${area}"/><path class="ln" d="${line}"/>
    ${pts.map((p,i)=>`<circle class="${i===pts.length-1?"end":"pt"}" cx="${X(p.d)}" cy="${Y(p.v)}" r="${i===pts.length-1?5:3.5}"><title>${esc(shortDate(p.d))}: ${p.v} kg</title></circle>`).join("")}
    <text class="lbl" x="${pl}" y="${H-6}">${esc(shortDate(pts[0].d))}</text><text class="lbl" x="${W-pr}" y="${H-6}" text-anchor="end">${esc(shortDate(last.d))}</text></svg>`;
  }
  // week table
  const t=targets(),rows=[];
  for(let i=6;i>=0;i--){const dt=parseISO(S.date);dt.setDate(dt.getDate()-i);const d=isoDate(dt),e=eaten(d),L2=S.logs[d]||{};
    const ws=L2.workouts?Object.keys(L2.workouts).filter(k=>{const day=S.routine.days[k];return day&&sessionStats(L2.workouts[k],day).done>0}):[];
    const ratio=t.kcal?e.kcal/t.kcal:0;
    rows.push(`<tr><td>${esc(dt.toLocaleDateString("es-PE",{weekday:"short",day:"numeric"}))}</td>
    <td class="num">${e.kcal?fmt(e.kcal):"–"} ${e.kcal?`<span class="pill ${ratio>1.05?"hi":ratio>=0.85?"ok":""}">${r0(ratio*100)}%</span>`:""}</td>
    <td class="num">${e.p?fmt(e.p)+" g":"–"}</td><td>${ws.length?ws.map(k=>esc(S.routine.days[k].focus)).join(", "):'<span class="muted">Descanso</span>'}</td><td class="num">${L2.weight?esc(L2.weight)+" kg":"–"}</td></tr>`)}
  $("#weekTable").innerHTML=`<table><thead><tr><th>Día</th><th>Calorías vs meta</th><th>Proteína</th><th>Entreno</th><th>Peso</th></tr></thead><tbody>${rows.join("")}</tbody></table>`;
  // sessions
  const sess=[];Object.keys(S.logs).sort().reverse().forEach(d=>{const ws=S.logs[d].workouts;if(!ws)return;Object.keys(ws).forEach(k=>{const day=S.routine.days[k];if(!day)return;
    const st=sessionStats(ws[k],day);if(st.done>0||(ws[k].cardio&&ws[k].cardio.done))sess.push({d,k,day,w:ws[k],st})})});
  $("#sessList").innerHTML=sess.length?sess.map(s=>`<details class="sess"><summary><span><b>${esc(parseISO(s.d).toLocaleDateString("es-PE",{weekday:"long",day:"numeric",month:"short"}))}</b> · ${esc(s.day.focus)}</span>
    <span class="num small">${s.st.done}/${s.st.total} series · ${fmt(s.st.vol)} kg${s.w.cardio&&s.w.cardio.done?" · cardio "+esc(s.w.cardio.min||"✓")+" min":""}</span></summary><ul>
    ${s.day.exercises.map(e=>{const done=((s.w.entries||{})[e.id]||[]).filter(x=>x.done);return done.length?`<li>${esc(e.name)}: <span class="num">${done.map(x=>`${esc(x.kg||"–")}×${esc(x.reps||"–")}`).join(", ")}</span></li>`:""}).join("")}
    ${s.w.notes?`<li class="muted">Notas: ${esc(s.w.notes)}</li>`:""}</ul></details>`).join("")
    :`<div class="empty">Tus sesiones aparecerán aquí cuando marques series en Entrenamiento.</div>`;
}

function renderAll(){renderHeader();fillProfile();renderTargets();renderFood();renderDay();renderProgress();renderBackup()}

/* ---------- events ---------- */
document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>{S.tab=b.dataset.tab;try{localStorage.setItem(LKEY+".tab",S.tab)}catch(e){}renderHeader();if(S.tab==="prog")renderProgress();window.scrollTo(0,0)}));
function moveDate(n){const d=parseISO(S.date);d.setDate(d.getDate()+n);S.date=isoDate(d);pickDay();S.editing=false;renderAll()}
function pickDay(){const ws=S.logs[S.date]&&S.logs[S.date].workouts;const k=ws&&Object.keys(ws)[0];S.dayKey=k&&S.routine.days[k]?k:dayKeyFor(S.date)}
$("#prevDay").onclick=()=>moveDate(-1);$("#nextDay").onclick=()=>moveDate(1);
$("#todayBtn").onclick=()=>{S.date=todayISO();pickDay();S.editing=false;renderAll()};

const pmap={"p-peso":"peso","p-est":"estatura","p-edad":"edad","p-sexo":"sexo","p-act":"actividad","p-prot":"protKg"};
Object.keys(pmap).forEach(id=>{const el=$("#"+id);el.addEventListener("input",()=>{const f=pmap[id];
  S.profile[f]=f==="sexo"?el.value:num(el.value);S.profile.example=false;renderTargets();persist("profile")})});

$("#foodForm").addEventListener("submit",e=>{e.preventDefault();
  const name=$("#f-name").value.trim();if(!name)return;
  const p=num($("#f-p").value)||0,c=num($("#f-c").value)||0,g=num($("#f-g").value)||0;let k=num($("#f-kcal").value);if(k==null)k=p*4+c*4+g*9;
  const L=log(S.date);(L.food=L.food||[]).push({name,kcal:k,p,c,g});persist("log:"+S.date);
  e.target.reset();$("#f-name").focus();renderFood();renderBars()});

document.addEventListener("click",e=>{const b=e.target.closest("[data-act]");if(!b)return;const a=b.dataset.act,i=+b.dataset.i;
  const L=S.logs[S.date];
  if(a==="fdel"){L.food.splice(i,1);persist("log:"+S.date);renderFood();renderBars()}
  else if(a==="fav"){const x=L.food[i];S.profile.favs=(S.profile.favs||[]).filter(f=>f.name!==x.name).concat([{...x}]);persist("profile");renderFood()}
  else if(a==="favadd"){const x=S.profile.favs[i];const L2=log(S.date);(L2.food=L2.food||[]).push({...x});persist("log:"+S.date);renderFood();renderBars()}
  else if(a==="favdel"){S.profile.favs.splice(i,1);persist("profile");renderFood()}
  else if(a==="day"){S.dayKey=b.dataset.k;S.editing=false;S.confirmReset=false;renderDay()}
  else if(a==="edit"){S.editing=true;renderDay()}
  else if(a==="editdone"){S.editing=false;S.confirmReset=false;renderDay()}
  else if(a==="tick"){const w=workout(S.date,S.dayKey,true),id=b.dataset.ex,arr=w.entries[id]=w.entries[id]||[],s=arr[i]=arr[i]||{};
    const kg=$("#kg-"+id+"-"+i),rp=$("#rp-"+id+"-"+i);
    if(!s.done){if(!kg.value&&kg.placeholder)kg.value=kg.placeholder;if(!rp.value&&rp.placeholder)rp.value=rp.placeholder}
    s.kg=kg.value;s.reps=rp.value;s.done=!s.done;persist("log:"+S.date);renderDay()}
  else if(a==="cardiotick"){const w=workout(S.date,S.dayKey,true);w.cardio.done=!w.cardio.done;if(w.cardio.done&&!w.cardio.min){const m=String(S.routine.days[S.dayKey].cardio||"").match(/\d+/g);w.cardio.min=m?m[m.length-1]:""}persist("log:"+S.date);renderDay()}
  else if(a==="mv"){const ex=S.routine.days[S.dayKey].exercises,j=ex.findIndex(x=>x.id===b.dataset.ex),k=j+(+b.dataset.d);if(k<0||k>=ex.length)return;[ex[j],ex[k]]=[ex[k],ex[j]];persist("routine");renderDay()}
  else if(a==="exdel"){const d=S.routine.days[S.dayKey];d.exercises=d.exercises.filter(x=>x.id!==b.dataset.ex);persist("routine");renderDay()}
  else if(a==="exadd"){const n=ex("Nuevo ejercicio",3,"10-12");S.routine.days[S.dayKey].exercises.push(n);persist("routine");renderDay();const el=$("#ed-n-"+n.id);if(el){el.focus();el.select()}}
  else if(a==="reset"){S.confirmReset=true;renderDay()}
  else if(a==="resetno"){S.confirmReset=false;renderDay()}
  else if(a==="resetyes"){S.routine=defaultRoutine();S.confirmReset=false;S.editing=false;persist("routine");renderDay()}
});
document.addEventListener("change",e=>{const el=e.target,a=el.dataset&&el.dataset.act;if(!a)return;
  if(a==="setv"){const w=workout(S.date,S.dayKey,true),arr=w.entries[el.dataset.ex]=w.entries[el.dataset.ex]||[],s=arr[+el.dataset.i]=arr[+el.dataset.i]||{};
    s[el.dataset.f]=el.value;persist("log:"+S.date);const st=sessionStats(w,S.routine.days[S.dayKey]);const bar=document.querySelector(".sessbar");
    if(bar){bar.firstElementChild.textContent=st.done+"/"+st.total+" series";bar.lastElementChild.textContent=fmt(st.vol)+" kg vol."}}
  else if(a==="cardio"){const w=workout(S.date,S.dayKey,true);w.cardio.min=el.value;persist("log:"+S.date)}
  else if(a==="notes"){const w=workout(S.date,S.dayKey,true);w.notes=el.value;persist("log:"+S.date)}
  else if(a==="edday"){S.routine.days[S.dayKey][el.dataset.f]=el.value.trim()||S.routine.days[S.dayKey][el.dataset.f];persist("routine");renderDayTabs()}
  else if(a==="edex"){const x=S.routine.days[S.dayKey].exercises.find(z=>z.id===el.dataset.ex);if(!x)return;const f=el.dataset.f;
    x[f]=f==="sets"?Math.max(1,Math.min(10,parseInt(el.value)||1)):(el.value.trim()||x[f]);persist("routine")}
});
$("#w-save").onclick=()=>{const v=num($("#w-in").value);const L=log(S.date);if(v==null){delete L.weight}else{L.weight=v}persist("log:"+S.date);renderProgress()};
$("#w-use").onclick=()=>{const v=num($("#w-in").value);if(v==null)return;S.profile.peso=v;S.profile.example=false;persist("profile");fillProfile();renderTargets();S.tab="nutri";renderHeader();window.scrollTo(0,0)};
$("#bkExport").onclick=exportData;
$("#bkImport").addEventListener("change",e=>{const f=e.target.files&&e.target.files[0];if(f)importData(f);e.target.value=""});

/* ---------- boot ---------- */
loadLocal();
try{const t=localStorage.getItem(LKEY+".tab");if(t)S.tab=t}catch(e){}
pickDay();renderAll();idleStatus();
if(navigator.storage&&navigator.storage.persist){navigator.storage.persist().catch(()=>{})}
if("serviceWorker" in navigator&&location.protocol!=="file:"){window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}))}
})();
