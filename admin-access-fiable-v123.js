
(function(){
  const ADMIN_CODE = "1702";
  const ADMIN_KEY = "recette19_admin_session_v12";
  const ERROR_KEY = "recette19_admin_errors_v12_3";
  const LAST_BACKUP_KEY = "recette19_last_backup_date_v12_3";
  let firestore = null;
  let longTimer = null;

  function $(id){ return document.getElementById(id); }
  function esc(s){ return String(s ?? "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

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
      alert("Firebase non disponible : " + (e.message || e));
      return false;
    }
  }

  function logError(type, error){
    try{
      const list = JSON.parse(localStorage.getItem(ERROR_KEY) || "[]");
      list.unshift({
        date: new Date().toLocaleString("fr-FR"),
        type,
        message: error && error.message ? error.message : String(error || "Erreur inconnue")
      });
      localStorage.setItem(ERROR_KEY, JSON.stringify(list.slice(0,100)));
    }catch(e){}
  }

  function getErrors(){
    try{ return JSON.parse(localStorage.getItem(ERROR_KEY) || "[]"); }
    catch(e){ return []; }
  }

  function clearErrors(){
    localStorage.removeItem(ERROR_KEY);
    showErrorsPanel();
  }

  function setAdmin(active){
    if(active){
      sessionStorage.setItem(ADMIN_KEY, "1");
      document.body.classList.add("admin-mode");
      document.body.classList.remove("client-mode");
    }else{
      sessionStorage.removeItem(ADMIN_KEY);
      document.body.classList.remove("admin-mode");
      document.body.classList.add("client-mode");
    }

    ["btnPublish","btnAdmin","btnSettings"].forEach(id=>{
      const el=$(id);
      if(el) el.style.display = active ? "" : "none";
    });

    const sub=document.querySelector(".sub");
    if(sub) sub.textContent = active ? "V12 · ADMIN" : "V12";

    const st=$("status");
    if(st) st.textContent = active ? "Mode administrateur actif ✓" : "Sauvegarde automatique active ✓";

    const trigger=$("adminRoundTrigger");
    if(trigger) trigger.textContent = active ? "⚙️" : "🔒";
  }

  function modal(html){
    const m=$("modal"), c=$("modalContent");
    if(!m || !c) return alert("Fenêtre administrateur introuvable.");
    c.innerHTML=html;
    m.style.display="flex";
  }

  function closeModal(){
    const m=$("modal");
    if(m) m.style.display="none";
  }

  function askAndOpen(){
    const code = prompt("Code administrateur");
    if(code === ADMIN_CODE){
      setAdmin(true);
      openAdminDashboard();
    }else if(code !== null){
      alert("Code incorrect.");
    }
  }

  async function openAdminDashboard(){
    if(!sessionStorage.getItem(ADMIN_KEY)){
      const code = prompt("Code administrateur");
      if(code !== ADMIN_CODE) return alert("Code incorrect.");
      setAdmin(true);
    }

    modal(`
      <h2>Tableau administrateur</h2>
      <div class="adminTabs">
        <button data-admin-tab="access" class="copy">Gestion des accès</button>
        <button data-admin-tab="errors" class="secondary">Rapport d'erreurs</button>
        <button data-admin-tab="app" class="secondary">Gestion application</button>
        <button data-admin-tab="backup" class="secondary">Sauvegardes</button>
        <button data-admin-tab="info" class="secondary">Informations</button>
        <button data-admin-action="close" class="secondary">Fermer</button>
      </div>
      <div id="adminDashboardContent" class="adminDashboardContent">Chargement...</div>
    `);
    await showAccessPanel();
  }

  function setContent(html){
    const c=$("adminDashboardContent");
    if(c) c.innerHTML=html;
  }

  async function fetchAccessDocs(){
    if(!initFirebase()) return [];
    const snap=await firestore.collection("demandes_acces").limit(300).get();
    const docs=[];
    snap.forEach(doc=>docs.push({id:doc.id,data:doc.data()||{}}));
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
    const s=status || "en_attente";
    if(s==="autorise") return '<span class="accessBadge okBadge">Autorisée</span>';
    if(s==="refuse") return '<span class="accessBadge refuseBadge">Refusée</span>';
    if(s==="suspendu") return '<span class="accessBadge suspendBadge">Suspendue</span>';
    return '<span class="accessBadge waitBadge">En attente</span>';
  }

  async function showAccessPanel(){
    setContent(`
      <div class="box">
        <b>Gestion des accès</b>
        <p>Liste des demandes du logiciel.</p>
        <div class="row">
          <div class="grow">
            <label>Recherche</label>
            <input id="adminAccessSearch" placeholder="Nom de la boulangerie">
          </div>
          <div>
            <label>Tri</label>
            <select id="adminAccessSort">
              <option value="date_desc">Plus récent</option>
              <option value="date_asc">Plus ancien</option>
              <option value="name_asc">Nom A → Z</option>
              <option value="status_asc">Statut</option>
            </select>
          </div>
        </div>
        <div class="row" style="margin-top:8px">
          <button data-admin-action="refreshAccess" class="secondary">Actualiser</button>
        </div>
      </div>
      <div id="adminAccessSummary" class="pills"></div>
      <div id="adminAccessList">Chargement...</div>
    `);
    await loadAccessList();
    $("adminAccessSearch")?.addEventListener("input", loadAccessList);
    $("adminAccessSort")?.addEventListener("change", loadAccessList);
  }

  async function loadAccessList(){
    const list=$("adminAccessList"), summary=$("adminAccessSummary");
    if(!list) return;
    list.innerHTML="Chargement...";

    try{
      let docs=await fetchAccessDocs();
      const q=String($("adminAccessSearch")?.value||"").trim().toLowerCase();
      if(q) docs=docs.filter(x=>String(x.data.bakeryName||x.id).toLowerCase().includes(q));

      const sort=$("adminAccessSort")?.value||"date_desc";
      docs.sort((a,b)=>{
        const da=a.data||{}, db=b.data||{};
        if(sort==="date_asc") return dateMs(da)-dateMs(db);
        if(sort==="name_asc") return String(da.bakeryName||a.id).localeCompare(String(db.bakeryName||b.id),"fr");
        if(sort==="status_asc") return String(da.status||"en_attente").localeCompare(String(db.status||"en_attente"),"fr");
        return dateMs(db)-dateMs(da);
      });

      const counts={en_attente:0,autorise:0,refuse:0,suspendu:0};
      docs.forEach(x=>{
        const s=x.data.status||"en_attente";
        counts[s]=(counts[s]||0)+1;
      });

      if(summary){
        summary.innerHTML=`
          <div class="pill">Total : <b>${docs.length}</b></div>
          <div class="pill">En attente : <b>${counts.en_attente||0}</b></div>
          <div class="pill">Autorisés : <b>${counts.autorise||0}</b></div>
          <div class="pill">Refusés : <b>${counts.refuse||0}</b></div>
          <div class="pill">Suspendus : <b>${counts.suspendu||0}</b></div>
        `;
      }

      if(!docs.length){
        list.innerHTML="<p>Aucune demande.</p>";
        return;
      }

      list.innerHTML=docs.map(x=>{
        const d=x.data||{};
        const dt=d.createdAt && d.createdAt.toDate ? d.createdAt.toDate().toLocaleString("fr-FR") : "Date inconnue";
        return `
          <div class="adminAccessCard">
            <div class="adminAccessHeader">
              <div>
                <b>${esc(d.bakeryName||x.id)}</b>
                <div class="adminStatus">${esc(x.id)}<br>${esc(dt)}</div>
              </div>
              ${badge(d.status)}
            </div>
            <div class="adminAccessActions">
              <button class="ok" data-access-action="autorise" data-id="${esc(x.id)}">Accepter</button>
              <button class="danger" data-access-action="refuse" data-id="${esc(x.id)}">Refuser</button>
              <button class="secondary" data-access-action="en_attente" data-id="${esc(x.id)}">En attente</button>
              <button class="secondary" data-access-action="suspendu" data-id="${esc(x.id)}">Suspendre</button>
              <button class="danger" data-access-delete="1" data-id="${esc(x.id)}">Supprimer</button>
            </div>
          </div>
        `;
      }).join("");
    }catch(e){
      logError("Liste des demandes",e);
      list.innerHTML="<p>Erreur : "+esc(e.message||e)+"</p>";
    }
  }

  async function updateAccess(id,status){
    try{
      if(!initFirebase()) return;
      await firestore.collection("demandes_acces").doc(id).set({
        status,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      },{merge:true});
      await loadAccessList();
    }catch(e){
      logError("Modification accès",e);
      alert("Erreur : "+(e.message||e));
    }
  }

  async function deleteAccess(id){
    try{
      if(!confirm("Supprimer définitivement cette demande ?")) return;
      if(!initFirebase()) return;
      await firestore.collection("demandes_acces").doc(id).delete();
      await loadAccessList();
    }catch(e){
      logError("Suppression accès",e);
      alert("Erreur : "+(e.message||e));
    }
  }

  function showErrorsPanel(){
    const errors=getErrors();
    setContent(`
      <div class="box">
        <b>Rapport d'erreurs</b>
        <button class="danger" data-admin-action="clearErrors">Vider le rapport</button>
      </div>
      ${errors.length ? errors.map(e=>`
        <div class="errorItem"><b>${esc(e.date)}</b><br>Type : ${esc(e.type)}<br>${esc(e.message)}</div>
      `).join("") : "<p>Aucune erreur enregistrée.</p>"}
    `);
  }

  async function showAppPanel(){
    try{
      const docs=await fetchAccessDocs();
      const counts={en_attente:0,autorise:0,suspendu:0};
      docs.forEach(x=>{
        const s=x.data.status||"en_attente";
        counts[s]=(counts[s]||0)+1;
      });
      setContent(`
        <div class="box"><b>Gestion de l'application</b></div>
        <div class="pills">
          <div class="pill">Clients autorisés : <b>${counts.autorise||0}</b></div>
          <div class="pill">Demandes en attente : <b>${counts.en_attente||0}</b></div>
          <div class="pill">Comptes suspendus : <b>${counts.suspendu||0}</b></div>
        </div>
        <div class="box"><button data-admin-action="createUpdate" class="copy">Créer une mise à jour</button></div>
      `);
    }catch(e){
      logError("Gestion application",e);
      setContent("<p>Erreur : "+esc(e.message||e)+"</p>");
    }
  }

  function getKeys(){
    const keys=[];
    try{
      for(let i=0;i<localStorage.length;i++){
        const k=localStorage.key(i);
        if(k && k.includes("recette19")) keys.push(k);
      }
    }catch(e){}
    return keys;
  }

  function download(content,name,type){
    const blob=new Blob([content],{type});
    const a=document.createElement("a");
    a.href=URL.createObjectURL(blob);
    a.download=name;
    a.click();
  }

  function exportFullBackup(){
    const data={};
    getKeys().forEach(k=>data[k]=localStorage.getItem(k));
    localStorage.setItem(LAST_BACKUP_KEY,new Date().toLocaleString("fr-FR"));
    download(JSON.stringify({type:"recette19-full-backup",createdAt:new Date().toISOString(),data},null,2),"sauvegarde_complete_recette19.json","application/json");
  }

  function exportDataOnly(){
    const data={};
    getKeys().forEach(k=>{
      if(k.includes("donnees")||k.includes("v11")||k.includes("v12")) data[k]=localStorage.getItem(k);
    });
    download(JSON.stringify({type:"recette19-data-export",createdAt:new Date().toISOString(),data},null,2),"export_donnees_recette19.json","application/json");
  }

  function importFile(file){
    if(!file) return;
    const r=new FileReader();
    r.onload=()=>{
      try{
        const obj=JSON.parse(r.result);
        if(!obj.data) return alert("Fichier invalide.");
        Object.keys(obj.data).forEach(k=>localStorage.setItem(k,obj.data[k]));
        localStorage.setItem(LAST_BACKUP_KEY,new Date().toLocaleString("fr-FR"));
        alert("Données importées. Recharge l'application.");
      }catch(e){
        logError("Import données",e);
        alert("Fichier invalide : "+(e.message||e));
      }
    };
    r.readAsText(file);
  }

  function showBackupPanel(){
    setContent(`
      <div class="box">
        <b>Sauvegardes</b>
        <div class="row">
          <button data-admin-action="fullBackup" class="ok">Sauvegarde complète</button>
          <button data-admin-action="exportData" class="copy">Exporter les données</button>
          <label class="uploadBtn">Restaurer / Importer<input type="file" id="adminImportBackup" accept=".json"></label>
        </div>
      </div>
    `);
    $("adminImportBackup")?.addEventListener("change",e=>importFile(e.target.files[0]));
  }

  function showInfoPanel(){
    setContent(`
      <div class="box">
        <b>Informations</b>
        <p>Version de l'application : <b>V12</b></p>
        <p>Version base Firebase : <b>application-recette-19 / demandes_acces</b></p>
        <p>Dernière sauvegarde : <b>${esc(localStorage.getItem(LAST_BACKUP_KEY)||"Aucune sauvegarde enregistrée")}</b></p>
      </div>
    `);
  }

  function bindTriggers(){
    const trigger=$("adminRoundTrigger");
    const logo=$("mainLogo")||document.querySelector(".brand img");

    // Click works immediately: avoids mobile long-press issues.
    if(trigger) trigger.addEventListener("click", askAndOpen);

    const bindLong=(el)=>{
      if(!el) return;
      const start=(e)=>{
        e.preventDefault();
        clearTimeout(longTimer);
        longTimer=setTimeout(askAndOpen,5000);
      };
      const stop=()=>{
        clearTimeout(longTimer);
        longTimer=null;
      };
      el.addEventListener("mousedown",start);
      el.addEventListener("touchstart",start,{passive:false});
      el.addEventListener("mouseup",stop);
      el.addEventListener("mouseleave",stop);
      el.addEventListener("touchend",stop);
      el.addEventListener("touchcancel",stop);
    };
    bindLong(trigger);
    bindLong(logo);
  }

  function init(){
    bindTriggers();
    setAdmin(sessionStorage.getItem(ADMIN_KEY)==="1");

    if(window.App){
      window.App.openAdmin=openAdminDashboard;
    }

    document.addEventListener("click",e=>{
      const tab=e.target.closest("[data-admin-tab]");
      if(tab){
        const name=tab.dataset.adminTab;
        if(name==="access") showAccessPanel();
        if(name==="errors") showErrorsPanel();
        if(name==="app") showAppPanel();
        if(name==="backup") showBackupPanel();
        if(name==="info") showInfoPanel();
      }

      const acc=e.target.closest("[data-access-action]");
      if(acc) updateAccess(acc.dataset.id,acc.dataset.accessAction);

      const del=e.target.closest("[data-access-delete]");
      if(del) deleteAccess(del.dataset.id);

      const action=e.target.closest("[data-admin-action]");
      if(action){
        const a=action.dataset.adminAction;
        if(a==="close") closeModal();
        if(a==="clearErrors") { localStorage.removeItem(ERROR_KEY); showErrorsPanel(); }
        if(a==="refreshAccess") loadAccessList();
        if(a==="fullBackup") exportFullBackup();
        if(a==="exportData") exportDataOnly();
        if(a==="createUpdate"){
          if(window.App && typeof window.App.openPublish==="function") window.App.openPublish();
          else alert("Fonction indisponible.");
        }
      }
    });

    setTimeout(()=>setAdmin(sessionStorage.getItem(ADMIN_KEY)==="1"),800);
  }

  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",init);
  else init();
})();
