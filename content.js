// Script de contenu de l'extension (content.js)
// Injecté dans les pages d'IA cibles (Gemini, ChatGPT, Claude)

(function() {
  let tabId = null;
  let sessionState = { mappings: {}, counters: {} };
  let config = {
    enabled: true,
    globalContext: "",
    forcedElements: [],
    excludedElements: [],
    pseudonymMode: "aliases",
    showOverlay: true
  };

  // State V3 Multi-documents
  let uploadedFiles = [];
  let activeFileId = null;

  // Variables UI
  let fabEl = null;
  let panelEl = null;
  let shieldBtnEl = null;
  let isPanelOpen = false;
  let observer = null;

  // Fonction utilitaire pour normaliser les accents/diacritiques
  function removeDiacritics(str) {
    if (!str) return "";
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  // --- 1. INITIALISATION ET RÉCUPÉRATION DU TAB ID ---
  chrome.runtime.sendMessage({ action: "get_tab_id" }, (response) => {
    if (response && response.tabId) {
      tabId = response.tabId;
      loadSessionAndSettings();
    }
  });

  // Charger les configurations globales et la session locale du Tab
  function loadSessionAndSettings() {
    if (!tabId) return;
    const sessionKey = `session_tab_${tabId}`;
    
    // Charger la session depuis le stockage local (spécifique à l'onglet)
    chrome.storage.local.get([sessionKey], (localData) => {
      if (localData[sessionKey]) {
        sessionState = localData[sessionKey];
      } else {
        sessionState = { mappings: {}, counters: {} };
      }

      // Charger les configurations globales depuis le stockage synchronisé (avec fallback local)
      const storage = chrome.storage.sync || chrome.storage.local;
      storage.get({
        enabled: true,
        globalContext: "",
        forcedElements: [],
        excludedElements: [],
        pseudonymMode: "aliases",
        showOverlay: true,
        customPatterns: [],
        customDictionaries: { names: [], locations: [], orgs: [] },
        pseudonymProfile: "standard"
      }, (syncData) => {
        config.enabled = syncData.enabled !== false;
        config.globalContext = syncData.globalContext || "";
        config.forcedElements = syncData.forcedElements || [];
        config.excludedElements = syncData.excludedElements || [];
        config.pseudonymMode = syncData.pseudonymMode || "aliases";
        config.showOverlay = syncData.showOverlay !== false;
        config.customPatterns = syncData.customPatterns || [];
        config.customDictionaries = syncData.customDictionaries || { names: [], locations: [], orgs: [] };
        config.pseudonymProfile = syncData.pseudonymProfile || "standard";

        applyState();
      });
    });
  }

  // Écouteur de modifications du stockage pour actualisation dynamique
  chrome.storage.onChanged.addListener((changes, areaName) => {
    let needsReinit = false;

    // Traiter les changements de configuration globaux (sync ou local)
    if (areaName === "sync" || areaName === "local") {
      if (changes.enabled) {
        config.enabled = changes.enabled.newValue !== false;
        needsReinit = true;
      }
      if (changes.globalContext) {
        config.globalContext = changes.globalContext.newValue || "";
        needsReinit = true;
      }
      if (changes.forcedElements) {
        config.forcedElements = changes.forcedElements.newValue || [];
      }
      if (changes.excludedElements) {
        config.excludedElements = changes.excludedElements.newValue || [];
      }
      if (changes.pseudonymMode) {
        config.pseudonymMode = changes.pseudonymMode.newValue || "aliases";
        needsReinit = true;
      }
      if (changes.showOverlay) {
        config.showOverlay = changes.showOverlay.newValue !== false;
        const panelToggle = document.getElementById("anonymai-overlay-toggle");
        if (panelToggle) {
          panelToggle.checked = config.showOverlay;
        }
        needsReinit = true;
      }
      if (changes.customPatterns) {
        config.customPatterns = changes.customPatterns.newValue || [];
      }
      if (changes.customDictionaries) {
        config.customDictionaries = changes.customDictionaries.newValue || { names: [], locations: [], orgs: [] };
      }
      if (changes.pseudonymProfile) {
        config.pseudonymProfile = changes.pseudonymProfile.newValue || "standard";
        const profileSelect = document.getElementById("anonymai-profile-select");
        if (profileSelect) {
          profileSelect.value = config.pseudonymProfile;
        }
      }
    }

    // La session de l'onglet est toujours stockée en local
    if (areaName === "local" && tabId) {
      const sessionKey = `session_tab_${tabId}`;
      if (changes[sessionKey]) {
        sessionState = changes[sessionKey].newValue || { mappings: {}, counters: {} };
        updateFabBadge();
        updateMappingsList();
      }
    }

    if (areaName === "local" && changes.stats) {
      updatePanelStats();
    }

    if (needsReinit) {
      applyState();
    }
  });

  // Écouteur de messages en provenance du popup ou background
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "show_notification") {
      showToast(request.text, request.type);
    } else if (request.action === "toggle_active") {
      config.enabled = request.enabled;
      applyState();
    } else if (request.action === "clear_session") {
      sessionState = { mappings: {}, counters: {} };
      updateFabBadge();
      updateMappingsList();
      showToast("Session de pseudonymisation réinitialisée.", "info");
      // Optionnel : recharger la page pour enlever les surbrillances vertes si besoin
    }
  });

  // --- 2. GESTION DE L'ÉTAT ACTIF / INACTIF ---
  function applyState() {
    if (config.enabled) {
      injectUI();
      if (config.showOverlay) {
        startObserver();
        walkAndRestore(document.body);
      } else {
        stopObserver();
        removeRestoredSpans();
      }
      startInputWatcher();
    } else {
      removeUI();
      stopObserver();
      stopInputWatcher();
      removeRestoredSpans();
    }
  }

  // --- 3. SURVEILLANCE ET INJECTION DU BOUTON SHIELD SUR LES INPUTS ---
  let inputWatcherInterval = null;
  function startInputWatcher() {
    if (inputWatcherInterval) return;
    inputWatcherInterval = setInterval(() => {
      injectShieldButton();
    }, 1500);

    // Écouter les raccourcis clavier globaux sur la page
    window.addEventListener("keydown", handleGlobalKeydown);
    // Écouter les soumissions automatiques
    document.addEventListener("keydown", handleTextareaSubmit, true);
    document.addEventListener("click", handleSendButtonClick, true);
    document.addEventListener("input", handleInputModify, true);
  }

  function stopInputWatcher() {
    if (inputWatcherInterval) {
      clearInterval(inputWatcherInterval);
      inputWatcherInterval = null;
    }
    removeShieldButton();
    window.removeEventListener("keydown", handleGlobalKeydown);
    document.removeEventListener("keydown", handleTextareaSubmit, true);
    document.removeEventListener("click", handleSendButtonClick, true);
    document.removeEventListener("input", handleInputModify, true);
  }

  // Recherche de l'input d'écriture principal de l'IA
  function findAIInput() {
    const selectors = [
      '#prompt-textarea', // ChatGPT
      'div[contenteditable="true"]', // Claude & Gemini
      'div[role="textbox"]',
      'graft-wysiwyg-html-editor div',
      'textarea'
    ];
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el && el.offsetWidth > 0 && el.offsetHeight > 0 && !el.closest('.anonymai-ui')) {
        return el;
      }
    }
    return null;
  }

  function findAIToolbar() {
    // 1. Tenter d'abord de trouver la barre d'outils via le bouton d'envoi natif connu
    const sendBtn = findAISendButton();
    if (sendBtn) {
      // Remonter dans le DOM et chercher un parent flex qui contient d'autres éléments interactifs (pour éviter un wrapper exclusif du bouton d'envoi)
      let curr = sendBtn;
      let bestToolbar = null;
      for (let depth = 0; depth < 5; depth++) {
        if (curr.parentElement) {
          curr = curr.parentElement;
          const display = window.getComputedStyle(curr).display;
          if (display === 'flex' || display === 'inline-flex') {
            // Compter le nombre de boutons ou d'éléments interactifs
            const interactiveElements = curr.querySelectorAll('button, [role="button"], svg, input[type="file"]');
            if (interactiveElements.length > 1) {
              // C'est un conteneur flex avec plusieurs éléments interactifs, c'est la vraie barre d'outils
              return curr;
            }
            if (!bestToolbar) {
              bestToolbar = curr;
            }
          }
        }
      }
      if (bestToolbar) return bestToolbar;
      return sendBtn.parentElement;
    }

    // 2. Recherche par sélecteurs classiques de barres d'outils
    const selectors = [
      // ChatGPT: bottom bar containing action buttons
      '#prompt-textarea ~ div.flex.items-center.justify-between',
      '#prompt-textarea ~ div div.flex.items-center.gap-1',
      // Claude: control panel bottom bar
      'div[contenteditable="true"] ~ div.flex.justify-between.items-center',
      'div[contenteditable="true"] ~ div div.flex.items-center.gap-1',
      // Gemini: right / bottom controls
      '.input-area-controls',
      '.right-controls',
      // Generic toolbar classes
      '.toolbar',
      '.button-bar',
      'div[contenteditable="true"] + div div.flex',
      '#prompt-textarea + div div.flex'
    ];
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el && el.offsetWidth > 0 && el.offsetHeight > 0 && !el.closest('.anonymai-ui')) {
        return el;
      }
    }

    // 3. Autre recherche par boutons de contrôles secondaires (mic, audio, attach, file, etc.)
    const buttons = document.querySelectorAll("button");
    for (const btn of buttons) {
      if (btn.offsetWidth > 0 && btn.offsetHeight > 0 && !btn.closest('.anonymai-ui')) {
        const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
        const title = (btn.getAttribute('title') || '').toLowerCase();
        const isControl = ariaLabel.includes('mic') || ariaLabel.includes('audio') || 
                          ariaLabel.includes('attach') || ariaLabel.includes('file') || 
                          ariaLabel.includes('importer') || ariaLabel.includes('upload') ||
                          title.includes('mic') || title.includes('audio') || 
                          title.includes('attach') || title.includes('file') || 
                          title.includes('importer') || title.includes('upload');
        if (isControl) {
          let curr = btn;
          for (let depth = 0; depth < 5; depth++) {
            if (curr.parentElement) {
              curr = curr.parentElement;
              const display = window.getComputedStyle(curr).display;
              if (display === 'flex' || display === 'inline-flex') {
                const interactiveElements = curr.querySelectorAll('button, [role="button"], svg, input[type="file"]');
                if (interactiveElements.length > 1) {
                  return curr;
                }
              }
            }
          }
          return btn.parentElement;
        }
      }
    }

    // 4. Fallback historique : chercher des conteneurs flex à côté de l'input
    const inputEl = findAIInput();
    if (inputEl) {
      const parent = inputEl.parentNode;
      if (parent) {
        const divs = parent.querySelectorAll('div');
        for (const div of divs) {
          if (div !== inputEl && div.offsetWidth > 0 && div.offsetHeight > 0) {
            const hasButtons = div.querySelector('button');
            const display = window.getComputedStyle(div).display;
            if (hasButtons && (display === 'flex' || display === 'inline-flex')) {
              return div;
            }
          }
        }
      }
    }
    return null;
  }

  function updateStats(typesArray) {
    if (!typesArray || typesArray.length === 0) return;
    chrome.storage.local.get({ stats: {} }, (data) => {
      const stats = data.stats || {};
      for (const t of typesArray) {
        stats[t] = (stats[t] || 0) + 1;
      }
      chrome.storage.local.set({ stats });
    });
  }

  // Trouver un parent non clippant pour le bouton flottant (évite d'être coupé sous Gemini/ChatGPT/Claude)
  function getNonClippingParent(inputEl) {
    const knownContainers = [
      '.input-area',
      '.input-area-container',
      '.text-input-container',
      'form',
      'fieldset',
      '.flex.flex-col.w-full',
      '.relative.flex.flex-col'
    ];
    for (const selector of knownContainers) {
      const container = inputEl.closest(selector);
      if (container) {
        // S'assurer que le conteneur ne cache pas ses débordements (clipping)
        const style = window.getComputedStyle(container);
        const overflowVal = (style.overflow || '') + (style.overflowX || '') + (style.overflowY || '');
        if (!overflowVal.includes('hidden') && !overflowVal.includes('auto') && !overflowVal.includes('scroll')) {
          return container;
        }
      }
    }
    
    let curr = inputEl.parentNode;
    while (curr && curr !== document.body) {
      const style = window.getComputedStyle(curr);
      const overflowVal = (style.overflow || '') + (style.overflowX || '') + (style.overflowY || '');
      if (!overflowVal.includes('hidden') && !overflowVal.includes('auto') && !overflowVal.includes('scroll')) {
        return curr;
      }
      curr = curr.parentNode;
    }
    return inputEl.parentNode || document.body;
  }

  // Injection du bouton "🛡️ Pseudonymiser" au-dessus de l'input de l'IA (ou inline si possible)
  function injectShieldButton() {
    const inputEl = findAIInput();
    if (!inputEl) {
      removeShieldButton();
      return;
    }

    // Le bouton existe déjà
    if (document.getElementById("anonymai-shield-btn") || document.getElementById("anonymai-shield-btn-inline")) return;

    // Tenter de trouver la barre d'outils native de l'IA
    const toolbar = findAIToolbar();
    if (toolbar) {
      shieldBtnEl = document.createElement("button");
      shieldBtnEl.id = "anonymai-shield-btn-inline";
      shieldBtnEl.className = "anonymai-ui anonymity-ui anonymai-shield-inline";
      shieldBtnEl.innerHTML = `<svg viewBox="0 0 24 24" class="anonymai-shield-icon"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`;
      shieldBtnEl.title = "Pseudonymiser le texte et injecter le contexte (Raccourci : Ctrl+Alt+A)";

      shieldBtnEl.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        triggerTextareaPseudonymization(inputEl);
      });

      // Injecter avant le bouton d'envoi natif ou le bouton d'envoi détecté dans la toolbar
      const sendButton = findAISendButton() || toolbar.querySelector('[aria-label*="send" i], [aria-label*="envoyer" i], [title*="send" i], [title*="envoyer" i], .send-button');
      if (sendButton && toolbar.contains(sendButton)) {
        // Pour éviter DOMException, trouver le nœud enfant direct de toolbar qui contient (ou est) sendButton
        let insertBeforeNode = sendButton;
        while (insertBeforeNode && insertBeforeNode.parentElement !== toolbar) {
          insertBeforeNode = insertBeforeNode.parentElement;
        }
        if (insertBeforeNode) {
          toolbar.insertBefore(shieldBtnEl, insertBeforeNode);
        } else {
          toolbar.appendChild(shieldBtnEl);
        }
      } else {
        toolbar.appendChild(shieldBtnEl);
      }
      return;
    }

    // Trouver le conteneur parent non-clippant pour positionner le bouton de manière relative
    const parent = getNonClippingParent(inputEl);
    if (!parent) return;

    // Créer le bouton shield flottant
    shieldBtnEl = document.createElement("button");
    shieldBtnEl.id = "anonymai-shield-btn";
    shieldBtnEl.className = "anonymai-ui anonymity-ui anonymai-shield-floating";
    shieldBtnEl.innerHTML = `<svg viewBox="0 0 24 24" class="anonymai-shield-icon"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg> <span>Pseudonymiser</span>`;
    shieldBtnEl.title = "Pseudonymiser le texte et injecter le contexte (Raccourci : Ctrl+Alt+A)";

    shieldBtnEl.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      triggerTextareaPseudonymization(inputEl);
    });

    // Assurer que le parent a une position relative/absolute pour l'ancrage
    const parentStyle = window.getComputedStyle(parent);
    if (parentStyle.position === "static") {
      parent.style.position = "relative";
    }

    parent.appendChild(shieldBtnEl);
  }

  function removeShieldButton() {
    const btn1 = document.getElementById("anonymai-shield-btn");
    if (btn1) btn1.remove();
    const btn2 = document.getElementById("anonymai-shield-btn-inline");
    if (btn2) btn2.remove();
    shieldBtnEl = null;
  }

  // Écrit de façon sécurisée le texte dans la zone de saisie contrôlée par React
  function insertTextIntoAI(text) {
    const inputEl = findAIInput();
    if (!inputEl) {
      showToast("Impossible de localiser la zone d'écriture de l'IA.", "error");
      return false;
    }

    inputEl.focus();

    // Méthode standard pour insérer le texte à l'emplacement du curseur (ou remplace tout si sélectionné)
    document.execCommand('selectAll', false, null);
    const success = document.execCommand('insertText', false, text);

    if (!success) {
      // Fallback si execCommand échoue (selon les navigateurs)
      if (inputEl.tagName === 'TEXTAREA' || inputEl.tagName === 'INPUT') {
        inputEl.value = text;
      } else {
        inputEl.innerText = text;
      }
      
      // Lever les événements natifs de saisie pour React/Svelte
      const inputEvent = new Event('input', { bubbles: true, cancelable: true });
      inputEl.dispatchEvent(inputEvent);
      
      const changeEvent = new Event('change', { bubbles: true, cancelable: true });
      inputEl.dispatchEvent(changeEvent);
    }
    
    // Marquer la zone de saisie comme ayant été anonymisée par l'extension
    inputEl.setAttribute("data-anonymai-processed", "true");
    
    return true;
  }

  let inputDebounceTimeout = null;

  // Événement déclenché lorsque l'utilisateur modifie la saisie manuellement
  function handleInputModify(e) {
    const inputEl = findAIInput();
    if (inputEl && e.target === inputEl) {
      inputEl.removeAttribute("data-anonymai-processed");
      
      if (inputDebounceTimeout) clearTimeout(inputDebounceTimeout);
      inputDebounceTimeout = setTimeout(() => {
        analyzeInputRealtime(inputEl);
      }, 300);
    }
  }

  // Analyse en temps réel du texte saisi pour détecter les PII et mettre à jour le panneau
  function analyzeInputRealtime(inputEl) {
    if (!config.enabled) return;
    let rawText = "";
    if (inputEl.tagName === 'TEXTAREA' || inputEl.tagName === 'INPUT') {
      rawText = inputEl.value;
    } else {
      rawText = inputEl.innerText;
    }

    if (!rawText || rawText.trim().length === 0) return;

    // 1. Retirer tout préfixe de contexte système existant
    let actualPrompt = rawText;
    const contextPrefixRegex = /^\[Contexte Système\s*:[^\]]*\](?:\s*\n)*/i;
    actualPrompt = actualPrompt.replace(contextPrefixRegex, "");

    // 2. Analyser le texte (met à jour sessionState avec les nouveaux PII détectés)
    const promptRes = globalThis.PIIEngine.pseudonymizeText(actualPrompt, sessionState, {
      forcedElements: config.forcedElements,
      excludedElements: config.excludedElements,
      pseudonymMode: config.pseudonymMode,
      customPatterns: config.customPatterns,
      customDictionaries: config.customDictionaries,
      pseudonymProfile: config.pseudonymProfile
    });

    sessionState = promptRes.sessionState;
    saveSessionToStorage();
  }

  // Exclure un mot de la pseudonymisation de manière dynamique
  function excludeWord(word) {
    const normWord = word.trim();
    if (!normWord) return;

    // Ajouter aux exclusions de config
    if (!config.excludedElements) config.excludedElements = [];
    const alreadyExcluded = config.excludedElements.some(e => {
      const ev = typeof e === "object" ? e.value : e;
      return ev.toLowerCase() === normWord.toLowerCase();
    });
    if (!alreadyExcluded) {
      config.excludedElements.push(normWord);
    }

    // Supprimer des mappings actifs de sessionState
    if (sessionState && sessionState.mappings) {
      let associatedToken = null;
      for (const [key, val] of Object.entries(sessionState.mappings)) {
        if (key.toLowerCase() === normWord.toLowerCase()) {
          associatedToken = val;
          delete sessionState.mappings[key];
        } else if (val.toLowerCase() === normWord.toLowerCase()) {
          associatedToken = key;
          delete sessionState.mappings[key];
        }
      }
      if (associatedToken) {
        delete sessionState.mappings[associatedToken];
        if (sessionState.generatedAliases) {
          sessionState.generatedAliases = sessionState.generatedAliases.filter(a => a !== associatedToken);
        }
        if (sessionState.fullAliases) {
          sessionState.fullAliases = sessionState.fullAliases.filter(a => a !== associatedToken);
        }
      }
    }

    // Sauvegarder dans le stockage Chrome et la session
    const storage = chrome.storage.sync || chrome.storage.local;
    storage.set({ excludedElements: config.excludedElements }, () => {
      saveSessionToStorage();

      // Ré-analyser la zone de saisie
      const inputEl = findAIInput();
      if (inputEl) {
        analyzeInputRealtime(inputEl);
      }

      // Mettre à jour l'affichage vert sur la page
      if (config.showOverlay) {
        removeRestoredSpans();
        walkAndRestore(document.body);
      }
    });
  }

  // Déclencher la pseudonymisation et injection de contexte sur l'input actif
  function triggerTextareaPseudonymization(inputEl) {
    let rawText = "";
    if (inputEl.tagName === 'TEXTAREA' || inputEl.tagName === 'INPUT') {
      rawText = inputEl.value;
    } else {
      rawText = inputEl.innerText;
    }

    if (!rawText || rawText.trim().length === 0) {
      showToast("Veuillez d'abord écrire votre message.", "info");
      return;
    }

    // 1. Retirer tout préfixe de contexte système existant pour repartir sur la saisie brute
    let actualPrompt = rawText;
    const contextPrefixRegex = /^\[Contexte Système\s*:[^\]]*\](?:\s*\n)*/i;
    actualPrompt = actualPrompt.replace(contextPrefixRegex, "");

    // 2. Pseudonymiser la saisie utilisateur brute
    const promptRes = globalThis.PIIEngine.pseudonymizeText(actualPrompt, sessionState, {
      forcedElements: config.forcedElements,
      excludedElements: config.excludedElements,
      pseudonymMode: config.pseudonymMode,
      customPatterns: config.customPatterns,
      customDictionaries: config.customDictionaries,
      pseudonymProfile: config.pseudonymProfile
    });

    let processedPrompt = promptRes.pseudonymizedText;
    sessionState = promptRes.sessionState;
    updateStats(promptRes.stats);

    // 3. Pseudonymiser le contexte système s'il est configuré
    let processedContext = "";
    if (config.globalContext && config.globalContext.trim().length > 0) {
      const trimmedContext = config.globalContext.trim();
      const contextRes = globalThis.PIIEngine.pseudonymizeText(trimmedContext, sessionState, {
        forcedElements: config.forcedElements,
        excludedElements: config.excludedElements,
        pseudonymMode: config.pseudonymMode,
        customPatterns: config.customPatterns,
        customDictionaries: config.customDictionaries,
        pseudonymProfile: config.pseudonymProfile
      });
      processedContext = contextRes.pseudonymizedText.trim();
      sessionState = contextRes.sessionState;
      updateStats(contextRes.stats);
    }

    // 4. Sauvegarde de la session enrichie
    saveSessionToStorage();

    // 5. Reconstruire le message final avec le contexte système pseudonymisé en en-tête
    let finalProcessedText = processedPrompt;
    if (processedContext.length > 0) {
      finalProcessedText = `[Contexte Système : ${processedContext}]\n\n${processedPrompt}`;
    }

    // Ré-injecter dans l'UI
    insertTextIntoAI(finalProcessedText);
  }

  // Raccourci clavier Ctrl+Alt+A
  function handleGlobalKeydown(e) {
    if (e.ctrlKey && e.altKey && e.code === "KeyA") {
      const inputEl = findAIInput();
      if (inputEl) {
        e.preventDefault();
        triggerTextareaPseudonymization(inputEl);
      }
    }
  }

  // Intercepter l'envoi de prompt lors du clic sur Entrée
  function handleTextareaSubmit(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      const inputEl = findAIInput();
      if (inputEl && e.target === inputEl) {
        if (inputEl.getAttribute("data-anonymai-processed") === "true") {
          // Déjà traité par l'extension, laisser passer et retirer la marque pour le prochain envoi
          inputEl.removeAttribute("data-anonymai-processed");
          return;
        }

        // Analyser s'il reste des PII non-pseudonymisées ou si le contexte manque
        let text = (inputEl.tagName === 'TEXTAREA' || inputEl.tagName === 'INPUT') ? inputEl.value : inputEl.innerText;
        if (!text || text.trim().length === 0) return;

        const hasContextPrefix = text.startsWith("[Contexte Système :");
        const hasContextConfig = config.globalContext && config.globalContext.trim().length > 0;
        const needsContext = hasContextConfig && !hasContextPrefix;

        // Tester si le texte brut contient des PII (avec un clone pour ne pas modifier la session active)
        const sessionStateClone = sessionState ? JSON.parse(JSON.stringify(sessionState)) : null;
        const testRes = globalThis.PIIEngine.pseudonymizeText(text, sessionStateClone, {
          forcedElements: config.forcedElements,
          excludedElements: config.excludedElements,
          pseudonymMode: config.pseudonymMode,
          customPatterns: config.customPatterns,
          customDictionaries: config.customDictionaries,
          pseudonymProfile: config.pseudonymProfile
        });
        const hasPII = testRes.pseudonymizedText !== text;

        if (needsContext || hasPII) {
          // Bloquer l'envoi direct pour forcer la pseudonymisation
          e.preventDefault();
          e.stopPropagation();

          // Lancer le traitement
          triggerTextareaPseudonymization(inputEl);

          // Renvoyer automatiquement après 150ms
          setTimeout(() => {
            const sendBtn = findAISendButton();
            if (sendBtn) {
              sendBtn.click();
            } else {
              // Renvoyer l'événement Entrée sur l'input modifié
              const enterEvent = new KeyboardEvent('keydown', {
                key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true
              });
              inputEl.dispatchEvent(enterEvent);
            }
          }, 150);
        }
      }
    }
  }

  // Intercepter l'envoi de prompt lors du clic sur le bouton d'envoi natif de la page
  function handleSendButtonClick(e) {
    const clickedButton = e.target.closest("button");
    if (!clickedButton) return;

    const isSendButton = checkIfSendButton(clickedButton);
    if (isSendButton) {
      const inputEl = findAIInput();
      if (inputEl) {
        if (inputEl.getAttribute("data-anonymai-processed") === "true") {
          // Déjà traité par l'extension, laisser passer et retirer la marque pour le prochain envoi
          inputEl.removeAttribute("data-anonymai-processed");
          return;
        }

        let text = (inputEl.tagName === 'TEXTAREA' || inputEl.tagName === 'INPUT') ? inputEl.value : inputEl.innerText;
        if (!text || text.trim().length === 0) return;

        const hasContextPrefix = text.startsWith("[Contexte Système :");
        const hasContextConfig = config.globalContext && config.globalContext.trim().length > 0;
        const needsContext = hasContextConfig && !hasContextPrefix;

        const sessionStateClone = sessionState ? JSON.parse(JSON.stringify(sessionState)) : null;
        const testRes = globalThis.PIIEngine.pseudonymizeText(text, sessionStateClone, {
          forcedElements: config.forcedElements,
          excludedElements: config.excludedElements,
          pseudonymMode: config.pseudonymMode,
          customPatterns: config.customPatterns,
          customDictionaries: config.customDictionaries,
          pseudonymProfile: config.pseudonymProfile
        });
        const hasPII = testRes.pseudonymizedText !== text;

        if (needsContext || hasPII) {
          e.preventDefault();
          e.stopPropagation();

          triggerTextareaPseudonymization(inputEl);

          setTimeout(() => {
            clickedButton.click();
          }, 150);
        }
      }
    }
  }

  function checkIfSendButton(button) {
    if (button.closest('.anonymai-ui')) return false; // Ne pas intercepter nos propres boutons

    // 1. Liste des sélecteurs connus pour les boutons d'envoi
    const selectors = [
      '[data-testid="send-button"]',
      '[aria-label="Send prompt"]',
      '.send-button',
      '[aria-label="Envoyer le message"]',
      '[aria-label="Send Message"]',
      '[aria-label="Send prompt"]',
      '[aria-label*="envoyer" i]',
      '[aria-label*="send" i]',
      '[aria-label*="soumettre" i]',
      '[aria-label*="submit" i]',
      '[title*="envoyer" i]',
      '[title*="send" i]',
      '[title*="soumettre" i]',
      '[title*="submit" i]',
      '.chat-send-button',
      '[type="submit"]'
    ];

    for (const selector of selectors) {
      if (button.matches(selector)) return true;
    }

    // 2. Vérification par rapport à la proximité de la zone de texte de saisie
    const inputEl = findAIInput();
    if (inputEl) {
      const commonParent = inputEl.closest('div'); // Conteneur le plus proche
      if (commonParent && commonParent.contains(button)) {
        const html = button.innerHTML.toLowerCase();
        const hasSendKeyword = /envoyer|send|submit|soumettre|arrow|up|fly|paper|plane/i.test(html) || 
                             button.innerText.toLowerCase().trim().length === 0;
        if (hasSendKeyword) return true;
      }
    }

    return false;
  }

  function findAISendButton() {
    const candidates = document.querySelectorAll("button, [role='button'], [aria-label*='send' i], [aria-label*='envoyer' i], [title*='send' i], [title*='envoyer' i], .send-button");
    for (const btn of candidates) {
      if (btn.offsetWidth > 0 && btn.offsetHeight > 0 && checkIfSendButton(btn)) {
        return btn;
      }
    }
    return null;
  }

  function saveSessionToStorage() {
    if (!tabId) return;
    const sessionKey = `session_tab_${tabId}`;
    chrome.storage.local.set({ [sessionKey]: sessionState }, () => {
      updateFabBadge();
      updateMappingsList();
    });
  }

  // --- 5. OBSERVATEUR DOM ET DE-PSEUDONYMISATION EN VERT ---
  function startObserver() {
    if (observer) return;
    
    observer = new MutationObserver((mutations) => {
      // Bloquer l'observation pendant l'injection des spans pour éviter la récursion infinie
      stopObserver();
      walkAndRestore(document.body);
      startObserver();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  function stopObserver() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }

  // Parcours le DOM de manière optimisée pour injecter les correspondances vertes
  function walkAndRestore(node) {
    if (!config.enabled) return;
    if (!sessionState || !sessionState.mappings || Object.keys(sessionState.mappings).length === 0) return;

    // Ignorer les éléments de notre extension, scripts, styles et zones d'écriture
    if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.classList.contains("anonymai-ui")) return;
      if (["SCRIPT", "STYLE", "TEXTAREA", "INPUT"].includes(node.tagName)) return;
      if (node.getAttribute("contenteditable") === "true") return;
    }

    // Parcourir les enfants
    let child = node.firstChild;
    while (child) {
      const next = child.nextSibling;
      if (child.nodeType === Node.ELEMENT_NODE) {
        walkAndRestore(child);
      } else if (child.nodeType === Node.TEXT_NODE) {
        restoreTextNode(child);
      }
      child = next;
    }
  }

  function restoreTextNode(textNode) {
    const text = textNode.nodeValue;
    if (!text || text.trim().length === 0) return;

    const generatedAliases = sessionState.generatedAliases || [];

    // 1. Recherche des jetons de pseudonymisation [TYPE_ID]
    const tokenRegex = /\[([A-Z_]+)_(\d+)\]/g;
    tokenRegex.lastIndex = 0;
    const match = tokenRegex.exec(text);

    if (match) {
      const token = match[0];
      const origValue = sessionState.mappings[token];

      if (origValue) {
        replaceMatchInNode(textNode, match.index, token.length, token, origValue);
        return;
      }
    }

    // 2. Recherche des alias réalistes générés (insensible à la casse et aux accents)
    if (generatedAliases.length > 0) {
      const normalizedText = removeDiacritics(text).toLowerCase();
      const sortedAliases = [...generatedAliases].sort((a, b) => b.length - a.length);
      for (const alias of sortedAliases) {
        const normalizedAlias = removeDiacritics(alias).toLowerCase();
        const index = normalizedText.indexOf(normalizedAlias);
        if (index !== -1) {
          const origValue = sessionState.mappings[alias];
          if (origValue) {
            replaceMatchInNode(textNode, index, alias.length, alias, origValue);
            break;
          }
        }
      }
    }
  }

  function replaceMatchInNode(textNode, index, matchLength, aliasOrToken, origValue) {
    const text = textNode.nodeValue;
    const beforeText = text.substring(0, index);
    const afterText = text.substring(index + matchLength);

    const beforeNode = document.createTextNode(beforeText);
    const afterNode = document.createTextNode(afterText);

    const span = document.createElement("span");
    span.className = "anonym-restored anonymai-ui";
    span.setAttribute("data-token", aliasOrToken);
    span.title = `Valeur originale : ${origValue} (Alias: ${aliasOrToken})`;
    
    // Inject dynamic inline SVG shield and wrap text for safety
    span.innerHTML = `
      <svg viewBox="0 0 24 24" class="anonymai-inline-restore-shield" style="width: 11px; height: 11px; fill: none; stroke: #10b981; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; flex-shrink: 0; display: inline-block;">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
      </svg>
    `;
    const textSpan = document.createElement("span");
    textSpan.className = "anonymai-ui";
    textSpan.style.display = "inline";
    textSpan.textContent = origValue;
    span.appendChild(textSpan);

    // Style vert haut de gamme identique pour les deux modes
    Object.assign(span.style, {
      color: '#065f46',
      fontWeight: 'bold',
      backgroundColor: '#ecfdf5',
      padding: '2px 6px',
      borderRadius: '4px',
      border: '1px solid #a7f3d0',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      fontFamily: 'inherit',
      fontSize: 'inherit',
      cursor: 'help',
      verticalAlign: 'middle',
      textDecoration: 'none'
    });

    const parent = textNode.parentNode;
    if (parent) {
      parent.insertBefore(beforeNode, textNode);
      parent.insertBefore(span, textNode);
      parent.insertBefore(afterNode, textNode);
      parent.removeChild(textNode);

      // Récurser sur la partie après
      restoreTextNode(afterNode);

      // Ajouter le badge Sécurisé sur le message parent
      addShieldBadgeToMessage(span);
    }
  }

  function addShieldBadgeToMessage(span) {
    const messageSelectors = [
      '[data-message-author-role="user"]',
      '[data-testid="user-message"]',
      '.query-text',
      'user-query',
      '.user-query',
      '.message.user',
      '.message-bubble.user',
      'article',
      '.message'
    ];

    let messageBubble = null;
    for (const selector of messageSelectors) {
      messageBubble = span.closest(selector);
      if (messageBubble) break;
    }

    if (!messageBubble) {
      let curr = span.parentNode;
      for (let i = 0; i < 5 && curr; i++) {
        if (curr.tagName === 'DIV' && (curr.className.includes('message') || curr.className.includes('bubble') || curr.className.includes('text'))) {
          messageBubble = curr;
          break;
        }
        curr = curr.parentNode;
      }
    }

    if (!messageBubble) return;

    if (messageBubble.querySelector('.anonymai-message-badge')) return;

    const style = window.getComputedStyle(messageBubble);
    if (style.position === 'static') {
      messageBubble.style.position = 'relative';
    }

    const badge = document.createElement('div');
    badge.className = 'anonymai-message-badge anonymai-ui';
    badge.innerHTML = `
      <svg viewBox="0 0 24 24" class="anonymai-message-badge-icon" style="width: 10px; height: 10px; fill: none; stroke: #10b981; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round;">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
      </svg>
      <span>Sécurisé</span>
    `;

    messageBubble.appendChild(badge);
  }

  function removeRestoredSpans() {
    const spans = document.querySelectorAll("span.anonym-restored");
    spans.forEach(span => {
      const token = span.getAttribute("data-token");
      if (token) {
        const textNode = document.createTextNode(token);
        if (span.parentNode) {
          span.parentNode.replaceChild(textNode, span);
        }
      }
    });
    document.body.normalize();
  }

  // --- 6. CRÉATION ET INJECTION DU FLOATING PANEL & FAB ---
  function injectUI() {
    if (document.getElementById("anonymai-fab-el")) return;

    // 1. Créer le FAB
    fabEl = document.createElement("div");
    fabEl.id = "anonymai-fab-el";
    fabEl.className = "anonymai-fab anonymity-ui anonymai-ui";
    fabEl.innerHTML = '<svg viewBox="0 0 24 24" class="anonymai-shield-icon"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>';
    fabEl.title = "Ouvrir l'assistant local AnonymAI";
    document.body.appendChild(fabEl);

    // 2. Créer le Panel latéral
    panelEl = document.createElement("div");
    panelEl.id = "anonymai-panel-el";
    panelEl.className = "anonymai-panel anonymity-ui anonymai-ui";
    
    panelEl.innerHTML = `
      <div class="anonymai-panel-header anonymai-ui">
        <div class="anonymai-panel-title anonymai-ui">
          <svg viewBox="0 0 24 24" class="anonymai-shield-icon" style="width: 20px; height: 20px; stroke: #10b981; fill: none; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
          <h3>AnonymAI Assistant</h3>
        </div>
        <button class="anonymai-panel-close anonymai-ui" id="anonymai-close-btn">&times;</button>
      </div>

      <div class="anonymai-panel-content anonymai-ui">
        <!-- Section Contexte -->
        <div class="anonymai-panel-section anonymai-ui" data-section="contexte">
          <div class="anonymai-panel-section-header anonymai-ui">
            <span class="anonymai-panel-section-title anonymai-ui">Contexte Actif</span>
            <span class="anonymai-collapse-arrow anonymai-ui">▼</span>
          </div>
          <div class="anonymai-section-body anonymity-ui anonymai-ui">
            <div class="anonymai-context-indicator anonymai-ui" id="anonymai-context-indicator">
              Aucun contexte système configuré.
            </div>
          </div>
        </div>

        <!-- Section Restauration Visuelle -->
        <div class="anonymai-panel-section anonymai-ui" data-section="restauration" style="padding: 10px 12px;">
          <div class="anonymai-panel-section-header anonymai-ui" style="display: flex; flex-direction: row; justify-content: space-between; align-items: center; width: 100%;">
            <span class="anonymai-panel-section-title anonymai-ui" style="margin-bottom: 0; font-size: 11px;">Restauration visuelle</span>
            <span class="anonymai-collapse-arrow anonymai-ui">▼</span>
          </div>
          <div class="anonymai-section-body anonymity-ui anonymai-ui" style="display: flex; flex-direction: row; justify-content: space-between; align-items: center; gap: 12px; width: 100%; margin-top: 8px;">
            <span class="anonymai-ui" style="font-size: 9px; color: #94a3b8;">Afficher le texte original en vert sur la page</span>
            <label class="anonymai-switch anonymity-ui anonymai-ui">
              <input type="checkbox" id="anonymai-overlay-toggle" ${config.showOverlay ? 'checked' : ''}>
              <span class="anonymai-slider anonymai-ui"></span>
            </label>
          </div>
        </div>

        <!-- Section Profil de Pseudonymisation -->
        <div class="anonymai-panel-section anonymai-ui" data-section="profil-pseudonymisation" style="padding: 10px 12px;">
          <div class="anonymai-panel-section-header anonymai-ui" style="display: flex; flex-direction: row; justify-content: space-between; align-items: center; width: 100%;">
            <span class="anonymai-panel-section-title anonymai-ui" style="margin-bottom: 0; font-size: 11px;">Profil actif</span>
            <span class="anonymai-collapse-arrow anonymai-ui">▼</span>
          </div>
          <div class="anonymai-section-body anonymity-ui anonymai-ui" style="display: flex; flex-direction: column; gap: 6px; width: 100%; margin-top: 8px;">
            <select id="anonymai-profile-select" class="anonymai-ui" style="width: 100%; padding: 4px; font-size: 11px; background: #1e293b; border: 1px solid #475569; color: white; border-radius: 4px;">
              <option value="light" ${config.pseudonymProfile === 'light' ? 'selected' : ''}>Léger (Noms, E-mails)</option>
              <option value="standard" ${config.pseudonymProfile === 'standard' || !config.pseudonymProfile ? 'selected' : ''}>Standard (Léger + Lieux, Orgs, Tél)</option>
              <option value="strict" ${config.pseudonymProfile === 'strict' ? 'selected' : ''}>Strict (Tous types)</option>
            </select>
          </div>
        </div>

        <!-- Section Statistiques de Protection -->
        <div class="anonymai-panel-section anonymai-ui" data-section="stats" style="padding: 10px 12px;">
          <div class="anonymai-panel-section-header anonymai-ui" style="display: flex; flex-direction: row; justify-content: space-between; align-items: center; width: 100%;">
            <span class="anonymai-panel-section-title anonymai-ui" style="margin-bottom: 0; font-size: 11px;">Statistiques de protection</span>
            <span class="anonymai-collapse-arrow anonymai-ui">▼</span>
          </div>
          <div class="anonymai-section-body anonymity-ui anonymai-ui" style="display: flex; flex-direction: row; align-items: center; gap: 16px; margin-top: 8px; width: 100%;">
            <div class="anonymai-panel-pie-wrapper anonymai-ui" style="position: relative; width: 64px; height: 64px; flex-shrink: 0;">
              <svg id="anonymai-panel-pie-svg" viewBox="0 0 100 100" width="64" height="64" class="anonymai-ui">
                <circle cx="50" cy="50" r="35" fill="none" stroke="#334155" stroke-width="12" class="anonymai-ui"></circle>
              </svg>
              <div class="anonymai-panel-pie-center anonymai-ui" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; pointer-events: none; line-height: 1.1;">
                <div id="anonymai-panel-pie-val" class="anonymai-ui" style="font-size: 12px; font-weight: 700; color: white;">0</div>
                <div class="anonymai-ui" style="font-size: 6px; color: #94a3b8; text-transform: uppercase; font-weight: 600;">Bloqués</div>
              </div>
            </div>
            <div id="anonymai-panel-stats-list" class="anonymai-ui" style="display: flex; flex-direction: column; gap: 4px; flex-grow: 1; font-size: 10px; max-height: 64px; overflow-y: auto; padding-right: 4px;">
              <div style="color: #94a3b8; font-style: italic; font-size: 9px; line-height: 1.4;" class="anonymai-ui">Aucune donnée protégée.</div>
            </div>
          </div>
        </div>

        <!-- Section Drag & Drop -->
        <div class="anonymai-panel-section anonymai-ui" data-section="documents">
          <div class="anonymai-panel-section-header anonymai-ui">
            <span class="anonymai-panel-section-title anonymai-ui">Pseudonymiser documents / dossiers</span>
            <span class="anonymai-collapse-arrow anonymai-ui">▼</span>
          </div>
          <div class="anonymai-section-body anonymity-ui anonymai-ui">
            <div class="anonymai-dropzone anonymai-ui" id="anonymai-dropzone" style="padding: 16px 12px; min-height: 80px; justify-content: center;">
              <span class="anonymai-dropzone-icon anonymai-ui">📂</span>
              <span class="anonymai-dropzone-text anonymai-ui">Glissez des fichiers ou un dossier ici</span>
              <span class="anonymai-dropzone-subtext anonymai-ui">PDF, Word, Text (.txt, .docx, .pdf)</span>
              <div class="anonymai-ui" style="margin-top: 8px; display: flex; gap: 8px; justify-content: center; width: 100%;">
                <button class="anonymai-btn anonymai-btn-secondary anonymai-ui" id="anonymai-select-files-btn" style="padding: 4px 8px; font-size: 11px; flex-grow: 1;">Fichiers</button>
                <button class="anonymai-btn anonymai-btn-secondary anonymai-ui" id="anonymai-select-folder-btn" style="padding: 4px 8px; font-size: 11px; flex-grow: 1;">Dossier</button>
              </div>
              <input type="file" id="anonymai-file-input" accept=".txt,.csv,.md,.pdf,.docx" multiple style="display:none;">
              <input type="file" id="anonymai-folder-input" webkitdirectory directory style="display:none;">
            </div>
          </div>
        </div>

        <!-- Section Liste de documents V3 -->
        <div class="anonymai-panel-section anonymai-ui" id="anonymai-file-list-section" data-section="documents-charges" style="display: none; max-height: 180px; overflow-y: auto;">
          <div class="anonymai-panel-section-header anonymai-ui" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
            <span class="anonymai-panel-section-title anonymai-ui" style="margin-bottom: 0; display: flex; justify-content: space-between; align-items: center; width: calc(100% - 20px);">
              <span>Documents chargés</span>
              <button id="anonymai-clear-files-btn" class="anonymai-ui" style="background: none; border: none; color: #ef4444; font-size: 10px; cursor: pointer; font-weight: 600; padding: 0;">Vider la liste</button>
            </span>
            <span class="anonymai-collapse-arrow anonymai-ui">▼</span>
          </div>
          <div class="anonymai-section-body anonymity-ui anonymai-ui" style="margin-top: 8px;">
            <div id="anonymai-file-list" class="anonymai-file-list-container anonymai-ui">
              <!-- Fichiers ajoutés dynamiquement -->
            </div>
          </div>
        </div>

        <!-- Section Textarea résultat -->
        <div class="anonymai-panel-section anonymai-ui" data-section="resultat" style="flex-grow: 1; display: flex; flex-direction: column;">
          <div class="anonymai-panel-section-header anonymai-ui">
            <span class="anonymai-panel-section-title anonymai-ui">Texte pseudonymisé</span>
            <span class="anonymai-collapse-arrow anonymai-ui">▼</span>
          </div>
          <div class="anonymai-section-body anonymity-ui anonymai-ui" style="flex-grow: 1; display: flex; flex-direction: column; margin-top: 8px;">
            <textarea class="anonymai-textarea anonymai-ui" id="anonymai-result-text" placeholder="Le texte extrait apparaîtra ici et sera automatiquement pseudonymisé..." style="flex-grow: 1; min-height: 100px;"></textarea>
            <div class="anonymai-actions-row anonymai-ui" style="margin-top: 8px;">
              <button class="anonymai-btn anonymai-btn-secondary anonymai-ui" id="anonymai-copy-btn">Copier</button>
              <button class="anonymai-btn anonymai-btn-primary anonymai-ui" id="anonymai-inject-btn">Injecter</button>
            </div>
          </div>
        </div>

        <!-- Section Ajouter/Forcer un élément -->
        <div class="anonymai-panel-section anonymai-ui" data-section="forcer-exclure" style="padding: 10px 12px; border-bottom: 1px solid #334155;">
          <div class="anonymai-panel-section-header anonymai-ui">
            <span class="anonymai-panel-section-title anonymai-ui">Forcer/Exclure un élément</span>
            <span class="anonymai-collapse-arrow anonymai-ui">▼</span>
          </div>
          <div class="anonymai-section-body anonymity-ui anonymai-ui" style="margin-top: 8px;">
            <div class="anonymai-ui" style="display: flex; flex-direction: column; gap: 6px;">
              <input type="text" id="anonymai-manual-word-input" class="anonymai-ui" placeholder="Entrez un mot à traiter..." style="width: 100%; padding: 4px 8px; font-size: 11px; background: #1e293b; border: 1px solid #475569; color: white; border-radius: 4px; box-sizing: border-box;">
              <div class="anonymai-ui" style="display: flex; gap: 6px; align-items: center; justify-content: space-between;">
                <select id="anonymai-manual-type-select" class="anonymai-ui" style="flex-grow: 1; padding: 4px; font-size: 11px; background: #1e293b; border: 1px solid #475569; color: white; border-radius: 4px;">
                  <option value="FORCE">Texte générique</option>
                  <option value="NOM_PRENOM">Nom Complet</option>
                  <option value="PRENOM">Prénom</option>
                  <option value="NOM">Nom de famille</option>
                  <option value="VILLE">Ville / Lieu</option>
                  <option value="ORGANISATION">Collectivité / Entreprise</option>
                  <option value="TELEPHONE">Téléphone</option>
                  <option value="EMAIL">Email</option>
                </select>
                <button class="anonymai-btn anonymai-ui" id="anonymai-manual-force-btn" style="padding: 4px 8px; font-size: 11px; background-color: #10b981; border: none; color: #0b0f19; font-weight:600; cursor: pointer; border-radius: 4px;">Forcer</button>
                <button class="anonymai-btn anonymai-ui" id="anonymai-manual-exclude-btn" style="padding: 4px 8px; font-size: 11px; background-color: #ef4444; color: white; border: none; font-weight:600; cursor: pointer; border-radius: 4px;">Exclure</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Section Mappings en cours -->
        <div class="anonymai-panel-section anonymai-ui" data-section="correspondances" style="max-height: 150px; overflow-y: auto;">
          <div class="anonymai-panel-section-header anonymai-ui">
            <span class="anonymai-panel-section-title anonymai-ui">Correspondances Actives</span>
            <span class="anonymai-collapse-arrow anonymai-ui">▼</span>
          </div>
          <div class="anonymai-section-body anonymity-ui anonymai-ui" style="margin-top: 8px;">
            <div id="anonymai-mappings-list" class="anonymai-ui" style="font-size: 11px; font-family: monospace; display: flex; flex-direction: column; gap: 4px;">
              <!-- Rempli dynamiquement -->
            </div>
          </div>
        </div>
      </div>

      <div class="anonymai-panel-footer anonymai-ui">
        <a href="#" class="anonymai-footer-link anonymai-ui" id="anonymai-options-link">⚙️ Options avancées</a>
      </div>
    `;

    document.body.appendChild(panelEl);

    // Appliquer les états repliés sauvegardés
    chrome.storage.local.get({ collapsedSections: {} }, (result) => {
      const collapsed = result.collapsedSections || {};
      Object.entries(collapsed).forEach(([secId, isCollapsed]) => {
        if (isCollapsed) {
          const section = panelEl.querySelector(`.anonymai-panel-section[data-section="${secId}"]`);
          if (section) {
            section.classList.add("anonymai-section-collapsed");
          }
        }
      });
    });

    // Attacher les écouteurs d'événements UI
    setupUIListeners();
    updateFabBadge();
    updateContextIndicator();
    updateMappingsList();
    renderFilesList();
    updatePanelStats();
  }

  function removeUI() {
    if (fabEl) fabEl.remove();
    if (panelEl) panelEl.remove();
    removeShieldButton();
    fabEl = null;
    panelEl = null;
    isPanelOpen = false;
  }

  function setupUIListeners() {
    const closeBtn = document.getElementById("anonymai-close-btn");
    const optionsLink = document.getElementById("anonymai-options-link");
    const dropzone = document.getElementById("anonymai-dropzone");
    const selectFilesBtn = document.getElementById("anonymai-select-files-btn");
    const selectFolderBtn = document.getElementById("anonymai-select-folder-btn");
    const fileInput = document.getElementById("anonymai-file-input");
    const folderInput = document.getElementById("anonymai-folder-input");
    const clearFilesBtn = document.getElementById("anonymai-clear-files-btn");
    const resultTextarea = document.getElementById("anonymai-result-text");
    const copyBtn = document.getElementById("anonymai-copy-btn");
    const injectBtn = document.getElementById("anonymai-inject-btn");
    const overlayToggle = document.getElementById("anonymai-overlay-toggle");

    if (overlayToggle) {
      overlayToggle.addEventListener("change", () => {
        const show = overlayToggle.checked;
        const storage = chrome.storage.sync || chrome.storage.local;
        storage.set({ showOverlay: show }, () => {
          config.showOverlay = show;
          applyState();
        });
      });
    }

    const profileSelect = document.getElementById("anonymai-profile-select");
    if (profileSelect) {
      profileSelect.addEventListener("change", () => {
        const profile = profileSelect.value;
        const storage = chrome.storage.sync || chrome.storage.local;
        storage.set({ pseudonymProfile: profile }, () => {
          config.pseudonymProfile = profile;
          const inputEl = findAIInput();
          if (inputEl) {
            analyzeInputRealtime(inputEl);
          }
          if (config.showOverlay) {
            removeRestoredSpans();
            walkAndRestore(document.body);
          }
        });
      });
    }

    // Toggle panel
    fabEl.addEventListener("click", () => {
      isPanelOpen = !isPanelOpen;
      panelEl.classList.toggle("anonymai-panel-open", isPanelOpen);
      fabEl.classList.toggle("anonymai-fab-active", isPanelOpen);
      fabEl.innerHTML = isPanelOpen 
        ? '<svg viewBox="0 0 24 24" class="anonymai-close-icon"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>' 
        : '<svg viewBox="0 0 24 24" class="anonymai-shield-icon"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>';
    });

    closeBtn.addEventListener("click", () => {
      isPanelOpen = false;
      panelEl.classList.remove("anonymai-panel-open");
      fabEl.classList.remove("anonymai-fab-active");
      fabEl.innerHTML = '<svg viewBox="0 0 24 24" class="anonymai-shield-icon"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>';
    });

    optionsLink.addEventListener("click", (e) => {
      e.preventDefault();
      chrome.runtime.sendMessage({ action: "open_options" });
    });

    // Drag & Drop
    dropzone.addEventListener("click", (e) => {
      if (e.target.closest("button")) return;
      fileInput.click();
    });

    selectFilesBtn.addEventListener("click", (e) => {
      e.preventDefault();
      fileInput.click();
    });

    selectFolderBtn.addEventListener("click", (e) => {
      e.preventDefault();
      folderInput.click();
    });

    dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropzone.classList.add("anonymai-dragover");
    });

    dropzone.addEventListener("dragleave", () => {
      dropzone.classList.remove("anonymai-dragover");
    });

    dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropzone.classList.remove("anonymai-dragover");
      if (e.dataTransfer) {
        handleDroppedItems(e.dataTransfer);
      }
    });

    fileInput.addEventListener("change", (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleUploadedFiles(Array.from(e.target.files));
        fileInput.value = "";
      }
    });

    folderInput.addEventListener("change", (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleUploadedFiles(Array.from(e.target.files));
        folderInput.value = "";
      }
    });

    clearFilesBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      uploadedFiles = [];
      activeFileId = null;
      renderFilesList();
    });

    // Action boutons
    copyBtn.addEventListener("click", () => {
      const text = resultTextarea.value;
      if (!text) return;
      navigator.clipboard.writeText(text).then(() => {
        const orig = copyBtn.textContent;
        copyBtn.textContent = "Copié !";
        setTimeout(() => copyBtn.textContent = orig, 1500);
      });
    });

    injectBtn.addEventListener("click", () => {
      const text = resultTextarea.value;
      if (!text || text === "--- Aucun document sélectionné ---") {
        showToast("Aucun texte à injecter.", "info");
        return;
      }
      const success = insertTextIntoAI(text);
      if (success) {
        showToast("Texte injecté dans l'IA !", "success");
        isPanelOpen = false;
        panelEl.classList.remove("anonymai-panel-open");
        fabEl.classList.remove("anonymai-fab-active");
        fabEl.innerHTML = '<svg viewBox="0 0 24 24" class="anonymai-shield-icon"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>';
      }
    });

    const manualInput = document.getElementById("anonymai-manual-word-input");
    const manualTypeSelect = document.getElementById("anonymai-manual-type-select");
    const manualForceBtn = document.getElementById("anonymai-manual-force-btn");
    const manualExcludeBtn = document.getElementById("anonymai-manual-exclude-btn");

    if (manualForceBtn && manualInput) {
      manualForceBtn.addEventListener("click", () => {
        const val = manualInput.value.trim();
        if (!val) return;

        const type = manualTypeSelect.value;
        
        // Retirer des exclusions si présent
        if (config.excludedElements) {
          config.excludedElements = config.excludedElements.filter(e => {
            const ev = typeof e === "object" ? e.value : e;
            return ev.toLowerCase() !== val.toLowerCase();
          });
        }

        // Ajouter aux forçages
        if (!config.forcedElements) config.forcedElements = [];
        // Vérifier s'il y est déjà
        const alreadyExists = config.forcedElements.some(e => {
          const ev = typeof e === "object" ? e.value : e;
          return ev.toLowerCase() === val.toLowerCase();
        });

        if (!alreadyExists) {
          config.forcedElements.push({ value: val, type: type });
        } else {
          // Mettre à jour le type si déjà existant
          config.forcedElements = config.forcedElements.map(e => {
            const ev = typeof e === "object" ? e.value : e;
            if (ev.toLowerCase() === val.toLowerCase()) {
              return { value: val, type: type };
            }
            return e;
          });
        }

        const storage = chrome.storage.sync || chrome.storage.local;
        storage.set({ 
          forcedElements: config.forcedElements,
          excludedElements: config.excludedElements || []
        }, () => {
          manualInput.value = "";
          
          // Ré-analyser la zone de saisie
          const inputEl = findAIInput();
          if (inputEl) {
            analyzeInputRealtime(inputEl);
          }
          
          // Rafraîchir les surbrillances vertes sur la page
          if (config.showOverlay) {
            removeRestoredSpans();
            walkAndRestore(document.body);
          }
        });
      });
    }

    if (manualExcludeBtn && manualInput) {
      manualExcludeBtn.addEventListener("click", () => {
        const val = manualInput.value.trim();
        if (!val) return;

        // Retirer des forçages si présent
        if (config.forcedElements) {
          config.forcedElements = config.forcedElements.filter(e => {
            const ev = typeof e === "object" ? e.value : e;
            return ev.toLowerCase() !== val.toLowerCase();
          });
        }

        const storage = chrome.storage.sync || chrome.storage.local;
        storage.set({ forcedElements: config.forcedElements }, () => {
          excludeWord(val);
          manualInput.value = "";
        });
      });
    }

    // Collapsible sections in panel
    const headers = panelEl.querySelectorAll(".anonymai-panel-section-header");
    headers.forEach(header => {
      header.addEventListener("click", (e) => {
        // Prevent collapse when clicking inputs, selects or buttons inside headers (e.g. vider la liste)
        if (e.target.closest("button") || e.target.closest("input") || e.target.closest("select")) {
          return;
        }
        const section = header.closest(".anonymai-panel-section");
        if (!section) return;
        const secId = section.getAttribute("data-section");
        if (!secId) return;
        const isCollapsed = section.classList.toggle("anonymai-section-collapsed");
        
        // Save state to chrome.storage.local
        chrome.storage.local.get({ collapsedSections: {} }, (result) => {
          const collapsed = result.collapsedSections || {};
          collapsed[secId] = isCollapsed;
          chrome.storage.local.set({ collapsedSections: collapsed });
        });
      });
    });
  }

  // Mettre à jour le badge de notifications sur le FAB
  function updateFabBadge() {
    if (!fabEl) return;
    
    // Compter le nombre d'éléments pseudonymisés (jetons ou alias générés)
    const generatedAliases = sessionState.generatedAliases || [];
    const displayKeys = Object.keys(sessionState.mappings || {}).filter(key => {
      return (key.startsWith("[") && key.endsWith("]")) || generatedAliases.includes(key);
    });
    const count = displayKeys.length;

    let badge = fabEl.querySelector(".anonymai-fab-badge");
    if (count > 0) {
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "anonymai-fab-badge anonymai-ui";
        fabEl.appendChild(badge);
      }
      badge.textContent = count;
    } else if (badge) {
      badge.remove();
    }
  }

  function updateContextIndicator() {
    const indicator = document.getElementById("anonymai-context-indicator");
    if (!indicator) return;

    if (config.globalContext && config.globalContext.trim().length > 0) {
      const text = config.globalContext.trim();
      indicator.textContent = text.length > 80 ? text.substring(0, 80) + "..." : text;
      indicator.title = text;
      indicator.style.color = "#34d399"; // vert clair pour contexte actif
    } else {
      indicator.textContent = "Aucun contexte système configuré.";
      indicator.style.color = "#94a3b8";
    }
  }

  function updatePanelStats() {
    chrome.storage.local.get({ stats: {} }, (data) => {
      const stats = data.stats || {};
      let total = 0;
      for (const val of Object.values(stats)) {
        total += val;
      }
      
      const pieCenterVal = document.getElementById("anonymai-panel-pie-val");
      if (pieCenterVal) {
        pieCenterVal.textContent = total;
      }
      
      const categoryLabels = {
        "NOM_PRENOM": "Noms complets",
        "PRENOM": "Prénoms",
        "NOM": "Noms de famille",
        "EMAIL": "Emails",
        "TELEPHONE": "Téléphones",
        "VILLE": "Villes / Lieux",
        "ORGANISATION": "Organisations",
        "SECURE_SOCIALE": "Séc. Sociale",
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
      const svgEl = document.getElementById("anonymai-panel-pie-svg");
      if (svgEl) {
        svgEl.innerHTML = "";
        
        if (total === 0) {
          const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
          circle.setAttribute("cx", "50");
          circle.setAttribute("cy", "50");
          circle.setAttribute("r", "35");
          circle.setAttribute("fill", "none");
          circle.setAttribute("stroke", "#334155");
          circle.setAttribute("stroke-width", "12");
          circle.setAttribute("class", "anonymai-ui");
          svgEl.appendChild(circle);
        } else {
          const sortedStats = Object.entries(stats)
            .filter(([_, count]) => count > 0)
            .sort((a, b) => b[1] - a[1]);
            
          const C = 219.911; // 2 * PI * r (r=35)
          let accumulatedOffset = 0;
          
          sortedStats.forEach(([cat, count]) => {
            const percentage = (count / total) * 100;
            const sliceLength = (count / total) * C;
            const color = categoryColors[cat] || defaultColor;
            const label = categoryLabels[cat] || cat;
            
            const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circle.setAttribute("cx", "50");
            circle.setAttribute("cy", "50");
            circle.setAttribute("r", "35");
            circle.setAttribute("fill", "none");
            circle.setAttribute("stroke", color);
            circle.setAttribute("stroke-width", "12");
            circle.setAttribute("stroke-dasharray", `${sliceLength} ${C}`);
            circle.setAttribute("stroke-dashoffset", `${C - accumulatedOffset}`);
            circle.setAttribute("transform", "rotate(-90 50 50)");
            circle.setAttribute("class", "anonymai-ui anonymai-panel-pie-slice");
            circle.style.cursor = "pointer";
            
            circle.addEventListener("mouseenter", () => {
              if (pieCenterVal) {
                pieCenterVal.textContent = `${percentage.toFixed(0)}%`;
              }
            });
            circle.addEventListener("mouseleave", () => {
              if (pieCenterVal) {
                pieCenterVal.textContent = total;
              }
            });
            
            svgEl.appendChild(circle);
            accumulatedOffset += sliceLength;
          });
        }
      }
      
      // Rendu de la liste
      const listEl = document.getElementById("anonymai-panel-stats-list");
      if (listEl) {
        listEl.innerHTML = "";
        
        if (total === 0) {
          listEl.innerHTML = `<div style="color: #94a3b8; font-style: italic; font-size: 9px; line-height: 1.4;" class="anonymai-ui">Aucune donnée protégée.</div>`;
        } else {
          const sortedStats = Object.entries(stats)
            .filter(([_, count]) => count > 0)
            .sort((a, b) => b[1] - a[1]);
            
          sortedStats.forEach(([cat, count]) => {
            const color = categoryColors[cat] || defaultColor;
            const label = categoryLabels[cat] || cat;
            
            const item = document.createElement("div");
            item.className = "anonymai-panel-stat-item anonymai-ui";
            item.style.display = "flex";
            item.style.alignItems = "center";
            item.style.justifyContent = "space-between";
            item.style.gap = "6px";
            item.style.width = "100%";
            item.style.padding = "2px 0";
            
            const left = document.createElement("div");
            left.className = "anonymai-ui";
            left.style.display = "flex";
            left.style.alignItems = "center";
            left.style.gap = "4px";
            
            const dot = document.createElement("span");
            dot.className = "anonymai-ui";
            dot.style.width = "6px";
            dot.style.height = "6px";
            dot.style.borderRadius = "50%";
            dot.style.backgroundColor = color;
            dot.style.display = "inline-block";
            
            const text = document.createElement("span");
            text.className = "anonymai-ui";
            text.style.color = "#cbd5e1";
            text.textContent = label;
            
            left.appendChild(dot);
            left.appendChild(text);
            
            const val = document.createElement("span");
            val.className = "anonymai-ui";
            val.style.color = "#94a3b8";
            val.style.fontWeight = "600";
            val.textContent = count;
            
            item.appendChild(left);
            item.appendChild(val);
            listEl.appendChild(item);
          });
        }
      }
    });
  }

  function updateMappingsList() {
    const listEl = document.getElementById("anonymai-mappings-list");
    if (!listEl) return;

    listEl.innerHTML = "";
    const generatedAliases = sessionState.generatedAliases || [];
    const displayKeys = Object.keys(sessionState.mappings || {}).filter(key => {
      return (key.startsWith("[") && key.endsWith("]")) || generatedAliases.includes(key);
    });

    if (displayKeys.length === 0) {
      listEl.innerHTML = `<span style="color: #64748b; font-style: italic;">Aucune correspondance active</span>`;
      return;
    }

    displayKeys.sort().forEach(token => {
      const original = sessionState.mappings[token];
      const div = document.createElement("div");
      div.className = "anonymai-ui";
      div.style.display = "flex";
      div.style.justifyContent = "space-between";
      div.style.alignItems = "center";
      div.style.padding = "2px 0";
      div.style.borderBottom = "1px solid #334155";
      
      div.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <span class="anonymai-ui" style="color: #34d399; font-weight:600;">${token}</span>
          <span class="anonymai-ui" style="color: #f8fafc; font-size: 10px; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${original}">${original}</span>
        </div>
        <button class="anonymai-exclude-mapping-btn anonymai-ui" data-val="${original}" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 14px; padding: 0 4px; font-weight: bold;" title="Exclure ce mot">✕</button>
      `;
      listEl.appendChild(div);
    });

    // Attacher les écouteurs sur les boutons d'exclusion rapide
    const excludeBtns = listEl.querySelectorAll(".anonymai-exclude-mapping-btn");
    excludeBtns.forEach(btn => {
      btn.addEventListener("click", (e) => {
        const val = btn.getAttribute("data-val");
        if (val) {
          excludeWord(val);
        }
      });
    });
  }

  // --- 7. EXTRACTION DES DOCUMENTS EN HORS-LIGNE (Multi-fichiers et récursion locale) ---
  async function handleUploadedFiles(files) {
    if (!files || files.length === 0) return;

    const hadFiles = uploadedFiles.length > 0;
    const addedFiles = [];

    for (const file of files) {
      const fileId = "file_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
      const newFileObj = {
        id: fileId,
        name: file.name,
        size: file.size,
        status: "processing",
        rawText: "",
        processedText: "",
        selected: true
      };
      
      uploadedFiles.push(newFileObj);
      addedFiles.push(newFileObj);
      
      // Attendre la fin du traitement pour éviter les conflits d'état sessionState concurrents
      await processSingleFile(file, newFileObj);
    }

    if (hadFiles || files.length > 1) {
      activeFileId = 'combined';
    } else if (addedFiles.length > 0) {
      activeFileId = addedFiles[0].id;
    }

    renderFilesList();
  }

  async function processSingleFile(file, fileObj) {
    try {
      let extractedText = "";
      const extension = file.name.split('.').pop().toLowerCase();

      if (extension === "pdf") {
        const arrayBuffer = await file.arrayBuffer();
        extractedText = await extractTextFromPDF(arrayBuffer);
      } else if (extension === "docx") {
        const arrayBuffer = await file.arrayBuffer();
        extractedText = await extractTextFromDocx(arrayBuffer);
      } else {
        // Plain text (.txt, .csv, .md, etc.)
        extractedText = await extractTextFromPlain(file);
      }

      if (!extractedText || extractedText.trim().length === 0) {
        throw new Error("Le document est vide ou protégé.");
      }

      fileObj.rawText = extractedText;

      // Lancer la pseudonymisation locale
      const res = globalThis.PIIEngine.pseudonymizeText(extractedText, sessionState, {
        forcedElements: config.forcedElements,
        excludedElements: config.excludedElements,
        pseudonymMode: config.pseudonymMode,
        customPatterns: config.customPatterns,
        customDictionaries: config.customDictionaries,
        pseudonymProfile: config.pseudonymProfile
      });

      sessionState = res.sessionState;
      saveSessionToStorage();
      updateStats(res.stats);

      fileObj.processedText = res.pseudonymizedText;
      fileObj.status = "success";

    } catch (err) {
      console.error(err);
      fileObj.status = "error";
      fileObj.errorMessage = err.message || "Erreur de conversion.";
    } finally {
      renderFilesList();
    }
  }

  // Gérer les éléments glissés-déposés (fichiers ou dossiers récursifs)
  async function handleDroppedItems(dataTransfer) {
    if (dataTransfer.items && dataTransfer.items.length > 0 && typeof dataTransfer.items[0].webkitGetAsEntry === "function") {
      const entries = [];
      for (let i = 0; i < dataTransfer.items.length; i++) {
        const item = dataTransfer.items[i];
        const entry = item.webkitGetAsEntry();
        if (entry) entries.push(entry);
      }
      
      const filePromises = entries.map(entry => scanEntry(entry));
      const fileLists = await Promise.all(filePromises);
      const allFiles = fileLists.flat();
      
      if (allFiles.length > 0) {
        handleUploadedFiles(allFiles);
        return;
      }
    }
    
    // Fallback standard
    if (dataTransfer.files && dataTransfer.files.length > 0) {
      handleUploadedFiles(Array.from(dataTransfer.files));
    }
  }

  // Scan récursif d'une entrée HTML5 FileSystem (Fichier ou Dossier)
  async function scanEntry(entry) {
    if (entry.isFile) {
      return new Promise((resolve) => {
        entry.file((file) => {
          const ext = file.name.split('.').pop().toLowerCase();
          if (['txt', 'csv', 'md', 'pdf', 'docx'].includes(ext)) {
            resolve([file]);
          } else {
            resolve([]); // Ignorer les formats non supportés
          }
        }, () => resolve([]));
      });
    } else if (entry.isDirectory) {
      return new Promise((resolve) => {
        const dirReader = entry.createReader();
        let allEntries = [];
        
        function readAllEntries() {
          dirReader.readEntries(async (results) => {
            if (results.length > 0) {
              allEntries = allEntries.concat(results);
              readAllEntries(); // Boucler pour tout récupérer (limite des blocs chrome de 100)
            } else {
              const filePromises = allEntries.map(e => scanEntry(e));
              const fileLists = await Promise.all(filePromises);
              resolve(fileLists.flat());
            }
          }, () => resolve([]));
        }
        
        readAllEntries();
      });
    }
    return [];
  }

  // Rendu graphique de la liste des fichiers chargés (V3)
  function renderFilesList() {
    const listSection = document.getElementById("anonymai-file-list-section");
    const listEl = document.getElementById("anonymai-file-list");
    if (!listSection || !listEl) return;

    if (uploadedFiles.length === 0) {
      listSection.style.display = "none";
      activeFileId = null;
      updateTextareaContent();
      return;
    }

    listSection.style.display = "block";
    listEl.innerHTML = "";

    // Ajouter un élément de vue combinée si plusieurs fichiers
    if (uploadedFiles.length > 1) {
      const combinedItem = document.createElement("div");
      const isCombinedActive = activeFileId === 'combined';
      combinedItem.className = `anonymai-file-item anonymai-ui ${isCombinedActive ? 'anonymai-file-item-active' : ''}`;
      
      const checkedCount = uploadedFiles.filter(f => f.selected && f.status === 'success').length;
      
      combinedItem.innerHTML = `
        <div class="anonymai-file-icon anonymai-ui">📚</div>
        <div class="anonymai-file-info anonymai-ui">
          <span class="anonymai-file-name anonymai-ui" style="font-weight: 700;">Afficher tout combiné</span>
          <span class="anonymai-file-meta anonymai-ui">${checkedCount} / ${uploadedFiles.filter(f => f.status === 'success').length} document(s) inclus</span>
        </div>
      `;
      
      combinedItem.addEventListener("click", () => {
        activeFileId = 'combined';
        renderFilesList();
      });
      listEl.appendChild(combinedItem);
    } else if (uploadedFiles.length === 1 && activeFileId === 'combined') {
      activeFileId = uploadedFiles[0].id;
    }

    uploadedFiles.forEach(file => {
      const item = document.createElement("div");
      const isActive = activeFileId === file.id;
      item.className = `anonymai-file-item anonymai-ui ${isActive ? 'anonymai-file-item-active' : ''}`;
      
      let statusBadge = "";
      if (file.status === "processing") {
        statusBadge = `<span class="anonymai-file-status-badge anonymai-file-status-loading anonymai-ui">Lecture...</span>`;
      } else if (file.status === "error") {
        statusBadge = `<span class="anonymai-file-status-badge anonymai-file-status-error anonymai-ui" title="${file.errorMessage || ''}">Erreur</span>`;
      } else {
        statusBadge = `<span class="anonymai-file-status-badge anonymai-file-status-success anonymai-ui">Prêt</span>`;
      }

      const sizeStr = formatFileSize(file.size);
      const fileIcon = getFileIcon(file.name);

      item.innerHTML = `
        <input type="checkbox" class="anonymai-file-checkbox anonymai-ui" ${file.selected ? 'checked' : ''} ${file.status !== 'success' ? 'disabled' : ''}>
        <div class="anonymai-file-icon anonymai-ui">${fileIcon}</div>
        <div class="anonymai-file-info anonymai-ui" style="margin-left: 2px;">
          <span class="anonymai-file-name anonymai-ui" title="${file.name}">${file.name}</span>
          <span class="anonymai-file-meta anonymai-ui">
            <span>${sizeStr}</span>
            ${statusBadge}
          </span>
        </div>
        <div class="anonymai-file-actions anonymai-ui">
          <button class="anonymai-file-delete-btn anonymai-ui" title="Retirer" data-id="${file.id}">&times;</button>
        </div>
      `;

      item.addEventListener("click", (e) => {
        if (e.target.classList.contains("anonymai-file-checkbox") || e.target.closest(".anonymai-file-delete-btn")) {
          return;
        }
        activeFileId = file.id;
        renderFilesList();
      });

      const checkbox = item.querySelector(".anonymai-file-checkbox");
      if (checkbox) {
        checkbox.addEventListener("change", (e) => {
          file.selected = checkbox.checked;
          if (activeFileId === 'combined') {
            updateTextareaContent();
          }
          renderFilesList();
        });
      }

      const deleteBtn = item.querySelector(".anonymai-file-delete-btn");
      if (deleteBtn) {
        deleteBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          removeFile(file.id);
        });
      }

      listEl.appendChild(item);
    });

    updateTextareaContent();
  }

  function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    if (ext === 'pdf') return '📕';
    if (ext === 'docx') return '📘';
    if (['txt', 'csv', 'md'].includes(ext)) return '📝';
    return '📄';
  }

  function formatFileSize(bytes) {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // Mettre à jour le contenu de la zone de texte de prévisualisation
  function updateTextareaContent() {
    const textarea = document.getElementById("anonymai-result-text");
    if (!textarea) return;

    if (uploadedFiles.length === 0) {
      textarea.value = "";
      textarea.placeholder = "Le texte extrait apparaîtra ici et sera automatiquement pseudonymisé...";
      return;
    }

    if (activeFileId === 'combined') {
      const selectedFiles = uploadedFiles.filter(f => f.selected && f.status === 'success');
      if (selectedFiles.length === 0) {
        textarea.value = "--- Aucun document sélectionné ---";
      } else {
        textarea.value = selectedFiles.map(f => {
          return `--- Début de document : ${f.name} ---\n${f.processedText}\n--- Fin de document : ${f.name} ---`;
        }).join("\n\n");
      }
    } else {
      const file = uploadedFiles.find(f => f.id === activeFileId);
      if (file) {
        if (file.status === 'processing') {
          textarea.value = `[Extraction en cours pour le fichier : ${file.name}...]`;
        } else if (file.status === 'error') {
          textarea.value = `[Erreur lors de la lecture du fichier : ${file.name}]\n\n${file.errorMessage || ""}`;
        } else {
          textarea.value = file.processedText;
        }
      } else {
        textarea.value = "";
      }
    }
  }

  function removeFile(fileId) {
    uploadedFiles = uploadedFiles.filter(f => f.id !== fileId);
    if (activeFileId === fileId) {
      if (uploadedFiles.length > 0) {
        activeFileId = uploadedFiles.length > 1 ? 'combined' : uploadedFiles[0].id;
      } else {
        activeFileId = null;
      }
    }
    renderFilesList();
  }

  // Extraction PDF local via pdf.js
  async function extractTextFromPDF(arrayBuffer) {
    try {
      // Charger le module de façon dynamique depuis l'extension
      const pdfjsLib = await import(chrome.runtime.getURL("lib/pdf.mjs"));
      // Spécifier la source du worker local
      pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("lib/pdf.worker.mjs");

      let pdf;
      try {
        pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      } catch (err) {
        if (err.name === 'PasswordException') {
          const password = prompt("Ce fichier PDF est protégé par un mot de passe. Veuillez le saisir pour extraire le texte :");
          if (password !== null) {
            pdf = await pdfjsLib.getDocument({ data: arrayBuffer, password: password }).promise;
          } else {
            throw new Error("Extraction annulée car le document est protégé par mot de passe.");
          }
        } else {
          throw err;
        }
      }

      let fullText = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        try {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          // Concaténer le texte de la page de façon robuste
          const pageText = textContent.items
            .filter(item => item && typeof item.str === 'string')
            .map(item => item.str)
            .join(" ");
          fullText += pageText + "\n";
        } catch (pageErr) {
          console.warn(`Erreur lors de l'extraction de la page ${i}:`, pageErr);
          fullText += `[Erreur d'extraction sur la page ${i}]\n`;
        }
      }

      return fullText;
    } catch (err) {
      throw new Error("Impossible d'extraire le PDF. Détail : " + err.message);
    }
  }

  // Extraction DOCX locale via mammoth.js
  async function extractTextFromDocx(arrayBuffer) {
    return new Promise((resolve, reject) => {
      if (typeof window.mammoth === "undefined") {
        reject(new Error("Mammoth.js n'est pas chargé dans la page."));
        return;
      }

      window.mammoth.extractRawText({ arrayBuffer: arrayBuffer })
        .then((result) => {
          resolve(result.value);
        })
        .catch((err) => {
          reject(new Error("Erreur de décodage Mammoth : " + err.message));
        });
    });
  }

  // Lecture fichier texte plat avec détection d'encodage robuste (UTF-8 puis Windows-1252)
  async function extractTextFromPlain(file) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      try {
        const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
        return utf8Decoder.decode(arrayBuffer);
      } catch (e) {
        console.warn("Échec du décodage UTF-8, tentative avec Windows-1252 :", e);
        const winDecoder = new TextDecoder('windows-1252');
        return winDecoder.decode(arrayBuffer);
      }
    } catch (err) {
      throw new Error("Erreur de lecture du fichier texte : " + err.message);
    }
  }

  // --- 8. SYSTÈME DE TOAST NOTIFICATION DANS LA PAGE ---
  function showToast(message, type = "success") {
    let container = document.getElementById("anonymai-toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "anonymai-toast-container";
      container.className = "anonymai-ui";
      // Placer le conteneur en z-index absolu
      Object.assign(container.style, {
        position: 'fixed',
        top: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: '9999999',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        pointerEvents: 'none'
      });
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `anonymai-toast-notif anonymai-toast-${type} anonymai-ui`;
    toast.innerHTML = `<span>🛡️</span> <span>${message}</span>`;
    
    // Forcer le style en ligne pour outrepasser les règles de la page hôte
    Object.assign(toast.style, {
      backgroundColor: type === "success" ? "#10b981" : (type === "error" ? "#ef4444" : "#3b82f6"),
      color: type === "success" ? "#0f172a" : "#ffffff",
      fontFamily: "'Outfit', sans-serif",
      fontSize: '13px',
      fontWeight: '600',
      padding: '10px 20px',
      borderRadius: '8px',
      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
      opacity: '0',
      transform: 'translateY(-20px)',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    });

    container.appendChild(toast);

    // Animation d'entrée
    setTimeout(() => {
      toast.style.opacity = "1";
      toast.style.transform = "translateY(0)";
    }, 10);

    // Animation de sortie et suppression
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(-20px)";
      setTimeout(() => {
        toast.remove();
        if (container.children.length === 0) container.remove();
      }, 300);
    }, 3500);
  }

})();
