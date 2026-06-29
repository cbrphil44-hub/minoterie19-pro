const App = (() => {
  const INIT = window.RECETTE19_INITIAL || {};
  const STORE = "recette19_v11_donnees_protegees";
  const ACCESS_STORE = "recette19_v11_access";
  const ADMIN_PIN = "1702";
  let isAdmin = false;
  let logoPressTimer = null;
  const URL = INIT.officialUrl || "https://application-recette-19.netlify.app";
  const LEGACY = [
    "recette19_v10_donnees_protegees",
    "recette19_v8_donnees_protegees",
    "recette19_donnees_utilisateur_stables_v7",
    "recette19_donnees_stables",
    "recette19_v6",
    "recette19_v52",
    "recette19_v51",
    "recette19_v5",
    "recette19_v4"
  ];

  let current = "Toutes";
  let mode = "user";
  let saveTimer = null;
  let firestore = null;

  const $ = (id) => document.getElementById(id);
  const parse = (v) => {
    if (typeof v === "number") return Number.isFinite(v) ? v : 0;
    const n = Number(String(v ?? "").trim().replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  };
  const rnd = (n, d) => Math.round(parse(n) * 10 ** d) / 10 ** d;
  const euro = (n) => (parse(n) || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
  const num = (n, d = 2) => (parse(n) || 0).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));


  function applySecurityUI() {
    document.body.classList.toggle("admin-mode", isAdmin);
    document.body.classList.toggle("client-mode", !isAdmin);

    const adminOnlyIds = [
      "btnNewFamily",
      "btnNewFamily2",
      "btnNewRecipe",
      "btnPublish",
      "btnClientSend",
      "btnAdmin",
      "btnSettings",
      "btnSave"
    ];

    adminOnlyIds.forEach((id) => {
      const el = $(id);
      if (el) el.style.display = isAdmin ? "" : "none";
    });

    const st = $("status");
    if (st) st.textContent = isAdmin ? "Mode administrateur actif ✓" : "Mode client";
  }

  function unlockAdmin() {
    const code = prompt("Code administrateur");
    if (code !== ADMIN_PIN) return;
    isAdmin = true;
    mode = "admin";
    applySecurityUI();
    render();
    alert("Mode administrateur activé.");
  }

  function bindLogoLongPress() {
    const logo = $("mainLogo");
    if (!logo) return;

    const start = (e) => {
      e.preventDefault();
      clearTimeout(logoPressTimer);
      logoPressTimer = setTimeout(unlockAdmin, 2500);
    };

    const stop = () => {
      clearTimeout(logoPressTimer);
      logoPressTimer = null;
    };

    logo.addEventListener("mousedown", start);
    logo.addEventListener("touchstart", start, { passive: false });
    logo.addEventListener("mouseup", stop);
    logo.addEventListener("mouseleave", stop);
    logo.addEventListener("touchend", stop);
    logo.addEventListener("touchcancel", stop);
  }

  function accessMsg(text) {
    const st = $("accessStatus");
    if (st) st.textContent = text;
    console.log("[Recette19]", text);
  }

  function initFirebase() {
    const res = window.Recette19Firebase?.init();
    if (!res?.ok) {
      accessMsg("Erreur Firebase : " + (res?.error || "connexion impossible"));
      return false;
    }
    firestore = window.Recette19Firebase.getDb();
    return true;
  }

  function normalizeName(v) {
    return String(v || "").trim().toLowerCase().normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function getDeviceId() {
    let id = localStorage.getItem("recette19_device_id");
    if (!id) {
      id = "dev-" + Date.now() + "-" + Math.random().toString(16).slice(2);
      localStorage.setItem("recette19_device_id", id);
    }
    return id;
  }

  function getAccess() {
    try { return JSON.parse(localStorage.getItem(ACCESS_STORE) || "{}"); }
    catch { return {}; }
  }

  function setAccess(a) {
    localStorage.setItem(ACCESS_STORE, JSON.stringify(a || {}));
  }

  function showGate(show) {
    const gate = $("accessGate");
    const main = $("mainApp");
    if (gate) gate.style.display = show ? "flex" : "none";
    if (main) main.style.display = show ? "none" : "block";
    if (!show) applySecurityUI();
  }

  async function requestAccess() {
    const name = ($("bakeryNameInput")?.value || "").trim();
    if (!name) {
      accessMsg("Renseignez le nom de la boulangerie.");
      return;
    }
    if (!initFirebase()) return;

    const bakeryId = normalizeName(name) + "-" + getDeviceId().slice(-6);
    try {
      accessMsg("Envoi de la demande...");
      await firestore.collection("demandes_acces").doc(bakeryId).set({
        bakeryName: name,
        bakeryId,
        deviceId: getDeviceId(),
        status: "en_attente",
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      setAccess({ bakeryName: name, bakeryId, status: "en_attente" });
      accessMsg("Demande envoyée. Attente de l’autorisation Minoterie 19.");
    } catch (e) {
      accessMsg("Erreur d’envoi : " + (e.message || String(e)));
    }
  }

  async function checkAccess() {
    if (!initFirebase()) {
      showGate(true);
      return false;
    }

    const a = getAccess();
    if (!a.bakeryId) {
      showGate(true);
      accessMsg("Saisissez le nom de la boulangerie puis demandez l'accès.");
      return false;
    }

    try {
      accessMsg("Vérification en cours...");
      const doc = await firestore.collection("demandes_acces").doc(a.bakeryId).get();

      if (doc.exists && doc.data().status === "autorise") {
        setAccess({ ...a, status: "autorise" });
        showGate(false);
        render();
        return true;
      }

      showGate(true);
      if (doc.exists && doc.data().status === "refuse") {
        accessMsg("Accès refusé. Contactez Minoterie 19.");
      } else {
        accessMsg("Demande envoyée. En attente d’autorisation.");
      }
      return false;
    } catch (e) {
      accessMsg("Erreur vérification : " + (e.message || String(e)));
      showGate(true);
      return false;
    }
  }

  function loadDB() {
    for (const k of LEGACY) {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      try {
        const d = JSON.parse(raw);
        if (Array.isArray(d.recipes) && Array.isArray(d.families)) {
          localStorage.setItem(STORE, JSON.stringify(d));
          return d;
        }
      } catch {}
    }
    return structuredClone(INIT);
  }

  let db = loadDB();

  function normRecipe(r) {
    if (!r.id) r.id = "r19-user-" + Date.now() + "-" + Math.random().toString(16).slice(2);
    if (!r.family) r.family = db.families?.[0] || "Pain";
    if (r.selected === undefined) r.selected = false;
    if (r.publish === undefined) r.publish = false;
    if (!r.source) r.source = String(r.id).includes("official") ? "officielle" : "personnelle";
    if (!r.recipeVersion) r.recipeVersion = 1;
    if (!r.priceMode) r.priceMode = "piece";
    if (r.costKgHT === undefined) r.costKgHT = r.weightG ? rnd(r.costPieceHT * 1000 / r.weightG, 3) : 0;
    return r;
  }

  function mergeOfficialData() {
    if (!db.families) db.families = [];
    if (!db.recipes) db.recipes = [];

    (INIT.families || []).forEach((f) => { if (!db.families.includes(f)) db.families.push(f); });

    const byId = new Set(db.recipes.map((r) => String(r.id)));
    const byNameFam = new Set(db.recipes.map((r) => `${String(r.name).toLowerCase()}||${String(r.family).toLowerCase()}`));

    (INIT.recipes || []).forEach((r) => {
      normRecipe(r);
      const key = `${String(r.name).toLowerCase()}||${String(r.family).toLowerCase()}`;
      if (!byId.has(String(r.id)) && !byNameFam.has(key)) {
        const copy = structuredClone(r);
        copy.selected = false;
        copy.publish = false;
        db.recipes.push(copy);
      }
    });

    db.version = INIT.version || "11.0.0";
    db.officialUrl = URL;
    db.storageMode = "protected-v11";
    db.recipes.forEach(normRecipe);
  }

  mergeOfficialData();

  function calc(r) {
    normRecipe(r);
    const t = parse(r.priceTTC), w = parse(r.weightG), vat = parse(r.vat), cost = parse(r.costPieceHT);
    const kg = w ? t * 1000 / w : 0;
    const ht = t / (1 + vat / 100);
    const ckg = w ? cost * 1000 / w : 0;
    const mh = ht - cost;
    const mt = t - cost * (1 + vat / 100);
    const mp = ht ? mh / ht * 100 : 0;
    const coef = cost ? ht / cost : 0;
    return { kg, ht, ckg, mh, mt, mp, coef };
  }

  function sync(r, field) {
    normRecipe(r);
    if (["priceTTC","priceKgTTC","weightG","vat","costPieceHT","costKgHT","coef"].includes(field)) r[field] = Math.max(0, parse(r[field]));

    const w = parse(r.weightG);
    const oldKg = parse(r.costKgHT);

    if (field === "priceKgTTC") {
      r.priceMode = "kg";
      r.priceTTC = w ? rnd(parse(r.priceKgTTC) * w / 1000, 2) : 0;
    }

    if (field === "priceTTC") {
      r.priceMode = "piece";
      r.priceKgTTC = w ? rnd(parse(r.priceTTC) * 1000 / w, 2) : 0;
    }

    if (field === "costPieceHT") r.costKgHT = w ? rnd(parse(r.costPieceHT) * 1000 / w, 3) : 0;
    if (field === "costKgHT") r.costPieceHT = w ? rnd(parse(r.costKgHT) * w / 1000, 3) : 0;

    if (field === "weightG") {
      if (r.priceMode === "kg") r.priceTTC = w ? rnd(parse(r.priceKgTTC) * w / 1000, 2) : 0;
      else r.priceKgTTC = w ? rnd(parse(r.priceTTC) * 1000 / w, 2) : 0;
      r.costPieceHT = w ? rnd(oldKg * w / 1000, 3) : 0;
    }

    if (field === "coef") {
      const ht = parse(r.priceTTC) / (1 + parse(r.vat) / 100);
      const coef = parse(r.coef);
      if (coef > 0) {
        r.costPieceHT = rnd(ht / coef, 3);
        r.costKgHT = w ? rnd(r.costPieceHT * 1000 / w, 3) : 0;
      }
    }

    const c = calc(r);
    r.priceKgTTC = rnd(c.kg, 2);
    r.costKgHT = rnd(c.ckg, 3);
    r.coef = rnd(c.coef, 2);
  }

  function save() {
    localStorage.setItem(STORE, JSON.stringify(db));
    const st = $("status");
    if (st) {
      st.textContent = "Sauvegardé automatiquement ✓";
      st.className = "saved";
    }
  }

  function autoSave() {
    clearTimeout(saveTimer);
    const st = $("status");
    if (st) {
      st.textContent = "Sauvegarde en cours...";
      st.className = "unsaved";
    }
    saveTimer = setTimeout(save, 250);
  }

  function color(m) { return m >= 80 ? "green" : m >= 75 ? "orange" : "red"; }

  function renderFamilies() {
    const box = $("familiesList");
    if (!box) return;
    box.innerHTML = "";
    ["Toutes", ...db.families].forEach((f) => {
      const count = f === "Toutes" ? db.recipes.length : db.recipes.filter((r) => r.family === f).length;
      const line = document.createElement("div");
      line.className = "familyLine";

      const main = document.createElement("button");
      main.className = "familyBtn " + (f === current ? "active" : "");
      main.innerHTML = `<span>${esc(f)}</span><b>${count}</b>`;
      main.onclick = () => { current = f; render(); };
      line.appendChild(main);

      if (f !== "Toutes" && mode === "admin") {
        const edit = document.createElement("button");
        edit.className = "secondary smallBtn";
        edit.textContent = "✏️";
        edit.onclick = () => renameFamilyPrompt(f);

        const del = document.createElement("button");
        del.className = "danger smallBtn";
        del.textContent = "🗑";
        del.onclick = () => deleteFamily(f);

        line.appendChild(edit);
        line.appendChild(del);
      } else {
        line.appendChild(document.createElement("span"));
        line.appendChild(document.createElement("span"));
      }

      box.appendChild(line);
    });
  }

  function render() {
    renderFamilies();
    const q = ($("search")?.value || "").toLowerCase().trim();
    const list = db.recipes.filter((r) => (current === "Toutes" || r.family === current) && (!q || r.name.toLowerCase().includes(q) || r.family.toLowerCase().includes(q)));
    const sel = list.filter((r) => r.selected);
    const pub = list.filter((r) => r.publish);
    const base = sel.length ? sel : list;
    const sm = base.reduce((a, r) => a + calc(r).mp, 0);
    const mt = base.reduce((a, r) => a + calc(r).mt, 0);

    if ($("summary")) {
      $("summary").innerHTML = `<div class="pill">Mode : <b>${mode === "admin" ? "Admin" : "Utilisateur"}</b></div><div class="pill">Famille : <b>${esc(current)}</b></div><div class="pill">Recettes : <b>${list.length}</b></div><div class="pill">Sélection marge : <b>${sel.length}</b></div><div class="pill">À publier : <b>${pub.length}</b></div><div class="pill">Marge moyenne : <b>${base.length ? num(sm / base.length, 1) : "0,0"} %</b></div><div class="pill">100 pièces : <b>${euro(mt * 100)}</b></div>`;
    }

    const lb = $("list");
    if (!lb) return;
    lb.innerHTML = "";
    list.forEach((r) => lb.appendChild(card(r)));
  }

  function inputBlock(i, k, label, value, type = "number") {
    return `<div><label>${label}</label><input type="${type}" step="0.001" value="${esc(value)}" data-index="${i}" data-key="${k}"></div>`;
  }

  function card(r) {
    const i = db.recipes.indexOf(r);
    const c = calc(r);
    const d = document.createElement("div");
    d.className = "recipe";

    const publishBox = mode === "admin" ? `<label class="checkItem"><input type="checkbox" ${r.publish ? "checked" : ""} data-index="${i}" data-key="publish"> À publier</label>` : "";

    d.innerHTML = `<div class="checks"><label class="checkItem"><input type="checkbox" ${r.selected ? "checked" : ""} data-index="${i}" data-key="selected"> Sélection marge</label>${publishBox}</div><div class="recipeTitleBox"><input value="${esc(r.name)}" data-index="${i}" data-key="name"></div><div class="grid"><div><label>Famille</label><select data-index="${i}" data-key="family">${db.families.map((f) => `<option value="${esc(f)}" ${f === r.family ? "selected" : ""}>${esc(f)}</option>`).join("")}</select></div>${inputBlock(i,"priceTTC","Prix TTC",r.priceTTC)}${inputBlock(i,"priceKgTTC","Prix/kg TTC",r.priceKgTTC)}${inputBlock(i,"weightG","Poids g",r.weightG)}${inputBlock(i,"vat","TVA %",r.vat)}<div><label>Prix HT</label><div class="readonly">${euro(c.ht)}</div></div><div><label>Coût/kg HT</label><div class="readonly">${euro(c.ckg)}</div></div>${inputBlock(i,"costPieceHT","Coût pièce HT",r.costPieceHT)}${inputBlock(i,"coef","Coefficient",rnd(c.coef,2))}<div><label>Marge € HT</label><div class="readonly">${euro(c.mh)}</div></div><div><label>Marge € TTC</label><div class="readonly">${euro(c.mt)}</div></div></div><div class="actions"><span class="badge ${color(c.mp)}">${num(c.mp,1)} %</span><div><button class="copy" data-action="dup" data-index="${i}">Dupliquer</button><button class="danger" data-action="del" data-index="${i}">Supprimer</button></div></div>`;
    return d;
  }

  function update(index, key, value) {
    const r = db.recipes[index];
    if (!r) return;

    if (key === "selected" || key === "publish") r[key] = !!value;
    else if (key === "name" || key === "family") r[key] = value;
    else {
      r[key] = parse(value);
      sync(r, key);
    }

    autoSave();
    render();
  }

  function newFamily() {
    let f = prompt("Nom de la nouvelle famille");
    if (!f) return;
    f = f.trim();
    if (!f) return;
    if (db.families.includes(f)) return alert("Cette famille existe déjà.");
    db.families.push(f);
    current = f;
    autoSave();
    render();
  }

  function renameFamilyPrompt(oldName) {
    const n = prompt("Nouveau nom de la famille", oldName);
    if (n) renameFamily(oldName, n);
  }

  function renameFamily(oldName, newName) {
    newName = (newName || "").trim();
    if (!newName || oldName === newName) return;
    if (db.families.includes(newName)) return alert("Cette famille existe déjà.");
    if (!confirm(`Renommer la famille "${oldName}" en "${newName}" ?`)) return;

    db.families = db.families.map((f) => f === oldName ? newName : f);
    db.recipes.forEach((r) => { if (r.family === oldName) r.family = newName; });
    if (current === oldName) current = newName;
    autoSave();
    render();
  }

  function deleteFamily(f) {
    const count = db.recipes.filter((r) => r.family === f).length;
    if (!confirm(`Confirmer la suppression de la famille "${f}" ?`)) return;

    if (count > 0) {
      const others = db.families.filter((x) => x !== f);
      if (!others.length) return alert("Crée une autre famille avant.");
      const target = prompt(`Cette famille contient ${count} recette(s). Vers quelle famille déplacer ?`, others[0]);
      if (!target) return;
      if (!db.families.includes(target)) db.families.push(target);
      db.recipes.forEach((r) => { if (r.family === f) r.family = target; });
    }

    db.families = db.families.filter((x) => x !== f);
    current = "Toutes";
    autoSave();
    render();
  }

  function newRecipe() {
    const n = prompt("Nom de la nouvelle recette", "Nouvelle recette");
    if (!n) return;
    const fam = current !== "Toutes" ? current : (db.families[0] || "Pain");
    db.recipes.unshift({
      id: "r19-user-" + Date.now(),
      source: "personnelle",
      recipeVersion: 1,
      name: n.trim(),
      family: fam,
      selected: false,
      publish: false,
      priceTTC: 1,
      priceKgTTC: 4,
      weightG: 250,
      vat: 5.5,
      costPieceHT: .15,
      costKgHT: .6,
      coef: 6.35,
      priceMode: "piece"
    });
    current = fam;
    autoSave();
    render();
  }

  function dup(i) {
    const r = structuredClone(db.recipes[i]);
    r.id = "r19-user-" + Date.now();
    r.name += " copie";
    r.source = "personnelle";
    r.publish = false;
    db.recipes.splice(i + 1, 0, r);
    autoSave();
    render();
  }

  function del(i) {
    const r = db.recipes[i];
    if (confirm(`Confirmer la suppression de la recette "${r.name}" ?`)) {
      db.recipes.splice(i, 1);
      autoSave();
      render();
    }
  }

  function modal(html) {
    $("modalContent").innerHTML = html;
    $("modal").style.display = "flex";
  }

  function closeModal() {
    $("modal").style.display = "none";
  }

  async function openAdmin() {
    if (!isAdmin) return;
    const pin = ADMIN_PIN;
    if (!initFirebase()) return alert("Firebase non disponible.");

    modal(`<h2>Administration des accès</h2><div class="box"><b>Demandes d’accès</b></div><div id="adminList">Chargement...</div><button class="secondary" data-action="closeModal">Fermer</button>`);

    const list = $("adminList");
    try {
      const snap = await firestore.collection("demandes_acces").orderBy("createdAt", "desc").limit(50).get();
      if (snap.empty) {
        list.innerHTML = "<p>Aucune demande.</p>";
        return;
      }

      list.innerHTML = "";
      snap.forEach((doc) => {
        const d = doc.data();
        const row = document.createElement("div");
        row.className = "adminLine";
        row.innerHTML = `<div><b>${esc(d.bakeryName || doc.id)}</b><div class="adminStatus">Statut : ${esc(d.status || "en_attente")}<br>${esc(doc.id)}</div></div><button class="ok" data-action="authorize" data-id="${esc(doc.id)}">Accepter</button><button class="secondary" data-action="pending" data-id="${esc(doc.id)}">En attente</button><button class="danger" data-action="refuse" data-id="${esc(doc.id)}">Refuser</button><button class="secondary" data-action="suspend" data-id="${esc(doc.id)}">Suspendre</button><button class="danger" data-action="deleteAccess" data-id="${esc(doc.id)}">Supprimer</button>`;
        list.appendChild(row);
      });
    } catch (e) {
      list.innerHTML = "<p>Erreur : " + esc(e.message || e) + "</p>";
    }
  }

  async function authorizeAccess(id) {
    if (!initFirebase()) return;
    await firestore.collection("demandes_acces").doc(id).set({
      status: "autorise",
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    alert("Accès autorisé.");
    openAdmin();
  }

  async function refuseAccess(id) {
    if (!initFirebase()) return;
    if (!confirm("Refuser cet accès ?")) return;
    await firestore.collection("demandes_acces").doc(id).set({
      status: "refuse",
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    alert("Accès refusé.");
    openAdmin();
  }

  async function pendingAccess(id) {
    if (!initFirebase()) return;
    await firestore.collection("demandes_acces").doc(id).set({
      status: "en_attente",
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    alert("Demande remise en attente.");
    openAdmin();
  }

  async function suspendAccess(id) {
    if (!initFirebase()) return;
    if (!confirm("Suspendre cet accès ?")) return;
    await firestore.collection("demandes_acces").doc(id).set({
      status: "suspendu",
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    alert("Accès suspendu.");
    openAdmin();
  }

  async function deleteAccess(id) {
    if (!initFirebase()) return;
    if (!confirm("Supprimer définitivement cette demande ?")) return;
    await firestore.collection("demandes_acces").doc(id).delete();
    alert("Demande supprimée.");
    openAdmin();
  }

  function openPublish() {
    const selected = db.recipes.filter((r) => r.publish);
    modal(`<h2>Créer une mise à jour</h2><div class="box publish"><b>${selected.length} recette(s) cochée(s)</b></div><div class="box">${selected.map((r) => `• ${esc(r.family)} — ${esc(r.name)}`).join("<br>") || "Aucune recette cochée."}</div><div class="row"><button data-action="exportUpdate">Créer fichier</button><label class="uploadBtn">Importer mise à jour<input type="file" id="importUpdateFile" accept=".json"></label><button class="secondary" data-action="closeModal">Fermer</button></div>`);
  }

  function exportUpdate() {
    const selected = db.recipes.filter((r) => r.publish);
    if (!selected.length) return alert("Aucune recette cochée.");

    const pack = {
      type: "recette19-update",
      createdAt: new Date().toISOString(),
      families: [...new Set(selected.map((r) => r.family))],
      recipes: selected.map((r) => structuredClone(r))
    };
    pack.recipes.forEach((r) => { r.publish = false; r.selected = false; });
    downloadJSON(pack, "mise_a_jour_recettes_19.json");
  }

  function importUpdateFile(file) {
    readJSONFile(file, (pack) => {
      if (pack.type !== "recette19-update" || !pack.recipes) return alert("Fichier invalide.");
      let added = 0;
      pack.families?.forEach((f) => { if (!db.families.includes(f)) db.families.push(f); });
      pack.recipes.forEach((nr) => {
        normRecipe(nr);
        nr.publish = false;
        nr.selected = false;
        if (!db.recipes.find((r) => r.id === nr.id)) {
          db.recipes.push(nr);
          added++;
        }
      });
      save();
      closeModal();
      render();
      alert(`${added} recette(s) ajoutée(s).`);
    });
  }

  function openClientSend() {
    const options = db.recipes.map((r, i) => `<option value="${i}">${esc(r.family)} — ${esc(r.name)}</option>`).join("");
    modal(`<h2>Envoyer recette client</h2><div class="box"><select id="clientRecipeSelect">${options}</select></div><div class="row"><button data-action="exportClientRecipe">Créer fichier JSON</button><button class="copy" data-action="shareClientRecipeText">Partager résumé</button><button class="secondary" data-action="closeModal">Fermer</button></div>`);
  }

  function exportClientRecipe() {
    const r = db.recipes[parse($("clientRecipeSelect")?.value)];
    if (!r) return;
    downloadJSON({ type: "recette19-client-recipe", createdAt: new Date().toISOString(), recipe: structuredClone(r) }, "recette_client_" + String(r.name).replace(/[^a-z0-9-_]+/gi, "_") + ".json");
  }

  async function shareClientRecipeText() {
    const r = db.recipes[parse($("clientRecipeSelect")?.value)];
    if (!r) return;
    const c = calc(r);
    const text = `Recette client\nFamille : ${r.family}\nNom : ${r.name}\nPrix TTC : ${r.priceTTC}\nPoids : ${r.weightG} g\nMarge : ${num(c.mp, 1)} %`;
    if (navigator.share) await navigator.share({ title: "Recette client", text });
    else navigator.clipboard?.writeText(text);
  }

  function settings() {
    if (!isAdmin) { modal(`<h2>Paramètres</h2><div class="box"><b>Version V12</b></div><div class="box">Application Recette 19</div><button class="secondary" data-action="closeModal">Fermer</button>`); return; }
    modal(`<h2>Paramètres</h2><div class="box"><b>Version ${INIT.version || "11.0.0"}</b><br>Données protégées V11.</div><div class="box"><b>Mode</b><div class="row"><button data-action="setModeAdmin">Mode Admin</button><button class="secondary" data-action="setModeUser">Mode Utilisateur</button></div></div><div class="box"><div class="row"><button data-action="exportJSON">Sauvegarde JSON</button><label class="uploadBtn">Restaurer JSON<input type="file" id="importJsonFile" accept=".json"></label><button data-action="exportCSV">Export CSV</button></div></div><button class="secondary" data-action="closeModal">Fermer</button>`);
  }

  function setMode(m) {
    mode = m === "user" ? "user" : "admin";
    closeModal();
    render();
    autoSave();
  }

  function exportJSON() {
    save();
    downloadJSON(db, "sauvegarde_complete_recette19.json");
  }

  function importJSONFile(file) {
    readJSONFile(file, (d) => {
      if (!d.recipes || !d.families) return alert("Fichier invalide.");
      db = d;
      db.recipes.forEach(normRecipe);
      save();
      closeModal();
      render();
      alert("Sauvegarde restaurée.");
    });
  }

  function exportCSV() {
    const rows = [["Famille","Nom","Prix TTC","Poids","Cout HT","Marge %"]];
    db.recipes.forEach((r) => {
      const c = calc(r);
      rows.push([r.family, r.name, r.priceTTC, r.weightG, r.costPieceHT, c.mp]);
    });
    const csv = rows.map((r) => r.map((x) => `"${String(x).replaceAll('"','""')}"`).join(";")).join("\n");
    downloadBlob(csv, "recette19.csv", "text/csv;charset=utf-8");
  }

  function installHelp() {
    modal(`<h2>Installer l’application</h2><div class="box"><b>iPhone</b><br>Safari → Partager → Sur l’écran d’accueil.</div><div class="box"><b>Samsung / Android</b><br>Chrome → ⋮ → Ajouter à l’écran d’accueil.</div><button class="secondary" data-action="closeModal">Fermer</button>`);
  }

  function hideInstall() {
    $("installBox").style.display = "none";
    localStorage.setItem("recette19_install_hidden", "1");
  }

  function downloadJSON(obj, name) {
    downloadBlob(JSON.stringify(obj, null, 2), name, "application/json");
  }

  function downloadBlob(content, name, type) {
    const b = new Blob([content], { type });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(b);
    a.download = name;
    a.click();
  }

  function readJSONFile(file, cb) {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      try { cb(JSON.parse(r.result)); }
      catch { alert("Fichier invalide."); }
    };
    r.readAsText(file);
  }

  function bindEvents() {
    $("btnRequestAccess")?.addEventListener("click", requestAccess);
    $("btnCheckAccess")?.addEventListener("click", checkAccess);
    $("btnNewFamily")?.addEventListener("click", newFamily);
    $("btnNewFamily2")?.addEventListener("click", newFamily);
    $("btnNewRecipe")?.addEventListener("click", newRecipe);
    $("btnPublish")?.addEventListener("click", openPublish);
    $("btnClientSend")?.addEventListener("click", openClientSend);
    $("btnAdmin")?.addEventListener("click", openAdmin);
    $("btnSettings")?.addEventListener("click", settings);
    $("btnSave")?.addEventListener("click", save);
    $("btnInstallHelp")?.addEventListener("click", installHelp);
    $("btnHideInstall")?.addEventListener("click", hideInstall);
    $("search")?.addEventListener("input", render);

    document.addEventListener("change", (e) => {
      const el = e.target;
      if (el.dataset?.index !== undefined && el.dataset?.key) {
        const i = Number(el.dataset.index);
        const key = el.dataset.key;
        const value = el.type === "checkbox" ? el.checked : el.value;
        update(i, key, value);
      }
      if (el.id === "importJsonFile") importJSONFile(el.files[0]);
      if (el.id === "importUpdateFile") importUpdateFile(el.files[0]);
    });

    document.addEventListener("click", (e) => {
      const el = e.target.closest("[data-action]");
      if (!el) return;
      const action = el.dataset.action;
      const i = el.dataset.index !== undefined ? Number(el.dataset.index) : null;
      const id = el.dataset.id;

      if (action === "dup") dup(i);
      if (action === "del") del(i);
      if (action === "closeModal") closeModal();
      if (action === "authorize") authorizeAccess(id);
      if (action === "refuse") refuseAccess(id);
      if (action === "pending") pendingAccess(id);
      if (action === "suspend") suspendAccess(id);
      if (action === "deleteAccess") deleteAccess(id);
      if (action === "exportUpdate") exportUpdate();
      if (action === "exportClientRecipe") exportClientRecipe();
      if (action === "shareClientRecipeText") shareClientRecipeText();
      if (action === "setModeAdmin") setMode("admin");
      if (action === "setModeUser") setMode("user");
      if (action === "exportJSON") exportJSON();
      if (action === "exportCSV") exportCSV();
    });
  }

  function start() {
    bindEvents();
    bindLogoLongPress();
    applySecurityUI();
    if (localStorage.getItem("recette19_install_hidden") === "1" && $("installBox")) $("installBox").style.display = "none";
    save();
    initFirebase();
    setTimeout(checkAccess, 700);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();

  return {
    requestAccess,
    checkAccess,
    openAdmin,
    authorizeAccess,
    refuseAccess,
    pendingAccess,
    suspendAccess,
    deleteAccess,
    render,
    save,
    newFamily,
    newRecipe,
    update,
    dup,
    del,
    settings,
    closeModal,
    renameFamily,
    renameFamilyPrompt,
    deleteFamily,
    openPublish,
    exportUpdate,
    openClientSend,
    exportClientRecipe,
    shareClientRecipeText,
    setMode,
    exportJSON,
    exportCSV,
    installHelp,
    hideInstall
  };
})();
