// Service Worker d'arrière-plan de l'extension (background.js)
// Gère la création et l'écoute du menu contextuel (clic droit)

const storage = chrome.storage.sync || chrome.storage.local;

// Initialisation à l'installation
chrome.runtime.onInstalled.addListener(() => {
  // Configurer les valeurs par défaut si elles n'existent pas
  storage.get({
    forcedElements: [],
    excludedElements: [],
    globalContext: "",
    enabled: true,
    pseudonymMode: "aliases",
    showOverlay: true
  }, (items) => {
    storage.set(items);
  });

  // Création des menus contextuels
  chrome.contextMenus.create({
    id: "force_anonymize_parent",
    title: "Toujours pseudonymiser : \"%s\"",
    contexts: ["selection"]
  });

  chrome.contextMenus.create({
    id: "force_type_nom_prenom",
    parentId: "force_anonymize_parent",
    title: "Nom complet (ex: Jean DUPONT)",
    contexts: ["selection"]
  });

  chrome.contextMenus.create({
    id: "force_type_prenom",
    parentId: "force_anonymize_parent",
    title: "Prénom",
    contexts: ["selection"]
  });

  chrome.contextMenus.create({
    id: "force_type_nom",
    parentId: "force_anonymize_parent",
    title: "Nom de famille",
    contexts: ["selection"]
  });

  chrome.contextMenus.create({
    id: "force_type_ville",
    parentId: "force_anonymize_parent",
    title: "Lieu / Ville",
    contexts: ["selection"]
  });

  chrome.contextMenus.create({
    id: "force_type_organisation",
    parentId: "force_anonymize_parent",
    title: "Organisation / Entreprise",
    contexts: ["selection"]
  });

  chrome.contextMenus.create({
    id: "force_type_force",
    parentId: "force_anonymize_parent",
    title: "Autre / Générique",
    contexts: ["selection"]
  });

  chrome.contextMenus.create({
    id: "exclude_anonymize",
    title: "Ne jamais pseudonymiser : \"%s\"",
    contexts: ["selection"]
  });
});

// Écoute du clic sur le menu contextuel
chrome.contextMenus.onClicked.addListener((info, tab) => {
  const selectedText = info.selectionText;
  if (!selectedText) return;

  const trimmedText = selectedText.trim();
  if (trimmedText.length === 0) return;

  const isForceAction = info.menuItemId.startsWith("force_type_") || info.menuItemId === "force_anonymize_parent";

  if (isForceAction) {
    let selectedType = "FORCE";
    if (info.menuItemId === "force_type_nom_prenom") selectedType = "NOM_PRENOM";
    else if (info.menuItemId === "force_type_prenom") selectedType = "PRENOM";
    else if (info.menuItemId === "force_type_nom") selectedType = "NOM";
    else if (info.menuItemId === "force_type_ville") selectedType = "VILLE";
    else if (info.menuItemId === "force_type_organisation") selectedType = "ORGANISATION";

    storage.get({ forcedElements: [] }, (data) => {
      const list = data.forcedElements || [];
      // Ajout unique insensible à la casse
      const alreadyExists = list.some(item => {
        const val = item && typeof item === "object" ? item.value : item;
        return val.toLowerCase() === trimmedText.toLowerCase();
      });

      if (!alreadyExists) {
        list.push({ value: trimmedText, type: selectedType });
        storage.set({ forcedElements: list }, () => {
          notifyTab(tab.id, {
            type: "success",
            message: `"${trimmedText}" (${selectedType}) sera désormais toujours pseudonymisé.`
          });
        });
      } else {
        // Mettre à jour le type si déjà existant
        const updatedList = list.map(item => {
          const val = item && typeof item === "object" ? item.value : item;
          if (val.toLowerCase() === trimmedText.toLowerCase()) {
            return { value: trimmedText, type: selectedType };
          }
          return item;
        });
        storage.set({ forcedElements: updatedList }, () => {
          notifyTab(tab.id, {
            type: "success",
            message: `"${trimmedText}" est maintenant forcé en tant que "${selectedType}".`
          });
        });
      }
    });
  } else if (info.menuItemId === "exclude_anonymize") {
    storage.get({ excludedElements: [] }, (data) => {
      const list = data.excludedElements || [];
      // Ajout unique insensible à la casse
      const alreadyExists = list.some(item => {
        const val = item && typeof item === "object" ? item.value : item;
        return val.toLowerCase() === trimmedText.toLowerCase();
      });
      if (!alreadyExists) {
        list.push(trimmedText);
        storage.set({ excludedElements: list }, () => {
          notifyTab(tab.id, {
            type: "success",
            message: `"${trimmedText}" sera exclu de la pseudonymisation.`
          });
        });
      } else {
        notifyTab(tab.id, {
          type: "info",
          message: `"${trimmedText}" est déjà présent dans la liste d'exclusion.`
        });
      }
    });
  }
});

