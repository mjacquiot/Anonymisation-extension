// offscreen.js - Script exécuté dans le document offscreen sécurisé de l'extension.
// Exécute l'OCR Tesseract et l'analyse PDF/images à l'abri des restrictions CSP.

function logOffscreen(message, type = 'info', tabId = null) {
  console.log(`[Offscreen] [${type.toUpperCase()}] ${message}`);
  chrome.runtime.sendMessage({
    action: "offscreen_log",
    message: message,
    type: type,
    tabId: tabId
  }).catch(() => {});
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "parse_document") {
    handleParseDocument(request.fileData, request.tabId)
      .then(text => sendResponse({ success: true, text: text }))
      .catch(err => {
        console.error("OCR/Parsing error:", err);
        logOffscreen(err.message || "Erreur de conversion.", "error", request.tabId);
        sendResponse({ success: false, error: err.message || "Erreur de conversion." });
      });
    return true; // Indique une réponse asynchrone
  }
});

function base64ToUint8Array(base64) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function handleParseDocument(fileData, tabId) {
  const { name, type, base64 } = fileData;
  const extension = name.split('.').pop().toLowerCase();

  if (!base64) {
    throw new Error("Aucune donnée de fichier Base64 reçue.");
  }

  const uint8Array = base64ToUint8Array(base64);

  if (extension === "pdf") {
    return parsePDF(uint8Array, name, tabId);
  } else if (["png", "jpg", "jpeg", "webp", "gif"].includes(extension)) {
    return parseImage(uint8Array, type, name, tabId);
  } else {
    throw new Error("Format de fichier non pris en charge par le parseur offscreen.");
  }
}

