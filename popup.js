// Script de contrôle du Popup (popup.js)

document.addEventListener("DOMContentLoaded", () => {
  const globalToggle = document.getElementById("global-toggle");
  const statusBadge = document.getElementById("status-badge");
  const statusText = document.getElementById("status-text");
  const quickContext = document.getElementById("quick-context");
  const saveContextBtn = document.getElementById("save-context-btn");
  const clearSessionBtn = document.getElementById("clear-session-btn");
  const mappingContainer = document.getElementById("mapping-container");
  const openOptionsBtn = document.getElementById("open-options-btn");
  const overlayToggle = document.getElementById("overlay-toggle");

  let currentTabId = null;
  let isAIPage = false;

  // 1. Déterminer l'onglet actif et son URL
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    if (!activeTab) return;
    currentTabId = activeTab.id;
    const url = activeTab.url || "";

    // Vérifier si l'onglet courant correspond à un site d'IA cible
    isAIPage = /gemini\.google\.com|chatgpt\.com|claude\.ai/i.test(url);

    // Initialiser les réglages et l'état visuel
    loadSettings();
  });

  // 2. Charger les paramètres depuis le stockage local
  function loadSettings() {
    chrome.storage.local.get({
      enabled: true,
      globalContext: "",
      pseudonymMode: "aliases",
      showOverlay: true
    }, (items) => {
      // Activer/Désactiver l'interrupteur
      globalToggle.checked = items.enabled !== false;
      overlayToggle.checked = items.showOverlay !== false;
      
      // Charger le contexte système
      quickContext.value = items.globalContext || "";

      // Charger le mode de masquage
      const modeRadio = document.querySelector(`input[name="pseudonym-mode"][value="${items.pseudonymMode}"]`);
      if (modeRadio) modeRadio.checked = true;

      // Mettre à jour l'indicateur d'état de l'onglet
      updateStatusUI(globalToggle.checked);

      // Charger les correspondances de session s'il s'agit d'un onglet IA actif
      if (currentTabId) {
        loadSessionMappings();
      }
    });
  }

  // 3. Mettre à jour l'interface en fonction de l'état d'activité
  function updateStatusUI(isEnabled) {
    statusBadge.classList.remove("active", "inactive");
    if (!isEnabled) {
      statusBadge.classList.add("inactive");
      statusText.textContent = "Protection désactivée";
    } else if (isAIPage) {
      statusBadge.classList.add("active");
      statusText.textContent = "Actif sur cette page IA";
    } else {
      statusBadge.classList.remove("active", "inactive");
      statusText.textContent = "En attente d'une page IA...";
    }
  }

  // 4. Charger et afficher la base locale des jetons de session (onglet courant)
  function loadSessionMappings() {
    const sessionKey = `session_tab_${currentTabId}`;
    chrome.storage.local.get([sessionKey], (data) => {
      const sessionState = data[sessionKey];
      
      if (!sessionState || !sessionState.mappings || Object.keys(sessionState.mappings).length === 0) {
        showEmptyMappings();
        return;
      }

      // Vider le conteneur
      mappingContainer.innerHTML = "";

      const mappings = sessionState.mappings;
      const generatedAliases = sessionState.generatedAliases || [];

      // Déterminer la liste des clés à afficher (soit les jetons [X_Y], soit les alias générés)
      const displayKeys = Object.keys(mappings).filter(key => {
        return (key.startsWith("[") && key.endsWith("]")) || generatedAliases.includes(key);
      });

      if (displayKeys.length === 0) {
        showEmptyMappings();
        return;
      }

      // Trier les clés pour l'affichage
      displayKeys.sort().forEach(key => {
        const originalVal = mappings[key];
        
        const item = document.createElement("div");
        item.className = "mapping-item";
        
        const keySpan = document.createElement("span");
        keySpan.className = "mapping-key";
        keySpan.textContent = key;
        
        const valSpan = document.createElement("span");
        valSpan.className = "mapping-val";
        valSpan.textContent = originalVal;
        valSpan.title = originalVal;

        item.appendChild(keySpan);
        item.appendChild(valSpan);
        mappingContainer.appendChild(item);
      });
    });
  }

  function showEmptyMappings() {
    mappingContainer.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">📁</span>
        <p>Aucune donnée pseudonymisée dans cette conversation pour l'instant.</p>
      </div>
    `;
  }

  // 5. Gérer les événements de bascule d'activation globale
  globalToggle.addEventListener("change", () => {
    const isEnabled = globalToggle.checked;
    chrome.storage.local.set({ enabled: isEnabled }, () => {
      updateStatusUI(isEnabled);
      // Envoyer un message à l'onglet actif pour recharger l'état sans recharger la page
      if (currentTabId) {
        chrome.tabs.sendMessage(currentTabId, { action: "toggle_active", enabled: isEnabled }, () => {
          // Ignorer les erreurs d'onglets non injectés
          const err = chrome.runtime.lastError;
        });
      }
    });
  });

  // Gérer le changement de mode de pseudonymisation (Jetons vs Alias)
  document.querySelectorAll('input[name="pseudonym-mode"]').forEach(radio => {
    radio.addEventListener("change", (e) => {
      const mode = e.target.value;
      chrome.storage.local.set({ pseudonymMode: mode }, () => {
        // Optionnel: Recharger les mappings de session affichés si le mode change
        if (currentTabId) {
          loadSessionMappings();
          // Envoyer une notification à la page de recharger sa config
          chrome.tabs.sendMessage(currentTabId, { action: "toggle_active", enabled: globalToggle.checked }, () => {
            const err = chrome.runtime.lastError;
          });
        }
      });
    });
  });

  // Gérer le changement d'overlay
  overlayToggle.addEventListener("change", () => {
    const show = overlayToggle.checked;
    chrome.storage.local.set({ showOverlay: show }, () => {
      if (currentTabId) {
        chrome.tabs.sendMessage(currentTabId, { action: "toggle_active", enabled: globalToggle.checked }, () => {
          const err = chrome.runtime.lastError;
        });
      }
    });
  });

  // 6. Sauvegarder le contexte système
  saveContextBtn.addEventListener("click", () => {
    const contextText = quickContext.value;
    chrome.storage.local.set({ globalContext: contextText }, () => {
      const originalText = saveContextBtn.textContent;
      saveContextBtn.textContent = "Sauvegardé !";
      saveContextBtn.style.backgroundColor = "#059669"; // Couleur verte plus foncée temporaire
      setTimeout(() => {
        saveContextBtn.textContent = originalText;
        saveContextBtn.style.backgroundColor = "";
      }, 1500);
    });
  });

  // 7. Effacer la session de l'onglet courant
  clearSessionBtn.addEventListener("click", () => {
    if (!currentTabId) return;
    const sessionKey = `session_tab_${currentTabId}`;
    
    // Supprimer du stockage
    chrome.storage.local.remove([sessionKey], () => {
      showEmptyMappings();
      // Informer l'onglet de vider son état local en mémoire
      chrome.tabs.sendMessage(currentTabId, { action: "clear_session" }, () => {
        const err = chrome.runtime.lastError;
      });
    });
  });

  // 8. Ouvrir la page des options avancées
  openOptionsBtn.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });
});