// Fonction utilitaire pour envoyer un message à un onglet spécifique
function notifyTab(tabId, data) {
  if (!tabId) return;
  chrome.tabs.sendMessage(tabId, {
    action: "show_notification",
    type: data.type,
    text: data.message
  }, () => {
    // Capturer les erreurs de message au cas où le script de contenu n'est pas encore prêt/injecté
    const err = chrome.runtime.lastError;
  });
}

// Écouteur de messages génériques provenant des scripts de contenu ou popups
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "get_tab_id") {
    sendResponse({ tabId: sender.tab ? sender.tab.id : null });
    return true;
  } else if (request.action === "open_options") {
    chrome.runtime.openOptionsPage();
    sendResponse({ success: true });
    return true;
  }
});

// --- double sauvegarde automatique optimisée (arrière-plan) ---
let backupTimeout = null;

chrome.storage.onChanged.addListener((changes, areaName) => {
  // Ignorer si les seuls changements concernent nos caches de sauvegarde ou les statistiques locales
  const keys = Object.keys(changes);
  const isOnlyCacheOrStats = keys.every(k => k === "lastBackupPersonal" || k === "lastBackupShared" || k === "stats");
  if (isOnlyCacheOrStats) return;

  storage.get({ autoBackupEnabled: false }, (data) => {
    if (data.autoBackupEnabled) {
      if (backupTimeout) {
        clearTimeout(backupTimeout);
      }
      backupTimeout = setTimeout(() => {
        performDoubleBackup();
      }, 5000); // Débouclage de 5 secondes
    }
  });
});

function performDoubleBackup() {
  storage.get(null, (items) => {
    // Filtrer les métadonnées internes du backup pour ne pas polluer le JSON
    const cleanItems = { ...items };
    delete cleanItems.lastBackupPersonal;
    delete cleanItems.lastBackupShared;

    const personalConfig = {
      app: "AnonymAI",
      exportDate: new Date().toISOString(),
      ...cleanItems
    };

    const sharedConfig = { ...personalConfig };
    delete sharedConfig.globalContext;

    const personalJson = JSON.stringify(personalConfig, null, 2);
    const sharedJson = JSON.stringify(sharedConfig, null, 2);

    chrome.storage.local.get(["lastBackupPersonal", "lastBackupShared"], (localData) => {
      const lastPersonal = localData.lastBackupPersonal || "";
      const lastShared = localData.lastBackupShared || "";

      const personalChanged = (personalJson !== lastPersonal);
      const sharedChanged = (sharedJson !== lastShared);

      if (!personalChanged && !sharedChanged) {
        return;
      }

      const updates = {};
      if (personalChanged) updates.lastBackupPersonal = personalJson;
      if (sharedChanged) updates.lastBackupShared = sharedJson;

      chrome.storage.local.set(updates, () => {
        if (personalChanged) {
          const personalUrl = "data:application/json;charset=utf-8," + encodeURIComponent(personalJson);
          chrome.downloads.download({
            url: personalUrl,
            filename: "anonymai-config-personnelle.json",
            conflictAction: "overwrite"
          }, (downloadId) => {
            if (chrome.runtime.lastError) {
              console.error("Personal backup failed:", chrome.runtime.lastError.message);
            }
          });
        }

        if (sharedChanged) {
          const sharedUrl = "data:application/json;charset=utf-8," + encodeURIComponent(sharedJson);
          chrome.downloads.download({
            url: sharedUrl,
            filename: "anonymai-config-partageable.json",
            conflictAction: "overwrite"
          }, (downloadId) => {
            if (chrome.runtime.lastError) {
              console.error("Shared backup failed:", chrome.runtime.lastError.message);
            }
          });
        }
      });
    });
  });
}