async function parsePDF(uint8Array, fileName, tabId) {
  // Boucle de keep-alive pour empêcher le Service Worker d'être arrêté pendant l'OCR
  const keepAliveInterval = setInterval(() => {
    chrome.storage.local.get(['enabled']).catch(() => {});
  }, 10000);

  try {
    // 1. Charger PDF.js
    logOffscreen("Chargement du moteur PDF...", "info", tabId);
    chrome.runtime.sendMessage({
      action: "ocr_progress",
      fileName: fileName,
      statusText: "Chargement du moteur PDF...",
      percent: 5,
      tabId: tabId
    }).catch(() => {});

    const pdfjsLib = await import(chrome.runtime.getURL("lib/pdf.mjs"));
    pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("lib/pdf.worker.mjs");

    logOffscreen("Moteur PDF chargé. Lecture du document...", "info", tabId);
    chrome.runtime.sendMessage({
      action: "ocr_progress",
      fileName: fileName,
      statusText: "Lecture du document...",
      percent: 10,
      tabId: tabId
    }).catch(() => {});

    const pdf = await pdfjsLib.getDocument({ data: uint8Array }).promise;
    let finalText = "";
    let worker = null;

    logOffscreen(`Document chargé avec succès (${pdf.numPages} pages).`, "info", tabId);
    chrome.runtime.sendMessage({
      action: "ocr_progress",
      fileName: fileName,
      statusText: `Document chargé (${pdf.numPages} pages)...`,
      percent: 15,
      tabId: tabId
    }).catch(() => {});

    let currentPageIdx = 1;

    async function getWorker() {
      if (!worker) {
        logOffscreen("Initialisation de l'OCR Tesseract...", "info", tabId);
        chrome.runtime.sendMessage({
          action: "ocr_progress",
          fileName: fileName,
          statusText: `Préparation du moteur OCR Tesseract...`,
          percent: Math.round(((currentPageIdx - 0.8) / pdf.numPages) * 100),
          tabId: tabId
        }).catch(() => {});

        const baseUrl = chrome.runtime.getURL("lib/tesseract/");
        worker = await Tesseract.createWorker('fra', 1, {
          workerPath: baseUrl + "worker.min.js",
          corePath: baseUrl,
          langPath: baseUrl,
          workerBlobURL: false,
          logger: (m) => {
            if (m && m.status === "recognizing text" && typeof m.progress === 'number') {
              const pagePercent = Math.round(m.progress * 100);
              chrome.runtime.sendMessage({
                action: "ocr_progress",
                fileName: fileName,
                currentPage: currentPageIdx,
                totalPages: pdf.numPages,
                isOcr: true,
                statusText: `OCR Tesseract : page ${currentPageIdx}/${pdf.numPages} (${pagePercent}%)...`,
                percent: Math.round(((currentPageIdx - 1 + m.progress) / pdf.numPages) * 100),
                tabId: tabId
              }).catch(() => {});
            }
          }
        });
        logOffscreen("Moteur OCR Tesseract local prêt.", "info", tabId);
      }
      return worker;
    }

    for (let i = 1; i <= pdf.numPages; i++) {
      currentPageIdx = i;
      try {
        logOffscreen(`Analyse de la page ${i}/${pdf.numPages}...`, "info", tabId);
        chrome.runtime.sendMessage({
          action: "ocr_progress",
          fileName: fileName,
          currentPage: i,
          totalPages: pdf.numPages,
          isOcr: false,
          statusText: `Analyse de la page ${i}/${pdf.numPages}...`,
          percent: Math.round(((i - 1) / pdf.numPages) * 100),
          tabId: tabId
        }).catch(() => {});

        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const items = textContent.items.filter(item => item && typeof item.str === 'string' && Array.isArray(item.transform) && item.transform.length >= 6);

        const lineThreshold = 5;
        const lines = [];
        let currentLine = [];
        let currentY = null;

        // Tri par coordonnée Y décroissante (de haut en bas)
        const sortedItems = [...items].sort((a, b) => b.transform[5] - a.transform[5]);

        for (const item of sortedItems) {
          const y = item.transform[5];
          if (currentY === null) {
            currentY = y;
            currentLine.push(item);
          } else if (Math.abs(y - currentY) <= lineThreshold) {
            currentLine.push(item);
          } else {
            currentLine.sort((a, b) => a.transform[4] - b.transform[4]);
            lines.push(currentLine);
            currentLine = [item];
            currentY = y;
          }
        }

        if (currentLine.length > 0) {
          currentLine.sort((a, b) => a.transform[4] - b.transform[4]);
          lines.push(currentLine);
        }

        const pageText = lines.map(line => {
          let lineStr = "";
          for (let j = 0; j < line.length; j++) {
            const str = line[j].str;
            if (j === 0) {
              lineStr = str;
            } else {
              const prev = lineStr;
              const prevEndsSpace = prev.endsWith(" ") || prev.endsWith("\t");
              const nextStartsSpace = str.startsWith(" ") || str.startsWith("\t");
              if (prevEndsSpace || nextStartsSpace) {
                lineStr += str;
              } else {
                lineStr += " " + str;
              }
            }
          }
          return lineStr;
        }).join("\n");

        const trimmedPageText = pageText.trim();
        const isOcr = trimmedPageText.length < 40;

        if (!isOcr) {
          logOffscreen(`Page ${i}/${pdf.numPages} : texte numérique suffisant (${trimmedPageText.length} caractères).`, "info", tabId);
          chrome.runtime.sendMessage({
            action: "ocr_progress",
            fileName: fileName,
            currentPage: i,
            totalPages: pdf.numPages,
            isOcr: false,
            statusText: `Page ${i}/${pdf.numPages} : Texte extrait...`,
            percent: Math.round((i / pdf.numPages) * 100),
            tabId: tabId
          }).catch(() => {});
          finalText += `--- Page ${i} ---\n${trimmedPageText}\n\n`;
        } else {
          logOffscreen(`Page ${i}/${pdf.numPages} : texte insuffisant (${trimmedPageText.length} caractères). Lancement de l'OCR...`, "info", tabId);
          
          chrome.runtime.sendMessage({
            action: "ocr_progress",
            fileName: fileName,
            currentPage: i,
            totalPages: pdf.numPages,
            isOcr: true,
            statusText: `Rendu graphique de la page ${i}/${pdf.numPages}...`,
            percent: Math.round(((i - 0.7) / pdf.numPages) * 100),
            tabId: tabId
          }).catch(() => {});

          const tWorker = await getWorker();

          // Rendu de la page à haute résolution (scale: 2.0 pour une bonne détection OCR)
          const viewport = page.getViewport({ scale: 2.0 });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;

          const ctx = canvas.getContext("2d");
          await page.render({ canvasContext: ctx, viewport: viewport }).promise;

          logOffscreen(`Lancement de l'OCR Tesseract sur la page ${i}/${pdf.numPages}...`, "info", tabId);
          chrome.runtime.sendMessage({
            action: "ocr_progress",
            fileName: fileName,
            currentPage: i,
            totalPages: pdf.numPages,
            isOcr: true,
            statusText: `Reconnaissance OCR en cours : page ${i}/${pdf.numPages}...`,
            percent: Math.round(((i - 0.5) / pdf.numPages) * 100),
            tabId: tabId
          }).catch(() => {});

          const { data: { text } } = await tWorker.recognize(canvas);
          logOffscreen(`Page ${i}/${pdf.numPages} (OCR) : Reconnaissance terminée.`, "success", tabId);
          finalText += `--- Page ${i} (OCR) ---\n${text.trim()}\n\n`;
        }
      } catch (pageErr) {
        logOffscreen(`Erreur lors du traitement de la page ${i}: ${pageErr.message}`, "error", tabId);
        finalText += `[Erreur lors de la lecture de la page ${i}]\n\n`;
      }
    }

    if (worker) {
      await worker.terminate();
    }

    chrome.runtime.sendMessage({
      action: "ocr_progress",
      fileName: fileName,
      currentPage: pdf.numPages,
      totalPages: pdf.numPages,
      isOcr: false,
      statusText: "Document lu avec succès !",
      percent: 100,
      tabId: tabId
    }).catch(() => {});

    return finalText.trim();
  } finally {
    clearInterval(keepAliveInterval);
  }
}

