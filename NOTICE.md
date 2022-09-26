Lien api VSCode : https://code.visualstudio.com/api/

## package.json :
Manifeste d'extension, contient les informations relatives à l'extension (nom, version, repository), les points de contributions (commandes, options de paramétrages, tree view) ainsi que les attributs de nodejs (dependances).
Les attributs "browser" et "main" sont les points d'entrés de l'extension lorsque cette dernière est packagée sous forme de vsix (https://marketplace.visualstudio.com/items?itemName=onlyutkarsh.vsix-viewer --> pour regarder le contenu d'un vsix)

## Paramètres de l'extension :
Définis dans le package.json, ils sont accessibles directement dans les paramètres VSCode (*File > Preferences > Settings > Extensions > Simplicite VSCode tools > Api: Send File On Save*). Exemple pour accéder à la valeur d'un paramètre :  `workspace.getConfiguration('simplicite-vscode-tools').get('api.autoAuthentication')`.

PI : 
sendFileOnSave --> permet d'appliquer les changements lors de la sauvegarde. La tree view des fichiers n'est plus affichée dans ce cas car plus pertinente.

## extension.ts :
Est le point d'entrée de l'extension. La fonction `activate()` est appelée lorsque VSCode a fini de charger (voir l'attribut activationEvents dans le package.json). On y retrouve l'initialisation des objets, la détection de la sauvegarde des fichiers, la gestion du workspace, la détection de l'éditeur ouvert pour le service de complétion.

## SimpliciteApi.ts :
Regroupe les méthodes responsables uniquement d'un appel à l'api d'une instance simplicité.

## SimpliciteApiController.ts :
Est le controlleur des actions liées à l'api.

## ApiFileSystemController.ts :
Est responsable de la création d'un module via l'api --> création de l'arborescence du projet et des fichiers.

## AppHandler.ts :
Stocke l'objet app de la lib npm simplicite sous la forme d'un tableau associatif. Chaque objet app correspond à une instance simplicité.

## BarItem.ts :
Affiche "Simplicite" dans la barre de status VSCode (en bas à droite). Cliquer sur ce composant ouvre le QuickPick (toutes les commandes de l'extension). Sur la version desktop, passer la souris au dessus affichera un markdown des instances connectés, pour les autres environnement (markdown non supporté) il s'agit uniquement d'une liste des url des instances connectées.

## commands.ts :
Initialise toutes les commandes et les ajoute au contexte de l'application.

## CompletionProvider.ts :
Implémente CompletionItemProvider (voir api VSCode). Cette classe est initalisée lorsque l'éditeur ouvert est un fichier simplicité dans lequel la complétion peut être proposée (voir fonction prodiverMaker dans extension.js).

## FileHandler :
Détecte les fichiers des modules et initialise les fichiers temporaires pour la résolution des conflits. Le chemin du dossier temporaire est fourni par VSCode via la variable contexte passé en argument de la fonction *activate* (context.globalStorageUri.path).
Applique les valeurs stockées en persistance (setTrackedStatusPersistence).
Le type, le row_id et d'autres attributs necessaires à l'envoi des fichiers via l'api sont attribués une fois que le moduleDevInfo est fetch.

## Logs.ts :
Affiche des logs dans la console et écrit un fichier dans le contexte desktop (le chemin est créé à partir de context.globalStorageUri.path).

## Module.ts :
Contient une classe représentant la présence d'un module dans le workspace.

## ModuleHandler.ts :
Détecte les modules du workspace et applique les valeurs de persistance.

## QuickPick.ts :
Implémente QuickPick (voir api VSCode). Affiche les commandes simplicité, à l'exception de quelques unes (voir condition dans la méthode commandListQuickPick).

## Dossier treeView : 
Les classes FileTree et ModuleInfoTree implémentent TreeDataProvider (voir api VSCode).
- FileTree.ts : Tree view de la gestion des fichiers. N'est affiché qu'avec le mode "manuel" d'application des modifications (sendFileOnSave == false).
- ModuleInfoTree.ts : Tree view affichant les moduleDevInfo
- treeViewClasses.ts : contient les classes utilisées par FileTree.
Les tree views doivent être ajoutées via la méthode "window.registerTreeDataProvider()" et être déclarées dans le package.json.
Les attributs relatifs aux tree views (package.json) sont les suivants : "viewsWelcome", "view/item/context", "view/title", "explorer".
Les boutons / interactions possibles avec les tree views se font grâce aux commandes.

## Points d'améliorations :
Traductions anglais français.

Ecrire les logs dans un fichier quand le contexte l'autorise + améliorer la pertinence des messages.

Remote file system quand les virtuals file systems seront supportés sur les versions VS Code web (https://code.visualstudio.com/api/extension-guides/virtual-documents). L'implémentation ne devrait pas poser trop de problèmes car tous les accès au filesystem se font via l'api vscode: `vscode.workspace.fs`.

Ne pas afficher les commandes inutiles lorsque le parametre sendFileOnSave est true ou afficher un message précisant que ces commandes n'auront pas d'effets.

Tester l'extension sur mac, versions web, Theia.

## Note diverses :
A ce jour, les extensions java (redhat et microsoft) ne sont pas compatibles avec VS Code web.

Comparatif de la compatibilité de l'api VS Code avec Api Theia: https://eclipse-theia.github.io/vscode-theia-comparator/status.html