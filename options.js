// Contrôleur de la page des options avancées (options.js)

document.addEventListener("DOMContentLoaded", () => {
  const storage = chrome.storage.sync || chrome.storage.local;

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
  const autoBackupToggle = document.getElementById("auto-backup-toggle");

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
      else if (tabId === "advanced-tab") tabTitle.textContent = "Options Avancées";
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
    storage.get({
      globalContext: "",
      forcedElements: [],
      excludedElements: [],
      pseudonymMode: "aliases",
      showOverlay: true,
      autoBackupEnabled: false,
      customPatterns: [],
      customDictionaries: { names: [], locations: [], orgs: [] },
      pseudonymProfile: "standard"
    }, (items) => {
      // Contexte
      systemContextTextarea.value = items.globalContext || "";
      
      // Mode de pseudonymisation
      const modeRadio = document.querySelector(`input[name="global-pseudonym-mode"][value="${items.pseudonymMode}"]`);
      if (modeRadio) modeRadio.checked = true;

      // Auto-backup toggle
      if (autoBackupToggle) {
        autoBackupToggle.checked = items.autoBackupEnabled === true;
      }

      // Profil de pseudonymisation
      const profileVal = items.pseudonymProfile || "standard";
      const profileRadio = document.querySelector(`input[name="pseudonym-profile-option"][value="${profileVal}"]`);
      if (profileRadio) profileRadio.checked = true;

      // Dictionnaires personnalisés
      const dict = items.customDictionaries || { names: [], locations: [], orgs: [] };
      const namesTextarea = document.getElementById("dict-names-textarea");
      const locationsTextarea = document.getElementById("dict-locations-textarea");
      const orgsTextarea = document.getElementById("dict-orgs-textarea");
      if (namesTextarea) namesTextarea.value = (dict.names || []).join("\n");
      if (locationsTextarea) locationsTextarea.value = (dict.locations || []).join("\n");
      if (orgsTextarea) orgsTextarea.value = (dict.orgs || []).join("\n");

      // Liste Forçage
      forcedElements = items.forcedElements || [];
      renderList(forcedElements, forceList, "force");
      
      // Liste Exclusion
      excludedElements = items.excludedElements || [];
      renderList(excludedElements, excludeList, "exclude");

      // Mettre à jour les compteurs
      updateCounters();

      // Mettre à jour les motifs personnalisés
      renderRegexList(items.customPatterns || []);

      // Charger les statistiques
      loadStats();
    });
  }

  // Écouteur pour le changement de mode global
  document.querySelectorAll('input[name="global-pseudonym-mode"]').forEach(radio => {
    radio.addEventListener("change", (e) => {
      const mode = e.target.value;
      storage.set({ pseudonymMode: mode }, () => {
        showToast("Mode de pseudonymisation mis à jour !");
        triggerAutoBackup();
      });
    });
  });

  // Écouteur pour le changement de profil
  document.querySelectorAll('input[name="pseudonym-profile-option"]').forEach(radio => {
    radio.addEventListener("change", (e) => {
      const profile = e.target.value;
      storage.set({ pseudonymProfile: profile }, () => {
        showToast("Profil de pseudonymisation mis à jour !");
        triggerAutoBackup();
      });
    });
  });

  // Écouteur pour la bascule de sauvegarde automatique
  if (autoBackupToggle) {
    autoBackupToggle.addEventListener("change", () => {
      const enabled = autoBackupToggle.checked;
      storage.set({ autoBackupEnabled: enabled }, () => {
        showToast(enabled ? "Sauvegarde automatique activée !" : "Sauvegarde automatique désactivée.");
        if (enabled) {
          triggerAutoBackup();
        }
      });
    });
  }

  // Mettre à jour les compteurs sur le menu de navigation
  function updateCounters() {
    forceBadgeCount.textContent = forcedElements.length;
    excludeBadgeCount.textContent = excludedElements.length;
  }

  // Rendu générique des listes d'éléments
  function renderList(array, listElement, listType) {
    listElement.innerHTML = "";
    if (array.length === 0) {
      listElement.innerHTML = `<li class="list-item" style="justify-content: center; color: var(--text-secondary);">Aucun élément enregistré</li>`;
      return;
    }

    array.forEach((itemVal) => {
      const isObj = itemVal && typeof itemVal === "object";
      const textVal = isObj ? itemVal.value : itemVal;
      const categoryType = isObj ? itemVal.type : null;

      const li = document.createElement("li");
      li.className = "list-item";
      li.setAttribute("data-value", textVal.toLowerCase());

      const textSpan = document.createElement("span");
      textSpan.className = "list-item-text";
      textSpan.textContent = categoryType ? `${textVal} [${categoryType}]` : textVal;

      const delBtn = document.createElement("button");
      delBtn.className = "delete-btn";
      delBtn.innerHTML = "&times;";
      delBtn.title = "Supprimer cet élément";
      delBtn.addEventListener("click", () => {
        removeItem(itemVal, listType);
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
      const typeSelect = document.getElementById("add-force-type-select");
      const selectedType = typeSelect ? typeSelect.value : "FORCE";

      let updated = false;
      const alreadyExists = forcedElements.some(el => {
        const val = el && typeof el === "object" ? el.value : el;
        return val.toLowerCase() === value.toLowerCase();
      });

      if (alreadyExists) {
        // Update type of existing item
        forcedElements = forcedElements.map(el => {
          const val = el && typeof el === "object" ? el.value : el;
          if (val.toLowerCase() === value.toLowerCase()) {
            updated = true;
            return { value: val, type: selectedType };
          }
          return el;
        });
      } else {
        forcedElements.push({ value: value, type: selectedType });
      }

      storage.set({ forcedElements: forcedElements }, () => {
        inputElement.value = "";
        renderList(forcedElements, forceList, "force");
        updateCounters();
        showToast(updated ? `Type de "${value}" mis à jour en "${selectedType}".` : "Élément ajouté à la liste de forçage !");
        triggerAutoBackup();
      });
    } else if (type === "exclude") {
      const alreadyExists = excludedElements.some(el => {
        const val = el && typeof el === "object" ? el.value : el;
        return val.toLowerCase() === value.toLowerCase();
      });
      if (alreadyExists) {
        showToast("Cet élément est déjà dans la liste d'exclusion.", true);
        return;
      }
      excludedElements.push(value);
      storage.set({ excludedElements: excludedElements }, () => {
        inputElement.value = "";
        renderList(excludedElements, excludeList, "exclude");
        updateCounters();
        showToast("Élément exclu !");
        triggerAutoBackup();
      });
    }
  }

  // Supprimer un élément
  function removeItem(itemVal, type) {
    if (type === "force") {
      forcedElements = forcedElements.filter(el => {
        if (el === itemVal) return false;
        if (el && itemVal && typeof el === "object" && typeof itemVal === "object") {
          return el.value !== itemVal.value || el.type !== itemVal.type;
        }
        return el !== itemVal;
      });
      storage.set({ forcedElements: forcedElements }, () => {
        renderList(forcedElements, forceList, "force");
        updateCounters();
        showToast("Élément supprimé de la liste de forçage.");
        triggerAutoBackup();
      });
    } else if (type === "exclude") {
      excludedElements = excludedElements.filter(el => {
        if (el === itemVal) return false;
        if (el && itemVal && typeof el === "object" && typeof itemVal === "object") {
          return el.value !== itemVal.value || el.type !== itemVal.type;
        }
        return el !== itemVal;
      });
      storage.set({ excludedElements: excludedElements }, () => {
        renderList(excludedElements, excludeList, "exclude");
        updateCounters();
        showToast("Élément supprimé de la liste d'exclusion.");
        triggerAutoBackup();
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
    storage.set({ globalContext: text }, () => {
      showToast("Contexte système enregistré avec succès !");
      triggerAutoBackup();
    });
  });

  // --- 7. EXPORT JSON ---
  exportBtn.addEventListener("click", () => {
    storage.get({
      globalContext: "",
      forcedElements: [],
      excludedElements: [],
      pseudonymMode: "aliases",
      customPatterns: [],
      customDictionaries: { names: [], locations: [], orgs: [] },
      pseudonymProfile: "standard"
    }, (items) => {
      const backupData = {
        app: "AnonymAI",
        exportDate: new Date().toISOString(),
        globalContext: items.globalContext,
        pseudonymMode: items.pseudonymMode,
        forcedElements: items.forcedElements,
        excludedElements: items.excludedElements,
        customPatterns: items.customPatterns,
        customDictionaries: items.customDictionaries,
        pseudonymProfile: items.pseudonymProfile
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

  // --- 7b. SAUVEGARDE AUTOMATIQUE JSON (GÉRÉE EN ARRIÈRE-PLAN) ---
  function triggerAutoBackup() {
    // La sauvegarde automatique est gérée de manière réactive par background.js
  }

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
        storage.set({
          globalContext: parsed.globalContext,
          pseudonymMode: parsed.pseudonymMode || "aliases",
          forcedElements: parsed.forcedElements,
          excludedElements: parsed.excludedElements,
          customPatterns: parsed.customPatterns || [],
          customDictionaries: parsed.customDictionaries || { names: [], locations: [], orgs: [] },
          pseudonymProfile: parsed.pseudonymProfile || "standard"
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

  // --- 9. GESTION DES REGEX ---
  const addRegexBtn = document.getElementById("add-regex-btn");
  const regexNameInput = document.getElementById("regex-name-input");
  const regexPatternInput = document.getElementById("regex-pattern-input");
  const regexTypeSelect = document.getElementById("regex-type-select");
  const regexList = document.getElementById("regex-list");

  function renderRegexList(patterns) {
    if (!regexList) return;
    regexList.innerHTML = "";
    if (!patterns || patterns.length === 0) {
      regexList.innerHTML = `<li class="list-item" style="justify-content: center; color: var(--text-secondary);">Aucun motif personnalisé enregistré</li>`;
      return;
    }
    patterns.forEach((pat, idx) => {
      const li = document.createElement("li");
      li.className = "list-item";
      
      const textSpan = document.createElement("span");
      textSpan.className = "list-item-text";
      textSpan.textContent = `${pat.name || "Regex " + (idx+1)} : ${pat.pattern} ➔ [${pat.replacementType}]`;
      
      const delBtn = document.createElement("button");
      delBtn.className = "delete-btn";
      delBtn.innerHTML = "&times;";
      delBtn.title = "Supprimer ce motif";
      delBtn.addEventListener("click", () => {
        removeRegex(idx);
      });
      
      li.appendChild(textSpan);
      li.appendChild(delBtn);
      regexList.appendChild(li);
    });
  }

  function removeRegex(index) {
    storage.get({ customPatterns: [] }, (items) => {
      const patterns = items.customPatterns || [];
      patterns.splice(index, 1);
      storage.set({ customPatterns: patterns }, () => {
        renderRegexList(patterns);
        showToast("Motif personnalisé supprimé.");
        triggerAutoBackup();
      });
    });
  }

  if (addRegexBtn) {
    addRegexBtn.addEventListener("click", () => {
      const name = regexNameInput.value.trim();
      const pattern = regexPatternInput.value.trim();
      const replacementType = regexTypeSelect.value;
      
      if (!name || !pattern) {
        showToast("Veuillez saisir un nom de règle et une expression régulière.", true);
        return;
      }
      
      try {
        new RegExp(pattern);
      } catch (e) {
        showToast("Expression régulière invalide : " + e.message, true);
        return;
      }
      
      storage.get({ customPatterns: [] }, (items) => {
        const patterns = items.customPatterns || [];
        patterns.push({
          name: name,
          pattern: pattern,
          replacementType: replacementType,
          caseInsensitive: true
        });
        storage.set({ customPatterns: patterns }, () => {
          regexNameInput.value = "";
          regexPatternInput.value = "";
          renderRegexList(patterns);
          showToast("Motif personnalisé ajouté !");
          triggerAutoBackup();
        });
      });
    });
  }

  // --- 10. GESTION DES DICTIONNAIRES ---
  const saveDictsBtn = document.getElementById("save-dictionaries-btn");
  if (saveDictsBtn) {
    saveDictsBtn.addEventListener("click", () => {
      const namesTextarea = document.getElementById("dict-names-textarea");
      const locationsTextarea = document.getElementById("dict-locations-textarea");
      const orgsTextarea = document.getElementById("dict-orgs-textarea");
      
      const parseTextarea = (textarea) => {
        if (!textarea) return [];
        return textarea.value.split(/\r?\n/)
          .map(line => line.trim())
          .filter(line => line.length > 0);
      };
      
      const customDictionaries = {
        names: parseTextarea(namesTextarea),
        locations: parseTextarea(locationsTextarea),
        orgs: parseTextarea(orgsTextarea)
      };
      
      storage.set({ customDictionaries: customDictionaries }, () => {
        showToast("Dictionnaires métiers enregistrés !");
        triggerAutoBackup();
      });
    });
  }

  // --- 11. TABLEAU DE BORD DES STATISTIQUES ---
  function loadStats() {
    chrome.storage.local.get({ stats: {} }, (data) => {
      const stats = data.stats || {};
      
      // Mettre à jour le compteur global
      const statsTotalCount = document.getElementById("stats-total-count");
      let total = 0;
      for (const val of Object.values(stats)) {
        total += val;
      }
      if (statsTotalCount) {
        statsTotalCount.textContent = total;
      }

      // Mettre à jour la valeur par défaut au centre du camembert
      const pieCenterVal = document.getElementById("pie-center-val");
      const pieCenterLabel = document.getElementById("pie-center-label");
      if (pieCenterVal) {
        pieCenterVal.textContent = total;
      }
      if (pieCenterLabel) {
        pieCenterLabel.textContent = "Total";
        pieCenterLabel.style.color = "var(--text-secondary)";
      }

      const categoryLabels = {
        "NOM_PRENOM": "Noms complets",
        "PRENOM": "Prénoms",
        "NOM": "Noms de famille",
        "EMAIL": "Emails",
        "TELEPHONE": "Téléphones",
        "VILLE": "Villes / Lieux",
        "ORGANISATION": "Organisations",
        "SECURE_SOCIALE": "Sécurité Sociale",
        "IBAN": "IBANs",
        "CARTE_BANCAIRE": "Cartes Bancaires",
        "CODE_POSTAL": "Codes Postaux",
        "FORCE": "Termes forcés"
      };

      const categoryColors = {
        "NOM_PRENOM": "#10b981",    // Emerald
        "PRENOM": "#14b8a6",        // Teal
        "NOM": "#06b6d4",           // Cyan
        "EMAIL": "#3b82f6",         // Blue
        "TELEPHONE": "#6366f1",     // Indigo
        "VILLE": "#8b5cf6",         // Violet
        "ORGANISATION": "#d946ef",  // Fuchsia
        "SECURE_SOCIALE": "#f43f5e",// Rose
        "IBAN": "#f59e0b",          // Amber
        "CARTE_BANCAIRE": "#f97316",// Orange
        "CODE_POSTAL": "#0ea5e9",   // Sky
        "FORCE": "#64748b"          // Slate
      };

      const defaultColor = "#cbd5e1";

      // Rendu du Camembert SVG
      const svgEl = document.getElementById("pie-chart-svg");
      if (svgEl) {
        svgEl.innerHTML = "";
        
        if (total === 0) {
          // Aucun élément bloqué : cercle gris neutre
          const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
          circle.setAttribute("cx", "50");
          circle.setAttribute("cy", "50");
          circle.setAttribute("r", "35");
          circle.setAttribute("fill", "none");
          circle.setAttribute("stroke", "#334155");
          circle.setAttribute("stroke-width", "12");
          svgEl.appendChild(circle);
        } else {
          // Dessiner les tranches SVG
          const sortedStatsForPie = Object.entries(stats)
            .filter(([_, count]) => count > 0)
            .sort((a, b) => b[1] - a[1]);

          const C = 219.911; // Circonférence (2 * PI * r) où r = 35
          let accumulatedOffset = 0;

          sortedStatsForPie.forEach(([cat, count]) => {
            const percentage = (count / total) * 100;
            const sliceLength = (count / total) * C;
            const color = categoryColors[cat] || defaultColor;
            const label = categoryLabels[cat] || cat;

            const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circle.setAttribute("cx", "50");
            circle.setAttribute("cy", "50");
            circle.setAttribute("r", "35");
            circle.setAttribute("class", "pie-chart-slice");
            circle.setAttribute("stroke", color);
            circle.style.setProperty("--slice-color", color);
            circle.setAttribute("stroke-dasharray", `${sliceLength} ${C}`);
            circle.setAttribute("stroke-dashoffset", `${C - accumulatedOffset}`);
            circle.setAttribute("transform", "rotate(-90 50 50)"); // Démarrage à 12h

            // Interactivité au survol
            circle.addEventListener("mouseenter", () => {
              if (pieCenterVal) {
                pieCenterVal.textContent = `${percentage.toFixed(0)}%`;
              }
              if (pieCenterLabel) {
                pieCenterLabel.textContent = label;
                pieCenterLabel.style.color = color;
              }
            });

            circle.addEventListener("mouseleave", () => {
              if (pieCenterVal) {
                pieCenterVal.textContent = total;
              }
              if (pieCenterLabel) {
                pieCenterLabel.textContent = "Total";
                pieCenterLabel.style.color = "var(--text-secondary)";
              }
            });

            svgEl.appendChild(circle);
            accumulatedOffset += sliceLength;
          });
        }
      }
      
      // Mettre à jour les barres de progression
      const container = document.getElementById("stats-bars-container");
      if (!container) return;
      
      container.innerHTML = "";
      
      let maxCount = 0;
      for (const count of Object.values(stats)) {
        if (count > maxCount) maxCount = count;
      }
      
      if (total === 0) {
        container.innerHTML = `<div style="text-align: center; color: var(--text-secondary); padding: 24px; font-size: 13px;">Aucune statistique enregistrée pour le moment.</div>`;
        return;
      }
      
      const sortedStats = Object.entries(stats)
        .filter(([_, count]) => count > 0)
        .sort((a, b) => b[1] - a[1]);
        
      sortedStats.forEach(([cat, count]) => {
        const label = categoryLabels[cat] || cat;
        const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;
        
        const barItem = document.createElement("div");
        barItem.className = "stat-bar-item";
        
        const barInfo = document.createElement("div");
        barInfo.className = "stat-bar-info";
        
        const barLabel = document.createElement("span");
        barLabel.className = "stat-bar-label";
        barLabel.textContent = label;
        
        const barVal = document.createElement("span");
        barVal.className = "stat-bar-val";
        barVal.textContent = count;
        
        barInfo.appendChild(barLabel);
        barInfo.appendChild(barVal);
        
        const barTrack = document.createElement("div");
        barTrack.className = "stat-bar-track";
        
        const barFill = document.createElement("div");
        barFill.className = "stat-bar-fill";
        
        barTrack.appendChild(barFill);
        barItem.appendChild(barInfo);
        barItem.appendChild(barTrack);
        
        container.appendChild(barItem);
        
        // Petite animation
        setTimeout(() => {
          barFill.style.width = `${percentage}%`;
        }, 50);
      });
    });
  }

  // Recharger stats si changées par d'autres onglets
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes.stats) {
      loadStats();
    }
  });

  // --- 12. IMPORT EN LOT (BULK IMPORTER) & RÉSOLUTION DES CONFLITS ---
  const bulkImportFile = document.getElementById("bulk-import-file");
  const bulkImportFileName = document.getElementById("bulk-import-file-name");
  const bulkImportTextarea = document.getElementById("bulk-import-textarea");
  const bulkImportPreviewBtn = document.getElementById("bulk-import-preview-btn");
  const bulkPreviewArea = document.getElementById("bulk-import-preview-area");
  const bulkTableBody = document.getElementById("bulk-import-table-body");
  const bulkCount = document.getElementById("bulk-import-count");
  const bulkImportCancelBtn = document.getElementById("bulk-import-cancel-btn");
  const bulkImportConfirmBtn = document.getElementById("bulk-import-confirm-btn");

  let parsedImportItems = [];

  function mapType(rawType) {
    if (!rawType) return "FORCE";
    const norm = rawType.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    if (norm === "nom complet" || norm === "nom_prenom" || norm === "fullname" || norm === "full name" || norm === "nom et prenom" || norm === "prenom nom" || norm === "prenom_nom") {
      return "NOM_PRENOM";
    }
    if (norm === "prenom" || norm === "firstname" || norm === "first name" || norm === "given name") {
      return "PRENOM";
    }
    if (norm === "nom" || norm === "nom de famille" || norm === "lastname" || norm === "last name" || norm === "surname") {
      return "NOM";
    }
    if (norm === "lieu" || norm === "ville" || norm === "adresse" || norm === "location" || norm === "city" || norm === "address" || norm === "pays" || norm === "country") {
      return "VILLE";
    }
    if (norm === "organisation" || norm === "entreprise" || norm === "societe" || norm === "collectivite" || norm === "mairie" || norm === "company" || norm === "organization" || norm === "org") {
      return "ORGANISATION";
    }
    if (norm === "telephone" || norm === "tel" || norm === "phone" || norm === "mobile") {
      return "TELEPHONE";
    }
    if (norm === "email" || norm === "courriel" || norm === "e-mail" || norm === "mail") {
      return "EMAIL";
    }
    return "FORCE";
  }

  if (bulkImportFile) {
    bulkImportFile.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      bulkImportFileName.textContent = file.name;
      const reader = new FileReader();
      reader.onload = (evt) => {
        bulkImportTextarea.value = evt.target.result;
        showToast("Fichier chargé dans la zone de texte. Cliquez sur Prévisualiser.");
      };
      reader.readAsText(file);
    });
  }

  if (bulkImportPreviewBtn) {
    bulkImportPreviewBtn.addEventListener("click", () => {
      const text = bulkImportTextarea.value.trim();
      if (!text) {
        showToast("Veuillez saisir du texte ou charger un fichier.", true);
        return;
      }
      
      const lines = text.split(/\r?\n/);
      parsedImportItems = [];
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;
        
        let delimiter = null;
        if (trimmedLine.includes("\t")) {
          delimiter = "\t";
        } else if (trimmedLine.includes(";")) {
          delimiter = ";";
        } else if (trimmedLine.includes(",")) {
          delimiter = ",";
        }
        
        let val = "";
        let rawType = "";
        if (delimiter) {
          const parts = trimmedLine.split(delimiter);
          val = parts[0].trim();
          rawType = parts.slice(1).join(delimiter).trim();
        } else {
          val = trimmedLine;
        }
        
        val = val.replace(/^["']|["']$/g, "").trim();
        rawType = rawType.replace(/^["']|["']$/g, "").trim();
        
        if (!val) continue;
        
        const mappedType = mapType(rawType);
        
        let status = "new";
        
        // 1. Détecter d'abord si le terme est présent dans les exclusions (Conflit)
        const isExcluded = excludedElements.some(el => {
          const checkVal = el && typeof el === "object" ? el.value : el;
          return checkVal.toLowerCase() === val.toLowerCase();
        });
        
        if (isExcluded) {
          status = "conflict";
        } else {
          // 2. Sinon, vérifier s'il est déjà dans le forçage
          const existingItem = forcedElements.find(el => {
            const checkVal = el && typeof el === "object" ? el.value : el;
            return checkVal.toLowerCase() === val.toLowerCase();
          });
          
          if (existingItem) {
            const existingType = existingItem && typeof existingItem === "object" ? (existingItem.type || "FORCE") : "FORCE";
            if (existingType === mappedType) {
              status = "exists";
            } else {
              status = "update";
            }
          }
        }
        
        parsedImportItems.push({
          value: val,
          type: mappedType,
          status: status
        });
      }
      
      if (parsedImportItems.length === 0) {
        showToast("Aucun élément valide détecté.", true);
        return;
      }
      
      bulkTableBody.innerHTML = "";
      bulkCount.textContent = parsedImportItems.length;
      
      parsedImportItems.forEach((item) => {
        const tr = document.createElement("tr");
        tr.style.borderBottom = "1px solid var(--border-color)";
        
        const tdValue = document.createElement("td");
        tdValue.style.padding = "10px 16px";
        tdValue.style.color = "var(--text-primary)";
        tdValue.textContent = item.value;
        
        const tdType = document.createElement("td");
        tdType.style.padding = "10px 16px";
        tdType.style.color = "var(--text-secondary)";
        tdType.textContent = item.type;
        
        const tdStatus = document.createElement("td");
        tdStatus.style.padding = "10px 16px";
        
        const spanBadge = document.createElement("span");
        spanBadge.className = "status-badge";
        if (item.status === "new") {
          spanBadge.classList.add("status-new");
          spanBadge.textContent = "Nouveau";
        } else if (item.status === "exists") {
          spanBadge.classList.add("status-exists");
          spanBadge.textContent = "Déjà présent";
        } else if (item.status === "update") {
          spanBadge.classList.add("status-update");
          spanBadge.textContent = "Mise à jour";
        } else if (item.status === "conflict") {
          spanBadge.className = "status-badge conflict-badge";
          spanBadge.textContent = "Conflit (Exclu)";
        }
        
        tdStatus.appendChild(spanBadge);
        
        const tdConflict = document.createElement("td");
        tdConflict.style.padding = "10px 16px";
        
        if (item.status === "conflict") {
          const label = document.createElement("label");
          label.className = "conflict-resolve-toggle";
          
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.checked = true; // Retrait activé par défaut
          
          item.resolveCheckbox = checkbox;
          
          label.appendChild(checkbox);
          label.appendChild(document.createTextNode(" Retirer des exclusions"));
          tdConflict.appendChild(label);
        } else {
          tdConflict.textContent = "-";
          tdConflict.style.color = "var(--text-secondary)";
          tdConflict.style.textAlign = "center";
        }
        
        tr.appendChild(tdValue);
        tr.appendChild(tdType);
        tr.appendChild(tdStatus);
        tr.appendChild(tdConflict);
        bulkTableBody.appendChild(tr);
      });
      
      bulkPreviewArea.style.display = "block";
      showToast("Aperçu généré !");
    });
  }

  if (bulkImportCancelBtn) {
    bulkImportCancelBtn.addEventListener("click", () => {
      bulkImportTextarea.value = "";
      if (bulkImportFile) bulkImportFile.value = "";
      if (bulkImportFileName) bulkImportFileName.textContent = "Aucun fichier sélectionné";
      if (bulkPreviewArea) bulkPreviewArea.style.display = "none";
      parsedImportItems = [];
      showToast("Importation annulée.");
    });
  }

  if (bulkImportConfirmBtn) {
    bulkImportConfirmBtn.addEventListener("click", () => {
      if (parsedImportItems.length === 0) return;
      
      let exclusionsModified = false;
      
      parsedImportItems.forEach(item => {
        // Résolution de conflit : retirer de la liste d'exclusions si coché
        if (item.status === "conflict" && item.resolveCheckbox && item.resolveCheckbox.checked) {
          excludedElements = excludedElements.filter(el => {
            const val = el && typeof el === "object" ? el.value : el;
            return val.toLowerCase() !== item.value.toLowerCase();
          });
          exclusionsModified = true;
        }

        const index = forcedElements.findIndex(el => {
          const val = el && typeof el === "object" ? el.value : el;
          return val.toLowerCase() === item.value.toLowerCase();
        });
        
        if (index !== -1) {
          forcedElements[index] = { value: forcedElements[index].value || forcedElements[index], type: item.type };
        } else {
          forcedElements.push({ value: item.value, type: item.type });
        }
      });
      
      const storageData = { forcedElements: forcedElements };
      if (exclusionsModified) {
        storageData.excludedElements = excludedElements;
      }
      
      storage.set(storageData, () => {
        renderList(forcedElements, forceList, "force");
        if (exclusionsModified) {
          renderList(excludedElements, excludeList, "exclude");
        }
        updateCounters();
        showToast(`${parsedImportItems.length} éléments importés ou mis à jour !`);
        triggerAutoBackup();
        
        bulkImportTextarea.value = "";
        if (bulkImportFile) bulkImportFile.value = "";
        if (bulkImportFileName) bulkImportFileName.textContent = "Aucun fichier sélectionné";
        if (bulkPreviewArea) bulkPreviewArea.style.display = "none";
        parsedImportItems = [];
      });
    });
  }

  // Charger la configuration à l'ouverture de la page
  loadConfiguration();
});

