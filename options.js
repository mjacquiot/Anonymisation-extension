// Contrôleur de la page des options avancées (options.js)

document.addEventListener("DOMContentLoaded", () => {
  // Navigation des onglets
  const menuItems = document.querySelectorAll(".menu-item");
  const panels = document.querySelectorAll(".panel");
  const tabTitle = document.getElementById("tab-title");

  // Contexte Système
  const systemContextTextarea = document.getElementById("system-context");
  const saveContextBtn = document.getElementById("save-context-btn");


  // Éléments à Forcer
  const addForceInput = document.getElementById("add-force-input");
  const addForceBtn = document.getElementById("add-force-btn");
  const searchForceInput = document.getElementById("search-force-input");
  const forceList = document.getElementById("force-list");
  const forceBadgeCount = document.getElementById("force-badge-count");

  // Éléments à Exclure
  const addExcludeInput = document.getElementById("add-exclude-input");
  const addExcludeBtn = document.getElementById("add-exclude-btn");
  const searchExcludeInput = document.getElementById("search-exclude-input");
  const excludeList = document.getElementById("exclude-list");
  const excludeBadgeCount = document.getElementById("exclude-badge-count");

  // Import / Export
  const exportBtn = document.getElementById("export-btn");
  const importFileInput = document.getElementById("import-file");
  const importFileName = document.getElementById("import-file-name");

  // Notification Toast
  const toast = document.getElementById("toast");

  // Variables globales de cache local
  let forcedElements = [];
  let excludedElements = [];

  // --- 1. GESTION DES ONGLETS ---
  menuItems.forEach(item => {
    item.addEventListener("click", () => {
      // Retirer la classe active de tous les onglets du menu
      menuItems.forEach(mi => mi.classList.remove("active"));
      // Ajouter la classe active sur l'onglet cliqué
      item.classList.add("active");

      // Cacher tous les panneaux de contenu
      panels.forEach(p => p.classList.remove("active"));
      // Afficher le panneau correspondant
      const tabId = item.getAttribute("data-tab");
      document.getElementById(tabId).classList.add("active");

      // Mettre à jour le titre principal de la page
      if (tabId === "context-tab") tabTitle.textContent = "Contexte Système";
      else if (tabId === "force-tab") tabTitle.textContent = "Éléments à Forcer";
      else if (tabId === "exclude-tab") tabTitle.textContent = "Éléments à Exclure";
      else if (tabId === "backup-tab") tabTitle.textContent = "Sauvegarde & Import";
    });
  });

  // --- 2. NOTIFICATIONS TOAST ---
  function showToast(message, isError = false) {
    toast.textContent = message;
    toast.className = "toast"; // Reset
    if (isError) {
      toast.classList.add("error");
    }
    toast.classList.remove("hidden");
    
    // Auto-fermeture après 3 secondes
    setTimeout(() => {
      toast.classList.add("hidden");
    }, 3000);
  }

  // --- 3. CHARGEMENT DE LA CONFIGURATION ---
  function loadConfiguration() {
    chrome.storage.local.get({
      globalContext: "",
      forcedElements: [],
      excludedElements: [],
      pseudonymMode: "aliases",
      showOverlay: true
    }, (items) => {
      // Contexte
      systemContextTextarea.value = items.globalContext || "";
      
      // Mode de pseudonymisation
      const modeRadio = document.querySelector(`input[name="global-pseudonym-mode"][value="${items.pseudonymMode}"]`);
      if (modeRadio) modeRadio.checked = true;



      // Liste Forçage
      forcedElements = items.forcedElements || [];
      renderList(forcedElements, forceList, "force");
      
      // Liste Exclusion
      excludedElements = items.excludedElements || [];
      renderList(excludedElements, excludeList, "exclude");

      // Mettre à jour les compteurs
      updateCounters();
    });
  }

  // Écouteur pour le changement de mode global
  document.querySelectorAll('input[name="global-pseudonym-mode"]').forEach(radio => {
    radio.addEventListener("change", (e) => {
      const mode = e.target.value;
      chrome.storage.local.set({ pseudonymMode: mode }, () => {
        showToast("Mode de pseudonymisation mis à jour !");
      });
    });
  });



  // Mettre à jour les compteurs sur le menu de navigation
  function updateCounters() {
    forceBadgeCount.textContent = forcedElements.length;
    excludeBadgeCount.textContent = excludedElements.length;
  }

  // Rendu générique des listes d'éléments
  function renderList(array, listElement, type) {
    listElement.innerHTML = "";
    if (array.length === 0) {
      listElement.innerHTML = `<li class="list-item" style="justify-content: center; color: var(--text-secondary);">Aucun élément enregistré</li>`;
      return;
    }

    array.forEach((text) => {
      const li = document.createElement("li");
      li.className = "list-item";
      li.setAttribute("data-value", text.toLowerCase());

      const textSpan = document.createElement("span");
      textSpan.className = "list-item-text";
      textSpan.textContent = text;

      const delBtn = document.createElement("button");
      delBtn.className = "delete-btn";
      delBtn.innerHTML = "&times;";
      delBtn.title = "Supprimer cet élément";
      delBtn.addEventListener("click", () => {
        removeItem(text, type);
      });

      li.appendChild(textSpan);
      li.appendChild(delBtn);
      listElement.appendChild(li);
    });
  }

  // --- 4. OPÉRATIONS D'AJOUT ET SUPPRESSION ---

  // Ajouter un élément
  function addItem(inputElement, type) {
    const value = inputElement.value.trim();
    if (!value) return;

    if (type === "force") {
      const alreadyExists = forcedElements.some(el => el.toLowerCase() === value.toLowerCase());
      if (alreadyExists) {
        showToast("Cet élément est déjà dans la liste de forçage.", true);
        return;
      }
      forcedElements.push(value);
      chrome.storage.local.set({ forcedElements: forcedElements }, () => {
        inputElement.value = "";
        renderList(forcedElements, forceList, "force");
        updateCounters();
        showToast("Élément ajouté à la liste de forçage !");
      });
    } else if (type === "exclude") {
      const alreadyExists = excludedElements.some(el => el.toLowerCase() === value.toLowerCase());
      if (alreadyExists) {
        showToast("Cet élément est déjà dans la liste d'exclusion.", true);
        return;
      }
      excludedElements.push(value);
      chrome.storage.local.set({ excludedElements: excludedElements }, () => {
        inputElement.value = "";
        renderList(excludedElements, excludeList, "exclude");
        updateCounters();
        showToast("Élément exclu !");
      });
    }
  }

  // Supprimer un élément
  function removeItem(value, type) {
    if (type === "force") {
      forcedElements = forcedElements.filter(el => el !== value);
      chrome.storage.local.set({ forcedElements: forcedElements }, () => {
        renderList(forcedElements, forceList, "force");
        updateCounters();
        showToast("Élément supprimé de la liste de forçage.");
      });
    } else if (type === "exclude") {
      excludedElements = excludedElements.filter(el => el !== value);
      chrome.storage.local.set({ excludedElements: excludedElements }, () => {
        renderList(excludedElements, excludeList, "exclude");
        updateCounters();
        showToast("Élément supprimé de la liste d'exclusion.");
      });
    }
  }

  // Écouteurs pour l'ajout
  addForceBtn.addEventListener("click", () => addItem(addForceInput, "force"));
  addForceInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") addItem(addForceInput, "force");
  });

  addExcludeBtn.addEventListener("click", () => addItem(addExcludeInput, "exclude"));
  addExcludeInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") addItem(addExcludeInput, "exclude");
  });

  // --- 5. RECHERCHE DE FILTRES EN TEMPS RÉEL ---
  function setupSearch(searchInput, listElement) {
    searchInput.addEventListener("input", () => {
      const query = searchInput.value.toLowerCase().trim();
      const items = listElement.querySelectorAll(".list-item");
      
      items.forEach(item => {
        const val = item.getAttribute("data-value");
        if (val && val.includes(query)) {
          item.style.display = "flex";
        } else if (val) {
          item.style.display = "none";
        }
      });
    });
  }

  setupSearch(searchForceInput, forceList);
  setupSearch(searchExcludeInput, excludeList);

  // --- 6. SAUVEGARDE CONTEXTE SYSTÈME ---
  saveContextBtn.addEventListener("click", () => {
    const text = systemContextTextarea.value;
    chrome.storage.local.set({ globalContext: text }, () => {
      showToast("Contexte système enregistré avec succès !");
    });
  });

  // --- 7. EXPORT JSON ---
  exportBtn.addEventListener("click", () => {
    chrome.storage.local.get({
      globalContext: "",
      forcedElements: [],
      excludedElements: [],
      pseudonymMode: "tokens"
    }, (items) => {
      const backupData = {
        app: "AnonymAI",
        exportDate: new Date().toISOString(),
        globalContext: items.globalContext,
        pseudonymMode: items.pseudonymMode,
        forcedElements: items.forcedElements,
        excludedElements: items.excludedElements
      };

      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      // Création d'un lien invisible pour télécharger le fichier
      const a = document.createElement("a");
      a.href = url;
      a.download = `anonymai-configuration-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      showToast("Configuration exportée avec succès !");
    });
  });

  // --- 8. IMPORT JSON ---
  importFileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    importFileName.textContent = file.name;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target.result);
        
        // Validation basique de la structure du JSON
        if (parsed.globalContext === undefined || !Array.isArray(parsed.forcedElements) || !Array.isArray(parsed.excludedElements)) {
          throw new Error("Format JSON invalide. Les clés requises sont manquantes.");
        }

        // Enregistrer dans le stockage
        chrome.storage.local.set({
          globalContext: parsed.globalContext,
          pseudonymMode: parsed.pseudonymMode || "tokens",
          forcedElements: parsed.forcedElements,
          excludedElements: parsed.excludedElements
        }, () => {
          // Recharger les données dans l'UI
          loadConfiguration();
          showToast("Configuration importée avec succès !");
          importFileInput.value = ""; // Vider le file input
          importFileName.textContent = "Aucun fichier choisi";
        });
      } catch (err) {
        showToast("Erreur lors de la lecture du fichier : " + err.message, true);
        importFileInput.value = "";
        importFileName.textContent = "Aucun fichier choisi";
      }
    };
    reader.readAsText(file);
  });

  // Charger la configuration à l'ouverture de la page
  loadConfiguration();
});
