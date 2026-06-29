
(function(){
  const ADMIN_CODE = "1702";
  const ADMIN_KEY = "recette19_admin_session_v12";
  let timer = null;

  function $(id){ return document.getElementById(id); }

  function isAdmin(){
    return sessionStorage.getItem(ADMIN_KEY) === "1";
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

    const adminOnlyIds = ["btnPublish", "btnAdmin", "btnSettings"];
    adminOnlyIds.forEach(id => {
      const el = $(id);
      if(el) el.style.display = active ? "" : "none";
    });

    const sub = document.querySelector(".sub");
    if(sub){
      sub.textContent = active ? "V12 · ADMIN" : "V12";
    }

    const status = $("status");
    if(status){
      status.textContent = active ? "Mode administrateur actif ✓" : "Sauvegarde automatique active ✓";
    }
  }

  function unlock(){
    const code = prompt("Code administrateur");
    if(code === ADMIN_CODE){
      setAdmin(true);
      alert("Mode administrateur activé.");
    }
  }

  function bindLogo(){
    const logo = $("mainLogo") || document.querySelector(".brand img");
    if(!logo) return;

    const start = (e) => {
      e.preventDefault();
      clearTimeout(timer);
      timer = setTimeout(unlock, 5000);
    };

    const stop = () => {
      clearTimeout(timer);
      timer = null;
    };

    logo.addEventListener("mousedown", start);
    logo.addEventListener("touchstart", start, {passive:false});
    logo.addEventListener("mouseup", stop);
    logo.addEventListener("mouseleave", stop);
    logo.addEventListener("touchend", stop);
    logo.addEventListener("touchcancel", stop);
  }

  function init(){
    bindLogo();
    setAdmin(isAdmin());
    setTimeout(() => setAdmin(isAdmin()), 500);
    setTimeout(() => setAdmin(isAdmin()), 1500);
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", init);
  }else{
    init();
  }
})();
