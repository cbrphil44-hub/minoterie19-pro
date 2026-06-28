window.Recette19Firebase = (() => {
  const config = {
    apiKey: "AIzaSyASWj-YPKjhpERSkMsacGqPI5pdlYcXvxY",
    authDomain: "application-recette-19.firebaseapp.com",
    projectId: "application-recette-19",
    storageBucket: "application-recette-19.firebasestorage.app",
    messagingSenderId: "458649313152",
    appId: "1:458649313152:web:cb64dcf459298902ae2b65",
    measurementId: "G-TRF852J7J5"
  };

  let db = null;
  let ready = false;

  function init() {
    try {
      if (!window.firebase) {
        return { ok: false, error: "SDK Firebase non chargé" };
      }
      if (!firebase.apps.length) firebase.initializeApp(config);
      db = firebase.firestore();
      ready = true;
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message || String(e) };
    }
  }

  function getDb() {
    if (!ready) init();
    return db;
  }

  function isReady() {
    return ready || !!init().ok;
  }

  return { init, getDb, isReady };
})();
