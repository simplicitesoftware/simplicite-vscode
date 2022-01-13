![Simplicit&eacute; Software](https://www.simplicite.io/resources/logos/logo250-grey.png)
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

Package into a vsix file:

```bash
vsce package
```

Publish
=====

To the **vscode marketplace** registry
--------------------------------------

Install or update the `vsce` CLI:

```bash
npm <install|update> -g vsce
```

Connect to the vsce API (you need an access token):

```bash
vsce login SimpliciteSoftware
```

Build the vsix file:

```bash
vsce package
```

Publish the vsix file to the registry:

```bash
vsce publish
```

To the *open vsx* registry
--------------------------

Install or update the `ovsx` CLI:

```bash
npm <install|update> -g ovsx
```

Publish the vsix file to the registry (you need an access token):

```bash
ovsx publish simplicite-vscode-tools-<x.y.z>.vsix -p <token>
```


