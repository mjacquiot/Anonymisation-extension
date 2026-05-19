// Service Worker d'arrière-plan de l'extension (background.js)
// Gère la création et l'écoute du menu contextuel (clic droit)

// Initialisation à l'installation
chrome.runtime.onInstalled.addListener(() => {
  // Configurer les valeurs par défaut si elles n'existent pas
  chrome.storage.local.get({
    forcedElements: [],
    excludedElements: [],
    globalContext: "",
    enabled: true
  }, (items) => {
    chrome.storage.local.set(items);
  });

  // Création des menus contextuels
  chrome.contextMenus.create({
    id: "force_anonymize",
    title: "Toujours pseudonymiser : \"%s\"",
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

  if (info.menuItemId === "force_anonymize") {
    chrome.storage.local.get({ forcedElements: [] }, (data) => {
      const list = data.forcedElements;
      // Ajout unique insensible à la casse
      const alreadyExists = list.some(item => item.toLowerCase() === trimmedText.toLowerCase());
      if (!alreadyExists) {
        list.push(trimmedText);
        chrome.storage.local.set({ forcedElements: list }, () => {
          notifyTab(tab.id, {
            type: "success",
            message: `"${trimmedText}" sera désormais toujours pseudonymisé.`
          });
        });
      } else {
        notifyTab(tab.id, {
          type: "info",
          message: `"${trimmedText}" est déjà présent dans la liste de forçage.`
        });
      }
    });
  } else if (info.menuItemId === "exclude_anonymize") {
    chrome.storage.local.get({ excludedElements: [] }, (data) => {
      const list = data.excludedElements;
      // Ajout unique insensible à la casse
      const alreadyExists = list.some(item => item.toLowerCase() === trimmedText.toLowerCase());
      if (!alreadyExists) {
        list.push(trimmedText);
        chrome.storage.local.set({ excludedElements: list }, () => {
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
