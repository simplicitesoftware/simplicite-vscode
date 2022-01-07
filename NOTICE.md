Lien api VSCode : https://code.visualstudio.com/api/

**package.json** :
Manifeste d'extension, contient les informations relatives à l'extension (nom, version, repository), les points de contributions (commandes, options de paramétrages, tree view) ainsi que les attributs de nodejs (dependances).
Les attributs "browser" et "main" sont les points d'entrées de l'extension lorsque cette dernière est packagée sous forme de vsix (https://marketplace.visualstudio.com/items?itemName=onlyutkarsh.vsix-viewer --> pour regarder le contenu d'un vsix)

Paramètres de l'extension :
Définis dans le package.json, ils sont accessibles directement les paramètres VSCode. Exemple pour accéder à la valeur d'un paramètre : ***workspace.getConfiguration('simplicite-vscode-tools').get('api.autoAuthentication')***
PI : 
- sendFileOnSave --> permet d'appliquer les changements lors de la sauvegarde. La tree view des fichiers n'est plus affichées dans ce cas.
- localCompilation --> désactivé car pas sûr de la pertinence de cette action. Lourde opération qui est déjà faite en backend.

**extension.ts** est le point d'entrée de l'extension. La fonction ***activate*** est appelée lorsque VSCode a fini de charger (voir l'attribut activationEvents dans le package.json). On y retrouve l'initialisation des objets, l'initialisation des éventuels api file systems, la détection de la sauvegarde des fichiers, la gestion du workspace, la détection de l'éditeur ouvert pour le service de complétion.

**SimpliciteApi.ts** regroupe les méthodes responsables uniquement d'un appel à l'api d'une instance simplicité.

**SimpliciteApiController.ts** est le controlleur des actions liées à l'api.

**ApiFileSystemController.ts** est responsable de la création d'un module via l'api --> création de l'arborescence du projet et des fichiers.

**AppHandler.ts** stocke l'objet app de la lib npm simplicite sous la forme d'un tableau associatif. Chaque objet app correspond à une instance simplicité.

**BarItem.ts** affiche "Simplicite" dans la barre de status VSCode (en bas à droite). Cliquer sur ce composant ouvre le QuickPick (toutes les commandes de l'extension). Sur la version desktop, passer la souris au dessus affichera un markdown des instances connectés, pour les autres environnement (markdown non supporté) il s'agit uniquement d'une liste des url des instances connectées.

**Cache.ts** stocke le row_id des objets précedemment envoyés sous la forme d'un tableau associatif.

**commands.ts** initialise toutes les commandes et les ajoute au contexte de l'application.

**CompletionProvider.ts** implémente CompletionItemProvider (voir api VSCode). Cette classe est initalisée lorsque l'éditeur ouvert est un fichier simplicité dans lequel la complétion peut être proposée (voir fonction prodiverMaker dans extension.js).

**FileHandler** détecte les fichiers des modules et initialise les fichiers temporaires pour la résolution des conflits. Le chemin du dossier temporaire est fourni par VSCode via la variable contexte passé en argument de la fonction *activate* (context.globalStorageUri.path).
Applique les valeurs stockées en persistance (setTrackedStatusPersistence).

**Logs.ts** affiche des logs dans la console et écrit un fichier dans le contexte desktop (le chemin est créé à partir de context.globalStorageUri.path).

**Module.ts** contient une classe représentant la présence d'un module dans le workspace

**ModuleHandler.ts** détecte les modules du workspace et applique les valeurs de persistance.

**QuickPick.ts** implémente QuickPick (voir api VSCode). Affiche les commandes simplicité, à l'exception de quelques unes (voir condition dans la méthode commandListQuickPick).

**Dossier treeView** : 
Les classes FileTree et ModuleInfoTree implémentent TreeDataProvider (voir api VSCode).
- FileTree.ts : Tree view de la gestion des fichiers. N'est affiché qu'avec le mode "manuel" d'application des modifications (!== sendFileOnSave).
- ModuleInfoTree.ts : Tree view affichant les moduleDevInfo
- treeViewClasses.ts : contient les classes utilisées par FileTree.
Les tree views doivent être ajoutés via la méthode "window.registerTreeDataProvider()" et être déclarées dans le package.json.
Les attributs relatifs aux tree views (package.json) sont les suivants : "viewsWelcome", "view/item/context", "view/title", "explorer".
Les boutons / interactions possibles avec les tree views se font grâce aux commandes.

Points d'améliorations :
Message + pertinent pour les erreurs de compilation en backend.
Enrichir le devInfo avec les infos des ressources (voir méthode getBusinessObjectType dans File.ts).
Enrichir le moduleDevInfo avec les chemins des fichiers pour faciliter la construction d'un module via l'api file system (ApiFileSystemController.ts : les méthodes createFolderTree et getAllFiles peuvent être simplifiées).

//

quickPick shortcut
barItem: Icon .svg ?
condition on logs to write log file when desktop

//