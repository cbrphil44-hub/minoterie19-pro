
(function(){
  const ADMIN_CODE = "1702";
  const ERROR_KEY = "recette19_admin_errors_v14";
  const LAST_BACKUP_KEY = "recette19_last_backup_date_v14";
  let firestore = null;

  function $(id){ return document.getElementById(id); }
  function esc(s){ return String(s ?? "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

  function logError(type, error){
    try{
      const list = JSON.parse(localStorage.getItem(ERROR_KEY) || "[]");
      list.unshift({date:new Date().toLocaleString("fr-FR"), type, message:error && error.message ? error.message : String(error || "Erreur inconnue")});
      localStorage.setItem(ERROR_KEY, JSON.stringify(list.slice(0,100)));
    }catch(e){}
  }

  function initFirebase(){
    try{
      if(!window.firebase) throw new Error("SDK Firebase non chargé");
      if(!firebase.apps.length){
        firebase.initializeApp({
          apiKey:"AIzaSyASWj-YPKjhpERSkMsacGqPI5pdlYcXvxY",
          authDomain:"application-recette-19.firebaseapp.com",
          projectId:"application-recette-19",
          storageBucket:"application-recette-19.firebasestorage.app",
          messagingSenderId:"458649313152",
          appId:"1:458649313152:web:cb64dcf459298902ae2b65",
          measurementId:"G-TRF852J7J5"
        });
      }
      firestore = firebase.firestore();
      return true;
    }catch(e){
      logError("Connexion Firebase", e);
      alert("Firebase indisponible : " + (e.message || e));
      return false;
    }
  }

  function modal(html){
    const m = $("modal"), c = $("modalContent");
    if(!m || !c) return alert("Fenêtre introuvable.");
    c.innerHTML = html;
    m.style.display = "flex";
  }

  function closeModal(){
    const m = $("modal");
    if(m) m.style.display = "none";
  }

  function requireAdmin(){
    const code = prompt("Code administrateur");
    if(code !== ADMIN_CODE){
      if(code !== null) alert("Code incorrect.");
      return false;
    }
    return true;
  }

  async function openAdmin(){
    if(!requireAdmin()) return;
    modal(`
      <h2>🔐 Tableau administrateur V14</h2>
      <div class="adminTabsV14">
        <button data-v14-tab="access" class="copy">Gestion des accès</button>
        <button data-v14-tab="errors" class="secondary">Rapport d'erreurs</button>
        <button data-v14-tab="app" class="secondary">Gestion application</button>
        <button data-v14-tab="backup" class="secondary">Sauvegardes</button>
        <button data-v14-tab="info" class="secondary">Informations</button>
        <button data-v14-action="close" class="secondary">Fermer</button>
      </div>
      <div id="adminContentV14">Chargement...</div>
    `);
    await showAccess();
  }

  async function fetchAccess(){
    if(!initFirebase()) return [];
    const snap = await firestore.collection("demandes_acces").limit(300).get();
    const docs = [];
    snap.forEach(doc => docs.push({id:doc.id, data:doc.data() || {}}));
    return docs;
  }

  function dateMs(d){
    try{
      if(d.createdAt && d.createdAt.toDate) return d.createdAt.toDate().getTime();
      if(d.createdAt) return new Date(d.createdAt).getTime() || 0;
    }catch(e){}
    return 0;
  }

  function badge(status){
    const s = status || "en_attente";
    if(s === "autorise") return '<span class="accessBadge okBadge">Autorisée</span>';
    if(s === "refuse") return '<span class="accessBadge refuseBadge">Refusée</span>';
    if(s === "suspendu") return '<span class="accessBadge suspendBadge">Suspendue</span>';
    return '<span class="accessBadge waitBadge">En attente</span>';
  }

  function setContent(html){
    const c = $("adminContentV14");
    if(c) c.innerHTML = html;
  }

  async function showAccess(){
    setContent(`
      <div class="box">
        <b>Gestion des accès</b>
        <p>Liste des demandes d'accès au logiciel.</p>
        <div class="row">
          <div class="grow">
            <label>Recherche</label>
            <input id="searchAccessV14" placeholder="Nom de la boulangerie">
          </div>
          <div>
            <label>Tri</label>
            <select id="sortAccessV14">
              <option value="date_desc">Plus récent</option>
              <option value="date_asc">Plus ancien</option>
              <option value="name_asc">Nom A → Z</option>
              <option value="status_asc">Statut</option>
            </select>
          </div>
        </div>
      </div>
      <div id="accessSummaryV14" class="pills"></div>
      <div id="accessListV14">Chargement...</div>
    `);
    $("searchAccessV14")?.addEventListener("input", loadAccessList);
    $("sortAccessV14")?.addEventListener("change", loadAccessList);
    await loadAccessList();
  }

  async function loadAccessList(){
    const list = $("accessListV14"), summary = $("accessSummaryV14");
    if(!list) return;
    list.innerHTML = "Chargement...";
    try{
      let docs = await fetchAccess();
      const q = String($("searchAccessV14")?.value || "").toLowerCase().trim();
      if(q) docs = docs.filter(x => String(x.data.bakeryName || x.id).toLowerCase().includes(q));
      const sort = $("sortAccessV14")?.value || "date_desc";
      docs.sort((a,b)=>{
        const da=a.data||{}, db=b.data||{};
        if(sort==="date_asc") return dateMs(da)-dateMs(db);
        if(sort==="name_asc") return String(da.bakeryName||a.id).localeCompare(String(db.bakeryName||b.id),"fr");
        if(sort==="status_asc") return String(da.status||"en_attente").localeCompare(String(db.status||"en_attente"),"fr");
        return dateMs(db)-dateMs(da);
      });
      const counts={en_attente:0, autorise:0, refuse:0, suspendu:0};
      docs.forEach(x => { const s=x.data.status||"en_attente"; counts[s]=(counts[s]||0)+1; });
      if(summary){
        summary.innerHTML = `
          <div class="pill">Total : <b>${docs.length}</b></div>
          <div class="pill">En attente : <b>${counts.en_attente||0}</b></div>
          <div class="pill">Autorisés : <b>${counts.autorise||0}</b></div>
          <div class="pill">Refusés : <b>${counts.refuse||0}</b></div>
          <div class="pill">Suspendus : <b>${counts.suspendu||0}</b></div>
        `;
      }
      if(!docs.length){ list.innerHTML = "<p>Aucune demande.</p>"; return; }
      list.innerHTML = docs.map(x=>{
        const d=x.data||{};
        const dt = d.createdAt && d.createdAt.toDate ? d.createdAt.toDate().toLocaleString("fr-FR") : "Date inconnue";
        return `
          <div class="adminAccessCard">
            <div class="adminAccessHeader">
              <div><b>${esc(d.bakeryName||x.id)}</b><div class="adminStatus">${esc(x.id)}<br>${esc(dt)}</div></div>
              ${badge(d.status)}
            </div>
            <div class="adminAccessActions">
              <button class="ok" data-v14-status="autorise" data-id="${esc(x.id)}">Accepter</button>
              <button class="danger" data-v14-status="refuse" data-id="${esc(x.id)}">Refuser</button>
              <button class="secondary" data-v14-status="en_attente" data-id="${esc(x.id)}">En attente</button>
              <button class="secondary" data-v14-status="suspendu" data-id="${esc(x.id)}">Suspendre</button>
              <button class="danger" data-v14-delete="1" data-id="${esc(x.id)}">Supprimer</button>
            </div>
          </div>`;
      }).join("");
    }catch(e){
      logError("Chargement accès", e);
      list.innerHTML = "<p>Erreur : " + esc(e.message || e) + "</p>";
    }
  }

  async function setStatus(id,status){
    try{
      if(!initFirebase()) return;
      await firestore.collection("demandes_acces").doc(id).set({status, updatedAt: firebase.firestore.FieldValue.serverTimestamp()}, {merge:true});
      await loadAccessList();
    }catch(e){
      logError("Modification statut", e);
      alert("Erreur : " + (e.message || e));
    }
  }

  async function deleteAccess(id){
    try{
      if(!confirm("Supprimer définitivement cette demande ?")) return;
      if(!initFirebase()) return;
      await firestore.collection("demandes_acces").doc(id).delete();
      await loadAccessList();
    }catch(e){
      logError("Suppression accès", e);
      alert("Erreur : " + (e.message || e));
    }
  }

  function showErrors(){
    let errors=[];
    try{ errors = JSON.parse(localStorage.getItem(ERROR_KEY) || "[]"); }catch(e){}
    setContent(`
      <div class="box"><b>Rapport d'erreurs</b><button class="danger" data-v14-action="clearErrors">Vider le rapport</button></div>
      ${errors.length ? errors.map(e=>`<div class="errorItem"><b>${esc(e.date)}</b><br>Type : ${esc(e.type)}<br>${esc(e.message)}</div>`).join("") : "<p>Aucune erreur enregistrée.</p>"}
    `);
  }

  async function showApp(){
    try{
      const docs = await fetchAccess();
      const counts={en_attente:0, autorise:0, suspendu:0};
      docs.forEach(x => { const s=x.data.status||"en_attente"; counts[s]=(counts[s]||0)+1; });
      setContent(`
        <div class="box"><b>Gestion de l'application</b></div>
        <div class="pills">
          <div class="pill">Clients autorisés : <b>${counts.autorise||0}</b></div>
          <div class="pill">Demandes en attente : <b>${counts.en_attente||0}</b></div>
          <div class="pill">Comptes suspendus : <b>${counts.suspendu||0}</b></div>
        </div>
        <div class="box"><button data-v14-action="createUpdate" class="copy">Créer une mise à jour</button></div>
      `);
    }catch(e){
      logError("Gestion application", e);
      setContent("<p>Erreur : "+esc(e.message||e)+"</p>");
    }
  }

  function keys(){
    const out=[];
    try{ for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k && k.includes("recette19")) out.push(k); } }catch(e){}
    return out;
  }

  function download(content, name){
    const blob = new Blob([content], {type:"application/json"});
    const a=document.createElement("a");
    a.href=URL.createObjectURL(blob); a.download=name; a.click();
  }

  function exportBackup(){
    const data={}; keys().forEach(k=>data[k]=localStorage.getItem(k));
    localStorage.setItem("recette19_last_backup_v14", new Date().toLocaleString("fr-FR"));
    download(JSON.stringify({type:"recette19-full-backup",createdAt:new Date().toISOString(),data},null,2), "sauvegarde_complete_recette19.json");
  }

  function exportData(){
    const data={}; keys().forEach(k=>{ if(k.includes("donnees")||k.includes("v11")||k.includes("v12")||k.includes("v14")) data[k]=localStorage.getItem(k); });
    download(JSON.stringify({type:"recette19-data-export",createdAt:new Date().toISOString(),data},null,2), "export_donnees_recette19.json");
  }

  function importFile(file){
    if(!file) return;
    const r=new FileReader();
    r.onload=()=>{
      try{
        const obj=JSON.parse(r.result);
        if(!obj.data) return alert("Fichier invalide");
        Object.keys(obj.data).forEach(k=>localStorage.setItem(k,obj.data[k]));
        localStorage.setItem("recette19_last_backup_v14", new Date().toLocaleString("fr-FR"));
        alert("Données importées. Recharge l'application.");
      }catch(e){
        logError("Import données", e);
        alert("Fichier invalide : "+(e.message||e));
      }
    };
    r.readAsText(file);
  }

  function showBackup(){
    setContent(`
      <div class="box">
        <b>Sauvegardes</b>
        <div class="row">
          <button class="ok" data-v14-action="fullBackup">Sauvegarde complète</button>
          <button class="copy" data-v14-action="exportData">Exporter les données</button>
          <label class="uploadBtn">Restaurer / Importer<input type="file" id="importBackupV14" accept=".json"></label>
        </div>
      </div>
    `);
    $("importBackupV14")?.addEventListener("change", e=>importFile(e.target.files[0]));
  }

  function showInfo(){
    setContent(`
      <div class="box">
        <b>Informations</b>
        <p>Version de l'application : <b>V14</b></p>
        <p>Version base Firebase : <b>application-recette-19 / demandes_acces</b></p>
        <p>Dernière sauvegarde : <b>${esc(localStorage.getItem("recette19_last_backup_v14") || "Aucune sauvegarde enregistrée")}</b></p>
      </div>
    `);
  }

  function bind(){
    $("btnAdminV14")?.addEventListener("click", openAdmin);

    document.addEventListener("click", e=>{
      const tab=e.target.closest("[data-v14-tab]");
      if(tab){
        const t=tab.dataset.v14Tab;
        if(t==="access") showAccess();
        if(t==="errors") showErrors();
        if(t==="app") showApp();
        if(t==="backup") showBackup();
        if(t==="info") showInfo();
      }
      const st=e.target.closest("[data-v14-status]");
      if(st) setStatus(st.dataset.id, st.dataset.v14Status);
      const del=e.target.closest("[data-v14-delete]");
      if(del) deleteAccess(del.dataset.id);
      const action=e.target.closest("[data-v14-action]");
      if(action){
        const a=action.dataset.v14Action;
        if(a==="close") closeModal();
        if(a==="clearErrors"){ localStorage.removeItem(ERROR_KEY); showErrors(); }
        if(a==="fullBackup") exportBackup();
        if(a==="exportData") exportData();
        if(a==="createUpdate"){
          if(window.App && typeof window.App.openPublish==="function") window.App.openPublish();
          else alert("Créer une mise à jour indisponible.");
        }
      }
    });
  }

  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();
})();
