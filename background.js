// Service Worker d'arrière-plan de l'extension (background.js)
// Gère la création et l'écoute du menu contextuel (clic droit)

const storage = chrome.storage.sync || chrome.storage.local;

// Autoriser l'accès au stockage de session pour les scripts de contenu
if (chrome.storage.session && typeof chrome.storage.session.setAccessLevel === 'function') {
  chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });
}

// Initialisation au démarrage du navigateur
chrome.runtime.onStartup.addListener(() => {
  checkLicenseStatus();
});

// Initialisation à l'installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.storage.local.set({ installDate: Date.now() });
  }
  
  // Lancer une première vérification de licence
  checkLicenseStatus();

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

  if (info.menuItemId === "force_anonymize_parent") {
    chrome.tabs.sendMessage(tab.id, {
      action: "prompt_force_type",
      text: trimmedText
    }, () => {
      const err = chrome.runtime.lastError;
    });
    return;
  }

  const isForceAction = info.menuItemId.startsWith("force_type_");

  if (isForceAction) {
    let selectedType = "FORCE";
    if (info.menuItemId === "force_type_nom_prenom") selectedType = "NOM_PRENOM";
    else if (info.menuItemId === "force_type_prenom") selectedType = "PRENOM";
    else if (info.menuItemId === "force_type_nom") selectedType = "NOM";
    else if (info.menuItemId === "force_type_ville") selectedType = "VILLE";
    else if (info.menuItemId === "force_type_organisation") selectedType = "ORGANISATION";
    else if (info.menuItemId === "force_type_force") selectedType = "FORCE";

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
  } else if (request.action === "ocr_progress" || request.action === "offscreen_log") {
    if (request.tabId) {
      chrome.tabs.sendMessage(request.tabId, request).catch(() => {});
    } else {
      chrome.tabs.query({ active: true }, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, request).catch(() => {});
        });
      });
    }
    sendResponse({ success: true });
    return true;
  } else if (request.action === "open_options") {
    chrome.runtime.openOptionsPage();
    sendResponse({ success: true });
    return true;
  } else if (request.action === "check_license") {
    checkLicenseStatus().then(status => sendResponse({ success: true, status: status }));
    return true;
  } else if (request.action === "set_license_key") {
    chrome.storage.local.set({ licenseKey: request.licenseKey, licenseStatusCache: null }, () => {
      checkLicenseStatus().then(status => sendResponse({ success: true, status: status }));
    });
    return true;
  } else if (request.action === "process_file") {
    const tabId = sender.tab ? sender.tab.id : null;
    checkLicenseStatus().then(status => {
      if (!status.active) {
        sendResponse({ success: false, error: "Votre période d'essai ou votre abonnement AnonymAI est expiré. Veuillez activer votre licence." });
        return;
      }
      handleProcessFile(request.fileData, tabId)
        .then(result => sendResponse(result))
        .catch(err => sendResponse({ success: false, error: err.message || "Erreur de traitement." }));
    });
    return true; // Indique une réponse asynchrone
  }
});

// --- GESTION DU DOCUMENT OFFSCREEN POUR L'OCR TESSERACT ---
let creatingOffscreen = null;

async function createOffscreenDocument() {
  const offscreenUrl = chrome.runtime.getURL('offscreen.html');
  
  if (typeof chrome.offscreen.hasDocument === 'function') {
    const hasDoc = await chrome.offscreen.hasDocument();
    if (hasDoc) return;
  } else {
    // Fallback de compatibilité
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT']
    });
    if (contexts.length > 0) return;
  }

  if (creatingOffscreen) {
    await creatingOffscreen;
    return;
  }

  creatingOffscreen = chrome.offscreen.createDocument({
    url: offscreenUrl,
    reasons: ['DOM_PARSER'],
    justification: 'Parser et exécuter l\'OCR sur les documents PDF/images.',
  });
  
  await creatingOffscreen;
  creatingOffscreen = null;
}

async function closeOffscreenDocument() {
  if (typeof chrome.offscreen.hasDocument === 'function') {
    const hasDoc = await chrome.offscreen.hasDocument();
    if (!hasDoc) return;
  } else {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT']
    });
    if (contexts.length === 0) return;
  }
  
  await chrome.offscreen.closeDocument();
}

