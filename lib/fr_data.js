// Moteur de détection et de pseudonymisation locale pour la France
// 100% hors-ligne et respectueux du RGPD / AI Act

(function() {
  // Liste des prénoms très courants en France (accents facultatifs dans les comparaisons grâce à normalizeStr)
  const COMMON_PRENOMS = new Set([
    "jean", "marie", "pierre", "michel", "philippe", "thomas", "nicolas", "alexandre", "julien", "vincent", "antoine", 
    "david", "guillaume", "laurent", "sebastien", "stephane", "francois", "frederic", "matthieu", "mathieu", "eric", "sophie", 
    "julie", "sarah", "emilie", "pauline", "lea", "manon", "emma", "louise", "alice", "juliette", "camille", 
    "mathilde", "chloe", "marion", "charlotte", "lucas", "hugo", "enzo", "arthur", "nathan", "mathis", "louis", 
    "leo", "clement", "maxime", "quentin", "alexis", "paul", "clara", "anais", "lucie", 
    "ines", "louna", "jade", "zoe", "gabriel", "raphael", "jules", "mael", "liam", "noah", "ethan", "sacha", "adam", "nolan", 
    "timothee", "jacques", "bernard", "daniel", "henri", "rene", "alain", "marcel", "robert", "christian", 
    "marc", "andre", "gerard", "yves", "guy", "patrick", "didier", "pascal", "dominique", "thierry", "bruno", 
    "christophe", "olivier", "franck", "arnaud", "ludovic", "jerome", "romain", 
    "damien", "florent", "loic", "yann", "cedric", "florian", "kevin", "aurelien", "benjamin", 
    "baptiste", "simon", "valentin", "remy", "adrien", "bastien", "dylan", "rayan", "corentin", "theo", "samuel", 
    "francoise", "monique", "jacqueline", "jeanne", "nicole", "helene", "nathalie", "isabelle", "sylvie", 
    "catherine", "brigitte", "valerie", "sandrine", "patricia", "laurence", "christine", "corinne", 
    "florence", "veronique", "chantal", "anne", "martine", "elisabeth", 
    "claude", "colette", "gisele", "micheline", "yvette", "simone", "suzanne", "denise", 
    "genevieve", "odette", "germaine", "lucette", "paulette", "raymonde", "liliane", "christiane", 
    "bernadette", "annie", "daniele", "arlette", "claudine", "danielle", "josiane", 
    "evelyne", "karine", "stephanie", "virginie", "severine", "emmanuelle", "aurelie", "celine", "audrey", "elodie", 
    "laetitia", "delphine", "marina", "sabrina", "christelle", "adeline", "amelie", 
    "melanie", "anne-sophie", "marjorie", "caroline", "clara", "marine", "justine", "eva", "laura", "oceane", "clementine", "morgane", "romane", 
    "agathe", "solene", "lisa", "noemie", "margaux", "salome", "myriam", "fanny", "adele", "coline", "lola", "maelys", "leonie", "clemence", "lucile", "elisa", "celia"
  ]);

  // Liste des villes françaises courantes (top 150)
  const COMMON_VILLES = new Set([
    "paris", "marseille", "lyon", "toulouse", "nice", "nantes", "montpellier", "strasbourg", "bordeaux", "lille", 
    "rennes", "reims", "saint-etienne", "toulon", "le havre", "grenoble", "dijon", "angers", "villeurbanne", 
    "saint-denis", "nimes", "clermont-ferrand", "aix-en-provence", "brest", "limoges", "tours", "amiens", 
    "perpignan", "metz", "besancon", "boulogne-billancourt", "orleans", "rouen", "mulhouse", "caen", 
    "nancy", "saint-paul", "tourcoing", "roubaix", "nanterre", "vitry-sur-seine", "avignon", "creteil", 
    "dunkerque", "poitiers", "aubervilliers", "versailles", "courbevoie", "colombes", "aulnay-sous-bois", 
    "cherbourg-en-cotentin", "saint-pierre", "aubagne", "asniere-sur-seine", "colmar", "saint-maur-des-fosses", 
    "rueil-malmaison", "champigny-sur-marne", "antibes", "beziers", "la rochelle", "saint-nazaire", "merignac", 
    "calais", "drancy", "bourges", "vienne", "ajaccio", "cayenne", "valence", "chambery", "saint-quentin", 
    "niort", "troyes", "lorient", "saint-leu", "sarcelles", "neuilly-sur-seine", "annecy", "belfort", 
    "tarbes", "auxerre", "nevers", "blois", "pau", "bayonne", "biarritz", "angouleme", "laval", "evreux", 
    "chartres", "mende", "aurillac", "cahors", "roanne", "saint-malo", "arras", "lens", "douai", "valenciennes",
    "bastia", "versailles", "vincennes", "montreuil", "pantin", "clichy", "meudon", "puteaux", "suresnes"
  ]);

  // Stop words français pour éviter de fausses pseudonymisations sur des mots majuscules en début de phrase ou dans le texte
  const FRENCH_STOP_WORDS = new Set([
    "le", "la", "les", "un", "une", "des", "du", "de", "au", "aux", "je", "tu", "il", "elle", "nous", "vous", "ils", "elles", 
    "mon", "ton", "son", "notre", "votre", "leur", "ma", "ta", "sa", "mes", "tes", "ses", "nos", "vos", "leurs", "ce", "cet", 
    "cette", "ces", "dans", "pour", "avec", "sans", "sous", "sur", "chez", "mais", "ou", "et", "donc", "or", "ni", "car", 
    "si", "comme", "quand", "depuis", "pendant", "bonjour", "salut", "merci", "oui", "non", "ok", "d'un", "d'une", "c'est", 
    "c'etait", "ceux", "celles", "celui", "celle", "quel", "quelle", "quels", "quelles", "lequel", "laquelle", "lesquels", 
    "lesquelles", "alors", "apres", "assez", "aujourd'hui", "aupres", "auquel", "aussi", "autant", "autre", "autres", 
    "auxquelles", "auxquels", "ayant", "beaucoup", "ceci", "cela", "celui-ci", "celui-la", "celle-ci", "celle-la", 
    "ceux-ci", "ceux-la", "celles-ci", "celles-la", "chaque", "combien", "comment", "dehors", "derriere", 
    "desquelles", "desquels", "devant", "devers", "durant", "encore", "envers", "environ", "hormis", "jusque", 
    "lorsque", "malgre", "moins", "moyen", "naguere", "parfois", "parmi", "partout", "plus", "plusieurs", "plutot", 
    "presque", "puisque", "quant", "quoique", "selon", "seront", "serait", "seraient", "sont", "etait", "etaient", 
    "toutefois", "vers", "voici", "voila", "m.", "mme", "dr", "pr", "monsieur", "madame", "professeur", "docteur",
    "directeur", "maire", "adjoint", "chef", "service", "agent", "tres", "trop", "bien", "ici", "la-bas", "alors", 
    "donc", "aussi", "peut-etre", "toujours", "jamais", "souvent", "parfois", "quelquefois", "rarement"
  ]);

  // Fonction utilitaire pour normaliser une chaîne de caractères (retirer accents, minuscules)
  function normalizeStr(str) {
    if (!str) return "";
    return str.toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .trim();
  }

  // Regex pour données structurées
  const PATTERNS = {
    EMAIL: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    // Téléphone français (avec espaces, tirets, points ou collés, local ou international)
    TELEPHONE: /(?:\+33|0033|0)\s*[1-9](?:[\s.-]*\d{2}){4}/g,
    // Numéro de sécurité sociale français (NIR) : 15 chiffres
    // Format : S AA MM DD COM ORD CLE (avec ou sans espaces/tirets)
    // S=1 ou 2, AA=année, MM=mois (01-12, 20 pour Corse), DD=dept (2A/2B/97/98 ou 2 chiffres), COM=commune, ORD=ordre, CLE=clé
    SECURE_SOCIALE: /[12]\s*\d{2}\s*(?:0[1-9]|1[0-2]|20)\s*(?:\d{2}|2[AB])\s*\d{3}\s*\d{3}\s*\d{2}/g,
    // IBAN standard (FR + 2 chiffres + 23 caractères alphanumériques séparés ou non par des espaces)
    IBAN: /FR\d{2}(?:\s*\d{4}){5}\s*\d{3}/gi,
    // Carte Bancaire (16 chiffres, séparés par espaces ou tirets ou collés)
    CARTE_BANCAIRE: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
    // Code postal à 5 chiffres
    CODE_POSTAL: /\b\d{5}\b/g
  };

  // Détecte si un mot capitalisé est précédé par un marqueur de phrase (début de phrase)
  // Pour éviter de pseudonymiser des mots ordinaires qui commencent juste une phrase (ex: "Il", "Nous", "Le")
  function isSentenceStart(text, index) {
    if (index === 0) return true;
    const beforeText = text.substring(0, index).trim();
    if (beforeText.length === 0) return true;
    const lastChar = beforeText.slice(-1);
    return [".", "!", "?", "\n"].includes(lastChar);
  }

  // Heuristique pour détecter les préfixes de contexte (ex: civilités, adresses)
  function checkContextPrefix(text, index) {
    const sub = text.substring(Math.max(0, index - 25), index).toLowerCase();
    
    // Si précédé par des formules de politesse ou titres -> NOM de personne
    if (/\b(?:m\.|mme|monsieur|madame|dr|docteur|professeur|prof|nomme|nommee|nommees|appelle|appellee)\b\s*$/i.test(sub)) {
      return "NOM_PRENOM";
    }
    // Si précédé par des indicateurs géographiques -> VILLE
    if (/\b(?:habite\s+a|vit\s+a|reside\s+a|situé\s+a|adresse\s+a|ville\s+de|aller\s+a|vers)\b\s*$/i.test(sub)) {
      return "VILLE";
    }
    // Si précédé par des indicateurs d'organisations/entreprises -> ORGANISATION
    if (/\b(?:societe|entreprise|compagnie|siret|siren|association|ets|etablissement|cabinet|agence)\b\s*$/i.test(sub)) {
      return "ORGANISATION";
    }
    return null;
  }

  // Fonction principale de pseudonymisation
  function pseudonymizeText(text, sessionState, config = { forcedElements: [], excludedElements: [] }) {
    if (!text) return text;
    
    // Initialisation de l'état de session si manquant
    if (!sessionState) {
      sessionState = {
        mappings: {}, // stocke les deux sens: "Jean" -> "[PRENOM_1]" et "[PRENOM_1]" -> "Jean"
        counters: {}  // compteurs par catégorie
      };
    }
    if (!sessionState.mappings) sessionState.mappings = {};
    if (!sessionState.counters) sessionState.counters = {};

    const candidates = [];

    // --- 1. EXCLUSIONS ---
    // Repérer toutes les occurrences des éléments exclus configurés par l'utilisateur
    const exclusions = (config.excludedElements || []).filter(el => el && el.trim().length > 0);
    const exclusionRanges = [];
    for (const excl of exclusions) {
      const escaped = excl.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
      let match;
      while ((match = regex.exec(text)) !== null) {
        exclusionRanges.push({
          start: match.index,
          end: match.index + match[0].length,
          value: match[0],
          type: "EXCLUDE"
        });
      }
    }

    // --- 2. ÉLÉMENTS FORCÉS (Utilisateur) ---
    const forced = (config.forcedElements || []).filter(el => el && el.trim().length > 0);
    for (const force of forced) {
      const escaped = force.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      // On autorise la recherche sur tout type de texte (avec ou sans word boundary pour s'assurer que c'est forcé)
      const regex = new RegExp(escaped, 'gi');
      let match;
      while ((match = regex.exec(text)) !== null) {
        candidates.push({
          start: match.index,
          end: match.index + match[0].length,
          value: match[0],
          type: "FORCE"
        });
      }
    }

    // --- 3. PATTERNS STRUCTURÉS ---
    for (const [type, regex] of Object.entries(PATTERNS)) {
      let match;
      // Réinitialiser l'index regex
      regex.lastIndex = 0;
      while ((match = regex.exec(text)) !== null) {
        candidates.push({
          start: match.index,
          end: match.index + match[0].length,
          value: match[0],
          type: type
        });
      }
    }

    // --- 4. DÉTECTION DES NOMS PROPRES, PRÉNOMS ET VILLES (Accents et capitales) ---
    // Regex pour détecter les mots capitalisés (accents compris)
    // Elle cherche un caractère majuscule français suivi de lettres minuscules, tirets, apostrophes
    const capWordRegex = /\b[A-ZÀ-ÖØ-ß][a-zA-ZÀ-ÖØ-öø-ÿœŒæÆéèêëàâäôöûüç'-]*\b/g;
    let match;
    while ((match = capWordRegex.exec(text)) !== null) {
      const word = match[0];
      const index = match.index;
      const normalizedWord = normalizeStr(word);

      // On passe si c'est un mot court (1 car.) sauf s'il s'agit de M. ou autre
      if (word.length <= 1) continue;

      // Si le mot est dans la liste des exclusions globales ou des stop words
      if (FRENCH_STOP_WORDS.has(normalizedWord)) continue;

      const sentenceStart = isSentenceStart(text, index);
      const isKnownPrenom = COMMON_PRENOMS.has(normalizedWord);
      const isKnownVille = COMMON_VILLES.has(normalizedWord);

      // Si on commence une phrase, on ne pseudonymise QUE si le mot fait partie de notre dictionnaire connu
      if (sentenceStart) {
        if (isKnownPrenom) {
          candidates.push({ start: index, end: index + word.length, value: word, type: "PRENOM" });
        } else if (isKnownVille) {
          candidates.push({ start: index, end: index + word.length, value: word, type: "VILLE" });
        }
        continue;
      }

      // En milieu de phrase, un mot capitalisé non-stop-word a de fortes chances d'être un PII
      let type = "NOM_PRENOM"; // Par défaut
      
      // Heuristiques de contexte
      const contextType = checkContextPrefix(text, index);
      if (contextType) {
        type = contextType;
      } else if (isKnownPrenom) {
        type = "PRENOM";
      } else if (isKnownVille) {
        type = "VILLE";
      }

      candidates.push({
        start: index,
        end: index + word.length,
        value: word,
        type: type
      });
    }

    // --- 5. FUSION DES NOMS COMPOSÉS ET ADJACENTS (Ex: "Jean Dupont", "Aix-en-Provence") ---
    // On regroupe les mots capitalisés adjacents séparés uniquement par des espaces ou tirets
    // (Cette étape s'applique uniquement aux prénoms, noms ou entités)
    const nameTypes = ["PRENOM", "NOM_PRENOM", "NOM", "ORGANISATION"];
    
    // Trier les candidats textuels par index
    let wordCandidates = candidates.filter(c => nameTypes.includes(c.type)).sort((a, b) => a.start - b.start);
    
    let i = 0;
    while (i < wordCandidates.length - 1) {
      const curr = wordCandidates[i];
      const next = wordCandidates[i + 1];
      
      // Vérifier l'espace ou le tiret séparateur
      const gap = text.substring(curr.end, next.start);
      if (gap === " " || gap === "-" || gap === " - ") {
        // Fusionner en NOM_PRENOM
        curr.end = next.end;
        curr.value = text.substring(curr.start, curr.end);
        curr.type = (curr.type === "ORGANISATION" || next.type === "ORGANISATION") ? "ORGANISATION" : "NOM_PRENOM";
        
        // Retirer le candidat fusionné de la liste globale de traitement
        // et le supprimer de notre sous-liste temporaire
        const indexInCandidates = candidates.indexOf(next);
        if (indexInCandidates !== -1) {
          candidates.splice(indexInCandidates, 1);
        }
        wordCandidates.splice(i + 1, 1);
        // On ne change pas "i" pour pouvoir fusionner récursivement (ex: "Jean-Pierre", "Jean-Pierre Martin")
      } else {
        i++;
      }
    }

    // --- 6. RÉSOLUTION DES OVERLAPS ET EXCLUSIONS ---
    // On filtre d'abord tout candidat qui chevauche une zone d'EXCLUSION
    let filteredCandidates = candidates.filter(candidate => {
      // Si c'est une exclusion en soi, on l'exclut des candidats de remplacement
      if (candidate.type === "EXCLUDE") return false;
      
      const overlapsExclusion = exclusionRanges.some(excl => 
        (candidate.start >= excl.start && candidate.start < excl.end) ||
        (candidate.end > excl.start && candidate.end <= excl.end)
      );
      return !overlapsExclusion;
    });

    // Tri par taille de plage décroissante (les plus longs d'abord)
    filteredCandidates.sort((a, b) => (b.end - b.start) - (a.end - a.start));

    const finalCandidates = [];
    for (const candidate of filteredCandidates) {
      // Vérifier si ce candidat chevauche un candidat déjà sélectionné
      const overlaps = finalCandidates.some(selected => 
        (candidate.start >= selected.start && candidate.start < selected.end) ||
        (candidate.end > selected.start && candidate.end <= selected.end)
      );
      if (!overlaps) {
        finalCandidates.push(candidate);
      }
    }

    // Tri par index de début croissant pour reconstruire la chaîne proprement
    finalCandidates.sort((a, b) => a.start - b.start);

    // --- 7. APPLIQUER LA PSEUDONYMISATION (De droite à gauche / Index décroissant) ---
    const pseudonymMode = (config && config.pseudonymMode) || "tokens";
    
    // Assurer que le tableau des alias générés existe dans sessionState
    if (!sessionState.generatedAliases) {
      sessionState.generatedAliases = [];
    }

    let resultText = text;
    for (let idx = finalCandidates.length - 1; idx >= 0; idx--) {
      const item = finalCandidates[idx];
      const origValue = item.value;
      const type = item.type;
      
      const normalizedValue = origValue.trim();
      let token = "";
      
      // Réutiliser le même token/alias s'il a déjà été généré dans cette session
      const mappedToken = findMappedToken(sessionState, normalizedValue, pseudonymMode);
      
      if (mappedToken) {
        token = mappedToken;
      } else {
        // Générer un nouveau compteur pour ce type si manquant
        if (!sessionState.counters[type]) {
          sessionState.counters[type] = 0;
        }
        sessionState.counters[type]++;
        
        if (pseudonymMode === "aliases") {
          token = generateAlias(type, sessionState.counters[type], sessionState);
        } else {
          token = `[${type}_${sessionState.counters[type]}]`;
        }
        
        // Enregistrer la correspondance bidirectionnelle
        sessionState.mappings[normalizedValue] = token;
        sessionState.mappings[token] = origValue;
      }

      // Remplacer dans le texte
      resultText = resultText.substring(0, item.start) + token + resultText.substring(item.end);
    }

    return {
      pseudonymizedText: resultText,
      sessionState: sessionState
    };
  }

  // --- 8. BASE D'ALIAS FICTIFS FRANÇAIS ET GÉNÉRATEUR ---
  const ALIAS_PRENOMS = ["Alain", "Bernard", "Christian", "Daniel", "Etienne", "Francois", "Gerard", "Henri", "Jean", "Louis", "Marc", "Nicolas", "Olivier", "Pierre", "Rene", "Serge", "Thomas", "Vincent", "Yann", "Anne", "Brigitte", "Catherine", "Dominique", "Elisabeth", "Françoise", "Gisèle", "Hélène", "Isabelle", "Juliette", "Laurence", "Marie", "Nathalie", "Odile", "Patricia", "Renée", "Sylvie", "Thérèse", "Valérie", "Véronique"];
  const ALIAS_NOMS = ["Martin", "Bernard", "Thomas", "Petit", "Robert", "Richard", "Durand", "Dubois", "Moreau", "Laurent", "Simon", "Michel", "Leroy", "Roux", "David", "Bertrand", "Morel", "Fournier", "Girard", "Bonnet", "Dupont", "Lambert", "Fontaine", "Rousseau", "Vincent", "Muller", "Lefevre", "Faure", "Andre", "Mercier"];
  const ALIAS_VILLES = ["Strasbourg", "Bordeaux", "Nantes", "Lille", "Rennes", "Reims", "Saint-Étienne", "Le Havre", "Toulon", "Grenoble", "Dijon", "Angers", "Nîmes", "Villeurbanne"];

  function generateAlias(type, counter, sessionState) {
    if (!sessionState.generatedAliases) {
      sessionState.generatedAliases = [];
    }

    const index = counter - 1;
    let alias = "";

    switch (type) {
      case "PRENOM":
        alias = ALIAS_PRENOMS[index % ALIAS_PRENOMS.length];
        break;
      case "NOM":
        alias = ALIAS_NOMS[index % ALIAS_NOMS.length];
        break;
      case "NOM_PRENOM":
        const pIndex = index % ALIAS_PRENOMS.length;
        const nIndex = Math.floor(index / ALIAS_PRENOMS.length) % ALIAS_NOMS.length;
        alias = `${ALIAS_PRENOMS[pIndex]} ${ALIAS_NOMS[nIndex]}`;
        break;
      case "VILLE":
        alias = ALIAS_VILLES[index % ALIAS_VILLES.length];
        break;
      case "EMAIL":
        alias = `adresse-contact.${counter}@courriel-professionnel.fr`;
        break;
      case "TELEPHONE":
        alias = `06 99 00 00 ${String(counter).padStart(2, '0')}`;
        break;
      case "SECURE_SOCIALE":
        alias = `1 90 01 75 123 456 ${String(counter).padStart(2, '0')}`;
        break;
      case "IBAN":
        alias = `FR76 3000 6000 0112 3456 7890 1${String(counter).padStart(2, '0')}`;
        break;
      case "CARTE_BANCAIRE":
        alias = `4970 1000 2000 ${String(3000 + counter).padStart(4, '0')}`;
        break;
      case "CODE_POSTAL":
        alias = String(86000 + counter);
        break;
      case "FORCE":
      default:
        alias = `Projet-Fictif-${counter}`;
        break;
    }

    // Unicité absolue des alias pour éviter les faux raccourcis
    let uniqueAlias = alias;
    let suffix = 1;
    while (sessionState.generatedAliases.includes(uniqueAlias)) {
      uniqueAlias = `${alias} ${suffix}`;
      suffix++;
    }

    sessionState.generatedAliases.push(uniqueAlias);
    return uniqueAlias;
  }

  // Trouve un jeton ou un alias de remplacement existant de façon insensible à la casse
  function findMappedToken(sessionState, value, pseudonymMode) {
    const lowerVal = value.toLowerCase();
    const mappings = sessionState.mappings || {};
    const generatedAliases = sessionState.generatedAliases || [];

    for (const [key, token] of Object.entries(mappings)) {
      if (key.toLowerCase() === lowerVal) {
        if (pseudonymMode === "tokens" && token.startsWith("[") && token.endsWith("]")) {
          return token;
        }
        if (pseudonymMode === "aliases" && generatedAliases.includes(token)) {
          return token;
        }
      }
    }
    return null;
  }

  // --- 9. FONCTION DE RESTAURATION (De-pseudonymisation visuelle en HTML) ---
  function restorePseudonymsInHTML(html, mappings, generatedAliases = []) {
    if (!html || !mappings) return html;
    
    let restoredHTML = html;

    // Déterminer la liste des cibles à remplacer (les jetons [X_Y] et les alias générés)
    const targets = Object.keys(mappings).filter(key => {
      return (key.startsWith("[") && key.endsWith("]")) || generatedAliases.includes(key);
    });

    // Trier les cibles par longueur décroissante pour éviter le remplacement partiel
    targets.sort((a, b) => b.length - a.length);

    for (const target of targets) {
      const origValue = mappings[target];
      if (!origValue) continue;

      const escapedTarget = target.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(escapedTarget, 'g');

      const highlightSpan = `<span class="anonym-restored" data-token="${target}" title="Original : ${origValue.replace(/"/g, '&quot;')}" style="color: #2e7d32 !important; font-weight: bold !important; background-color: #e8f5e9 !important; padding: 2px 4px !important; border-radius: 4px !important; border: 1px solid #c8e6c9 !important; display: inline-block !important; font-family: inherit !important;">${escapeHTML(origValue)}</span>`;
      
      restoredHTML = restoredHTML.replace(regex, highlightSpan);
    }

    return restoredHTML;
  }

  function escapeHTML(str) {
    if (!str) return "";
    return str.replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&#039;");
  }

  // Exposer les méthodes dans globalThis
  globalThis.PIIEngine = {
    pseudonymizeText: pseudonymizeText,
    restorePseudonymsInHTML: restorePseudonymsInHTML,
    COMMON_PRENOMS: COMMON_PRENOMS,
    COMMON_VILLES: COMMON_VILLES,
    FRENCH_STOP_WORDS: FRENCH_STOP_WORDS,
    normalizeStr: normalizeStr
  };
})();
