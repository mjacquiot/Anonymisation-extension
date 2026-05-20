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
    "agathe", "solene", "lisa", "noemie", "margaux", "salome", "myriam", "fanny", "adele", "coline", "lola", "maelys", "leonie", "clemence", "lucile", "elisa", "celia", "renee", "odile"
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

  // Mots clés d'organisations en français (minuscules, sans accents)
  const ORG_KEYWORDS = new Set([
    "commune", "communes", "mairie", "mairies", "collectivite", "collectivites", "departement", "departements", "region", "regions",
    "prefecture", "prefectures", "ministere", "ministeres", "senat", "assemblee", "tribunal", "hopital", "hopitaux",
    "ecole", "ecoles", "college", "colleges", "lycee", "lycees", "universite", "universites", "faculte", "facultes",
    "cabinet", "cabinets", "societe", "societes", "entreprise", "entreprises", "compagnie", "compagnies",
    "association", "associations", "federation", "federations", "syndicat", "syndicats", "fondation", "fondations",
    "direction", "directions", "commission", "commissions", "comite", "comites", "office", "offices",
    "agence", "agences", "banque", "banques", "caisse", "caisses", "mutuelle", "mutuelles", "groupe", "groupes",
    "service", "services", "pole", "poles", "centre", "centres", "institut", "instituts", "communaute", "communautes",
    "marches", "velay", "rochebaron"
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

  // Mots exclus spécifiques (mois et jours) qui commencent par des majuscules mais ne sont pas des PII
  const EXCLUDED_WORDS = new Set([
    "janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout", "septembre", "octobre", "novembre", "decembre",
    "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"
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
    const beforeText = text.substring(0, index);
    // Traiter les tabulations, retours à la ligne et espaces multiples (>= 2) comme des débuts de phrase/bloc (très fréquent en PDF)
    if (/\s{2,}$|[\t\r\n]$/.test(beforeText)) {
      return true;
    }
    const trailingSpacesStripped = beforeText.replace(/[ \t]+$/, "");
    if (trailingSpacesStripped.length === 0) return true;
    const lastChar = trailingSpacesStripped.slice(-1);
    return [".", "!", "?", "\n", "\r", "]", ">"].includes(lastChar);
  }

  // Heuristique pour détecter les préfixes de contexte (ex: civilités, adresses)
  function checkContextPrefix(text, index) {
    const sub = text.substring(Math.max(0, index - 35), index)
                    .toLowerCase()
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "");
    
    // Si précédé par des formules de politesse, titres ou "chez" -> NOM de personne
    if (/\b(?:m\.|mme|monsieur|madame|dr|docteur|professeur|prof|nomme|nommee|nommees|appelle|appellee|chez|collegue|compagnon|ami|directeur|responsable)\b\s*$/i.test(sub)) {
      return "NOM_PRENOM";
    }
    // Si précédé par des indicateurs géographiques -> VILLE
    if (/\b(?:habite\s+a|vit\s+a|reside\s+a|situe\s+a|adresse\s+a|ville\s+de|aller\s+a|vers|depuis|en|dans|region\s+de|departement\s+de|pays\s+de|commune\s+de|territoire\s+de|metropole\s+de|canton\s+de|a)\b\s*$/i.test(sub)) {
      return "VILLE";
    }
    // Si précédé par des indicateurs d'organisations/entreprises -> ORGANISATION
    if (/\b(?:societe|entreprise|compagnie|siret|siren|association|ets|etablissement|cabinet|agence|ministere|direction|service|mairie|collectivite|communaute|pole|centre|groupe|syndicat|fondation|office|faculte|universite|ecole|college|lycee)\b\s*$/i.test(sub)) {
      return "ORGANISATION";
    }
    return null;
  }

  function isFollowedByCapitalized(text, endIndex) {
    const remaining = text.substring(endIndex);
    // Si l'intervalle restant commence par une tabulation, un retour à la ligne ou plusieurs espaces (>= 2), ce n'est pas la suite d'un nom
    if (/^(?:[\t\r\n]|\s{2,})/.test(remaining)) {
      return false;
    }
    const regex = /^(?:\s*[-\s]\s*|\s+(?:de|d'|du|des|en|sur|sous|le|la|les)\s+)[A-ZÀ-ÖØ-ß]/;
    return regex.test(remaining);
  }

  // Fonction principale de pseudonymisation
  function pseudonymizeText(text, sessionState, config = { forcedElements: [], excludedElements: [] }) {
    if (!text) return text;
    
    // Initialisation de l'état de session si manquant
    if (!sessionState) {
      sessionState = {
        mappings: {}, // stocke les deux sens: "Jean" -> "[PRENOM_1]" et "[PRENOM_1]" -> "Jean"
        counters: {},  // compteurs par catégorie
        fullAliases: [],
        generatedAliases: []
      };
    }
    if (!sessionState.mappings) sessionState.mappings = {};
    if (!sessionState.counters) sessionState.counters = {};
    if (!sessionState.fullAliases) sessionState.fullAliases = [];
    if (!sessionState.generatedAliases) sessionState.generatedAliases = [];

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

    // --- 1b. DÉTECTION DES JETONS EXISTANTS ET DU CONTEXTE POUR LES EXCLURE ---
    const tokenRegex = /\[[A-Z_]+_\d+\]/g;
    let tokenMatch;
    while ((tokenMatch = tokenRegex.exec(text)) !== null) {
      exclusionRanges.push({
        start: tokenMatch.index,
        end: tokenMatch.index + tokenMatch[0].length,
        value: tokenMatch[0],
        type: "EXCLUDE"
      });
    }

    const contextRegex = /\[Contexte Système\s*:[^\]]*\]/gi;
    let contextMatch;
    while ((contextMatch = contextRegex.exec(text)) !== null) {
      exclusionRanges.push({
        start: contextMatch.index,
        end: contextMatch.index + contextMatch[0].length,
        value: contextMatch[0],
        type: "EXCLUDE"
      });
    }

    // Exclure les en-têtes de documents (Début/Fin de document) pour éviter de pseudonymiser "Début" et "Fin"
    const docHeaderRegex = /^--- (?:Début|Fin) de document : .* ---$/gm;
    let docHeaderMatch;
    docHeaderRegex.lastIndex = 0;
    while ((docHeaderMatch = docHeaderRegex.exec(text)) !== null) {
      exclusionRanges.push({
        start: docHeaderMatch.index,
        end: docHeaderMatch.index + docHeaderMatch[0].length,
        value: docHeaderMatch[0],
        type: "EXCLUDE"
      });
    }

    // Écarter également tous les tokens et alias complets déjà générés dans la session (pour éviter de re-pseudonymiser un alias complet ou ses composants)
    const fullAliases = sessionState.fullAliases || [];
    for (const alias of fullAliases) {
      if (alias && alias.trim().length > 0) {
        const escaped = alias.replace(/[\\^$*+?.()|[\]{}]/g, '\\$&');
        // Utiliser des assertions Unicode pour les bordures de mot afin de supporter les accents
        const regex = new RegExp(`(?:^|[^\\p{L}\\p{N}])(${escaped})(?:$|[^\\p{L}\\p{N}])`, 'gui');
        let match;
        while ((match = regex.exec(text)) !== null) {
          const matchVal = match[1];
          const matchStart = match.index + match[0].indexOf(matchVal);
          exclusionRanges.push({
            start: matchStart,
            end: matchStart + matchVal.length,
            value: matchVal,
            type: "EXCLUDE"
          });
        }
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
    // Regex Unicode moderne pour détecter les mots commençant par une majuscule (y compris avec accents complexes)
    const capWordRegex = /(?:^|[^\p{L}'-])(\p{Lu}[\p{L}'-]*)/gu;
    let match;
    while ((match = capWordRegex.exec(text)) !== null) {
      const word = match[1];
      const index = match.index + match[0].indexOf(word);
      const normalizedWord = normalizeStr(word);

      // On passe si c'est un mot court (1 car.)
      if (word.length <= 1) continue;

      // Si le mot est dans la liste des exclusions globales, des stop words, ou des mois/jours exclus
      if (FRENCH_STOP_WORDS.has(normalizedWord) || EXCLUDED_WORDS.has(normalizedWord)) continue;

      // Si le mot est déjà un alias généré, ou un composant d'un alias généré dans la session (pour éviter de re-pseudonymiser un alias)
      if (sessionState && sessionState.fullAliases) {
        const isAliasOrComponent = sessionState.fullAliases.some(alias => {
          const normAlias = normalizeStr(alias);
          if (normAlias === normalizedWord) return true;
          const parts = normAlias.split(/\s+/);
          return parts.includes(normalizedWord);
        });
        if (isAliasOrComponent) continue;
      }

      const sentenceStart = isSentenceStart(text, index);
      const isKnownPrenom = COMMON_PRENOMS.has(normalizedWord);
      const isKnownVille = COMMON_VILLES.has(normalizedWord);
      const isKnownOrg = ORG_KEYWORDS.has(normalizedWord);
      const isAllUppercase = word === word.toUpperCase() && word.length >= 2;

      // Si on commence une phrase, on ne pseudonymise que si le mot fait partie de notre dictionnaire connu,
      // s'il s'agit d'un acronyme 100% majuscule, ou s'il est immédiatement suivi par un autre mot capitalisé
      if (sentenceStart) {
        const followedByCap = isFollowedByCapitalized(text, index + word.length);
        if (isAllUppercase) {
          candidates.push({ start: index, end: index + word.length, value: word, type: "ORGANISATION" });
        } else if (isKnownPrenom) {
          candidates.push({ start: index, end: index + word.length, value: word, type: "PRENOM" });
        } else if (isKnownVille) {
          candidates.push({ start: index, end: index + word.length, value: word, type: "VILLE" });
        } else if (isKnownOrg) {
          candidates.push({ start: index, end: index + word.length, value: word, type: "ORGANISATION" });
        } else if (followedByCap) {
          candidates.push({ start: index, end: index + word.length, value: word, type: "NOM_PRENOM" });
        }
        continue;
      }

      // En milieu de phrase, un mot capitalisé non-stop-word a de fortes chances d'être un PII
      let type = "NOM_PRENOM"; // Par défaut
      
      // Heuristiques de contexte
      const contextType = checkContextPrefix(text, index);
      if (contextType) {
        type = contextType;
      } else if (isKnownOrg) {
        type = "ORGANISATION";
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

    // --- 5. FUSION DES NOMS COMPOSÉS ET ADJACENTS ---
    const nameTypes = ["PRENOM", "NOM_PRENOM", "NOM", "ORGANISATION"];
    let wordCandidates = candidates.filter(c => nameTypes.includes(c.type)).sort((a, b) => a.start - b.start);
    
    let i = 0;
    while (i < wordCandidates.length - 1) {
      const curr = wordCandidates[i];
      const next = wordCandidates[i + 1];
      const gap = text.substring(curr.end, next.start);
      const isAllowedGap = (
        gap === " " || gap === "-" || gap === " - " ||
        /^(?:\s+(?:de|du|des|en|sur|sous|le|la|les)\s+|\s+d')$/i.test(gap)
      );
      if (isAllowedGap) {
        curr.end = next.end;
        curr.value = text.substring(curr.start, curr.end);
        const words = curr.value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/\W+/);
        const hasOrgKeyword = words.some(w => ORG_KEYWORDS.has(w));
        curr.type = (curr.type === "ORGANISATION" || next.type === "ORGANISATION" || hasOrgKeyword) ? "ORGANISATION" : "NOM_PRENOM";
        const indexInCandidates = candidates.indexOf(next);
        if (indexInCandidates !== -1) candidates.splice(indexInCandidates, 1);
        wordCandidates.splice(i + 1, 1);
      } else {
        i++;
      }
    }

    // --- 6. RÉSOLUTION DES OVERLAPS ---
    let filteredCandidates = candidates.filter(candidate => {
      if (candidate.type === "EXCLUDE") return false;
      const overlapsExclusion = exclusionRanges.some(excl => 
        (candidate.start >= excl.start && candidate.start < excl.end) ||
        (candidate.end > excl.start && candidate.end <= excl.end)
      );
      return !overlapsExclusion;
    });

    filteredCandidates.sort((a, b) => (b.end - b.start) - (a.end - a.start));
    const finalCandidates = [];
    for (const candidate of filteredCandidates) {
      const overlaps = finalCandidates.some(selected => 
        (candidate.start >= selected.start && candidate.start < selected.end) ||
        (candidate.end > selected.start && candidate.end <= selected.end)
      );
      if (!overlaps) finalCandidates.push(candidate);
    }
    finalCandidates.sort((a, b) => a.start - b.start);

    // --- 7. APPLIQUER LA PSEUDONYMISATION ---
    const pseudonymMode = (config && config.pseudonymMode) || "tokens";

    let resultText = text;
    for (let idx = finalCandidates.length - 1; idx >= 0; idx--) {
      const item = finalCandidates[idx];
      const origValue = item.value;
      const type = item.type;
      const normalizedValue = origValue.trim();
      let token = "";
      
      const mappedToken = findMappedToken(sessionState, normalizedValue, pseudonymMode);
      
      if (mappedToken) {
        token = mappedToken;
      } else {
        if (!sessionState.counters[type]) sessionState.counters[type] = 0;
        sessionState.counters[type]++;
        
        if (pseudonymMode === "aliases") {
          token = generateAlias(type, sessionState.counters[type], sessionState);
        } else {
          token = `[${type}_${sessionState.counters[type]}]`;
        }
        
        sessionState.mappings[normalizedValue] = token;
        sessionState.mappings[token] = origValue;
        
        // Enregistrer dans les alias complets de la session pour l'exclusion de re-pseudonymisation
        if (!sessionState.fullAliases.includes(token)) {
          sessionState.fullAliases.push(token);
        }

        if (pseudonymMode === "aliases" && type === "NOM_PRENOM") {
          const origParts = normalizedValue.split(/\s+/);
          const tokenParts = token.split(/\s+/);
          if (origParts.length === tokenParts.length) {
            for (let p = 0; p < origParts.length; p++) {
              const oPart = origParts[p];
              const tPart = tokenParts[p];
              if (oPart.length > 1 && tPart.length > 1) {
                const oPartNorm = oPart.trim();
                const tPartNorm = tPart.trim();
                if (!sessionState.mappings[oPartNorm]) {
                  sessionState.mappings[oPartNorm] = tPartNorm;
                }
                if (!sessionState.mappings[tPartNorm]) {
                  sessionState.mappings[tPartNorm] = oPartNorm;
                }
                if (!sessionState.generatedAliases.includes(tPartNorm)) {
                  sessionState.generatedAliases.push(tPartNorm);
                }
              }
            }
          }
        }
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
  const ALIAS_ORGANISATIONS = ["Collectivite Fictive", "Mairie Fictive", "Communaute de Communes Fictive", "Administration Fictive", "Association Fictive", "Etablissement Fictif", "Societe Fictive", "Cabinet Fictif", "Agence Fictive", "Etablissement Public Fictif"];

  function generateAlias(type, counter, sessionState) {
    if (!sessionState.generatedAliases) {
      sessionState.generatedAliases = [];
    }

    const index = counter - 1;
    let alias = "";

    switch (type) {
      case "ORGANISATION":
        alias = `${ALIAS_ORGANISATIONS[index % ALIAS_ORGANISATIONS.length]} ${counter}`;
        break;
      case "PRENOM":
        alias = ALIAS_PRENOMS[index % ALIAS_PRENOMS.length];
        break;
      case "NOM":
        alias = ALIAS_NOMS[index % ALIAS_NOMS.length];
        break;
      case "NOM_PRENOM":
        const pIndex = index % ALIAS_PRENOMS.length;
        const nIndex = (index + 7) % ALIAS_NOMS.length;
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