async function handleProcessFile(fileData, tabId) {
  try {
    await createOffscreenDocument();
    
    // Transmettre la demande de parsing au document offscreen
    const response = await chrome.runtime.sendMessage({
      action: "parse_document",
      fileData: fileData,
      tabId: tabId
    });
    
    // Fermer l'offscreen pour libérer la mémoire vive
    await closeOffscreenDocument();
    
    return response;
  } catch (err) {
    console.error("Error in background file processor:", err);
    await closeOffscreenDocument().catch(() => {});
    return { success: false, error: err.message || "Erreur lors de l'analyse dans l'Offscreen Document." };
  }
}

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

// --- VÉRIFICATION DE LICENCE STRIPE / GPO ---
async function checkLicenseStatus() {
  return new Promise((resolve) => {
    // 1. GPO / Managed Storage check (Highest priority)
    chrome.storage.managed.get(["licenseKey"], async (managedData) => {
      const errManaged = chrome.runtime.lastError;
      if (managedData && managedData.licenseKey) {
        // Active through GPO deployment
        const status = { active: true, reason: "managed", licenseKey: managedData.licenseKey };
        chrome.storage.session.set({ licenseStatus: status }).catch(() => {});
        return resolve(status);
      }

      // 2. Local License Key check
      chrome.storage.local.get(["licenseKey", "installDate", "licenseStatusCache"], async (localData) => {
        // Enregistrer la date d'installation si manquante (sécurité de rattrapage)
        if (!localData.installDate) {
          const now = Date.now();
          chrome.storage.local.set({ installDate: now });
          localData.installDate = now;
        }

        // Vérifier si clé utilisateur présente
        if (localData.licenseKey) {
          const cache = localData.licenseStatusCache;
          const cacheAge = cache ? Date.now() - cache.timestamp : null;
          if (cache && cacheAge !== null && cacheAge < 24 * 60 * 60 * 1000) {
            chrome.storage.session.set({ licenseStatus: cache.status }).catch(() => {});
            return resolve(cache.status);
          }

          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            
            const licenseUrl = "https://api.anonymai.fr/verify-license";
            const response = await fetch(licenseUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ licenseKey: localData.licenseKey }),
              signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (response.ok) {
              const resData = await response.json();
              const status = { active: resData.active === true, reason: "subscribed", enterprise: resData.enterprise === true };
              
              chrome.storage.local.set({ 
                licenseStatusCache: { timestamp: Date.now(), status: status } 
              });
              chrome.storage.session.set({ licenseStatus: status }).catch(() => {});
              return resolve(status);
            }
          } catch (fetchErr) {
            console.warn("Réseau indisponible pour vérifier Stripe, utilisation du cache hors-ligne.");
            if (cache) {
              chrome.storage.session.set({ licenseStatus: cache.status }).catch(() => {});
              return resolve(cache.status);
            }
          }
          
          // Fallback d'évaluation local
          const keyLower = localData.licenseKey.toLowerCase();
          if (localData.licenseKey.startsWith("key_") || keyLower.includes("premium") || keyLower.includes("test")) {
            const status = { active: true, reason: "subscribed", enterprise: false };
            chrome.storage.session.set({ licenseStatus: status }).catch(() => {});
            return resolve(status);
          }
        }

        // 3. Essai gratuit de 30 jours (Trial check)
        const elapsed = Date.now() - localData.installDate;
        const trialDuration = 30 * 24 * 60 * 60 * 1000;
        const daysRemaining = Math.max(0, Math.ceil((trialDuration - elapsed) / (24 * 60 * 60 * 1000)));

        if (elapsed < trialDuration) {
          const status = { active: true, reason: "trial", daysRemaining: daysRemaining };
          chrome.storage.session.set({ licenseStatus: status }).catch(() => {});
          return resolve(status);
        }

        // 4. Expiré
        const status = { active: false, reason: "expired" };
        chrome.storage.session.set({ licenseStatus: status }).catch(() => {});
        return resolve(status);
      });
    });
  });
}
