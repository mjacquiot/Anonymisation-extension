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
    "agathe", "solene", "lisa", "noemie", "margaux", "salome", "myriam", "fanny", "adele", "coline", "lola", "maelys", "leonie", "clemence", "lucile", "elisa", "celia", "renee", "odile",
    "thibault", "thibaut", "gaston", "lucien", "maurice", "albert", "eugene", "etienne", "regis", "xavier", "jonathan", "anthony", "maxence", "dorian", "killian", "kylian", "mateo", "matheo", "sohan", "tiago", "lisandro", "diego", "milo", "timothe", "louison", "auguste", "charles", "edouard", "victor", "mathurin", "gabin", "leandre", "marius", "tristan", "claire", "elsa", "amanda", "melissa", "sabine", "nadine", "marcelline", "victoire", "valentine", "apolline", "constance", "hortense", "eugenie", "eleonore", "gabrielle", "marthe", "clotilde", "berthe", "beatrice", "pascale", "lina", "mia", "mila", "chana", "hanna", "leila", "amina", "fatima", "yasmine", "kenza", "nour", "linda", "nadia", "sonia", "samira", "karima", "rachida", "fadila", "malika", "driss", "mohamed", "mehdi", "yassine", "sofiane", "khalid", "mustapha", "ali", "ahmed", "omar", "karim", "hassan", "said", "youssef", "brahim", "rachid", "mourad", "tarek", "farid", "slimane", "salim"
  ]);

  // Liste des villes françaises courantes, régions et départements (accents facultatifs)
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
    "bastia", "versailles", "vincennes", "montreuil", "pantin", "clichy", "meudon", "puteaux", "suresnes",
    "ile-de-france", "normandie", "bretagne", "corse", "martinique", "guadeloupe", "guyane", "reunion", "mayotte", "alsace", "lorraine", "champagne", "ardennes", "picardie", "nord-pas-de-calais", "pays-de-la-loire", "centre-val-de-loire", "bourgogne-franche-comte", "nouvelle-aquitaine", "auvergne-rhone-alpes", "occitanie", "provence-alpes-cote-d-azur", "aquitaine", "limousin", "poitou-charentes", "midi-pyrenees", "languedoc-roussillon",
    "arles", "beauvais", "brive-la-gaillarde", "cannes", "carcassonne", "chalon-sur-saone", "chalons-en-champagne", "charleville-mezieres", "chateauroux", "cherbourg", "cholet", "dieppe", "evry", "foix", "fort-de-france", "frejus", "gap", "hyeres", "issy-les-moulineaux", "la roche-sur-yon", "le mans", "le puy-en-velay", "les sables-d-olonne", "lourdes", "macon", "mamoudzou", "martigues", "meaux", "melun", "mont-de-marsan", "montauban", "montbeliard", "montlucon", "narbonne", "noisy-le-grand", "noumea", "quimper", "rochefort", "rodez", "saint-brieuc", "saint-dizier", "saint-herblain", "saint-laurent-du-maroni", "saint-lo", "saint-omer", "saint-ouen", "saint-tropez", "salon-de-provence", "saumur", "sedan", "sens", "sevrans", "vannes", "vierzon"
  ]);

  // Liste des noms de famille français courants (accents facultatifs)
  const COMMON_NOMS = new Set([
    "martin", "bernard", "thomas", "petit", "robert", "richard", "durand", "dubois", "moreau", "laurent", "simon", "michel", "leroy", "roux", "david", "bertrand", "morel", "fournier", "girard", "bonnet", "dupont", "lambert", "fontaine", "rousseau", "vincent", "muller", "lefevre", "faure", "andre", "mercier", "blanc", "guerin", "boyer", "chevalier", "denis", "antoine", "mathieu", "nicolas", "masson", "schmitt", "morin", "roussel", "gautier", "meyer", "lemaire", "picard", "dumont", "colin", "ortiz", "lopez", "garcia", "martinez", "rodriguez", "fernandez", "perez", "vasseur", "joly", "gauthier", "lucas", "brun", "dumas", "brunet", "renard", "guillaume", "caron", "dufour", "aubert", "marcel", "henri", "daniel", "dubreuil", "prevost", "royer",
    "gaillard", "lemoine", "millet", "gerard", "renault", "clement", "gros", "dupuy", "marchand", "arnaud", "duval", "aubry", "barbier", "lopes", "goncalves", "silva", "ferreira", "oliveira", "martins", "rocha", "costa", "santos", "gomes", "souza", "alves", "pinto", "carvalho", "ribeiro", "teixeira", "mendes", "lima", "silvestre", "renaud", "julien", "benoit", "monnier", "leclerc", "leclercq", "gimenez", "poulain", "collet", "legrand", "allard", "pasquier", "vallet", "maillard", "rousset", "moulin", "perrot", "jacquet", "guillot", "bourgeois", "riviere", "gonzalez", "ruiz", "sanchez", "diaz", "alvarez", "munoz", "romero", "gomez"
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
  // Enrichi avec les termes professionnels et techniques (français/anglais) très courants
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
    "donc", "aussi", "peut-etre", "toujours", "jamais", "souvent", "parfois", "quelquefois", "rarement",
    
    // Termes professionnels & business (sans accents, minuscules)
    "client", "projet", "projets", "clients", "application", "applications", "serveur", "serveurs", "base", "bases", "donnee", "donnees", "services", "rapport", "rapports", "devis", "facture", "factures", "contrat", "contrats", "planning", "plannings", "budget", "budgets", "reunion", "reunions", "equipe", "equipes", "manager", "managers", "collaborateur", "collaborateurs", "directeurs", "president", "partenaire", "partenaires", "fournisseur", "fournisseurs", "prestataire", "prestataires", "candidat", "candidats", "employeur", "employeurs", "salarie", "salaries", "action", "actions", "tache", "taches", "description", "details", "commentaire", "commentaires", "statut", "statuts", "etape", "etapes", "phase", "phases", "lot", "lots", "livrable", "livrables", "synthese", "introduction", "conclusion", "annexe", "annexes", "source", "sources", "cible", "cibles", "fichier", "fichiers", "dossier", "dossiers", "document", "documents", "version", "versions", "auteur", "auteurs", "createur", "modifie", "date", "dates", "heure", "heures", "type", "types", "format", "formats", "taille", "tailles", "valeur", "valeurs", "cle", "cles", "champ", "champs", "table", "tables", "index", "recherche", "recherches", "filtre", "filtres", "tri", "calcul", "calculs", "total", "totals", "somme", "sommes", "moyenne", "taux", "montant", "montants", "prix", "cout", "couts", "remise", "remises", "reduction", "reductions", "taxe", "taxes", "impot", "impots", "banque", "banques", "compte", "comptes", "paiement", "paiements", "transaction", "transactions", "historique", "log", "logs", "erreur", "erreurs", "warning", "warnings", "info", "infos", "debug", "trace", "traces", "test", "tests", "recette", "production", "preprod", "staging", "dev", "developement", "environnement", "environnements", "systeme", "systemes", "reseau", "reseaux", "securite", "security", "audit", "audits", "conformite", "compliance", "risque", "risques", "impact", "impacts", "solution", "solutions", "besoin", "besoins", "exigence", "exigences", "fonctionnalite", "fonctionnalites", "interface", "interfaces", "module", "modules", "composant", "composants", "architecture", "architectures", "design", "designs", "code", "codes", "bug", "bugs", "ticket", "tickets", "titre", "titres", "sujet", "sujets", "objet", "objets", "message", "messages", "mail", "mails", "email", "emails", "adresse", "adresses", "telephone", "telephones", "contact", "contacts", "profil", "profils", "utilisateur", "utilisateurs", "admin", "admins", "administrateur", "administrateurs", "role", "roles", "permission", "permissions", "droit", "droits", "groupe", "groupes", "organisation", "organisations", "structure", "structures", "division", "divisions", "direction", "directions", "pole", "poles", "axe", "axes", "theme", "themes", "secteur", "secteurs", "domaine", "domaines", "activite", "activites", "processus", "process", "flux", "workflow", "workflows", "tendance", "tendances", "objectif", "objectifs", "strategie", "strategies", "vision", "mission", "missions", "valeur", "culture", "charte", "regle", "regles", "cahier", "cahiers",
    
    // Termes techniques / Tech
    "react", "angular", "vue", "java", "python", "javascript", "html", "css", "sql", "docker", "kubernetes", "aws", "azure", "cloud", "git", "github", "gitlab", "jira", "slack", "teams", "excel", "word", "powerpoint", "outlook", "windows", "linux", "macos", "android", "ios", "chrome", "firefox", "safari", "api", "database", "server", "frontend", "backend", "fullstack", "agile", "scrum", "sprint", "france", "europe", "francais", "anglais", "langue", "pays", "etat", "etats", "ville", "villes", "rue", "avenue", "boulevard", "route", "chacune", "chacun", "quelque", "quelques", "plusieurs", "semaine", "semaines", "mois", "annee", "annees", "jour", "jours",
    
    // Acronymes et sigles
    "rgpd", "tva", "faq", "crm", "erp", "rse", "rhs", "sncf", "edf", "ratp", "cdd", "cdi", "sarl", "sas", "sa", "eurl", "sci", "scpi", "sms", "vga", "hdmi", "usb", "cpu", "gpu", "ram", "rom", "ssd", "hdd", "ip", "dns", "vpn", "wan", "lan", "wifi", "ssid", "http", "https", "ftp", "ssh", "ssl", "tls", "sdk", "ide"
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
    SECURE_SOCIALE: /[12]\s*\d{2}\s*(?:0[1-9]|1[0-2]|20)\s*(?:\d{2}|2[AB])\s*\d{3}\s*\d{3}\s*\d{2}/g,
    // IBAN standard (FR + 2 chiffres + 23 caractères alphanumériques séparés ou non par des espaces)
    IBAN: /FR\d{2}(?:\s*\d{4}){5}\s*\d{3}/gi,
    // Carte Bancaire (16 chiffres, séparés par espaces ou tirets ou collés)
    CARTE_BANCAIRE: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
    // Code postal à 5 chiffres
    CODE_POSTAL: /\b\d{5}\b/g,
    
    // NOUVEAUX PATTERNS
    ADRESSE: /(?:\b\d+(?:[\s-]*(?:bis|ter|quater|a|b))?\s+)?\b(?:rue|avenue|boulevard|allee|place|route|chemin|faubourg|impasse|cours|quai|square|voie|passage|villa|residence|clos|domaine|grand\s+rue)\b(?:\s+(?:de|la|les|du|d'|l'|des|au|aux|sur|sous)?(?:\s+[\p{L}\p{N}'-]+){1,4})/gui,
    PLAQUE_IMMATRICULATION: /\b[A-Za-z]{2}[-\s]?\d{3}[-\s]?[A-Za-z]{2}\b|\b\d{1,4}\s+[A-Za-z]{1,3}\s+\d{2,3}\b/g,
    IDENTIFIANT_FISCAL: /\b[0-3](?:\s*\d){12}\b/g,
    MOT_DE_PASSE: /\b(?:mot\s*de\s*passe|mdp|password|pwd|pass)\s*[:=]\s*[^\s;,\n]{4,30}\b/gi,
    CLE_API: /\b(?:sk_live_[0-9a-zA-Z]{24}|sk_test_[0-9a-zA-Z]{24}|AIzaSy[0-9A-Za-z-_]{33}|gh[oprs]_[0-9a-zA-Z]{36}|AKIA[0-9A-Z]{16})\b|\b(?:api[_-]?key|token|secret)\s*[:=]\s*["']?[0-9a-zA-Z-_]{16,64}["']?/gi
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
    return [".", "!", "?", "\n", "\r", "]", ">", ":", ";", "-", "*", "•", "–", "—", "(", "\"", "«", "”", "’"].includes(lastChar);
  }

  // Heuristique pour détecter les préfixes de contexte (ex: civilités, adresses)
  function checkContextPrefix(text, index) {
    const sub = text.substring(Math.max(0, index - 45), index)
                    .toLowerCase()
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "");
    
    // Si précédé par des formules de politesse, titres ou "chez" -> NOM de personne
    if (/\b(?:m\.|mme|monsieur|madame|dr|docteur|professeur|prof|nomme|nommee|nommees|appelle|appellee|chez|collegue|compagnon|ami|directeur|responsable)\b\s*(?:[a-zA-ZÀ-ÖØ-öø-ÿ'-]+\s+){0,1}$/i.test(sub)) {
      return "NOM_PRENOM";
    }
    // Si précédé par des indicateurs géographiques de rue/voie -> ADRESSE
    if (/\b(?:rue|avenue|boulevard|allee|place|route|chemin|faubourg|impasse|cours|quai|square|voie|passage|villa|residence|clos|domaine|grand\s+rue)\b\s*(?:[a-zA-ZÀ-ÖØ-öø-ÿ'-]+\s+){0,2}(?:de|la|les|du|d'|l'|des|au|aux|sur|sous)?\s*$/i.test(sub)) {
      return "ADRESSE";
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
    const regex = /^(?:\s*[-\s]\s*|\s+(?:de|d'|du|des|en|sur|sous|le|la|les)\s+)(\p{Lu}[\p{L}'-]*)/u;
    const match = remaining.match(regex);
    if (match) {
      const nextWord = match[1];
      const nextWordNorm = normalizeStr(nextWord);
      if (FRENCH_STOP_WORDS.has(nextWordNorm) || EXCLUDED_WORDS.has(nextWordNorm)) {
        return false;
      }
      return true;
    }
    return false;
  }

  function isPrecededByCapitalized(text, index) {
    if (index === 0) return false;
    const beforeText = text.substring(0, index);
    if (/[\t\r\n]|\s{2,}$/.test(beforeText)) {
      return false;
    }
    // Rechercher le mot capitalisé précédent avec les liaisons possibles
    const regex = /(\p{Lu}[\p{L}'-]*)(?:\s+|[-\s]\s*|\s+(?:de|d'|du|des|en|sur|sous|le|la|les)\s+)$/u;
    const match = beforeText.match(regex);
    if (match) {
      const prevWord = match[1];
      const prevWordNorm = normalizeStr(prevWord);
      if (FRENCH_STOP_WORDS.has(prevWordNorm) || EXCLUDED_WORDS.has(prevWordNorm)) {
        return false;
      }
      return true;
    }
    return false;
  }

  // Filtrage robuste pour différencier les codes postaux français (5 chiffres) des nombres ordinaires
  function isLikelyPostalCode(match, text) {
    const val = match[0];
    const index = match.index;
    
    // Écarter les nombres ronds typiques (ex: 10000, 20000, 50000) sauf s'ils sont suivis d'une ville
    const isRoundNumber = /^[1-9]0000$/.test(val);
    
    const afterText = text.substring(index + val.length, index + val.length + 50);
    const beforeText = text.substring(Math.max(0, index - 50), index);
    
    // Détecter si une ville connue suit
    const nextWordMatch = afterText.match(/^\s+([a-zA-ZÀ-ÖØ-öø-ÿ-]+)/);
    let followedByCity = false;
    if (nextWordMatch) {
      const nextWordNorm = normalizeStr(nextWordMatch[1]);
      if (COMMON_VILLES.has(nextWordNorm)) {
        followedByCity = true;
      }
    }
    
    if (isRoundNumber && !followedByCity) {
      return false;
    }
    
    // Écarter s'il s'agit de montants ou d'unités de mesure après le nombre
    if (/^\s*(?:€|\$|£|%|euros?|dollars?|unites?|habitants?|m(?:etres?)?[²2]?|km|kg|g|ans|pages?|dossiers?|fichiers?|clients?|utilisateurs?|bugs?|tickets?)\b/i.test(afterText)) {
      return false;
    }
    
    // Écarter s'il s'agit de métriques/id avant le nombre
    if (/\b(?:budget|montant|prix|total|somme|ca|chiffre\s+d'affaires|quantite|nombre\s+de|id|identifiant|compteur|mesure)\s*(?:de|d')?\s*$/i.test(beforeText)) {
      return false;
    }
    
    return true;
  }

  // Fonction principale de pseudonymisation
  function pseudonymizeText(text, sessionState, config = {}) {
    if (!config) config = {};
    if (!text) return { pseudonymizedText: "", sessionState: sessionState || {}, stats: [] };
    
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

    // Normalisation et préparation des dictionnaires personnalisés
    const customNames = new Set((config.customDictionaries?.names || []).map(n => normalizeStr(n)));
    const customLocations = new Set((config.customDictionaries?.locations || []).map(l => normalizeStr(l)));
    const customOrgs = new Set((config.customDictionaries?.orgs || []).map(o => normalizeStr(o)));

    const candidates = [];

    // --- 1. EXCLUSIONS ---
    // Repérer toutes les occurrences des éléments exclus configurés par l'utilisateur
    const exclusions = (config.excludedElements || []).filter(el => el && el.trim().length > 0);
    const exclusionRanges = [];
    for (const excl of exclusions) {
      const escaped = excl.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const flexible = escaped.replace(/[\s\-–—]+/g, '[\\s\\-–—]+');
      // Utiliser des assertions Unicode pour les bordures de mots
      const regex = new RegExp(`(?:^|[^\\p{L}\\p{N}])(${flexible})(?=$|[^\\p{L}\\p{N}])`, 'gui');
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
    const rawForced = (config.forcedElements || []).filter(el => {
      if (typeof el === 'string') return el.trim().length > 0;
      return el && el.value && el.value.trim().length > 0;
    });

    const forced = [];
    for (const forceObj of rawForced) {
      const forceVal = typeof forceObj === 'string' ? forceObj : forceObj.value;
      const forceType = (typeof forceObj === 'string' || !forceObj.type) ? "FORCE" : forceObj.type;

      forced.push({ value: forceVal, type: forceType, wordBoundary: false });

      // Si c'est un Nom Complet (NOM_PRENOM), on propage la pseudonymisation à ses parties constitutives
      if (forceType === "NOM_PRENOM") {
        const parts = forceVal.trim().split(/\s+/);
        if (parts.length > 1) {
          for (let p = 0; p < parts.length; p++) {
            const part = parts[p].trim();
            if (part.length > 1) {
              const isLast = (p === parts.length - 1);
              const partType = isLast ? "NOM" : "PRENOM";
              forced.push({ value: part, type: partType, wordBoundary: false });
            }
          }
        }
      }
    }

    // Ajouter les dictionnaires personnalisés aux éléments forcés pour garantir la détection
    // case-insensitive avec mot-frontières (word boundaries) et fusion avec mots capitalisés adjacents
    const customNamesList = config.customDictionaries?.names || [];
    for (const name of customNamesList) {
      if (name && name.trim().length > 0) {
        forced.push({ value: name.trim(), type: "NOM", wordBoundary: true });
      }
    }

    const customLocationsList = config.customDictionaries?.locations || [];
    for (const loc of customLocationsList) {
      if (loc && loc.trim().length > 0) {
        forced.push({ value: loc.trim(), type: "VILLE", wordBoundary: true });
      }
    }

    const customOrgsList = config.customDictionaries?.orgs || [];
    for (const org of customOrgsList) {
      if (org && org.trim().length > 0) {
        forced.push({ value: org.trim(), type: "ORGANISATION", wordBoundary: true });
      }
    }

    for (const forceObj of forced) {
      const forceVal = forceObj.value;
      const forceType = forceObj.type;
      const wordBoundary = forceObj.wordBoundary;
      
      const escaped = forceVal.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const flexible = escaped.replace(/[\s\-–—]+/g, '[\\s\\-–—]+');
      let regex;
      if (wordBoundary) {
        // Lookahead pour le suffixe pour éviter de consommer les espaces et rater des occurrences adjacentes
        regex = new RegExp(`(?:^|[^\\p{L}\\p{N}])(${flexible})(?=$|[^\\p{L}\\p{N}])`, 'gui');
      } else {
        regex = new RegExp(`(${flexible})`, 'gi');
      }

      let match;
      while ((match = regex.exec(text)) !== null) {
        const matchVal = match[1];
        const start = match.index + match[0].indexOf(matchVal);
        const end = start + matchVal.length;
        const val = matchVal;
        
        let type = forceType;

        // Si c'est un type susceptible d'être un nom propre (FORCE, NOM, PRENOM, NOM_PRENOM)
        // et qu'il y a un mot adjacent commençant par une majuscule (hors stop words),
        // on l'agrège pour former un nom complet NOM_PRENOM
        if (type === "FORCE" || type === "NOM" || type === "PRENOM" || type === "NOM_PRENOM") {
          let merged = true;
          const originalStart = start;
          const originalEnd = end;

          while (merged) {
            merged = false;
            const textBefore = text.substring(0, start);
            const textAfter = text.substring(end);
            
            const beforeRegex = /(\p{Lu}[\p{L}'-]*\s*[-]?\s*)$/u;
            const afterRegex = /^(\s*[-]?\s*\p{Lu}[\p{L}'-]*)/u;
            
            const beforeMatch = textBefore.match(beforeRegex);
            const afterMatch = textAfter.match(afterRegex);
            
            if (beforeMatch && beforeMatch[1]) {
              const word = beforeMatch[1].trim().replace(/[-']/g, '');
              const normalized = normalizeStr(word);
              if (word.length > 1 && !FRENCH_STOP_WORDS.has(normalized) && !EXCLUDED_WORDS.has(normalized)) {
                start -= beforeMatch[1].length;
                merged = true;
              }
            }
            if (afterMatch && afterMatch[1]) {
              const word = afterMatch[1].trim().replace(/[-']/g, '');
              const normalized = normalizeStr(word);
              if (word.length > 1 && !FRENCH_STOP_WORDS.has(normalized) && !EXCLUDED_WORDS.has(normalized)) {
                end += afterMatch[1].length;
                merged = true;
              }
            }
          }
          
          if (start < originalStart || end > originalEnd) {
            val = text.substring(start, end);
            type = "NOM_PRENOM";
          }
        }

        candidates.push({
          start: start,
          end: end,
          value: val,
          type: type,
          isForced: true
        });
      }
    }

    // --- 3. PATTERNS STRUCTURÉS ---
    for (const [type, regex] of Object.entries(PATTERNS)) {
      let match;
      regex.lastIndex = 0;
      while ((match = regex.exec(text)) !== null) {
        if (type === "CODE_POSTAL") {
          if (!isLikelyPostalCode(match, text)) {
            continue;
          }
        }
        candidates.push({
          start: match.index,
          end: match.index + match[0].length,
          value: match[0],
          type: type
        });
      }
    }

    // --- 3b. PATTERNS STRUCTURÉS PERSONNALISÉS (Regex de l'utilisateur) ---
    const customPatterns = config.customPatterns || [];
    for (const cp of customPatterns) {
      if (!cp.pattern || !cp.replacementType) continue;
      try {
        let regex;
        const flags = cp.caseInsensitive ? 'gi' : 'g';
        if (cp.pattern.startsWith('/') && cp.pattern.lastIndexOf('/') > 0) {
          const lastSlash = cp.pattern.lastIndexOf('/');
          const pat = cp.pattern.slice(1, lastSlash);
          const fl = cp.pattern.slice(lastSlash + 1);
          const finalFlags = fl.includes('g') ? fl : fl + 'g';
          regex = new RegExp(pat, finalFlags);
        } else {
          regex = new RegExp(cp.pattern, flags);
        }
        
        let match;
        regex.lastIndex = 0;
        while ((match = regex.exec(text)) !== null) {
          if (match[0].length === 0) {
            regex.lastIndex++;
            continue;
          }
          candidates.push({
            start: match.index,
            end: match.index + match[0].length,
            value: match[0],
            type: cp.replacementType,
            isForced: true
          });
        }
      } catch (e) {
        console.error("Error executing custom regex pattern:", cp.name, e);
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
      const isKnownNom = COMMON_NOMS.has(normalizedWord) || customNames.has(normalizedWord);
      const isKnownVille = COMMON_VILLES.has(normalizedWord) || customLocations.has(normalizedWord);
      const isKnownOrg = ORG_KEYWORDS.has(normalizedWord) || customOrgs.has(normalizedWord);
      const isAllUppercase = word === word.toUpperCase() && word.length >= 2;

      // Si on commence une phrase, on ne pseudonymise que si le mot fait partie de notre dictionnaire connu (prénom, nom, ville, org),
      // s'il s'agit d'un acronyme tout en majuscules, ou s'il est immédiatement suivi par un autre mot capitalisé
      if (sentenceStart) {
        const followedByCap = isFollowedByCapitalized(text, index + word.length);
        if (isKnownPrenom) {
          candidates.push({ start: index, end: index + word.length, value: word, type: "PRENOM" });
        } else if (isKnownNom) {
          candidates.push({ start: index, end: index + word.length, value: word, type: "NOM" });
        } else if (isKnownVille) {
          candidates.push({ start: index, end: index + word.length, value: word, type: "VILLE" });
        } else if (isKnownOrg) {
          candidates.push({ start: index, end: index + word.length, value: word, type: "ORGANISATION" });
        } else if (isAllUppercase) {
          candidates.push({ start: index, end: index + word.length, value: word, type: "ORGANISATION" });
        } else if (followedByCap) {
          candidates.push({ start: index, end: index + word.length, value: word, type: "NOM_PRENOM" });
        }
        continue;
      }

      // En milieu de phrase, on ne pseudonymise un mot capitalisé non-stop-word que si :
      // 1. Il a un préfixe de contexte (ex: civilité, "chez", etc.)
      // 2. C'est un prénom, nom, ville ou mot-clé d'organisation connu
      // 3. Il fait partie d'une séquence de mots capitalisés (précédé ou suivi par un autre mot capitalisé)
      // 4. C'est un acronyme tout en majuscules (longueur >= 2)
      const contextType = checkContextPrefix(text, index);
      const followedByCap = isFollowedByCapitalized(text, index + word.length);
      const precededByCap = isPrecededByCapitalized(text, index);
      
      let shouldAnonymize = false;
      let type = "NOM_PRENOM"; // Par défaut

      if (contextType) {
        shouldAnonymize = true;
        type = contextType;
      } else if (isKnownOrg) {
        shouldAnonymize = true;
        type = "ORGANISATION";
      } else if (isKnownPrenom) {
        shouldAnonymize = true;
        type = "PRENOM";
      } else if (isKnownNom) {
        shouldAnonymize = true;
        type = "NOM";
      } else if (isKnownVille) {
        shouldAnonymize = true;
        type = "VILLE";
      } else if (followedByCap || precededByCap) {
        shouldAnonymize = true;
        type = "NOM_PRENOM";
      } else if (isAllUppercase) {
        shouldAnonymize = true;
        type = "ORGANISATION";
      }

      if (shouldAnonymize) {
        candidates.push({
          start: index,
          end: index + word.length,
          value: word,
          type: type
        });
      }
    }

    // --- 4b. FILTRAGE PAR PROFIL DE PSEUDONYMISATION ---
    const profile = config.pseudonymProfile || "standard";
    let allowedTypes = null;
    if (profile === "light") {
      allowedTypes = ["PRENOM", "NOM", "NOM_PRENOM", "EMAIL", "FORCE"];
    } else if (profile === "standard") {
      allowedTypes = ["PRENOM", "NOM", "NOM_PRENOM", "EMAIL", "FORCE", "VILLE", "ORGANISATION", "TELEPHONE", "ADRESSE"];
    }
    
    let filteredProfileCandidates = candidates;
    if (allowedTypes) {
      filteredProfileCandidates = candidates.filter(c => allowedTypes.includes(c.type));
    }

    // --- 5. FUSION DES NOMS COMPOSÉS ET ADJACENTS ---
    const nameTypes = ["PRENOM", "NOM_PRENOM", "NOM", "ORGANISATION"];
    let wordCandidates = filteredProfileCandidates.filter(c => nameTypes.includes(c.type)).sort((a, b) => a.start - b.start);
    
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
        const hasOrgKeyword = words.some(w => ORG_KEYWORDS.has(w) || customOrgs.has(w));
        curr.type = (curr.type === "ORGANISATION" || next.type === "ORGANISATION" || hasOrgKeyword) ? "ORGANISATION" : "NOM_PRENOM";
        const indexInCandidates = filteredProfileCandidates.indexOf(next);
        if (indexInCandidates !== -1) filteredProfileCandidates.splice(indexInCandidates, 1);
        wordCandidates.splice(i + 1, 1);
      } else {
        i++;
      }
    }

    // --- 6. RÉSOLUTION DES OVERLAPS ---
    let filteredCandidates = filteredProfileCandidates.filter(candidate => {
      if (candidate.type === "EXCLUDE") return false;
      const overlapsExclusion = exclusionRanges.some(excl => 
        candidate.start < excl.end && candidate.end > excl.start
      );
      return !overlapsExclusion;
    });

    // Trier pour traiter d'abord les éléments forcés manuellement, puis par longueur décroissante
    filteredCandidates.sort((a, b) => {
      const aForced = a.isForced ? 1 : 0;
      const bForced = b.isForced ? 1 : 0;
      if (aForced !== bForced) {
        return bForced - aForced; // Éléments forcés d'abord
      }
      return (b.end - b.start) - (a.end - a.start); // Puis plus longs d'abord
    });

    const finalCandidates = [];
    for (const candidate of filteredCandidates) {
      const overlaps = finalCandidates.some(selected => 
        candidate.start < selected.end && candidate.end > selected.start
      );
      if (!overlaps) finalCandidates.push(candidate);
    }
    finalCandidates.sort((a, b) => a.start - b.start);

    // --- 7. APPLIQUER LA PSEUDONYMISATION ---
    const pseudonymMode = (config && config.pseudonymMode) || "tokens";

    let resultText = text;
    const detectedTypes = [];
    for (let idx = finalCandidates.length - 1; idx >= 0; idx--) {
      const item = finalCandidates[idx];
      const origValue = item.value;
      const type = item.type;
      
      if (!detectedTypes.includes(type)) {
        detectedTypes.push(type);
      }

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

        if (type === "NOM_PRENOM") {
          const origParts = normalizedValue.split(/\s+/);
          if (pseudonymMode === "aliases") {
            const tokenParts = token.split(/\s+/);
            if (origParts.length === tokenParts.length) {
              for (let p = 0; p < origParts.length; p++) {
                const oPart = origParts[p].trim();
                const tPart = tokenParts[p].trim();
                if (oPart.length > 1 && tPart.length > 1) {
                  if (!sessionState.mappings[oPart]) {
                    sessionState.mappings[oPart] = tPart;
                  }
                  if (!sessionState.mappings[tPart]) {
                    sessionState.mappings[tPart] = oPart;
                  }
                  if (!sessionState.generatedAliases.includes(tPart)) {
                    sessionState.generatedAliases.push(tPart);
                  }
                }
              }
            }
          } else {
            // mode jetons (tokens)
            for (let p = 0; p < origParts.length; p++) {
              const oPart = origParts[p].trim();
              if (oPart.length > 1) {
                const isLast = (p === origParts.length - 1);
                const partType = isLast ? "NOM" : "PRENOM";
                if (!sessionState.mappings[oPart]) {
                  if (!sessionState.counters[partType]) sessionState.counters[partType] = 0;
                  sessionState.counters[partType]++;
                  const partToken = `[${partType}_${sessionState.counters[partType]}]`;
                  sessionState.mappings[oPart] = partToken;
                  sessionState.mappings[partToken] = oPart;
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
      sessionState: sessionState,
      stats: detectedTypes,
      candidates: finalCandidates
    };
  }

  // --- 8. BASE D'ALIAS FICTIFS FRANÇAIS ET GÉNÉRATEUR ---
  const ALIAS_PRENOMS = [
    // Prénoms masculins classiques et modernes
    "Gabriel", "Raphaël", "Léo", "Louis", "Lucas", "Hugo", "Arthur", "Nathan", "Jules", "Maël",
    "Liam", "Ethan", "Noah", "Sacha", "Paul", "Maxime", "Antoine", "Thomas", "Alexandre", "Nicolas",
    "Julien", "Vincent", "Pierre", "Jean", "Michel", "Philippe", "David", "Guillaume", "Sébastien", "Stéphane",
    "Frédéric", "Laurent", "Aurélien", "Alexis", "Valentin", "Romain", "Clément", "Benjamin", "Mathieu", "Franck",
    "Olivier", "Christophe", "Arnaud", "Didier", "Pascal", "Marc", "Christian", "Bernard", "Jacques", "Robert",
    "Daniel", "Henri", "René", "Alain", "Marcel", "André", "Gérard", "Yves", "Guy", "Patrick",
    "Bruno", "Ludovic", "Jérôme", "Damien", "Florent", "Loïc", "Yann", "Cédric", "Florian", "Kévin",
    "Baptiste", "Simon", "Adrien", "Bastien", "Corentin", "Théo", "Samuel", "Thibault", "Maxence", "Victor",
    "Mathias", "Robin", "Augustin", "Gabin", "Léandre", "Marius", "Tristan", "Edouard", "Charles", "Gaston",
    "Lucien", "Etienne", "Régis", "Xavier", "Dorian", "Killian", "Kylian", "Matéo", "Mathéo", "Sohan",
    "Tiago", "Diego", "Milo", "Timothée", "Louison", "Auguste", "Mathurin", "Adel", "Amir", "Imran",
    "Rayane", "Sofiane", "Yanis", "Amine", "Bilal", "Hamza", "Ismaël", "Malik", "Naïm", "Omar",
    "Rayan", "Salim", "Samy", "Wassim", "Zakaria", "Florentin", "Grégory", "Jérémy", "Lionel", "Mathis",
    "Matthieu", "Rémi", "Rodolphe", "Yannick", "Gilbert", "Hubert", "Jean-Pierre", "Jean-Marc", "Jean-Claude",
    "Jean-Luc", "Jean-François", "Jean-Baptiste", "Jean-Yves", "Jean-Paul", "Joseph", "Léonard", "Norbert",
    "Raymond", "Roger", "Serge", "Thierry", "Victorien",
    // Prénoms féminins classiques et modernes
    "Emma", "Jade", "Louise", "Alice", "Chloé", "Lina", "Mila", "Léa", "Manon", "Inès",
    "Sarah", "Clara", "Anna", "Camille", "Juliette", "Sofia", "Charlotte", "Zoé", "Lola", "Lucie",
    "Ambre", "Julia", "Éva", "Rose", "Romane", "Agathe", "Inaya", "Léna", "Margaux", "Sophie",
    "Julie", "Pauline", "Mathilde", "Marion", "Émilie", "Céline", "Aurélie", "Élodie", "Laetitia", "Sandrine",
    "Christelle", "Audrey", "Stéphanie", "Virginie", "Nathalie", "Isabelle", "Sylvie", "Catherine", "Valérie", "Florence",
    "Véronique", "Chantal", "Anne", "Martine", "Monique", "Françoise", "Jacqueline", "Nicole", "Hélène", "Brigitte",
    "Corinne", "Elisabeth", "Marie", "Jeanne", "Suzanne", "Colette", "Gisèle", "Odile", "Patricia", "Renée",
    "Laurence", "Thérèse", "Clémence", "Elisa", "Célia", "Fanny", "Adèle", "Noémie", "Lisa", "Coline",
    "Apolline", "Valentine", "Constance", "Hortense", "Eugénie", "Éléonore", "Gabrielle", "Marthe", "Clotilde",
    "Berthe", "Béatrice", "Pascale", "Mia", "Hanna", "Yasmine", "Kenza", "Leïla", "Nour", "Linda",
    "Nadia", "Sonia", "Samira", "Karima", "Rachida", "Fadila", "Malika", "Myriam", "Maëlys", "Léonie",
    "Lucile", "Anaïs", "Justine", "Eva", "Marine", "Solène", "Salomé", "Aude", "Bérangère", "Cécile",
    "Clarisse", "Dorothée", "Estelle", "Gaëlle", "Gwenaëlle", "Ingrid", "Joëlle", "Laure", "Lidwine",
    "Magali", "Marlène", "Maud", "Muriel", "Nadege", "Nelly", "Noëlle", "Ophélie", "Sabine", "Séverine",
    "Sidonie", "Solange", "Sylviane", "Tatiana"
  ];

  const ALIAS_NOMS = [
    "Martin", "Bernard", "Thomas", "Petit", "Robert", "Richard", "Durand", "Dubois", "Moreau", "Laurent",
    "Simon", "Michel", "Leroy", "Roux", "David", "Bertrand", "Morel", "Fournier", "Girard", "Bonnet",
    "Dupont", "Lambert", "Fontaine", "Rousseau", "Vincent", "Muller", "Lefevre", "Faure", "Andre", "Mercier",
    "Blanc", "Guerin", "Boyer", "Chevalier", "Denis", "Antoine", "Mathieu", "Nicolas", "Masson", "Schmitt",
    "Morin", "Roussel", "Gautier", "Meyer", "Lemaire", "Picard", "Dumont", "Colin", "Ortiz", "Lopez",
    "Garcia", "Martinez", "Rodriguez", "Fernandez", "Perez", "Vasseur", "Joly", "Gauthier", "Lucas", "Brun",
    "Dumas", "Brunet", "Renard", "Guillaume", "Caron", "Dufour", "Aubert", "Marcel", "Henri", "Daniel",
    "Dubreuil", "Prevost", "Royer", "Gaillard", "Lemoine", "Millet", "Gerard", "Renault", "Clement", "Gros",
    "Dupuy", "Marchand", "Arnaud", "Duval", "Aubry", "Barbier", "Lopes", "Goncalves", "Silva", "Ferreira",
    "Oliveira", "Martins", "Rocha", "Costa", "Santos", "Gomes", "Souza", "Alves", "Pinto", "Carvalho",
    "Ribeiro", "Teixeira", "Mendes", "Lima", "Silvestre", "Renaud", "Julien", "Benoit", "Monnier", "Leclerc",
    "Aubois", "Bailly", "Barre", "Bastien", "Bazin", "Belanger", "Bellamy", "Berger", "Besset", "Boucher",
    "Boulanger", "Bourdon", "Bourgeois", "Bousquet", "Bouvet", "Breton", "Buisson", "Carre", "Charpentier",
    "Chartier", "Chauvin", "Clerc", "Collet", "Cordier", "Cousin", "Couturier", "Delage", "Delahaye",
    "Delattre", "Delorme", "Descamps", "Deschamps", "Desjardins", "Devaux", "Didier", "Droit", "Duchemin",
    "Duchesne", "Duclos", "Dupuis", "Favier", "Ferry", "Fischer", "Forestier", "Garnier", "Gaudin",
    "Gillet", "Giraud", "Granger", "Guichard", "Guillot", "Guyot", "Hardy", "Hauet", "Hebert", "Humbert",
    "Imbert", "Jacob", "Jacques", "Jacquet", "Jourdan", "Klein", "Lacroix", "Laine", "Lamy", "Langlois",
    "Laporte", "Laroche", "Lecomte", "Legendre", "Leger", "Legrand", "Lelievre", "Lemonnier", "Lenoir",
    "Leroux", "Lesage", "Leveque", "Maillet", "Maillard", "Maire", "Mallet", "Maréchal", "Masse",
    "Menard", "Meunier", "Moulin", "Mouton", "Neveu", "Noel", "Olivier", "Page", "Pain", "Papon",
    "Parent", "Paris", "Pasquier", "Peltier", "Perret", "Perrier", "Perrot", "Philippe", "Pichon",
    "Pierre", "Poirier", "Pons", "Poulain", "Prigent", "Proust", "Provost", "Prudhomme", "Remy",
    "Rey", "Riviere", "Rocher", "Roger", "Rollant", "Rousset", "Salmon", "Samson", "Seguin",
    "Sellier", "Serre", "Tessier", "Texier", "Thierry", "Toussaint", "Valentin", "Vallee",
    "Vallet", "Vassal", "Vasseur", "Vernet", "Vial", "Vidal", "Vigneron", "Weber"
  ];

  const ALIAS_VILLES = [
    "Paris", "Marseille", "Lyon", "Toulouse", "Nice", "Nantes", "Montpellier", "Strasbourg", "Bordeaux", "Lille",
    "Rennes", "Reims", "Saint-Étienne", "Toulon", "Le Havre", "Grenoble", "Dijon", "Angers", "Villeurbanne", "Saint-Denis",
    "Nîmes", "Clermont-Ferrand", "Aix-en-Provence", "Brest", "Limoges", "Tours", "Amiens", "Perpignan", "Metz", "Besançon",
    "Boulogne-Billancourt", "Orléans", "Rouen", "Mulhouse", "Caen", "Nancy", "Saint-Paul", "Tourcoing", "Roubaix", "Nanterre",
    "Vitry-sur-Seine", "Avignon", "Créteil", "Dunkerque", "Poitiers", "Aubervilliers", "Versailles", "Courbevoie", "Colombes", "Aulnay-sous-Bois",
    "Cherbourg-en-Cotentin", "Saint-Pierre", "Aubagne", "Asnières-sur-Seine", "Colmar", "Saint-Maur-des-Fossés", "Rueil-Malmaison", "Champigny-sur-Marne", "Antibes", "Béziers",
    "La Rochelle", "Saint-Nazaire", "Mérignac", "Calais", "Drancy", "Bourges", "Vienne", "Ajaccio", "Cayenne", "Valence",
    "Chambéry", "Saint-Quentin", "Niort", "Troyes", "Lorient", "Saint-Leu", "Sarcelles", "Neuilly-sur-Seine", "Annecy", "Belfort",
    "Tarbes", "Auxerre", "Nevers", "Blois", "Pau", "Bayonne", "Biarritz", "Angoulême", "Laval", "Évreux",
    "Chartres", "Mende", "Aurillac", "Cahors", "Roanne", "Saint-Malo", "Arras", "Lens", "Douai", "Valenciennes",
    "Bastia", "Vincennes", "Montreuil", "Pantin", "Clichy", "Meudon", "Puteaux", "Suresnes",
    "Abbeville", "Albertville", "Alençon", "Ancenis", "Annemasse", "Annonay", "Armentières", "Auray",
    "Autun", "Avallon", "Bagnols-sur-Cèze", "Bar-le-Duc", "Beaune", "Bergerac", "Bernay", "Besné",
    "Béthune", "Blaye", "Bolbec", "Brignoles", "Brive-la-Gaillarde", "Carentan", "Carhaix-Plouguer", "Castelnaudary",
    "Cavaillon", "Challans", "Chalon-sur-Saône", "Châlons-en-Champagne", "Chantilly", "Châteaubriant", "Châteaudun",
    "Château-Thierry", "Châtellerault", "Chaumont", "Cognac", "Compiègne", "Concarneau", "Condom", "Coutances",
    "Creil", "Dax", "Deauville", "Dieppe", "Digne-les-Bains", "Dole", "Draguignan", "Épernay", "Épinal",
    "Fécamp", "Figeac", "Flers", "Fontainebleau", "Fouesnant", "Fougères", "Gap", "Gérardmer", "Grasse",
    "Guérande", "Guingamp", "Haguenau", "Hazebrouck", "Honfleur", "Issoudun", "Istres", "Laon", "La Seyne-sur-Mer",
    "Lézignan-Corbières", "Libourne", "Lisieux", "Longwy", "Lons-le-Saunier", "Lunéville", "Mâcon", "Manosque",
    "Marmande", "Martigues", "Maubeuge", "Mayenne", "Melun", "Menton", "Millau", "Montargis", "Montbrison",
    "Montceau-les-Mines", "Mont-de-Marsan", "Montélimar", "Morlaix", "Moulins", "Nogent-le-Rotrou", "Nyon",
    "Oyonnax", "Paimpol", "Pamiers", "Parthenay", "Péronne", "Pertuis", "Plouzané", "Pont-à-Mousson", "Pontivy",
    "Pornic", "Privas", "Provins", "Redon", "Riom", "Roanne", "Rochefort", "Rodez", "Romans-sur-Isère",
    "Royan", "Sables-d'Olonne", "Saint-Amand-les-Eaux", "Saint-Brieuc", "Saint-Dié-des-Vosges", "Saint-Dizier",
    "Saint-Flour", "Saint-Gaudens", "Saint-Jean-de-Luz", "Saint-Lô", "Saint-Omer", "Saint-Pol-de-Léon",
    "Saint-Raphaël", "Salins-les-Bains", "Sallanches", "Saumur", "Sedan", "Segré", "Senlis", "Sens",
    "Sisteron", "Soissons", "Tarare", "Thiers", "Thonon-les-Bains", "Thouars", "Tulle", "Valréas",
    "Vendôme", "Vesoul", "Vichy", "Vierzon", "Vitré", "Voiron", "Yvetot"
  ];

  const ALIAS_ORGANISATIONS = [
    // Administration / Secteur Public
    "Collectivité Territoriale Fictive", "Mairie Fictive", "Communauté de Communes Fictive", "Administration Fictive", "Établissement Public Fictif",
    "Préfecture Fictive", "Conseil Départemental Fictif", "Conseil Régional Fictif", "Ministère Fictif de l'Énergie", "Tribunal Administratif Fictif",
    "Office National du Logement Fictif", "Agence de Santé Fictive", "Centre Communal d'Action Sociale Fictif", "Service des Eaux Fictif",
    // Entreprises / Cabinet
    "Société Fictive SAS", "Cabinet Fictif Conseil", "Agence Fictive Digitale", "Groupe Logistique Fictif", "Synergie Fictive SA",
    "Apex Solutions", "Novatech Industrie", "Altamir Logistique", "Horizon Digital", "OmniServices France",
    "France Conseil Groupe", "ValoTech", "Borealis Partners", "Zenith Assurance", "Solyris Énergie",
    "AeroSystems France", "LogiCorp", "Vecteur Immobilier", "Alliance R&D", "Innova France",
    "Delta Consultant", "BioPharma Lab", "Nord Équipement", "Atlantique Finance", "Global Transit",
    // Association / Santé / Éducation
    "Association Sportive Fictive", "Association Éco-Avenir", "Fédération Nationale du Sport Fictif", "Fondation pour le Patrimoine Fictif",
    "Clinique Médicale Saint-Roch", "Hôpital Privé du Val", "Centre de Réadaptation Fictif",
    "Université Fictive des Sciences", "École Supérieure de Management Fictive", "Lycée Polyvalent Fictif", "Institut de Recherche Fictif",
    "Agence de Développement Locale", "Direction Générale Fictive", "Institut Fictif d'Aménagement", "Société de Conseil Logistique",
    "Cabinet Juridique Associé", "Mutuelle Générale Fictive", "Régie des Transports Fictive", "Fonds de Dotation Fictif",
    "Fédération Fictive d'Écologie", "Bureau de Recherche Fictif", "Lycée Technique Fictif", "École de Design Fictive",
    "Université Fictive des Arts", "Clinique Fictive du Parc", "Centre de Soins Fictif", "Syndicat Mixte Fictif",
    "Association d'Entraide Fictive", "Coopérative Agricole Fictive", "Union Fictive Artisanale", "Espace Culturel Fictif",
    "Théâtre Municipal Fictif", "Société Civile Fictive", "Alliance Digitale SAS", "Boreal Technologies",
    "Calyx Capital", "Dendron Solutions", "Eolis Énergie", "Flux Systèmes", "Helios Industrie", "Ion Concept",
    "Krypton Services", "Lithos BTP", "Nautilus Transport", "Orion Santé", "Pyxis Consulting", "Quartz Assurance",
    "Rift Sécurité", "Stratum Immobilier", "Tethys Finance", "Ursa Logistique", "Vesta Conseil", "Wyvern Software",
    "Xenon Telecom", "Zephyr Aéronautique", "Mairie Fictive d'Avallon", "Communauté d'Agglomération Fictive",
    "Préfecture de Région Fictive", "Chambre des Métiers Fictive", "Chambre de Commerce Fictive", "Comité Local Fictif"
  ];

  function getRandomUnused(pool, sessionState) {
    if (!sessionState.generatedAliases) {
      sessionState.generatedAliases = [];
    }
    const unused = pool.filter(item => !sessionState.generatedAliases.includes(item));
    if (unused.length > 0) {
      return unused[Math.floor(Math.random() * unused.length)];
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function generateAlias(type, counter, sessionState) {
    if (!sessionState.generatedAliases) {
      sessionState.generatedAliases = [];
    }

    let alias = "";

    switch (type) {
      case "ORGANISATION":
        alias = getRandomUnused(ALIAS_ORGANISATIONS, sessionState);
        break;
      case "PRENOM":
        alias = getRandomUnused(ALIAS_PRENOMS, sessionState);
        break;
      case "NOM":
        alias = getRandomUnused(ALIAS_NOMS, sessionState);
        break;
      case "NOM_PRENOM":
        const randPrenom = getRandomUnused(ALIAS_PRENOMS, sessionState);
        const randNom = ALIAS_NOMS[Math.floor(Math.random() * ALIAS_NOMS.length)];
        alias = `${randPrenom} ${randNom}`;
        break;
      case "VILLE":
        alias = getRandomUnused(ALIAS_VILLES, sessionState);
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

      const highlightSpan = `<span class="anonym-restored" data-token="${target}" title="Original : ${origValue.replace(/"/g, '&quot;')}" style="color: #2e7d32 !important; font-weight: bold !important; background-color: #e8f5e9 !important; padding: 0 2px !important; border-radius: 4px !important; border: 1px solid #c8e6c9 !important; display: inline !important; font-family: inherit !important; font-size: inherit !important;">${escapeHTML(origValue)}</span>`;
      
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
