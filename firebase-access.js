
(function(){
const FIREBASE_CONFIG={apiKey:"AIzaSyASWj-YPKjhpERSkMsacGqPI5pdlYcXvxY",authDomain:"application-recette-19.firebaseapp.com",projectId:"application-recette-19",storageBucket:"application-recette-19.firebasestorage.app",messagingSenderId:"458649313152",appId:"1:458649313152:web:cb64dcf459298902ae2b65",measurementId:"G-TRF852J7J5"};
const ACCESS_STORE="recette19_access_v9"; const ADMIN_PIN="1919";
let firestore=null, ready=false;
function $(id){return document.getElementById(id)}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function norm(v){return String(v||"").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}
function getDeviceId(){let id=localStorage.getItem("recette19_device_id"); if(!id){id="dev-"+Date.now()+"-"+Math.random().toString(16).slice(2);localStorage.setItem("recette19_device_id",id)} return id}
function getAccess(){try{return JSON.parse(localStorage.getItem(ACCESS_STORE)||"{}")}catch(e){return{}}}
function setAccess(a){localStorage.setItem(ACCESS_STORE,JSON.stringify(a||{}))}
try{ if(window.firebase){ firebase.initializeApp(FIREBASE_CONFIG); firestore=firebase.firestore(); ready=true; } }catch(e){console.warn(e)}
async function checkAccess(){
 const gate=$("accessGate"), main=$("mainApp"), st=$("accessStatus");
 if(!ready){ if(gate)gate.style.display="none"; if(main)main.style.display="block"; return true; }
 const a=getAccess();
 if(!a.bakeryId){ if(gate)gate.style.display="flex"; if(main)main.style.display="none"; return false; }
 try{ const doc=await firestore.collection("demandes_acces").doc(a.bakeryId).get();
   if(doc.exists && doc.data().status==="autorise"){setAccess({...a,status:"autorise"}); if(gate)gate.style.display="none"; if(main)main.style.display="block"; return true;}
   if(gate)gate.style.display="flex"; if(main)main.style.display="none"; if(st)st.textContent=(doc.exists&&doc.data().status==="refuse")?"Accès refusé. Contactez Minoterie 19.":"Demande envoyée. En attente d’autorisation."; return false;
 }catch(e){ if(st)st.textContent="Impossible de vérifier pour le moment."; if(gate)gate.style.display="flex"; if(main)main.style.display="none"; return false; }
}
async function requestAccess(){
 const input=$("bakeryNameInput"), st=$("accessStatus"); const name=(input?.value||"").trim();
 if(!name){if(st)st.textContent="Renseignez le nom de la boulangerie."; return;}
 if(!ready){if(st)st.textContent="Firebase non disponible."; return;}
 const bakeryId=norm(name)+"-"+getDeviceId().slice(-6);
 try{ await firestore.collection("demandes_acces").doc(bakeryId).set({bakeryName:name,bakeryId,deviceId:getDeviceId(),status:"en_attente",createdAt:firebase.firestore.FieldValue.serverTimestamp(),updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true}); setAccess({bakeryName:name,bakeryId,status:"en_attente"}); if(st)st.textContent="Demande envoyée. Attente de l’autorisation Minoterie 19."; }
 catch(e){ if(st)st.textContent="Erreur d’envoi. Vérifiez la connexion."; }
}
async function openAdmin(){
 const pin=prompt("Code administrateur"); if(pin!==ADMIN_PIN)return alert("Code incorrect."); if(!ready)return alert("Firebase non disponible.");
 if(!window.App || !App.closeModal)return alert("Application non prête.");
 const html='<h2>Administration des accès</h2><div class="box"><b>Demandes d’accès</b><p>Autorise uniquement les boulangeries qui doivent utiliser l’application.</p></div><div id="adminList">Chargement...</div><button class="secondary" onclick="App.closeModal()">Fermer</button>';
 document.getElementById('modalContent').innerHTML=html; document.getElementById('modal').style.display='flex';
 const list=$("adminList");
 try{ const snap=await firestore.collection("demandes_acces").orderBy("createdAt","desc").limit(50).get(); if(snap.empty){list.innerHTML="<p>Aucune demande.</p>";return;} list.innerHTML=""; snap.forEach(doc=>{const d=doc.data(); const row=document.createElement("div"); row.className="adminLine"; row.innerHTML=`<div><b>${esc(d.bakeryName||doc.id)}</b><div class="adminStatus">${esc(d.status||"en_attente")}<br>${esc(doc.id)}</div></div><button class="ok" onclick="App.authorizeAccess('${doc.id}')">Autoriser</button><button class="danger" onclick="App.refuseAccess('${doc.id}')">Refuser</button>`; list.appendChild(row);}); }
 catch(e){list.innerHTML="<p>Erreur de chargement. Vérifie les règles Firestore.</p>";}
}
async function authorizeAccess(id){await firestore.collection("demandes_acces").doc(id).set({status:"autorise",updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true}); alert("Accès autorisé."); openAdmin();}
async function refuseAccess(id){if(!confirm("Refuser cet accès ?"))return; await firestore.collection("demandes_acces").doc(id).set({status:"refuse",updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true}); alert("Accès refusé."); openAdmin();}
window.addEventListener('load',()=>setTimeout(checkAccess,500));
window.App=Object.assign(window.App||{},{requestAccess,checkAccess,openAdmin,authorizeAccess,refuseAccess});
})();