async function parseImage(uint8Array, type, fileName, tabId) {
  // Boucle de keep-alive pour empêcher le Service Worker d'être arrêté pendant l'OCR
  const keepAliveInterval = setInterval(() => {
    chrome.storage.local.get(['enabled']).catch(() => {});
  }, 10000);

  try {
    logOffscreen(`Préparation de l'image ${fileName}...`, "info", tabId);
    chrome.runtime.sendMessage({
      action: "ocr_progress",
      fileName: fileName,
      currentPage: 1,
      totalPages: 1,
      isOcr: true,
      statusText: "Préparation de l'image...",
      percent: 10,
      tabId: tabId
    }).catch(() => {});

    const blob = new Blob([uint8Array], { type: type });
    const blobUrl = URL.createObjectURL(blob);

    logOffscreen(`Initialisation de l'OCR Tesseract local...`, "info", tabId);
    chrome.runtime.sendMessage({
      action: "ocr_progress",
      fileName: fileName,
      currentPage: 1,
      totalPages: 1,
      isOcr: true,
      statusText: "Initialisation du moteur OCR local...",
      percent: 30,
      tabId: tabId
    }).catch(() => {});

    const baseUrl = chrome.runtime.getURL("lib/tesseract/");
    const worker = await Tesseract.createWorker('fra', 1, {
      workerPath: baseUrl + "worker.min.js",
      corePath: baseUrl,
      langPath: baseUrl,
      workerBlobURL: false,
      logger: (m) => {
        if (m && m.status === "recognizing text" && typeof m.progress === 'number') {
          const pagePercent = Math.round(m.progress * 100);
          chrome.runtime.sendMessage({
            action: "ocr_progress",
            fileName: fileName,
            currentPage: 1,
            totalPages: 1,
            isOcr: true,
            statusText: `Reconnaissance OCR de l'image (${pagePercent}%)...`,
            percent: Math.round(30 + m.progress * 65),
            tabId: tabId
          }).catch(() => {});
        }
      }
    });

    logOffscreen(`Lancement de l'OCR sur l'image...`, "info", tabId);
    chrome.runtime.sendMessage({
      action: "ocr_progress",
      fileName: fileName,
      currentPage: 1,
      totalPages: 1,
      isOcr: true,
      statusText: "Reconnaissance de l'image (OCR)...",
      percent: 50,
      tabId: tabId
    }).catch(() => {});

    let extractedText = "";
    try {
      const { data: { text } } = await worker.recognize(blobUrl);
      extractedText = text;
      logOffscreen(`Image ${fileName} (OCR) : Reconnaissance terminée.`, "success", tabId);
      chrome.runtime.sendMessage({
        action: "ocr_progress",
        fileName: fileName,
        currentPage: 1,
        totalPages: 1,
        isOcr: true,
        statusText: "Image lue avec succès !",
        percent: 100,
        tabId: tabId
      }).catch(() => {});
    } catch (err) {
      logOffscreen(`Image ${fileName} (OCR) : Erreur : ${err.message}`, "error", tabId);
      throw err;
    } finally {
      await worker.terminate();
      URL.revokeObjectURL(blobUrl);
    }

    return extractedText.trim();
  } finally {
    clearInterval(keepAliveInterval);
  }
}
