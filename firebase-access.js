
(function(){
const FIREBASE_CONFIG={
  apiKey:"AIzaSyASWj-YPKjhpERSkMsacGqPI5pdlYcXvxY",
  authDomain:"application-recette-19.firebaseapp.com",
  projectId:"application-recette-19",
  storageBucket:"application-recette-19.firebasestorage.app",
  messagingSenderId:"458649313152",
  appId:"1:458649313152:web:cb64dcf459298902ae2b65",
  measurementId:"G-TRF852J7J5"
};

const ACCESS_STORE="recette19_access_v91";
const ADMIN_PIN="1919";
let firestore=null;
let ready=false;

function $(id){return document.getElementById(id)}
function msg(t){
  const st=$("accessStatus");
  if(st) st.textContent=t;
  console.log("[Recette19 accès]", t);
}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function norm(v){return String(v||"").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}
function getDeviceId(){
  let id=localStorage.getItem("recette19_device_id");
  if(!id){
    id="dev-"+Date.now()+"-"+Math.random().toString(16).slice(2);
    localStorage.setItem("recette19_device_id",id);
  }
  return id;
}
function getAccess(){try{return JSON.parse(localStorage.getItem(ACCESS_STORE)||"{}")}catch(e){return{}}}
function setAccess(a){localStorage.setItem(ACCESS_STORE,JSON.stringify(a||{}))}

function initFirebase(){
  try{
    if(!window.firebase){
      msg("Firebase SDK non chargé. Rechargez la page.");
      return false;
    }
    if(!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    firestore=firebase.firestore();
    ready=true;
    return true;
  }catch(e){
    msg("Erreur Firebase : " + (e.message || e));
    return false;
  }
}

async function checkAccess(){
  const gate=$("accessGate"), main=$("mainApp");
  if(!ready && !initFirebase()){
    if(gate) gate.style.display="flex";
    if(main) main.style.display="none";
    return false;
  }

  const a=getAccess();
  if(!a.bakeryId){
    if(gate) gate.style.display="flex";
    if(main) main.style.display="none";
    msg("Saisissez le nom de la boulangerie puis demandez l'accès.");
    return false;
  }

  try{
    msg("Vérification en cours...");
    const doc=await firestore.collection("demandes_acces").doc(a.bakeryId).get();

    if(doc.exists && doc.data().status==="autorise"){
      setAccess({...a,status:"autorise"});
      if(gate) gate.style.display="none";
      if(main) main.style.display="block";
      msg("Accès autorisé.");
      return true;
    }

    if(gate) gate.style.display="flex";
    if(main) main.style.display="none";
    msg(doc.exists && doc.data().status==="refuse"
      ? "Accès refusé. Contactez Minoterie 19."
      : "Demande envoyée. En attente d’autorisation.");
    return false;
  }catch(e){
    msg("Erreur vérification : " + (e.message || e));
    if(gate) gate.style.display="flex";
    if(main) main.style.display="none";
    return false;
  }
}

async function requestAccess(){
  const input=$("bakeryNameInput");
  const name=(input?.value||"").trim();

  if(!name){
    msg("Renseignez le nom de la boulangerie.");
    return;
  }

  if(!ready && !initFirebase()){
    return;
  }

  const bakeryId=norm(name)+"-"+getDeviceId().slice(-6);

  try{
    msg("Envoi de la demande...");
    await firestore.collection("demandes_acces").doc(bakeryId).set({
      bakeryName:name,
      bakeryId,
      deviceId:getDeviceId(),
      status:"en_attente",
      createdAt:firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt:firebase.firestore.FieldValue.serverTimestamp()
    },{merge:true});

    setAccess({bakeryName:name,bakeryId,status:"en_attente"});
    msg("Demande envoyée. Attente de l’autorisation Minoterie 19.");
  }catch(e){
    msg("Erreur d’envoi : " + (e.message || e));
  }
}

async function openAdmin(){
  const pin=prompt("Code administrateur");
  if(pin!==ADMIN_PIN) return alert("Code incorrect.");
  if(!ready && !initFirebase()) return alert("Firebase non disponible.");

  if(!document.getElementById("modalContent")){
    return alert("Fenêtre d'administration non disponible.");
  }

  document.getElementById("modalContent").innerHTML =
    '<h2>Administration des accès</h2><div class="box"><b>Demandes d’accès</b><p>Autorise uniquement les boulangeries qui doivent utiliser l’application.</p></div><div id="adminList">Chargement...</div><button class="secondary" onclick="App.closeModal()">Fermer</button>';
  document.getElementById("modal").style.display="flex";

  const list=$("adminList");
  try{
    const snap=await firestore.collection("demandes_acces").orderBy("createdAt","desc").limit(50).get();
    if(snap.empty){
      list.innerHTML="<p>Aucune demande.</p>";
      return;
    }
    list.innerHTML="";
    snap.forEach(doc=>{
      const d=doc.data();
      const row=document.createElement("div");
      row.className="adminLine";
      row.innerHTML=`<div><b>${esc(d.bakeryName||doc.id)}</b><div class="adminStatus">${esc(d.status||"en_attente")}<br>${esc(doc.id)}</div></div><button class="ok" onclick="window.App.authorizeAccess('${doc.id}')">Autoriser</button><button class="danger" onclick="window.App.refuseAccess('${doc.id}')">Refuser</button>`;
      list.appendChild(row);
    });
  }catch(e){
    list.innerHTML="<p>Erreur de chargement : "+esc(e.message||e)+"</p>";
  }
}

async function authorizeAccess(id){
  if(!ready && !initFirebase()) return;
  await firestore.collection("demandes_acces").doc(id).set({
    status:"autorise",
    updatedAt:firebase.firestore.FieldValue.serverTimestamp()
  },{merge:true});
  alert("Accès autorisé.");
  openAdmin();
}

async function refuseAccess(id){
  if(!ready && !initFirebase()) return;
  if(!confirm("Refuser cet accès ?")) return;
  await firestore.collection("demandes_acces").doc(id).set({
    status:"refuse",
    updatedAt:firebase.firestore.FieldValue.serverTimestamp()
  },{merge:true});
  alert("Accès refusé.");
  openAdmin();
}

window.App=Object.assign(window.App||{},{
  requestAccess,
  checkAccess,
  openAdmin,
  authorizeAccess,
  refuseAccess
});

window.addEventListener("load",()=>{
  initFirebase();
  setTimeout(checkAccess,700);
});
})();
