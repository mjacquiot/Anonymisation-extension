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
    
    chrome.storage.local.get([sessionKey, "enabled", "globalContext", "forcedElements", "excludedElements", "pseudonymMode", "showOverlay"], (data) => {
      config.enabled = data.enabled !== false;
      config.globalContext = data.globalContext || "";
      config.forcedElements = data.forcedElements || [];
      config.excludedElements = data.excludedElements || [];
      config.pseudonymMode = data.pseudonymMode || "aliases";
      config.showOverlay = data.showOverlay !== false;

      if (data[sessionKey]) {
        sessionState = data[sessionKey];
      } else {
        sessionState = { mappings: {}, counters: {} };
      }

      applyState();
    });
  }

  // Écouteur de modifications du stockage local pour actualisation dynamique
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    let needsReinit = false;

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

    if (tabId) {
      const sessionKey = `session_tab_${tabId}`;
      if (changes[sessionKey]) {
        sessionState = changes[sessionKey].newValue || { mappings: {}, counters: {} };
        updateFabBadge();
        updateMappingsList();
      }
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

  // Injection du bouton "🛡️ Pseudonymiser" au-dessus de l'input de l'IA
  function injectShieldButton() {
    const inputEl = findAIInput();
    if (!inputEl) {
      removeShieldButton();
      return;
    }

    // Le bouton existe déjà
    if (document.getElementById("anonymai-shield-btn")) return;

    // Trouver le conteneur parent pour positionner le bouton de manière relative
    const parent = inputEl.parentNode;
    if (!parent) return;

    // Créer le bouton shield
    shieldBtnEl = document.createElement("button");
    shieldBtnEl.id = "anonymai-shield-btn";
    shieldBtnEl.className = "anonymai-ui";
    shieldBtnEl.innerHTML = "🛡️ Pseudonymiser";
    shieldBtnEl.title = "Pseudonymiser le texte et injecter le contexte (Raccourci : Ctrl+Alt+A)";

    // Style du bouton flottant au-dessus de l'input
    Object.assign(shieldBtnEl.style, {
      position: 'absolute',
      top: '-32px',
      right: '12px',
      zIndex: '9999',
      backgroundColor: '#10b981',
      color: '#0b0f19',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '16px',
      padding: '4px 10px',
      cursor: 'pointer',
      fontSize: '11px',
      fontWeight: '600',
      fontFamily: "'Outfit', sans-serif",
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
      transition: 'all 0.2s ease'
    });

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
    const btn = document.getElementById("anonymai-shield-btn");
    if (btn) btn.remove();
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

  // Événement déclenché lorsque l'utilisateur modifie la saisie manuellement
  function handleInputModify(e) {
    const inputEl = findAIInput();
    if (inputEl && e.target === inputEl) {
      inputEl.removeAttribute("data-anonymai-processed");
    }
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
      pseudonymMode: config.pseudonymMode
    });

    let processedPrompt = promptRes.pseudonymizedText;
    sessionState = promptRes.sessionState;

    // 3. Pseudonymiser le contexte système s'il est configuré
    let processedContext = "";
    if (config.globalContext && config.globalContext.trim().length > 0) {
      const trimmedContext = config.globalContext.trim();
      const contextRes = globalThis.PIIEngine.pseudonymizeText(trimmedContext, sessionState, {
        forcedElements: config.forcedElements,
        excludedElements: config.excludedElements,
        pseudonymMode: config.pseudonymMode
      });
      processedContext = contextRes.pseudonymizedText.trim();
      sessionState = contextRes.sessionState;
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
    showToast("Texte pseudonymisé et contexte injecté !", "success");
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
          pseudonymMode: config.pseudonymMode
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
          pseudonymMode: config.pseudonymMode
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
      'button[data-testid="send-button"]',
      'button[aria-label="Send prompt"]',
      'button.send-button',
      'button[aria-label="Envoyer le message"]',
      'button[aria-label="Send Message"]',
      'button[aria-label="Send prompt"]',
      'button[aria-label*="envoyer" i]',
      'button[aria-label*="send" i]',
      'button[aria-label*="soumettre" i]',
      'button[aria-label*="submit" i]',
      'button[title*="envoyer" i]',
      'button[title*="send" i]',
      'button[title*="soumettre" i]',
      'button[title*="submit" i]',
      'button.chat-send-button',
      'button[type="submit"]'
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
    const buttons = document.querySelectorAll("button");
    for (const btn of buttons) {
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
    span.textContent = origValue;

    // Style vert haut de gamme identique pour les deux modes
    Object.assign(span.style, {
      color: '#2e7d32',
      fontWeight: 'bold',
      backgroundColor: '#e8f5e9',
      padding: '2px 4px',
      borderRadius: '4px',
      border: '1px solid #c8e6c9',
      display: 'inline-block',
      fontFamily: 'inherit',
      cursor: 'help'
    });

    const parent = textNode.parentNode;
    if (parent) {
      parent.insertBefore(beforeNode, textNode);
      parent.insertBefore(span, textNode);
      parent.insertBefore(afterNode, textNode);
      parent.removeChild(textNode);

      // Récurser sur la partie après
      restoreTextNode(afterNode);
    }
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
    fabEl.innerHTML = "🛡️";
    fabEl.title = "Ouvrir l'assistant local AnonymAI";
    document.body.appendChild(fabEl);

    // 2. Créer le Panel latéral
    panelEl = document.createElement("div");
    panelEl.id = "anonymai-panel-el";
    panelEl.className = "anonymai-panel anonymity-ui anonymai-ui";
    
    panelEl.innerHTML = `
      <div class="anonymai-panel-header anonymai-ui">
        <div class="anonymai-panel-title anonymai-ui">
          <span style="font-size: 20px;">🛡️</span>
          <h3>AnonymAI Assistant</h3>
        </div>
        <button class="anonymai-panel-close anonymai-ui" id="anonymai-close-btn">&times;</button>
      </div>

      <div class="anonymai-panel-content anonymai-ui">
        <!-- Section Contexte -->
        <div class="anonymai-panel-section anonymai-ui">
          <div class="anonymai-panel-section-title anonymai-ui">Contexte Actif</div>
          <div class="anonymai-context-indicator anonymai-ui" id="anonymai-context-indicator">
            Aucun contexte système configuré.
          </div>
        </div>

        <!-- Section Restauration Visuelle -->
        <div class="anonymai-panel-section anonymai-ui" style="display: flex; flex-direction: row; justify-content: space-between; align-items: center; gap: 12px; padding: 10px 12px;">
          <div class="anonymai-ui" style="display: flex; flex-direction: column; gap: 2px;">
            <div class="anonymai-panel-section-title anonymai-ui" style="margin-bottom: 0; font-size: 11px;">Restauration visuelle</div>
            <span class="anonymai-ui" style="font-size: 9px; color: #94a3b8;">Afficher le texte original en vert sur la page</span>
          </div>
          <label class="anonymai-switch anonymity-ui anonymai-ui">
            <input type="checkbox" id="anonymai-overlay-toggle" ${config.showOverlay ? 'checked' : ''}>
            <span class="anonymai-slider anonymai-ui"></span>
          </label>
        </div>

        <!-- Section Drag & Drop -->
        <div class="anonymai-panel-section anonymai-ui">
          <div class="anonymai-panel-section-title anonymai-ui">Pseudonymiser documents / dossiers</div>
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

        <!-- Section Liste de documents V3 -->
        <div class="anonymai-panel-section anonymai-ui" id="anonymai-file-list-section" style="display: none; max-height: 180px; overflow-y: auto;">
          <div class="anonymai-panel-section-title anonymai-ui" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span>Documents chargés</span>
            <button id="anonymai-clear-files-btn" class="anonymai-ui" style="background: none; border: none; color: #ef4444; font-size: 10px; cursor: pointer; font-weight: 600; padding: 0;">Vider la liste</button>
          </div>
          <div id="anonymai-file-list" class="anonymai-file-list-container anonymai-ui">
            <!-- Fichiers ajoutés dynamiquement -->
          </div>
        </div>

        <!-- Section Textarea résultat -->
        <div class="anonymai-panel-section anonymai-ui" style="flex-grow: 1; display: flex; flex-direction: column;">
          <div class="anonymai-panel-section-title anonymai-ui">Texte pseudonymisé</div>
          <textarea class="anonymai-textarea anonymai-ui" id="anonymai-result-text" placeholder="Le texte extrait apparaîtra ici et sera automatiquement pseudonymisé..."></textarea>
          <div class="anonymai-actions-row anonymai-ui" style="margin-top: 8px;">
            <button class="anonymai-btn anonymai-btn-secondary anonymai-ui" id="anonymai-copy-btn">Copier</button>
            <button class="anonymai-btn anonymai-btn-primary anonymai-ui" id="anonymai-inject-btn">Injecter</button>
          </div>
        </div>

        <!-- Section Mappings en cours -->
        <div class="anonymai-panel-section anonymai-ui" style="max-height: 150px; overflow-y: auto;">
          <div class="anonymai-panel-section-title anonymai-ui">Correspondances Actives</div>
          <div id="anonymai-mappings-list" class="anonymai-ui" style="font-size: 11px; font-family: monospace; display: flex; flex-direction: column; gap: 4px;">
            <!-- Rempli dynamiquement -->
          </div>
        </div>
      </div>

      <div class="anonymai-panel-footer anonymai-ui">
        <a href="#" class="anonymai-footer-link anonymai-ui" id="anonymai-options-link">⚙️ Options avancées</a>
      </div>
    `;

    document.body.appendChild(panelEl);

    // Attacher les écouteurs d'événements UI
    setupUIListeners();
    updateFabBadge();
    updateContextIndicator();
    updateMappingsList();
    renderFilesList();
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
        chrome.storage.local.set({ showOverlay: show }, () => {
          config.showOverlay = show;
          applyState();
        });
      });
    }

    // Toggle panel
    fabEl.addEventListener("click", () => {
      isPanelOpen = !isPanelOpen;
      panelEl.classList.toggle("anonymai-panel-open", isPanelOpen);
      fabEl.classList.toggle("anonymai-fab-active", isPanelOpen);
      fabEl.innerHTML = isPanelOpen ? "&times;" : "🛡️";
    });

    closeBtn.addEventListener("click", () => {
      isPanelOpen = false;
      panelEl.classList.remove("anonymai-panel-open");
      fabEl.classList.remove("anonymai-fab-active");
      fabEl.innerHTML = "🛡️";
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

    clearFilesBtn.addEventListener("click", () => {
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
        fabEl.innerHTML = "🛡️";
      }
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
      div.style.padding = "2px 0";
      div.style.borderBottom = "1px solid #334155";
      
      div.innerHTML = `
        <span class="anonymai-ui" style="color: #34d399; font-weight:600;">${token}</span>
        <span class="anonymai-ui" style="color: #f8fafc; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${original}">${original}</span>
      `;
      listEl.appendChild(div);
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
        pseudonymMode: config.pseudonymMode
      });

      sessionState = res.sessionState;
      saveSessionToStorage();

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

      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = "";

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        // Concaténer le texte de la page
        const pageText = textContent.items.map(item => item.str).join(" ");
        fullText += pageText + "\n";
      }

      return fullText;
    } catch (err) {
      throw new Error("Impossible d'extraire le PDF. Vérifiez qu'il n'est pas scanné ou protégé. Détail : " + err.message);
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

  // Lecture fichier texte plat
  function extractTextFromPlain(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (err) => reject(new Error("Erreur FileReader : " + err));
      reader.readAsText(file);
    });
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
