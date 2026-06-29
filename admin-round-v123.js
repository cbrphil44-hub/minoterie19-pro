
(function(){
  const ADMIN_CODE = "1702";
  const ADMIN_KEY = "recette19_admin_session_v12";
  let timer = null;

  function $(id){ return document.getElementById(id); }

  function setAdminVisual(active){
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
      const el = $(id);
      if(el) el.style.display = active ? "" : "none";
    });

    const sub = document.querySelector(".sub");
    if(sub) sub.textContent = active ? "V12 · ADMIN" : "V12";

    const status = $("status");
    if(status) status.textContent = active ? "Mode administrateur actif ✓" : "Sauvegarde automatique active ✓";

    const trigger = $("adminRoundTrigger");
    if(trigger) trigger.textContent = active ? "⚙️" : "🔒";
  }

  function activateAdmin(){
    const code = prompt("Code administrateur");
    if(code === ADMIN_CODE){
      setAdminVisual(true);

      // Open the complete admin dashboard if available.
      if(window.App && typeof window.App.openAdmin === "function"){
        window.App.openAdmin();
      }else{
        alert("Mode administrateur activé.");
      }
    }else if(code !== null){
      alert("Code incorrect.");
    }
  }

  function bindLongPress(el){
    if(!el) return;

    const start = (e) => {
      e.preventDefault();
      clearTimeout(timer);
      timer = setTimeout(activateAdmin, 5000);
    };

    const stop = () => {
      clearTimeout(timer);
      timer = null;
    };

    el.addEventListener("mousedown", start);
    el.addEventListener("touchstart", start, {passive:false});
    el.addEventListener("mouseup", stop);
    el.addEventListener("mouseleave", stop);
    el.addEventListener("touchend", stop);
    el.addEventListener("touchcancel", stop);
  }

  function init(){
    bindLongPress($("adminRoundTrigger"));
    bindLongPress($("mainLogo"));

    setAdminVisual(sessionStorage.getItem(ADMIN_KEY) === "1");
    setTimeout(()=>setAdminVisual(sessionStorage.getItem(ADMIN_KEY) === "1"), 700);
    setTimeout(()=>setAdminVisual(sessionStorage.getItem(ADMIN_KEY) === "1"), 1600);
  }

  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
