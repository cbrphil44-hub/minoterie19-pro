const App = (() => {
  const STORE = "minoterie19_pro_v2";
  const DEFAULTS = window.M19_INITIAL_DATA;
  let db = JSON.parse(localStorage.getItem(STORE) || "null") || structuredClone(DEFAULTS);
  let dirty = false;
  let currentFamily = "";

  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const euro = n => (Number(n)||0).toLocaleString("fr-FR",{style:"currency",currency:"EUR"});
  const num = (n,d=2) => (Number(n)||0).toLocaleString("fr-FR",{minimumFractionDigits:d,maximumFractionDigits:d});
  const rnd = (n,d) => { const p=10**d; return Math.round((Number(n)||0)*p)/p; };
  const pos = n => Math.max(0, Number(n)||0);

  function markDirty(){ dirty=true; $("status").textContent="Modifications non sauvegardées"; $("status").className="unsaved"; }
  function save(){ localStorage.setItem(STORE, JSON.stringify(db)); dirty=false; $("status").textContent="Sauvegardé ✓"; $("status").className="saved"; }
  window.addEventListener("beforeunload", e => { if(dirty){e.preventDefault(); e.returnValue="";} });

  function norm(r){
    if(!r.id) r.id = "r"+Date.now()+Math.random();
    if(!r.family) r.family = db.families[0] || "Pain";
    if(r.selected === undefined) r.selected = false;
    if(!r.priceMode) r.priceMode = "piece";
    return r;
  }
  db.recipes.forEach(norm);

  function calc(r){
    norm(r);
    const ttc=Number(r.priceTTC)||0, w=Number(r.weightG)||0, vat=Number(r.vat)||0, cost=Number(r.costPieceHT)||0;
    const kg = w ? ttc*1000/w : 0;
    const ht = ttc/(1+vat/100);
    const costKg = w ? cost*1000/w : 0;
    const marginHT = ht-cost;
    const marginTTC = ttc-(cost*(1+vat/100));
    const marginPct = ht ? marginHT/ht*100 : 0;
    const coef = cost ? ht/cost : 0;
    return {kg, ht, costKg, marginHT, marginTTC, marginPct, coef};
  }

  function sync(r, field){
    norm(r);
    if(["priceTTC","priceKgTTC","weightG","vat","costPieceHT","coef"].includes(field)) r[field]=pos(r[field]);
    if(field==="priceKgTTC"){ r.priceMode="kg"; r.priceTTC = r.weightG ? rnd(r.priceKgTTC*r.weightG/1000,2) : 0; }
    if(field==="priceTTC"){ r.priceMode="piece"; r.priceKgTTC = r.weightG ? rnd(r.priceTTC*1000/r.weightG,2) : 0; }
    if(field==="weightG"){
      if(r.priceMode==="kg") r.priceTTC = r.weightG ? rnd(r.priceKgTTC*r.weightG/1000,2) : 0;
      else r.priceKgTTC = r.weightG ? rnd(r.priceTTC*1000/r.weightG,2) : 0;
      r.costPieceHT = rnd((Number(r.costKgHT)||0)*r.weightG/1000,3);
    }
    if(field==="costPieceHT") r.costKgHT = r.weightG ? rnd(r.costPieceHT*1000/r.weightG,3) : 0;
    if(field==="coef"){
      const ht = r.priceTTC/(1+r.vat/100);
      if(r.coef>0){
        r.costPieceHT = rnd(ht/r.coef,3);
        r.costKgHT = r.weightG ? rnd(r.costPieceHT*1000/r.weightG,3) : 0;
      }
    }
    const c=calc(r);
    r.priceKgTTC=rnd(c.kg,2);
    r.costKgHT=rnd(c.costKg,3);
    r.coef=rnd(c.coef,2);
  }

  function color(m){ return m>=80 ? "green" : m>=75 ? "orange" : "red"; }
  function showOnly(view){
    ["homeView","recipesView","clientView"].forEach(id => $(id).classList.add("hidden"));
    $(view).classList.remove("hidden");
  }
  function showHome(){ showOnly("homeView"); renderHome(); }
  function showClient(){ showOnly("clientView"); renderClient(); }

  function renderHome(){
    const total=db.recipes.length;
    const sm=db.recipes.reduce((a,r)=>a+calc(r).marginPct,0);
    $("globalSummary").innerHTML = `<div class="pill">Familles : <b>${db.families.length}</b></div><div class="pill">Recettes : <b>${total}</b></div><div class="pill">Marge moyenne : <b>${total?num(sm/total,1):"0,0"} %</b></div>`;
    $("dashboard").innerHTML="";
    db.families.forEach(f=>{
      const list=db.recipes.filter(r=>norm(r).family===f);
      const m=list.reduce((a,r)=>a+calc(r).marginPct,0);
      const d=document.createElement("div");
      d.className="familyCard";
      d.onclick=()=>openFamily(f);
      d.innerHTML=`<b>${esc(f)}</b><span>${list.length} recette(s)</span><span>Marge moy. ${list.length?num(m/list.length,1):"0,0"} %</span>`;
      $("dashboard").appendChild(d);
    });
  }
  function openFamily(f){ currentFamily=f; $("familyTitle").textContent=f; $("searchInput").value=""; showOnly("recipesView"); renderRecipes(); }

  function renderRecipes(){
    const q=($("searchInput").value||"").toLowerCase();
    const list=db.recipes.filter(r=>norm(r).family===currentFamily && (!q || r.name.toLowerCase().includes(q)));
    const selected=list.filter(r=>r.selected);
    const base=selected.length ? selected : list;
    const sm=base.reduce((a,r)=>a+calc(r).marginPct,0);
    const mt=base.reduce((a,r)=>a+calc(r).marginTTC,0);
    $("familySummary").innerHTML=`<div class="pill">Recettes : <b>${list.length}</b></div><div class="pill">Sélection client : <b>${selected.length}</b></div><div class="pill">Marge moy. : <b>${base.length?num(sm/base.length,1):"0,0"} %</b></div><div class="pill">100 pièces : <b>${euro(mt*100)}</b></div><div class="pill">1000 pièces : <b>${euro(mt*1000)}</b></div>`;
    $("recipeList").innerHTML="";
    list.forEach(r=>$("recipeList").appendChild(card(r)));
  }

  function inp(i,k,l,v,t="number"){
    return `<div><label>${l}</label><input type="${t}" step="0.001" value="${esc(v)}" onchange="App.updateRecipe(${i},'${k}',this.value)"></div>`;
  }
  function card(r){
    const i=db.recipes.indexOf(r), c=calc(r);
    const d=document.createElement("div"); d.className="recipeCard";
    d.innerHTML=`<div class="topLine"><input type="checkbox" ${r.selected?"checked":""} onchange="App.updateRecipe(${i},'selected',this.checked)"><div class="title">${esc(r.name)}</div></div>
    <div class="grid">
      ${inp(i,"name","Nom",r.name,"text")}
      <div><label>Famille</label><select onchange="App.updateRecipe(${i},'family',this.value)">${db.families.map(f=>`<option value="${esc(f)}" ${f===r.family?"selected":""}>${esc(f)}</option>`).join("")}</select></div>
      ${inp(i,"priceTTC","Prix TTC",r.priceTTC)}${inp(i,"priceKgTTC","Prix/kg TTC",r.priceKgTTC)}${inp(i,"weightG","Poids g",r.weightG)}${inp(i,"vat","TVA %",r.vat)}
      <div><label>Prix HT</label><div class="readonly">${euro(c.ht)}</div></div>
      <div><label>Coût/kg HT</label><div class="readonly">${euro(c.costKg)}</div></div>
      ${inp(i,"costPieceHT","Coût pièce HT",r.costPieceHT)}${inp(i,"coef","Coefficient",rnd(c.coef,2))}
      <div><label>Marge € HT</label><div class="readonly">${euro(c.marginHT)}</div></div>
      <div><label>Marge € TTC</label><div class="readonly">${euro(c.marginTTC)}</div></div>
    </div>
    <div class="actions"><span class="badge ${color(c.marginPct)}">${num(c.marginPct,1)} %</span><div><button class="copy" onclick="App.duplicateRecipe(${i})">Dupliquer</button><button class="danger" onclick="App.deleteRecipe(${i})">Supprimer</button></div></div>`;
    return d;
  }
  function updateRecipe(i,k,v){
    const r=db.recipes[i];
    if(k==="selected") r.selected=v;
    else if(k==="name" || k==="family") r[k]=v;
    else { r[k]=Number(v)||0; sync(r,k); }
    markDirty(); renderRecipes();
  }
  function addRecipe(){
    db.recipes.push({id:"r"+Date.now(),name:"Nouvelle recette",family:currentFamily,selected:false,priceTTC:1,priceKgTTC:4,weightG:250,vat:5.5,costPieceHT:.15,costKgHT:.6,coef:6.35,priceMode:"piece"});
    markDirty(); renderRecipes();
  }
  function duplicateRecipe(i){ const r=structuredClone(db.recipes[i]); r.id="r"+Date.now(); r.name += " copie"; db.recipes.splice(i+1,0,r); markDirty(); renderRecipes(); }
  function deleteRecipe(i){ if(confirm("Supprimer cette recette ?")){ db.recipes.splice(i,1); markDirty(); renderRecipes(); } }

  function setClient(k,v){ db.client[k]=v; markDirty(); renderClient(); }
  function renderClient(){
    $("clientBakery").value=db.client.bakery||"";
    $("clientManager").value=db.client.manager||"";
    $("clientPhone").value=db.client.phone||"";
    $("clientDate").value=db.client.date||"";
    $("clientNotes").value=db.client.notes||"";
    const s=db.recipes.filter(r=>r.selected), sm=s.reduce((a,r)=>a+calc(r).marginPct,0);
    $("clientSummary").innerHTML=`<div class="pill">Recettes sélectionnées : <b>${s.length}</b></div><div class="pill">Marge moyenne client : <b>${s.length?num(sm/s.length,1):"0,0"} %</b></div>`;
  }

  function openFamilies(){
    modal(`<h2>Gérer les familles</h2><div class="row"><div class="grow"><label>Nouvelle famille</label><input id="newFamilyName" placeholder="Ex : Snacking, Cakes..."></div><button onclick="App.addFamily()">Ajouter</button></div><div id="familyManager"></div><div class="actions"><span></span><button class="secondary" onclick="App.closeModal()">Fermer</button></div>`);
    renderFamilyManager();
  }
  function renderFamilyManager(){
    const box=$("familyManager"); if(!box) return; box.innerHTML="";
    db.families.forEach(f=>{
      const count=db.recipes.filter(r=>r.family===f).length;
      const d=document.createElement("div"); d.className="box";
      d.innerHTML=`<div class="row"><div class="grow"><label>Famille (${count})</label><input value="${esc(f)}" onchange="App.renameFamily('${esc(f)}',this.value)"></div><button class="danger" onclick="App.deleteFamily('${esc(f)}')">Supprimer</button></div>`;
      box.appendChild(d);
    });
  }
  function addFamily(){ const n=($("newFamilyName").value||"").trim(); if(!n) return; if(!db.families.includes(n)) db.families.push(n); markDirty(); renderFamilyManager(); renderHome(); }
  function renameFamily(oldName,newName){ newName=(newName||"").trim(); if(!newName||oldName===newName) return; if(db.families.includes(newName)) return alert("Cette famille existe déjà."); db.families=db.families.map(f=>f===oldName?newName:f); db.recipes.forEach(r=>{if(r.family===oldName) r.family=newName;}); markDirty(); renderFamilyManager(); renderHome(); }
  function deleteFamily(f){ if(db.families.length<=1) return alert("Il faut garder une famille."); const target=prompt("Déplacer les recettes vers quelle famille ?", db.families.find(x=>x!==f)||"Pain"); if(!target) return; if(!db.families.includes(target)) db.families.push(target); db.recipes.forEach(r=>{if(r.family===f) r.family=target;}); db.families=db.families.filter(x=>x!==f); markDirty(); renderFamilyManager(); renderHome(); }

  function modal(html){ $("modalContent").innerHTML=html; $("modal").style.display="flex"; }
  function closeModal(){ $("modal").style.display="none"; }
  function openShare(){
    const url=DEFAULTS.officialUrl;
    modal(`<h2>Partager l’application</h2><p>Partage directement ce lien officiel :</p><div class="box"><b>${url}</b></div><div class="box"><b>Message prêt :</b><br>Minoterie 19 Pro — calculateur de prix de revient et de marge.<br>${url}</div><div style="text-align:center"><img class="qr" src="https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(url)}"></div><div class="row"><button onclick="App.shareLink()">Partager</button><button class="secondary" onclick="App.copyLink()">Copier le lien</button><button class="secondary" onclick="App.closeModal()">Fermer</button></div><p id="modalInfo" class="small"></p>`);
  }
  async function shareLink(){ const url=DEFAULTS.officialUrl; if(navigator.share){try{await navigator.share({title:"Minoterie 19 Pro",text:"Calculateur de prix de revient et de marge.",url});}catch(e){}} else copyLink(); }
  function copyLink(){ const text=`Minoterie 19 Pro — calculateur de prix de revient et de marge.\n${DEFAULTS.officialUrl}`; navigator.clipboard?.writeText(text); const i=$("modalInfo"); if(i)i.textContent="Lien copié."; }
  function openSettings(){
    modal(`<h2>Paramètres</h2><div class="box"><b>Version 2.0.0</b><p>Lien officiel : ${DEFAULTS.officialUrl}</p></div><div class="box"><b>Mises à jour</b><p>Les mises à jour se feront via GitHub puis Netlify gardera le même lien.</p></div><div class="row"><button onclick="App.exportJSON()">Sauvegarder mes données</button><button class="secondary" onclick="App.closeModal()">Fermer</button></div>`);
  }

  function exportJSON(){ const b=new Blob([JSON.stringify(db,null,2)],{type:"application/json"}); const a=document.createElement("a"); a.href=URL.createObjectURL(b); a.download="sauvegarde_minoterie19_pro.json"; a.click(); }
  function importJSON(e){ const f=e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=()=>{try{db=JSON.parse(r.result); db.recipes.forEach(norm); markDirty(); showHome();}catch(err){alert("Fichier invalide");}}; r.readAsText(f); }
  function exportCSV(){ const rows=[["Famille","Selection","Nom","Prix TTC","Prix kg TTC","Poids","Prix HT","Cout piece HT","Cout kg HT","Marge %","Marge HT","Marge TTC","Coef"]]; db.recipes.forEach(r=>{const c=calc(r); rows.push([r.family,r.selected?"Oui":"Non",r.name,r.priceTTC,r.priceKgTTC,r.weightG,c.ht,r.costPieceHT,c.costKg,c.marginPct,c.marginHT,c.marginTTC,c.coef]);}); const csv=rows.map(r=>r.map(x=>`"${String(x).replaceAll('"','""')}"`).join(";")).join("\n"); const b=new Blob([csv],{type:"text/csv;charset=utf-8"}); const a=document.createElement("a"); a.href=URL.createObjectURL(b); a.download="minoterie19_recettes.csv"; a.click(); }

  if("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("./service-worker.js").catch(()=>{});
  showHome();
  return {showHome,showClient,openFamilies,closeModal,addFamily,renameFamily,deleteFamily,openShare,shareLink,copyLink,openSettings,save,exportJSON,importJSON,exportCSV,renderRecipes,addRecipe,updateRecipe,duplicateRecipe,deleteRecipe,setClient};
})();
