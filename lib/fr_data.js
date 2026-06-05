// Moteur de détection et de pseudonymisation locale pour la France
// 100% hors-ligne et respectueux du RGPD / AI Act

(function() {
  // Liste des prénoms très courants en France (accents facultatifs dans les comparaisons grâce à normalizeStr)
  const COMMON_PRENOMS_MASCULINS = new Set([
    "aaron", "emile", "emmanuel", "gerald", "herve", "jose", "martin", "aymeric", "boris", "erwan", "fabien", "fabrice", "felix", "georges", "hubert", "joel", "patrice", "ronan", "sylvain", "leon", "adam", "adrien", "ahmed", "alain", "albert", "alessio", "alexandre", "alexis", "ali", "amand", "andre",
    "anthony", "antoine", "arnaud", "arthur", "auguste", "aurelien", "baptiste", "bastien", "benjamin", "bernard", "brahim", "bruno",
    "camille", "cedric", "charles", "christian", "christophe", "claude", "clement", "corentin", "damien", "daniel", "david", "denis",
    "didier", "diego", "dominique", "dorian", "driss", "dylan", "edouard", "enzo", "eric", "ethan", "etienne", "eugene",
    "farid", "florent", "florian", "franck", "francois", "frederic", "gabin", "gabriel", "gaston", "gerard", "guillaume", "guy",
    "hassan", "henri", "hugo", "jacques", "jean", "jerome", "jocelyn", "jonathan", "jules", "julien", "karim", "kevin",
    "khalid", "killian", "kylian", "laurent", "leandre", "leo", "leonard", "liam", "lisandro", "loic", "louis", "louison",
    "luc", "lucas", "lucien", "ludovic", "mael", "marc", "marcel", "marius", "mateo", "matheo", "mathieu", "mathis",
    "mathurin", "matthieu", "maurice", "maxence", "maxime", "mehdi", "michel", "milo", "mohamed", "mourad", "mustapha", "nathan",
    "nicolas", "noah", "nolan", "olivier", "omar", "pascal", "patrick", "paul", "philippe", "pierre", "quentin", "rachid",
    "raphael", "rayan", "regis", "remy", "rene", "robert", "robin", "romain", "sacha", "said", "salim", "samuel",
    "sebastien", "serge", "simon", "slimane", "sofiane", "sohan", "stephane", "tarek", "theo", "thibault", "thibaut", "thierry",
    "thomas", "tiago", "timothe", "timothee", "tony", "tristan", "valentin", "victor", "vincent", "xavier", "yann", "yannick",
    "yassine", "youssef", "yves"
  ]);

  const COMMON_PRENOMS_FEMININS = new Set([
    "adele", "carole", "nadege", "agnes", "adeline", "agathe", "alice", "amanda", "amelie", "amina", "anais", "anne", "anne-sophie", "annie", "apolline",
    "arlette", "audrey", "aurelie", "beatrice", "bernadette", "berthe", "brigitte", "camille", "caroline", "catherine", "cecile", "celia",
    "celine", "chana", "chantal", "charlotte", "chloe", "christelle", "christiane", "christine", "claire", "clara", "claude", "claudine",
    "clemence", "clementine", "clotilde", "colette", "coline", "constance", "corinne", "daniele", "danielle", "delphine", "denise", "dominique",
    "eleonore", "elisa", "elisabeth", "elodie", "elsa", "emilie", "emma", "emmanuelle", "eugenie", "eva", "evelyne", "fadila",
    "fanny", "fatima", "florence", "francoise", "gabrielle", "genevieve", "germaine", "gisele", "hanna", "helene", "hortense", "ines",
    "isabelle", "jacqueline", "jade", "jeanne", "josiane", "julie", "juliette", "justine", "karima", "karine", "kenza", "laetitia",
    "laura", "laurence", "lea", "leila", "leonie", "liliane", "lina", "linda", "lisa", "livia", "lola", "louise",
    "louison", "louna", "lucette", "lucie", "lucile", "maelys", "malika", "manon", "marcelline", "margaux", "marie", "marie-cecile",
    "marina", "marine", "marion", "marjorie", "marthe", "martine", "mathilde", "melanie", "melissa", "mia", "micheline", "mila",
    "monique", "morgane", "myriam", "nadia", "nadine", "nathalie", "nicole", "noemie", "nour", "oceane", "odette", "odile",
    "pascale", "patricia", "paulette", "pauline", "rachida", "raymonde", "renee", "romane", "sabine", "sabrina", "sacha", "salome",
    "samira", "sandrine", "sarah", "severine", "simone", "solene", "sonia", "sophie", "stephanie", "suzanne", "sylvie", "valentine",
    "valerie", "veronique", "victoire", "virginie", "yasmine", "yvette", "zoe"
  ]);

  const COMMON_PRENOMS = new Set([...COMMON_PRENOMS_MASCULINS, ...COMMON_PRENOMS_FEMININS]);

  // Liste des villes françaises courantes, régions et départements (accents facultatifs)
  const COMMON_VILLES = new Set([
    "aix-en-provence", "ajaccio", "ales", "alsace", "amiens", "angers", "angouleme", "annecy", "antibes", "ariege", "arles", "arras",
    "aubagne", "aubervilliers", "aude", "aulnay-sous-bois", "aunay-sous-auneau", "aurillac", "auvergne-rhone-alpes", "auxerre", "aveyron", "avignon", "bassan", "basse-goulaine",
    "bastia", "bayonne", "beauvais", "belfort", "besancon", "bevenais", "beziers", "biarritz", "blois", "bordeaux", "boucles", "boulogne-billancourt",
    "bourges", "bourgogne-franche-comte", "brest", "bretagne", "brive-la-gaillarde", "caen", "cahors", "calais", "cannes", "carcassonne", "cayenne", "centre-val-de-loire",
    "chalon-sur-saone", "chalons-en-champagne", "chambery", "champagne", "champigny-sur-marne", "charleville-mezieres", "chartres", "chateauroux", "cherbourg", "cherbourg-en-cotentin", "cholet", "clermont-ferrand",
    "clichy", "colmar", "colombes", "coly-saint-amand", "corquilleroy", "courbevoie", "creteil", "dieppe", "dijon", "doissin", "douai", "drancy",
    "dunieres", "dunkerque", "evreux", "evry", "ferrieres", "finistere", "foix", "foix-varilhes", "fort-de-france", "frejus", "gap", "gorre",
    "grenoble", "guadeloupe", "guyane", "haute-loire", "hyeres", "ile-de-france", "issy-les-moulineaux", "la roche-sur-yon", "la rochelle", "laval", "le havre", "le mans",
    "le puy-en-velay", "lens", "les sables-d-olonne", "lille", "limoges", "limousin", "lorient", "lorraine", "lourdes", "lyon", "macon", "mamoudzou",
    "marseille", "martigues", "martinique", "mayenne", "mayotte", "meaux", "mediterranee", "melun", "mende", "merignac", "metz", "meudon",
    "midi-pyrenees", "mont-de-marsan", "montauban", "montbeliard", "montlucon", "montpellier", "montreuil", "moyrazes", "mulhouse", "muret", "nancy", "nanterre",
    "nantes", "narbonne", "neuilly-sur-seine", "nevers", "nice", "nimes", "niort", "noisy-le-grand", "nord", "nord-pas-de-calais", "normandie", "noumea",
    "nouvelle-aquitaine", "occitanie", "orleans", "pantin", "paris", "pau", "pays-de-la-loire", "perpignan", "picardie", "ploudiry", "poitiers", "poitou",
    "poitou-charentes", "pralognan-la-vanoise", "provence-alpes-cote-d-azur", "puteaux", "pyrenees", "quimper", "reims", "rennes", "roanne", "rochefort", "rodez", "roubaix",
    "rouen", "saint-berthevin", "saint-brieuc", "saint-denis", "saint-dizier", "saint-etienne", "saint-herblain", "saint-laurent-du-maroni", "saint-leu", "saint-lo", "saint-malo", "saint-maur-des-fosses",
    "saint-nazaire", "saint-omer", "saint-ouen", "saint-paul", "saint-pierre", "saint-quentin", "saint-symphorien", "saint-tropez", "sainte-luce-sur-loire", "salon-de-provence", "samoreau", "sarcelles",
    "sarlat", "saumur", "savoie", "sens", "strasbourg", "sud", "suresnes", "tarbes", "toulon", "toulouse", "tourcoing", "tours",
    "troyes", "valence", "valenciennes", "vannes", "varilhes", "verniolle", "versailles", "vicoin", "vienne", "vierzon", "villeurbanne", "vincennes",
    "vitry-sur-seine"
  ]);

  // Liste des noms de famille français courants (accents facultatifs)
  const COMMON_NOMS = new Set([
    "allard", "alvarez", "alves", "andre", "antoine", "antonio", "arnaud", "aubert", "aubry", "azevedo", "barbier", "benoit",
    "bernard", "berthelot", "bertrand", "blanc", "bonnet", "borde", "bourgeois", "boyer", "brel", "breuvand", "brun", "brunet",
    "caron", "carvalho", "cessac", "charrier", "chevalier", "chombart", "clement", "colin", "collet", "corre", "costa", "coussinet",
    "daniel", "david", "delmas", "denis", "diaz", "dubois", "dufour", "dumas", "dumont", "dupont", "dupuy", "durand",
    "duval", "faure", "fernandes", "fernandez", "ferreira", "fontaine", "fournier", "gaillard", "garcia", "gaspard", "gauthier", "gautier",
    "gerard", "gimenez", "girard", "godais", "goethem", "gomes", "gomez", "goncalves", "gonzalez", "gros", "guerin", "guillaume",
    "guillot", "henri", "jacquet", "joly", "jonard", "julien", "lauwe", "ndiaye", "parker", "renault", "rouziere"
  ]);

  // Mots clés d'organisations en français (minuscules, sans accents)
  const ORG_KEYWORDS = new Set([
    "ademe", "agence", "agences", "alsh", "ars", "assemblee", "association", "associations", "banque", "banques", "cabinet", "cabinets",
    "caf", "caisse", "caisses", "ccas", "centre", "centres", "cnil", "collectivite", "collectivites", "college", "colleges", "comite",
    "comites", "commission", "commissions", "communaute", "communautes", "commune", "communes", "compagnie", "compagnies", "cpam", "departement", "departements",
    "dgfip", "direction", "directions", "ecole", "ecoles", "edf", "ehpad", "entreprise", "entreprises", "epfn", "faculte", "facultes",
    "federation", "federations", "fondation", "fondations", "groupe", "groupes", "hopital", "hopitaux", "institut", "instituts", "lycee", "lycees",
    "mairie", "mairies", "marches", "mfr", "ministere", "ministeres", "mutuelle", "mutuelles", "office", "offices", "pole", "poles",
    "prefecture", "prefectures", "ratp", "region", "regions", "rochebaron", "rte", "sdis", "sem", "senat", "service", "services",
    "sncf", "societe", "societes", "syndicat", "syndicats", "tribunal", "universite", "universites", "urssaf", "velay"
  ]);

  // Stop words français pour éviter de fausses pseudonymisations sur des mots majuscules en début de phrase ou dans le texte
  // Enrichi avec les termes professionnels et techniques (français/anglais) très courants
  const FRENCH_STOP_WORDS = new Set([
    "-amenagement", "reglement", "communale", "creation", "bp", "ca", "membres", "membre", "achat", "interieur", "-brac", "aad-nvpdl", "abbassia", "absents", "abu", "accessibilite", "accession", "accessoires", "accompagnement", "accoord", "accroissement",
    "accueil", "accueils", "acquisition", "acquisitions", "act", "acte", "actes", "action", "actions", "activite", "activites", "actus",
    "addan", "addictions", "ademe", "adhesion", "adjoint", "adjointe", "admin", "administrateur", "administrateurs", "administratif", "administratifs", "administration",
    "admins", "adoma", "adresse", "adresses", "adulte", "affaires", "affile", "afg-", "afrique", "agees", "agence", "agent",
    "agents", "agglomeration", "agile", "agir", "agla", "agora", "agricole", "agriculture", "aicha", "aide", "aides",
    "aime", "air", "aire", "ajustement", "ak", "alassane", "aleas", "alfred", "alimentaire", "allee", "allocations", "allotissement",
    "alors", "amailland", "ambitions", "ame", "amenagement", "amenagements", "amicale", "amie", "amis", "amrouche", "an", "anatole",
    "andev", "andriot", "android", "andy", "anglais", "angular", "animal", "animale", "animation", "animations", "anjou", "annee",
    "annees", "annexe", "annexes", "annuel", "anonyme", "ap", "api", "apo", "appareil", "appel", "appels", "application",
    "applications", "apport", "approbation", "approuver", "appui", "apres", "aragon", "arbres", "arcade", "architectes", "architecture", "architectures",
    "ardillon", "armenie", "armoire", "arret", "arrivee", "ars", "arte", "artelia", "article", "artificialisation", "as", "asamla",
    "asie", "assainissement", "asseh", "assemblees", "assez", "assise", "associatif", "association", "associations", "assurance", "aster", "astreintes",
    "atao", "atdec", "atelier", "ateliers", "athletique", "atlanpole", "atlantique", "atsem", "attributaire", "attributaires", "au", "audit",
    "audits", "aujourd'hui", "aupres", "auquel", "aura", "aussi", "autant", "auteur", "auteurs", "autonomie", "autorisation", "autoriser",
    "autre", "autres", "aux", "auxquelles", "auxquels", "auzelle", "ava", "avance", "avec", "avenant", "avenir", "avenue",
    "aws", "axe", "axes", "ayant", "azerbaidjan", "aziliz", "azure", "azzi", "backend", "bail", "bainvel",
    "banderoles", "banque", "banques", "banzai", "bar", "barnier", "base", "bases", "bassal", "bassani", "basse-goulaine", "bassem",
    "basseville", "bati", "batiment", "batiment lacoste", "batiment restaurant", "batiments", "bauche", "bb", "bde", "beaucoup", "beaujoire", "beaulac",
    "beaune", "beausoleil", "belhamiti", "bellamy", "belle", "belleville", "bellevue", "benatre", "benevolat", "benoite", "berangere", "bertu",
    "beslier", "besoin", "besoins", "betiaux", "bf", "bibliotheque", "biche", "bicloo", "bien", "biens", "big", "bir",
    "blin", "bogota", "bois", "boismenu", "boisrame", "boissiere", "bolo", "bon", "bonamy", "bonjour", "boreal",
    "bosnie", "bottiere", "bottiere-pin", "bouaye", "bouche", "bouguenais", "boule", "boulevard", "bourdon", "bourses", "bout", "boutin",
    "bpce", "brains", "breil", "bricolowtech", "brillaud", "brin", "brocante", "brosseau", "broussais", "brs", "brule", "bruxelles",
    "budak", "budget", "budgetaire", "budgets", "bug", "bugs", "bulletin", "bureau", "bureaux", "burkina", "but", "c'est",
    "c'etait", "cable", "caf", "cafe", "cafes", "cahier", "cahiers", "caisse", "calcul", "calculs", "calyps", "campagne",
    "campagnes", "candidat", "candidats", "car", "caractere", "carquefou", "casque", "cassette", "castets", "categorie", "categories",
    "caux", "cbr", "ccas", "ccpv", "cdac", "cdc", "cdd", "cdg", "cdi", "ce", "ceci", "cedes",
    "cee", "cela", "celle", "celle-ci", "celle-la", "celles", "celles-ci", "celles-la", "celui", "celui-ci", "celui-la", "ceme",
    "cemea", "centrale", "centre", "centre-ville", "centres", "ces", "cessions", "cet", "cetex", "cette", "ceux", "ceux-ci",
    "ceux-la", "cezam", "cfo", "cgct", "chacun", "chacune", "chahboun", "chaire", "chaleur", "chamalieres", "chambellan", "chambre",
    "champ", "champenois-", "champs", "chantenay", "chantier", "chapelle", "chapitre", "chaque", "charges", "charmant", "charpente", "charte",
    "chasse", "chasses", "chasseur", "chasseurs", "chat", "chateau", "chaude", "chef", "cheminement", "chene", "cher", "chers",
    "chez", "chine", "chomage", "chomeur", "chomeurs", "choregraphique", "chrome", "chu", "cible", "cibles", "cif", "cil",
    "cimetiere", "cinq", "cinquieme", "citad", "cite", "citeau", "citoyens", "civile", "clamart", "classe", "classement", "cle",
    "clect", "cles", "client", "clients", "climat", "clos", "cloture", "cloud", "clspd", "club", "cnas", "co-maitrise",
    "cobra", "cocotier", "code", "codega", "codes", "coeur", "cohesion", "collaborateur", "collaborateurs", "collectif", "collections", "collectivite",
    "collectivites", "collineau", "combien", "comite", "commande", "comme", "comment", "commentaire", "commentaires", "commerce", "commissaire", "commissaires",
    "commission", "commissions", "communal", "communautaire", "communaute", "communaute de communes", "communaute de communes du pays loudunais", "commune", "communes", "communication", "compagnie", "competences",
    "complementaire", "complet", "compliance", "composant", "composants", "compostri", "compresseur", "compte", "comptes", "concept", "conciliateur", "conciliateurs",
    "conclusion", "concurrence", "confederation", "confluence", "conformite", "conge", "connex", "conseil", "consentie", "consenties", "conservateurs", "conserve",
    "considerant", "consignations", "constitution", "contact", "contacts", "contrat", "contrats", "contrie", "convention", "conventions", "coop", "cooperatif",
    "cooperation", "cooperative", "coppey", "cordemais", "corto", "cosmopolis", "cote", "coueron", "coupe", "cour", "courantes", "cours",
    "cout", "couts", "couture", "couvert", "couverture", "covid", "cpam", "cpls", "cpu", "cra", "crc", "createur",
    "creative", "credit", "crm", "croquer", "css", "culture", "culturel", "culturelle", "d'administration", "d'allocations", "d'arreter", "d'ecoles",
    "d'un", "d'une", "dame", "dans", "danse", "dantec", "database", "date", "dates", "de", "debats", "debord",
    "debug", "decentralisation", "decentralisee", "dechets", "decide", "decision", "defense", "dehors", "del", "delegation", "delegations", "delegue",
    "delegues", "deliberation", "deliberations", "demande", "demarche", "demolition", "depart", "departement", "departemental", "departementale", "departementales", "departementaux",
    "departements", "depense", "depenses", "deports", "depose", "depuis", "dernier", "derogations", "derriere", "dervallieres", "des", "desamiantage",
    "descloziers", "description", "design", "designe", "designers", "designs", "desquelles", "desquels", "details", "deux", "deuxieme", "dev",
    "devant", "developement", "developpement", "devers", "devis", "diagnostic", "diagnostique", "dif", "directeur", "directeurs", "direction", "directions",
    "dirigeants", "discover", "dispositif", "disposition", "distribution", "division", "divisions", "dns", "docker", "docteur", "document", "documents",
    "domaine", "domaines", "domicile", "domus", "don", "donation", "donc", "donne", "donnee", "donnees", "dont", "doria",
    "dossier", "dossiers", "doulon", "dr", "droit", "droits", "drona", "dschang", "dte", "du", "ducs", "dupleix",
    "durant", "duree", "dust", "dvd", "d’administration", "d’aide", "d’amenagement", "d’arreter", "d’etude", "eau", "eaux", "ebe",
    "ecart", "echanges", "eclaireurs", "ecole", "ecoles", "economie", "ecopole", "ecos", "edeis", "edf", "edmond", "edmonde",
    "educateurs", "education", "eglise", "ehpad", "ejo", "eldonia", "election", "elections", "electric", "electricite", "elementaire", "elephant",
    "eleves", "elhadi", "eli", "elle", "elles", "elon", "elu", "elus", "email", "emails",
    "emplacements", "emploi", "emplois", "employeur", "employeurs", "emprunts", "en", "encore", "enedis", "energie", "enfance", "enfants",
    "engagement", "engagements", "enrouleur", "enseignement", "ensemble", "entreprise", "entreprises", "entretien", "envers", "environ", "environnement", "environnementale",
    "environnements", "epargne", "epci", "epdm", "ephad", "epizbar", "epiz’bar", "epl", "equipe", "equipement des communes", "equipements", "equipes",
    "eram", "erevan", "erp", "erreur", "erreurs", "esblg", "escapade", "espace", "espaces", "estime", "et",
    "etagere", "etaient", "etait", "etancheite", "etape", "etapes", "etat", "etats", "etp", "etrangeres", "etudes", "eurl",
    "euro", "eurolat", "europe", "euros", "evaluation", "eveil", "evolea", "excel", "excuses", "exercice", "exigence", "exigences",
    "experimentation", "expression", "fabrik", "factory", "factotum", "facture", "factures", "faculte", "faisons", "familial",
    "familiale", "famille", "familles", "faq", "faso", "faux", "faveur", "fayat", "fcm", "fdaec", "federation", "federations",
    "fellonneau", "ferre", "festival", "fete", "fetes", "fibre", "fichier", "fichiers", "figuls", "fikry", "fil",
    "filiere", "fillon", "filtre", "filtres", "financement", "finances", "financier", "financiere", "financieres", "financiers", "firefox", "fixation",
    "flux", "folle", "foncier", "fonciere", "fonction", "fonctionnaires", "fonctionnalite", "fonctionnalites", "fonctionnement", "fonds", "football", "foret-le deuxieme",
    "forfait", "forfaits", "format", "formation", "formats", "formule", "foulees", "foulques", "fournisseur", "fournisseurs", "francais", "francaise",
    "france", "francette", "francine", "franckie", "frankie", "fratries", "french", "freres", "friche", "froides", "fromages", "front",
    "frontend", "ftp", "fullstack", "futur", "g-xiste", "gadge", "gaelle", "gaialt", "garantie", "garanties", "gare", "garnier",
    "garreau", "garrigues", "gaz", "gazette", "geffray", "general", "generale", "generation", "generaux", "gengis", "geopolis", "george",
    "gerontopole", "gessant", "gestion", "ggr", "ghislaine", "gilbert", "gildas", "gironde", "gironde ressources", "git",
    "github", "gitlab", "global", "globale", "godasses", "goddess", "gorsse", "gouez", "goureaux", "gouvernement", "gpcu", "gpu",
    "gracia", "grades", "grand", "grande", "grau", "graveur", "grelaud", "griffe", "grosses", "groupe", "groupes", "guedj",
    "guerra", "guichet", "guimard", "guine", "guinee", "guisse", "gustave", "guyanais", "habitat", "habitations", "hakem", "halte",
    "harcelement", "harmonie", "haroun", "haute", "haute-garonne", "hautes", "hauts-paves", "hdd", "hdmi", "heure", "heures",
    "hip", "hirondelle", "histoire", "historique", "hlm", "homme", "horaires", "hormis", "hors", "hotel annexe gardette", "hotel gardette", "houda",
    "html", "http", "https", "huchet", "hulya", "hybrides", "ia", "iae", "ici", "ide", "idea",
    "identite", "ii", "iii", "il", "ile", "ile-de-france", "illustration", "ilot", "ils", "ime", "imp", "impact",
    "impacts", "impasse", "impot", "impots", "impressions", "imputation", "incapacite", "incendie", "inclusion", "inddigo", "indemnitaire", "indemnite",
    "index", "indice", "indique", "indre", "inferieure", "info", "information", "informations", "infos", "insertion", "installation", "installations",
    "interet", "interface", "interfaces", "intergenerationnel", "international", "internationale", "interventions", "inti", "intitule", "intitules", "introduction", "investissement",
    "ios", "ip", "iran", "iris", "irreversible", "isolation", "jacquinez", "jamais", "jamal", "jardin", "jardins", "java",
    "javascript", "javo", "je", "jet", "jeune", "jeunes", "jeunesse", "jeux", "jira", "johanna", "johnny",
    "josephine", "jouin", "jour", "journee", "jours", "jusqu'au", "jusque", "kabbaj", "kari", "kejadenn", "kerbrat",
    "kit", "kubernetes", "kyiv", "l'action", "l'agglomeration", "l'amicale", "l'article", "l'edition", "l'engagement", "l.2122.8", "la", "la france",
    "la-bas", "labellisation", "lacroix", "laep", "lagrange", "laiterie", "lamoriciere", "lan", "lancement", "landes", "lang", "langlois",
    "langue", "laquelle", "largo", "lascaux", "laure", "lavigne", "le", "le maire", "leblanc", "lecteur", "lecteurs", "lefebvre",
    "legrand", "lemaire", "lequel", "leroux", "lerude", "les", "lesquelles", "lesquels", "let's", "leur", "leurs",
    "lieu", "lieux", "ligne", "linux", "lire", "liste", "livrable", "livrables", "livraison", "livraisons", "livres", "local",
    "locale", "locatifs", "locaux", "lockbit", "log", "logement", "logements", "logeo", "logs", "loigatel le maire delegue", "loire", "loire-",
    "loire-atlantique", "loisirs", "longevite", "longue", "loquet", "lorin", "lorsque", "lot", "lots", "louisa", "luccini", "lucot",
    "lumiere", "lumineuse", "lunte", "l’isere", "m.", "m.delmond", "m.f.r", "ma", "macos", "macron", "madame", "magalie",
    "magma", "mahaut", "mahel", "mail", "mails", "maintenance", "maintien", "maire", "maires", "mairie", "mairies", "mais",
    "maison", "maisons", "maitrise", "majorite", "malakoff", "malchere", "malesherbes", "malgre", "manager", "managers", "mandat", "mandats",
    "mangin", "manifestation", "manufacture", "map", "marais", "marche", "marches", "marinette", "maritime", "maritimes", "marlene",
    "martins", "master", "materiel", "materiels", "maternelle", "matignon", "matthias", "maud", "mauves", "maximum", "medecine", "medico-social",
    "melinee", "mellinet", "memoires", "mendes-france", "menuiserie", "menuiseries", "merci", "mes", "mesdames", "message", "messages", "messieurs",
    "meta", "metallerie", "metropole", "metropolitain", "mfr", "mic", "michelin", "michelle", "ministere", "ministre", "mire", "mise",
    "mission", "missions", "mixte", "mme", "mnt", "mnt-", "mobilite", "modernisation", "modifie", "module", "modules", "moins",
    "mois", "moliere", "mom", "mon", "monnaie", "monnet", "monsieur", "montant", "montants", "moradi", "morancais", "moreau",
    "morice", "moss", "moteur", "mouillage", "moulin", "moulins", "moulins-association", "mounir", "mouvement", "moyen", "moyenne", "msp",
    "multi", "municipal", "municipalite", "municipaux", "musee", "musee de l'imprimerie", "naguere", "nangeville", "nantais", "naoned", "national",
    "nationale", "nationaux", "nature", "naulin", "nautique", "nautiques", "navigation", "nazaire", "nazaire-", "ne", "nelson", "neo",
    "neuvy", "new", "ni", "nid", "noel", "nom", "nombre", "non", "nor", "nos", "notaire", "notre",
    "nous", "nouveau", "novapole", "numerique", "oap", "oberenne", "objectif", "objectifs", "objet", "objets", "obtenu", "ocean",
    "office", "offices", "offre", "offres", "oissel", "ok", "olivet", "olivia", "olympique", "ombrieres", "ong", "ont",
    "opac", "operations", "oppelt", "or", "orange", "ordinaire", "ordre", "oree", "organisation", "organisations", "orientation", "orientations",
    "oro", "orsec", "orvault", "osons", "ou", "oublier", "ouest-", "ouest-france", "ouggourni", "oui", "outlook", "outre",
    "ouverture", "paddle", "page", "paiement", "paiements", "palais", "palestine", "paloma", "pam", "pan", "paq", "par",
    "paragot", "parcelle", "parcelles", "parcours", "parfois", "parking", "parmi", "parpaillon", "part", "partenaire", "partenaires", "partenariat",
    "parti", "partout", "pas", "pascouau", "passage", "patis", "patrimoine", "patrimoniale", "pauvres", "pav", "pays",
    "pays-de-la-loire", "paysages", "pendant", "pep", "perissol", "permanent", "permanente", "permanentes", "permission", "permissions", "personnel", "personnes",
    "petit", "petite", "petites", "petits", "peut-etre", "phase", "phases", "phia", "piano", "pick", "pieces", "pilotage",
    "pin", "pineau", "pirmil", "pirouette", "place", "plai", "plan", "planning", "plannings", "plateau", "platrerie", "plessis",
    "pli", "plomberie", "plomberie-chauffage", "pls", "plui", "plus", "plusieurs", "plutot", "poids", "point", "pole", "poles",
    "police", "politique", "pont", "ponts", "port", "porterie", "portrait", "position", "post", "poste", "postes", "pour",
    "powerpoint", "pr", "prairie", "pras", "pre", "prealables", "precedent", "prefectoral", "prefectorale", "prefectorales", "prefectoraux", "prefecture",
    "prefectures", "prefet", "prefete", "prelevement", "premiere", "prend", "prenom", "preprod", "presidence", "president", "presque", "presse",
    "prestataire", "prestataires", "prestations", "prevention", "preventive", "prevert", "prime", "prise", "prix", "pro", "procedure", "procedures",
    "proces", "process", "processus", "prochaines", "prochasson", "production", "produit", "produits", "professeur", "profil", "profils", "programme",
    "programmes", "projet", "projets", "promotion", "proprietaire", "propriete", "proprietes", "protection", "proximite", "public", "publication", "publications",
    "publics", "publique", "publiques", "puisque", "pv", "python", "qf", "qpv", "quai", "qualite", "quand", "quant",
    "quartier", "quartiers", "que", "quel", "quelle", "quelles", "quelque", "quelquefois", "quelques", "quels", "quenea", "quero",
    "questions", "qui", "quoique", "raa", "racing", "radio", "ral", "ram", "rapi", "rappel", "rapport", "rapporteurs",
    "rapports", "rarement", "ratios", "ratp", "ravez", "raynaldo", "rayonnement", "rbf", "rctc", "rd", "react", "reagir",
    "realisation", "rebouh", "recette", "recettes", "recherche", "recherches", "recours", "recreation", "recueil", "reduction", "reductions", "reel",
    "refacturation", "refacture", "reflet", "reflex", "regime", "region", "regional", "regionale", "regions", "regle", "regles", "rehabilitation",
    "reine", "reinventer", "remerciements", "remise", "remises", "renaud", "rencontres", "renforcer", "renon", "renouvellement", "renovation", "rente",
    "repertoire", "repos", "reseau", "reseaux", "residence", "resister", "resonantes", "responsabilite", "responsable", "ressources", "restaurant", "reste",
    "retailleau", "retour", "reunion", "reunions", "reussite", "reze", "rgpd", "rhs", "ribeiro", "richard", "rien", "rieux",
    "ring", "riom", "risque", "risques", "roch", "roche", "rodolphe", "rodriguez", "role", "roles", "rolland", "rom",
    "romy", "rosnet", "route", "rse", "rte", "rue", "rufisque", "rullo", "rurale", "sa", "saadi",
    "sablieres", "saem", "safari", "safe", "saint", "saint-", "saint-aignan-de-grand-lieu", "saint-herblain", "saint-leger-les-vignes", "saint-mars-la-jaille", "saint-nazaire", "saint-symphorien",
    "sainte", "sainte-", "sainte-croix", "sainte-luce", "sainte-luce-sur-loire", "saison", "saisonnier", "saisons", "salarie", "salaries", "salaun", "salecroi",
    "salecroix", "salles", "salut", "samedi", "sanam", "sandra", "sanitaire", "sans", "sante", "sarl", "sas", "sautron",
    "savary", "scene", "schema", "sci", "scic", "scpi", "scrum", "sdis", "sdk", "seance", "seassau", "seconde",
    "secours", "secteur", "secteurs", "section", "section de fonctionnement", "securite", "security", "sedar", "seine", "selon", "semaine", "semaines",
    "sennse", "seraient", "serait", "seront", "server", "serveur", "serveurs", "service", "services", "ses", "si", "siege",
    "sigma", "signalisation", "silver", "sis", "site", "situation", "skene", "slack", "smic", "sms", "sncf", "social",
    "sociale", "societe", "sodineuf", "sogea", "solidaires", "solidarite", "solidarites", "soliya", "solution", "solutions", "somme", "sommes",
    "son", "songo", "sons", "sont", "sony", "sotter", "source", "sources", "souris", "sous", "sous-prefecture", "souvent",
    "spbr", "specifique", "spectacle", "sport", "sportif", "sporting", "sportive", "sports", "sprint", "sql", "square", "ssd",
    "ssh", "ssid", "ssl", "stade", "staging", "startup", "statut", "statuts", "steel", "stefan", "stereolux", "stockage",
    "strategie", "strategies", "street", "structure", "structures", "style", "subvention", "subventions", "suffrages", "suite", "suivi", "sujet",
    "sujets", "super", "superieur", "superieure", "supervision", "sur", "surete", "surface", "syndical", "synthese", "systeme",
    "systemes", "ta", "tabarly", "table", "tables", "tache", "taches", "taille", "tailles", "taillis", "talledec", "tarifs",
    "taux", "taxe", "taxes", "teams", "tecam", "technique", "techniques", "telephone", "telephones", "temps", "ten'up", "tendance",
    "tendances", "tennis", "ten’up", "terrassement", "terre", "terres", "terrien", "territoire", "territoires", "territorial", "territoriale", "tes",
    "test", "testeur", "tests", "tete", "the", "theatre", "theme", "themes", "thibaud", "thiriet", "ticket", "tickets",
    "tiers", "tisse", "tit", "titan", "titre", "titres", "titulaire", "titulaires", "tls", "tnc", "ton", "top",
    "total", "totals", "toujours", "tourisme", "tous", "tout", "toutefois", "toutes", "trace", "traces", "tranche", "tranches",
    "transaction", "transactions", "transfert", "transition", "transitions", "travail", "travailler", "travaux", "trentemoult", "tres", "tresor", "tri",
    "trichet", "trois", "trop", "trophees", "ttc", "tu", "tva", "twitter", "two", "type", "types", "ukraine",
    "ulis", "un", "une", "union", "unite", "universitaire", "urbain", "urbaine", "urbanisme", "urssaf", "usb", "ussb",
    "utilisateur", "utilisateurs", "vacations", "vaisselle", "val", "valeur", "valeurs", "validation", "valmy", "van", "varsovie", "vefa",
    "vehicule", "vehicules", "vendeur", "vendus", "ventilation", "verbal", "verbaux", "vers", "version", "versions", "vertais", "vertou",
    "vertou-", "vga", "vialard", "vice-president", "vice-presidents", "vie", "vieux", "vignoles", "vii", "ville", "villes", "viltais",
    "violences", "virement", "vision", "vitoux", "vive", "vives", "vogue", "voici", "voila", "voirie", "volet", "volume",
    "vos", "votes", "votre", "vous", "vpn", "vue", "vyv", "wan", "warning", "warnings", "wc", "weiss",
    "wifi", "windows", "word", "workflow", "workflows", "xiii", "yaho", "yzeure", "zac", "zaenr", "zero", "zone",
    "zoo", "œuvre", "œuvres"
  ]);

  // Mots exclus spécifiques (mois et jours) qui commencent par des majuscules mais ne sont pas des PII
  const EXCLUDED_WORDS = new Set([
    "aout", "avril", "decembre", "dimanche", "fevrier", "janvier", "jeudi", "juillet", "juin", "lundi", "mai", "mardi",
    "mars", "mercredi", "novembre", "octobre", "samedi", "septembre", "vendredi"
  ]);

  // Fonction utilitaire pour normaliser une chaîne de caractères (retirer accents, minuscules)
  function dictHas(set, word) {
    if (!word) return false;
    if (set.has(word)) return true;
    if (word.includes('\uFFFD')) {
      const cleanWord = word.replace(/\uFFFD/g, '.');
      const regex = new RegExp('^' + cleanWord + '$', 'i');
      for (const item of set) {
        if (regex.test(item)) return true;
      }
    }
    return false;
  }

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
    const startIdx = Math.max(0, index - 50);
    const beforeText = text.substring(startIdx, index);
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
    const sub = text.substring(Math.max(0, index - 35), index)
                    .toLowerCase()
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "");
    
    // Si précédé par des formules de politesse, titres ou "chez" -> NOM de personne
    if (/\b(?:m\.|mm\.|mme|mme\.|mmes|mlle|mlles|monsieur|madame|dr|docteur|professeur|prof|nomme|nommee|nommees|appelle|appellee|chez|collegue|compagnon|ami|directeur|responsable|mr|mr\.)\b\s*(?:[a-z\'-]+\s+){0,1}$/i.test(sub)) {
      return "NOM_PRENOM";
    }
    if (/\b[a-z]\.(?:-[a-z]\.)?\s*(?:[a-z\'-]+\s+){0,1}$/i.test(sub)) {
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
    const remaining = text.substring(endIndex, endIndex + 100);
    // Si l'intervalle restant commence par une tabulation, un retour à la ligne ou plusieurs espaces (>= 2), ce n'est pas la suite d'un nom
    if (/^(?:[\t\r\n]|\s{2,})/.test(remaining)) {
      return false;
    }
    const regex = /^(?:\s*[-\s]\s*|\s+(?:de|d'|du|des|en|sur|sous|le|la|les|DE|D'|DU|DES|EN|SUR|SOUS|LE|LA|LES)\s+)(\p{Lu}[\p{L}'-]*)/u;
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
    const startIdx = Math.max(0, index - 100);
    const beforeText = text.substring(startIdx, index);
    if (/[\t\r\n]|\s{2,}$/.test(beforeText)) {
      return false;
    }
    // Rechercher le mot capitalisé précédent avec les liaisons possibles
    const regex = /(\p{Lu}[\p{L}'-]*)(?:\s+|[-\s]\s*|\s+(?:de|d'|du|des|en|sur|sous|le|la|les|DE|D'|DU|DES|EN|SUR|SOUS|LE|LA|LES)\s+)$/u;
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
    
    // Écarter si précédé par des caractères typiques de paramètres ou chemins URL (/id, =id, ?id, &id)
    if (/[\/=\?:&]$/.test(beforeText)) {
      return false;
    }
    
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
    if (/\b(?:budget|montant|prix|total|somme|ca|chiffre\s+d'affaires|quantite|nombre\s+de|id|identifiant|compteur|mesure|compte|comptes|chapitre|chapitres|article|articles|imputation|imputations|sous-compte|sous-comptes|fonction|rubrique)\s*(?:de|d')?\s*$/i.test(beforeText)) {
      return false;
    }

    // Écarter s'il y a un symbole monétaire ou un montant formaté à proximité (tableaux financiers)
    const monetaryRegex = /(?:€|\$|£|euros?|\b\d+[\s\.]*\d*[\.,]\d{2}\b)/i;
    if (monetaryRegex.test(beforeText) || monetaryRegex.test(afterText)) {
      return false;
    }
    
    return true;
  }

  // Fonction principale de pseudonymisation
  function pseudonymizeText(text, sessionState, config = {}) {
    if (!config) config = {};
    if (!text) return { pseudonymizedText: "", sessionState: sessionState || {}, stats: [] };
    
    // Bloquer le traitement si la licence est inactive (Paywall)
    if (!isLicenseActive) {
      return { 
        pseudonymizedText: text, 
        sessionState: sessionState || {}, 
        stats: [],
        expired: true
      };
    }
    
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
      let regex;
      if (wordBoundary) {
        // Lookahead pour le suffixe pour éviter de consommer les espaces et rater des occurrences adjacentes
        regex = new RegExp(`(?:^|[^\\p{L}\\p{N}])(${escaped})(?=$|[^\\p{L}\\p{N}])`, 'gui');
      } else {
        regex = new RegExp(escaped, 'gi');
      }

      let match;
      while ((match = regex.exec(text)) !== null) {
        let start, end, val;
        if (wordBoundary) {
          const matchVal = match[1];
          start = match.index + match[0].indexOf(matchVal);
          end = start + matchVal.length;
          val = matchVal;
        } else {
          start = match.index;
          end = match.index + match[0].length;
          val = match[0];
        }
        
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
            const startIdx = Math.max(0, start - 50);
            const textBefore = text.substring(startIdx, start);
            const textAfter = text.substring(end, end + 50);
            
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
          type: type
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
            type: cp.replacementType
          });
        }
      } catch (e) {
        console.error("Error executing custom regex pattern:", cp.name, e);
      }
    }

    // --- 4. DÉTECTION DES NOMS PROPRES, PRÉNOMS ET VILLES (Accents et capitales) ---
    // Détecter tous les mots pour capturer les prénoms/communes connus même en minuscules (ex: aaron, haute-loire)
    const wordRegex = /(?<![\p{L}\uFFFD])(?<!(?<![dDlL])')(?<![\p{L}\uFFFD]-)([\p{L}\uFFFD'-]+)/gu;
    let match;
    while ((match = wordRegex.exec(text)) !== null) {
      const word = match[1];
      const index = match.index + match[0].indexOf(word);
      const normalizedWord = normalizeStr(word);

      // On passe si c'est un mot court (1 car.)
      if (word.length <= 1) continue;

      const startsWithLowercase = /^[a-zà-öø-ÿ]/.test(word);

      let isKnownPrenom = dictHas(COMMON_PRENOMS, normalizedWord);
      if (!isKnownPrenom && normalizedWord.includes('-')) {
        const parts = normalizedWord.split('-');
        isKnownPrenom = parts.every(p => dictHas(COMMON_PRENOMS, p) || dictHas(COMMON_NOMS, p));
      }

      const isKnownNom = dictHas(COMMON_NOMS, normalizedWord) || customNames.has(normalizedWord);
      const isKnownVille = dictHas(COMMON_VILLES, normalizedWord) || customLocations.has(normalizedWord);
      const isKnownOrg = ORG_KEYWORDS.has(normalizedWord) || customOrgs.has(normalizedWord);
      const isAllUppercase = false;

      // Si le mot commence par une minuscule, on n'accepte de le traiter que s'il figure
      // explicitement dans nos dictionnaires connus (pour éviter les faux positifs massifs sur les mots ordinaires)
      if (startsWithLowercase) {
        if (!isKnownPrenom && !isKnownNom && !isKnownVille && !isKnownOrg) {
          continue;
        }
      }

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

      // 4a. Priorité 1 : Vérification des préfixes de contexte (ex: civilités, adresses)
      const contextType = checkContextPrefix(text, index);
      if (contextType) {
        candidates.push({
          start: index,
          end: index + word.length,
          value: word,
          type: contextType
        });
        continue;
      }

      // 4b. Priorité 2 : Détection en début de phrase
      const sentenceStart = isSentenceStart(text, index);
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

      // 4c. Priorité 3 : Détection en milieu de phrase
      const followedByCap = isFollowedByCapitalized(text, index + word.length);
      const precededByCap = isPrecededByCapitalized(text, index);
      
      let shouldAnonymize = false;
      let type = "NOM_PRENOM"; // Par défaut

      if (isKnownOrg) {
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
      allowedTypes = ["PRENOM", "NOM", "NOM_PRENOM", "EMAIL", "FORCE", "VILLE", "ORGANISATION", "TELEPHONE", "ADRESSE", "PLAQUE_IMMATRICULATION", "IDENTIFIANT_FISCAL", "MOT_DE_PASSE", "CLE_API"];
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
          token = generateAlias(type, sessionState.counters[type], sessionState, normalizedValue);
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
                if (FRENCH_STOP_WORDS.has(oPart.toLowerCase())) continue;
                if (FRENCH_STOP_WORDS.has(oPart.toLowerCase())) continue;
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
      stats: detectedTypes
    };
  }

  // --- 8. BASE D'ALIAS FICTIFS FRANÇAIS ET GÉNÉRATEUR ---
  const ALIAS_PRENOMS_MASCULINS = [
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
    "Matthieu", "Rémi", "Rodolphe", "Yannick", "Gilbert", "Hubert", "Jean-Pierre", "Jean-Marc", "Jean-Claude", "Jean-Luc",
    "Jean-François", "Jean-Baptiste", "Jean-Yves", "Jean-Paul", "Joseph", "Léonard", "Norbert", "Raymond", "Roger", "Serge",
    "Thierry", "Victorien", "Aaron", "Alessio"
  ];

  const ALIAS_PRENOMS_FEMININS = [
    "Emma", "Jade", "Louise", "Alice", "Chloé", "Lina", "Mila", "Léa", "Manon", "Inès",
    "Sarah", "Clara", "Anna", "Camille", "Juliette", "Sofia", "Charlotte", "Zoé", "Lola", "Lucie",
    "Ambre", "Julia", "Éva", "Rose", "Romane", "Agathe", "Inaya", "Léna", "Margaux", "Sophie",
    "Julie", "Pauline", "Mathilde", "Marion", "Émilie", "Céline", "Aurélie", "Élodie", "Laetitia", "Sandrine",
    "Christelle", "Audrey", "Stéphanie", "Virginie", "Nathalie", "Isabelle", "Sylvie", "Catherine", "Valérie", "Florence",
    "Véronique", "Chantal", "Anne", "Martine", "Monique", "Françoise", "Jacqueline", "Nicole", "Hélène", "Brigitte",
    "Corinne", "Elisabeth", "Marie", "Jeanne", "Suzanne", "Colette", "Gisèle", "Odile", "Patricia", "Renée",
    "Laurence", "Thérèse", "Clémence", "Elisa", "Célia", "Fanny", "Adèle", "Noémie", "Lisa", "Coline",
    "Apolline", "Valentine", "Constance", "Hortense", "Eugénie", "Éléonore", "Gabrielle", "Marthe", "Clotilde", "Berthe",
    "Béatrice", "Pascale", "Mia", "Hanna", "Yasmine", "Kenza", "Leïla", "Nour", "Linda", "Nadia",
    "Sonia", "Samira", "Karima", "Rachida", "Fadila", "Malika", "Myriam", "Maëlys", "Léonie", "Lucile",
    "Anaïs", "Justine", "Eva", "Marine", "Solène", "Salomé", "Aude", "Bérangère", "Cécile", "Clarisse",
    "Dorothée", "Estelle", "Gaëlle", "Gwenaëlle", "Ingrid", "Joëlle", "Laure", "Lidwine", "Magali", "Marlène",
    "Maud", "Muriel", "Nadege", "Nelly", "Noëlle", "Ophélie", "Sabine", "Séverine", "Sidonie", "Solange",
    "Sylviane", "Tatiana", "Livia"
  ];

  const ALIAS_PRENOMS = [...ALIAS_PRENOMS_MASCULINS, ...ALIAS_PRENOMS_FEMININS];

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

  function determineGender(origValue) {
    if (!origValue) return "M"; // Par défaut

    // Prendre la première partie si c'est un nom composé ou complet
    const firstWord = origValue.trim().split(/[\s-]+/)[0].toLowerCase();
    const normalized = normalizeStr(firstWord);

    // 1. Vérification dans les dictionnaires explicites de prénoms par genre
    const isFem = COMMON_PRENOMS_FEMININS.has(normalized);
    const isMasc = COMMON_PRENOMS_MASCULINS.has(normalized);

    if (isFem && !isMasc) return "F";
    if (isMasc && !isFem) return "M";

    // 2. Si ambigu ou absent des dictionnaires, utiliser des heuristiques de suffixes
    if (normalized.endsWith("a") || normalized.endsWith("elle") || normalized.endsWith("ette") || 
        normalized.endsWith("ine") || normalized.endsWith("ie") || normalized.endsWith("ise") || 
        normalized.endsWith("ence") || normalized.endsWith("ee")) {
      return "F";
    }

    if (normalized.endsWith("o") || normalized.endsWith("us") || normalized.endsWith("on") || 
        normalized.endsWith("an") || normalized.endsWith("is") || normalized.endsWith("ix")) {
      return "M";
    }

    return "M"; // Par défaut
  }

  function generateAlias(type, counter, sessionState, originalValue) {
    if (!sessionState.generatedAliases) {
      sessionState.generatedAliases = [];
    }

    let alias = "";

    switch (type) {
      case "ORGANISATION":
        alias = getRandomUnused(ALIAS_ORGANISATIONS, sessionState);
        break;
      case "PRENOM": {
        const gender = determineGender(originalValue);
        if (gender === "F") {
          alias = getRandomUnused(ALIAS_PRENOMS_FEMININS, sessionState);
        } else {
          alias = getRandomUnused(ALIAS_PRENOMS_MASCULINS, sessionState);
        }
        break;
      }
      case "NOM":
        alias = getRandomUnused(ALIAS_NOMS, sessionState);
        break;
      case "NOM_PRENOM": {
        const firstPart = originalValue ? originalValue.trim().split(/\s+/)[0] : "";
        const gender = determineGender(firstPart);
        let randPrenom = "";
        if (gender === "F") {
          randPrenom = getRandomUnused(ALIAS_PRENOMS_FEMININS, sessionState);
        } else {
          randPrenom = getRandomUnused(ALIAS_PRENOMS_MASCULINS, sessionState);
        }
        const randNom = ALIAS_NOMS[Math.floor(Math.random() * ALIAS_NOMS.length)];
        alias = `${randPrenom} ${randNom}`;
        break;
      }
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

  // Gestion locale de l'état de licence dans le moteur
  let isLicenseActive = true;
  function refreshLicenseStatus() {
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ action: "check_license" }, (response) => {
        if (chrome.runtime.lastError) return;
        if (response && response.status) {
          isLicenseActive = response.status.active !== false;
        }
      });
    }
  }
  // Mettre à jour au démarrage
  if (typeof chrome !== "undefined" && chrome.runtime) {
    setTimeout(refreshLicenseStatus, 200);
  }
  
  // Écouter les changements dans le stockage session
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === "session" && changes.licenseStatus) {
        isLicenseActive = changes.licenseStatus.newValue.active !== false;
      }
    });
  }

  // Exposer les méthodes dans globalThis
  globalThis.PIIEngine = {
    pseudonymizeText: pseudonymizeText,
    restorePseudonymsInHTML: restorePseudonymsInHTML,
    COMMON_PRENOMS: COMMON_PRENOMS,
    COMMON_VILLES: COMMON_VILLES,
    FRENCH_STOP_WORDS: FRENCH_STOP_WORDS,
    normalizeStr: normalizeStr,
    isLicenseActive: () => isLicenseActive
  };
})();
