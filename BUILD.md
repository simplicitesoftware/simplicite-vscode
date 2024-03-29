![Simplicit&eacute; Software](https://platform.simplicite.io/logos/logo250-grey.png)
* * *

Prepare
=======

Look for updates:

```bash
npm run ncu
```

Install dependencies:

```bash
npm install
```

Build
=====

Check syntax and rules:

```bash
npm run lint
```

Build and package :

```bash
npm run package
```

Publish
=====

To the **vscode marketplace** registry
--------------------------------------

Install or update the `vsce` CLI:

```bash
npm <install|update> -g vsce
```

Connect to the vsce API (you need an access token that you can create [here](https://dev.azure.com/simplicite/_usersSettings/tokens)):

```bash
vsce login SimpliciteSoftware
```

Built the vsix file:

```bash
vsce package
```

or builds **and** publish the vsix file to the registry:

```bash
vsce publish
```

publish as **pre-release**

```bash
vsce publish --pre-release
```

To the *open vsx* registry
--------------------------

Install or update the `ovsx` CLI:

```bash
npm <install|update> -g ovsx
```

Build the vsix file:

```bash
vsce package
```

Publish the vsix file to the registry (you need an access token):

```bash
ovsx publish simplicite-vscode-tools-<x.y.z>.vsix -p <token>
```


