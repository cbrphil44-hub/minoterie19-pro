
const App=(()=>{
const STORE="recette19_v8_donnees_protegees";
const LEGACY=["recette19_v8_donnees_protegees","recette19_donnees_utilisateur_stables_v7","recette19_donnees_stables","recette19_single_v51","recette19_v6","recette19_v52","recette19_v51","recette19_v5","recette19_v4","application_recette_19_v30","minoterie19_pro_v1","m19pro_v1"];
const INIT=window.RECETTE19_INITIAL||window.APP_INITIAL_DATA||{};
const URL=INIT.officialUrl||"https://application-recette-19.netlify.app";
let current="Toutes",saveTimer=null,mode="admin";
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const parse=v=>{if(typeof v==="number")return Number.isFinite(v)?v:0;if(v==null)return 0;let s=String(v).trim().replace(/\s/g,"").replace(",",".");if(s===""||s==="-"||s===".")return 0;let n=Number(s);return Number.isFinite(n)?n:0};
const rnd=(n,d)=>{let p=10**d;return Math.round(parse(n)*p)/p};
const euro=n=>(parse(n)||0).toLocaleString("fr-FR",{style:"currency",currency:"EUR"});
const num=(n,d=2)=>(parse(n)||0).toLocaleString("fr-FR",{minimumFractionDigits:d,maximumFractionDigits:d});

function loadDB(){
  for(const key of LEGACY){
    const raw=localStorage.getItem(key);
    if(!raw)continue;
    try{
      const d=JSON.parse(raw);
      if(d&&Array.isArray(d.recipes)&&Array.isArray(d.families)){
        localStorage.setItem(STORE,JSON.stringify(d));
        return d;
      }
    }catch(e){}
  }
  return structuredClone(INIT);
}
let db=loadDB();

function norm(r){
  if(!r.id)r.id="recette19-user-"+Date.now()+"-"+Math.random().toString(16).slice(2);
  if(!r.family)r.family=(db.families&&db.families[0])||"Pain";
  if(r.selected===undefined)r.selected=false;
  if(r.publish===undefined)r.publish=false;
  if(!r.source)r.source=String(r.id).includes("official")?"officielle":"personnelle";
  if(!r.recipeVersion)r.recipeVersion=1;
  if(!r.priceMode)r.priceMode="piece";
  if(r.costKgHT===undefined)r.costKgHT=r.weightG?rnd(r.costPieceHT*1000/r.weightG,3):0;
  return r;
}
function mergeOfficialData(){
  if(!db.families)db.families=[];
  if(!db.recipes)db.recipes=[];
  (INIT.families||[]).forEach(f=>{if(!db.families.includes(f))db.families.push(f)});
  const byId=new Map(db.recipes.map(r=>[String(r.id||""),r]));
  const byNameFam=new Map(db.recipes.map(r=>[`${String(r.name||"").toLowerCase()}||${String(r.family||"").toLowerCase()}`,r]));
  (INIT.recipes||[]).forEach(official=>{
    norm(official); official.source="officielle";
    const key=`${String(official.name||"").toLowerCase()}||${String(official.family||"").toLowerCase()}`;
    const existing=byId.get(String(official.id))||byNameFam.get(key);
    if(!existing){
      const copy=structuredClone(official);
      copy.selected=false;copy.publish=false;
      db.recipes.push(copy);
    }else{
      if(existing.selected===undefined)existing.selected=false;
      if(existing.publish===undefined)existing.publish=false;
      if(!existing.source)existing.source="officielle";
      if(!existing.recipeVersion)existing.recipeVersion=official.recipeVersion||1;
    }
  });
  db.version=INIT.version||"8.0.0";
  db.officialUrl=URL;
  db.storageMode="protected-user-data-v8";
  db.updatedAt=new Date().toISOString();
  db.recipes.forEach(norm);
}
mergeOfficialData();

function calc(r){
  norm(r);
  let t=parse(r.priceTTC),w=parse(r.weightG),vat=parse(r.vat),cost=parse(r.costPieceHT);
  let kg=w?t*1000/w:0,ht=t/(1+vat/100),ckg=w?cost*1000/w:0,mh=ht-cost,mt=t-(cost*(1+vat/100)),mp=ht?mh/ht*100:0,coef=cost?ht/cost:0;
  return{kg,ht,ckg,mh,mt,mp,coef};
}
function sync(r,f){
  norm(r);
  ["priceTTC","priceKgTTC","weightG","vat","costPieceHT","costKgHT","coef"].includes(f)&&(r[f]=Math.max(0,parse(r[f])));
  let w=parse(r.weightG),oldKg=parse(r.costKgHT);
  if(f==="priceKgTTC"){r.priceMode="kg";r.priceTTC=w?rnd(parse(r.priceKgTTC)*w/1000,2):0}
  if(f==="priceTTC"){r.priceMode="piece";r.priceKgTTC=w?rnd(parse(r.priceTTC)*1000/w,2):0}
  if(f==="costPieceHT")r.costKgHT=w?rnd(parse(r.costPieceHT)*1000/w,3):0;
  if(f==="costKgHT")r.costPieceHT=w?rnd(parse(r.costKgHT)*w/1000,3):0;
  if(f==="weightG"){
    if(r.priceMode==="kg")r.priceTTC=w?rnd(parse(r.priceKgTTC)*w/1000,2):0;
    else r.priceKgTTC=w?rnd(parse(r.priceTTC)*1000/w,2):0;
    r.costPieceHT=w?rnd(oldKg*w/1000,3):0;
  }
  if(f==="coef"){
    let ht=parse(r.priceTTC)/(1+parse(r.vat)/100),coef=parse(r.coef);
    if(coef>0){r.costPieceHT=rnd(ht/coef,3);r.costKgHT=w?rnd(r.costPieceHT*1000/w,3):0}
  }
  let c=calc(r);r.priceKgTTC=rnd(c.kg,2);r.costKgHT=rnd(c.ckg,3);r.coef=rnd(c.coef,2);
}
function save(){
  localStorage.setItem(STORE,JSON.stringify(db));
  const st=$("status");if(st){st.textContent="Sauvegardé automatiquement ✓";st.className="saved";}
}
function autoSave(){
  clearTimeout(saveTimer);
  const st=$("status");if(st){st.textContent="Sauvegarde en cours...";st.className="unsaved";}
  saveTimer=setTimeout(save,250);
}
function color(m){return m>=80?"green":m>=75?"orange":"red"}

function renderFamilies(){
  let box=$("familiesList");if(!box)return;
  box.innerHTML="";
  ["Toutes",...db.families].forEach(f=>{
    let count=f==="Toutes"?db.recipes.length:db.recipes.filter(r=>r.family===f).length;
    let line=document.createElement("div");line.className="familyLine";
    let main=document.createElement("button");main.className="familyBtn "+(f===current?"active":"");
    main.innerHTML=`<span>${esc(f)}</span><b>${count}</b>`;
    main.onclick=()=>{current=f;render()};
    line.appendChild(main);
    if(f!=="Toutes"&&mode==="admin"){
      let edit=document.createElement("button");edit.className="secondary smallBtn";edit.textContent="✏️";edit.onclick=()=>renameFamilyPrompt(f);
      let del=document.createElement("button");del.className="danger smallBtn";del.textContent="🗑";del.onclick=()=>deleteFamily(f);
      line.appendChild(edit);line.appendChild(del);
    }else{
      line.appendChild(document.createElement("span"));line.appendChild(document.createElement("span"));
    }
    box.appendChild(line);
  });
}
function render(){
  renderFamilies();
  const search=$("search");
  let q=(search?search.value:"").toLowerCase().trim();
  let list=db.recipes.filter(r=>(current==="Toutes"||r.family===current)&&(!q||r.name.toLowerCase().includes(q)||r.family.toLowerCase().includes(q)));
  let sel=list.filter(r=>r.selected),pub=list.filter(r=>r.publish),base=sel.length?sel:list;
  let sm=base.reduce((a,r)=>a+calc(r).mp,0),mt=base.reduce((a,r)=>a+calc(r).mt,0);
  const summary=$("summary");
  if(summary)summary.innerHTML=`<div class="pill">Mode : <b>${mode==="admin"?"Admin":"Utilisateur"}</b></div><div class="pill">Famille : <b>${esc(current)}</b></div><div class="pill">Recettes : <b>${list.length}</b></div><div class="pill">Sélection marge : <b>${sel.length}</b></div><div class="pill">À publier : <b>${pub.length}</b></div><div class="pill">Marge moyenne : <b>${base.length?num(sm/base.length,1):"0,0"} %</b></div><div class="pill">100 pièces : <b>${euro(mt*100)}</b></div>`;
  const listBox=$("list");if(!listBox)return;
  listBox.innerHTML="";list.forEach(r=>listBox.appendChild(card(r)));
}
function inp(i,k,l,v,t="number"){return`<div><label>${l}</label><input type="${t}" step="0.001" value="${esc(v)}" onchange="App.update(${i},'${k}',this.value)"></div>`}
function card(r){
  let i=db.recipes.indexOf(r),c=calc(r),d=document.createElement("div");d.className="recipe";
  const publishBox=mode==="admin"?`<label class="checkItem"><input title="Publier cette recette" type="checkbox" ${r.publish?"checked":""} onchange="App.update(${i},'publish',this.checked)"> À publier</label>`:"";
  d.innerHTML=`<div class="checks"><label class="checkItem"><input type="checkbox" ${r.selected?"checked":""} onchange="App.update(${i},'selected',this.checked)"> Sélection marge</label>${publishBox}</div><div class="recipeTitleBox"><input value="${esc(r.name)}" onchange="App.update(${i},'name',this.value)"></div><div class="grid"><div><label>Famille</label><select onchange="App.update(${i},'family',this.value)">${db.families.map(f=>`<option value="${esc(f)}" ${f===r.family?"selected":""}>${esc(f)}</option>`).join("")}</select></div>${inp(i,"priceTTC","Prix TTC",r.priceTTC)}${inp(i,"priceKgTTC","Prix/kg TTC",r.priceKgTTC)}${inp(i,"weightG","Poids g",r.weightG)}${inp(i,"vat","TVA %",r.vat)}<div><label>Prix HT</label><div class="readonly">${euro(c.ht)}</div></div><div><label>Coût/kg HT</label><div class="readonly">${euro(c.ckg)}</div></div>${inp(i,"costPieceHT","Coût pièce HT",r.costPieceHT)}${inp(i,"coef","Coefficient",rnd(c.coef,2))}<div><label>Marge € HT</label><div class="readonly">${euro(c.mh)}</div></div><div><label>Marge € TTC</label><div class="readonly">${euro(c.mt)}</div></div></div><div class="actions"><span class="badge ${color(c.mp)}">${num(c.mp,1)} %</span><div><button class="copy" onclick="App.dup(${i})">Dupliquer</button><button class="danger" onclick="App.del(${i})">Supprimer</button></div></div>`;
  return d;
}
function update(i,k,v){
  let r=db.recipes[i];
  if(k==="selected"||k==="publish")r[k]=v;
  else if(k==="name"||k==="family")r[k]=v;
  else{r[k]=parse(v);sync(r,k)}
  autoSave();render();
}
function newFamily(){
  let f=prompt("Nom de la nouvelle famille");if(!f)return;f=f.trim();if(!f)return;
  if(db.families.includes(f))return alert("Cette famille existe déjà.");
  db.families.push(f);current=f;autoSave();render();
}
function renameFamilyPrompt(oldName){let n=prompt("Nouveau nom de la famille",oldName);if(!n)return;renameFamily(oldName,n)}
function renameFamily(oldName,newName){
  newName=(newName||"").trim();if(!newName||oldName===newName)return;
  if(db.families.includes(newName))return alert("Cette famille existe déjà.");
  if(!confirm(`Renommer la famille "${oldName}" en "${newName}" ?`))return;
  db.families=db.families.map(f=>f===oldName?newName:f);
  db.recipes.forEach(r=>{if(r.family===oldName)r.family=newName});
  if(current===oldName)current=newName;autoSave();render();
}
function deleteFamily(f){
  let count=db.recipes.filter(r=>r.family===f).length;
  if(!confirm(`Confirmer la suppression de la famille "${f}" ?`))return;
  if(count>0){
    let others=db.families.filter(x=>x!==f);
    if(!others.length)return alert("Impossible : crée une autre famille avant de supprimer celle-ci.");
    let target=prompt(`Cette famille contient ${count} recette(s).\nVers quelle famille déplacer les recettes ?`,others[0]);
    if(!target)return;
    if(!db.families.includes(target))db.families.push(target);
    db.recipes.forEach(r=>{if(r.family===f)r.family=target});
  }
  db.families=db.families.filter(x=>x!==f);current="Toutes";autoSave();render();
}
function newRecipe(){
  let n=prompt("Nom de la nouvelle recette","Nouvelle recette");if(!n)return;
  let fam=current!=="Toutes"?current:(db.families[0]||"Pain");
  db.recipes.unshift({id:"recette19-user-"+Date.now(),source:"personnelle",recipeVersion:1,name:n.trim(),family:fam,selected:false,publish:false,priceTTC:1,priceKgTTC:4,weightG:250,vat:5.5,costPieceHT:.15,costKgHT:.6,coef:6.35,priceMode:"piece"});
  current=fam;autoSave();render();
}
function dup(i){
  let r=structuredClone(db.recipes[i]);r.id="recette19-user-"+Date.now();r.name+=" copie";r.source="personnelle";r.publish=false;db.recipes.splice(i+1,0,r);autoSave();render();
}
function del(i){
  let r=db.recipes[i];
  if(confirm(`Confirmer la suppression de la recette "${r.name}" ?`)){db.recipes.splice(i,1);autoSave();render()}
}
function modal(h){$("modalContent").innerHTML=h;$("modal").style.display="flex"}
function closeModal(){$("modal").style.display="none"}

function openPublish(){
  if(mode!=="admin")return alert("La publication est réservée au mode Admin.");
  let selected=db.recipes.filter(r=>r.publish);
  modal(`<h2>Créer une mise à jour</h2><div class="box publish"><b>${selected.length} recette(s) cochée(s) pour publication</b><p>Coche les recettes à publier avec la case “À publier”.</p></div><div class="box">${selected.map(r=>`• ${esc(r.family)} — ${esc(r.name)} v${r.recipeVersion||1}`).join("<br>")||"Aucune recette cochée."}</div><div class="row"><button onclick="App.exportUpdate()">Créer le fichier de mise à jour</button><label class="uploadBtn">Importer une mise à jour<input type="file" accept=".json" onchange="App.importUpdate(event)"></label><button class="secondary" onclick="App.closeModal()">Fermer</button></div>`);
}
function exportUpdate(){
  let selected=db.recipes.filter(r=>r.publish);
  if(!selected.length)return alert("Aucune recette cochée pour publication.");
  let pack={type:"recette19-update",createdAt:new Date().toISOString(),families:[...new Set(selected.map(r=>r.family))],recipes:selected.map(r=>structuredClone(r))};
  pack.recipes.forEach(r=>{r.publish=false;r.selected=false});
  let b=new Blob([JSON.stringify(pack,null,2)],{type:"application/json"}),a=document.createElement("a");
  a.href=URL.createObjectURL(b);a.download="mise_a_jour_recettes_19.json";a.click();
}
function importUpdate(e){
  let f=e.target.files[0];if(!f)return;
  let fr=new FileReader();fr.onload=()=>{
    try{
      let pack=JSON.parse(fr.result);
      if(pack.type!=="recette19-update"||!pack.recipes)return alert("Fichier de mise à jour invalide.");
      let added=0,updated=0,skipped=0;
      pack.families?.forEach(f=>{if(!db.families.includes(f))db.families.push(f)});
      pack.recipes.forEach(nr=>{
        norm(nr);nr.publish=false;nr.selected=false;
        let existing=db.recipes.find(r=>r.id===nr.id);
        if(existing){
          if((nr.recipeVersion||1)>(existing.recipeVersion||1)){
            if(confirm(`Mettre à jour "${nr.name}" ?`)){Object.assign(existing,nr);updated++}else skipped++;
          }else skipped++;
        }else{db.recipes.push(nr);added++}
      });
      save();closeModal();render();alert(`Mise à jour installée : ${added} ajoutée(s), ${updated} mise(s) à jour, ${skipped} ignorée(s).`);
    }catch(err){alert("Fichier invalide.")}
  };fr.readAsText(f);
}

function openClientSend(){
  const options=db.recipes.map((r,i)=>`<option value="${i}">${esc(r.family)} — ${esc(r.name)}</option>`).join("");
  modal(`<h2>Envoyer une recette client</h2><div class="box"><p>Choisis une recette. Tu peux tenter un envoi automatique via Netlify Forms ou créer un fichier JSON de secours.</p><label>Recette à envoyer</label><select id="clientRecipeSelect">${options}</select></div><div class="row"><button onclick="App.sendClientRecipeOnline()">Envoyer automatiquement</button><button onclick="App.exportClientRecipe()">Créer fichier JSON</button><button class="copy" onclick="App.shareClientRecipeText()">Partager résumé</button><button class="secondary" onclick="App.closeModal()">Fermer</button></div><p id="modalInfo" class="small"></p>`);
}
async function sendClientRecipeOnline(){
  const idx=parse(document.getElementById("clientRecipeSelect")?.value);const r=db.recipes[idx];if(!r)return alert("Aucune recette sélectionnée.");
  const c=calc(r);
  const pack={type:"recette19-client-recipe",createdAt:new Date().toISOString(),from:"client",recipe:structuredClone(r)};
  pack.recipe.publish=false;pack.recipe.selected=false;
  const resume=`Famille : ${r.family}\nNom : ${r.name}\nPrix TTC : ${r.priceTTC}\nPrix/kg TTC : ${r.priceKgTTC}\nPoids : ${r.weightG} g\nCoût pièce HT : ${r.costPieceHT}\nCoût/kg HT : ${r.costKgHT}\nMarge : ${num(c.mp,1)} %\nMarge HT : ${euro(c.mh)}\nMarge TTC : ${euro(c.mt)}`;
  const body=new URLSearchParams();body.append("form-name","recette-client");body.append("nom_recette",r.name||"");body.append("famille",r.family||"");body.append("donnees_json",JSON.stringify(pack,null,2));body.append("resume",resume);
  try{
    const res=await fetch("/",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:body.toString()});
    const info=document.getElementById("modalInfo");
    if(res.ok){if(info)info.textContent="Recette envoyée automatiquement. Voir Netlify → Forms → recette-client.";alert("Recette envoyée automatiquement.");}
    else throw new Error("Erreur envoi");
  }catch(e){alert("Envoi automatique impossible. Utilise le JSON ou le résumé.");}
}
function exportClientRecipe(){
  const idx=parse(document.getElementById("clientRecipeSelect")?.value);const r=db.recipes[idx];if(!r)return alert("Aucune recette sélectionnée.");
  const pack={type:"recette19-client-recipe",createdAt:new Date().toISOString(),from:"client",recipe:structuredClone(r)};
  pack.recipe.publish=false;pack.recipe.selected=false;
  const b=new Blob([JSON.stringify(pack,null,2)],{type:"application/json"}),a=document.createElement("a");
  a.href=URL.createObjectURL(b);a.download=`recette_client_${String(r.name||"recette").replace(/[^a-z0-9-_]+/gi,"_")}.json`;a.click();
}
async function shareClientRecipeText(){
  const idx=parse(document.getElementById("clientRecipeSelect")?.value);const r=db.recipes[idx];if(!r)return alert("Aucune recette sélectionnée.");
  const c=calc(r);
  const text=`Recette client à intégrer\n\nFamille : ${r.family}\nNom : ${r.name}\nPrix TTC : ${r.priceTTC}\nPrix/kg TTC : ${r.priceKgTTC}\nPoids : ${r.weightG} g\nCoût pièce HT : ${r.costPieceHT}\nCoût/kg HT : ${r.costKgHT}\nMarge : ${num(c.mp,1)} %`;
  if(navigator.share){try{await navigator.share({title:"Recette client",text});}catch(e){}}else{navigator.clipboard?.writeText(text);alert("Résumé copié.")}
}
function importClientRecipe(e){
  let f=e.target.files[0];if(!f)return;
  let fr=new FileReader();fr.onload=()=>{
    try{
      let pack=JSON.parse(fr.result);if(pack.type!=="recette19-client-recipe"||!pack.recipe)return alert("Fichier recette client invalide.");
      let r=pack.recipe;norm(r);if(!db.families.includes(r.family))db.families.push(r.family);
      r.id="recette19-client-"+Date.now();r.source="client";r.publish=false;r.selected=false;db.recipes.unshift(r);current=r.family;save();closeModal();render();alert("Recette client importée.");
    }catch(err){alert("Fichier invalide.")}
  };fr.readAsText(f);
}

function settings(){
  modal(`<h2>Paramètres</h2><div class="box"><b>Version ${INIT.version||"8.0.0"}</b><br><b>Données protégées V8 Pro</b><br>Les mises à jour n’écrasent plus les recettes, familles, prix ou poids déjà enregistrés.</div><div class="box"><b>Mode</b><div class="row"><button onclick="App.setMode('admin')">Mode Admin</button><button class="secondary" onclick="App.setMode('user')">Mode Utilisateur</button></div></div><div class="box"><b>Sauvegarde / Import</b><div class="row"><button onclick="App.exportJSON()">Sauvegarde complète JSON</button><label class="uploadBtn">Restaurer JSON<input type="file" accept=".json" onchange="App.importJSON(event)"></label><label class="uploadBtn">Importer mise à jour<input type="file" accept=".json" onchange="App.importUpdate(event)"></label><label class="uploadBtn">Importer recette client<input type="file" accept=".json" onchange="App.importClientRecipe(event)"></label><button onclick="App.exportCSV()">Export CSV</button></div></div><button class="secondary" onclick="App.closeModal()">Fermer</button>`);
}
function setMode(m){mode=m==="user"?"user":"admin";closeModal();render();autoSave();}
function share(){
  modal(`<h2>Partager</h2><div class="box"><b>Partager l’application</b><br>${URL}</div><div class="box"><b>Partager seulement certaines recettes</b><br>Coche les recettes “À publier”, puis clique sur Créer mise à jour.</div><div class="row"><button onclick="App.shareLink()">Partager le lien</button><button class="secondary" onclick="App.copyLink()">Copier</button><button class="secondary" onclick="App.closeModal()">Fermer</button></div><p id="modalInfo" class="small"></p>`);
}
async function shareLink(){if(navigator.share){try{await navigator.share({title:"Application Recette 19",text:"Calculateur de prix de revient et marge.",url:URL})}catch(e){}}else copyLink()}
function copyLink(){navigator.clipboard?.writeText(`Application Recette 19\n${URL}`);let i=document.getElementById("modalInfo");if(i)i.textContent="Lien copié."}
function exportJSON(){save();let b=new Blob([JSON.stringify(db,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="sauvegarde_complete_recette19.json";a.click()}
function importJSON(e){let f=e.target.files[0];if(!f)return;let r=new FileReader();r.onload=()=>{try{let imported=JSON.parse(r.result);if(!imported.recipes||!imported.families)return alert("Fichier invalide.");db=imported;db.recipes.forEach(norm);save();closeModal();render();alert("Sauvegarde restaurée.")}catch(err){alert("Fichier invalide.")}};r.readAsText(f)}
function exportCSV(){let rows=[["Famille","Selection","Publier","Source","Version","Nom","Prix TTC","Prix/kg TTC","Poids","Prix HT","Cout piece HT","Cout/kg HT","Marge %","Marge HT","Marge TTC","Coef"]];db.recipes.forEach(r=>{let c=calc(r);rows.push([r.family,r.selected?"Oui":"Non",r.publish?"Oui":"Non",r.source,r.recipeVersion,r.name,r.priceTTC,r.priceKgTTC,r.weightG,c.ht,r.costPieceHT,c.ckg,c.mp,c.mh,c.mt,c.coef])});let csv=rows.map(r=>r.map(x=>`"${String(x).replaceAll('"','""')}"`).join(";")).join("\n"),b=new Blob([csv],{type:"text/csv;charset=utf-8"}),a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="recette19.csv";a.click()}
function installHelp(){modal(`<h2>Installer l’application</h2><div class="box"><b>iPhone</b><br>Ouvre le lien dans Safari → bouton Partager → Sur l’écran d’accueil.</div><div class="box"><b>Samsung / Android</b><br>Ouvre le lien dans Chrome → menu ⋮ → Ajouter à l’écran d’accueil.</div><button class="secondary" onclick="App.closeModal()">Fermer</button>`)}
function hideInstall(){$("installBox").style.display="none";localStorage.setItem("recette19_install_hidden","1")}
if(localStorage.getItem("recette19_install_hidden")==="1" && $("installBox"))$("installBox").style.display="none";
if("serviceWorker"in navigator&&location.protocol!=="file:")navigator.serviceWorker.register("./service-worker.js").catch(()=>{});
save();render();
return{render,save,newFamily,newRecipe,update,dup,del,settings,closeModal,renameFamily,renameFamilyPrompt,deleteFamily,share,shareLink,copyLink,exportJSON,importJSON,exportCSV,installHelp,hideInstall,openPublish,exportUpdate,importUpdate,openClientSend,sendClientRecipeOnline,exportClientRecipe,shareClientRecipeText,importClientRecipe,setMode};
})();
