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

Package into a vsix file
```bash
vsce package
```

Publish
=====
### To the *vscode marketplace*:
Connect to the vsce API, you'll need an access token
```bash
vsce login SimpliciteSoftware
```

Publish vsix to the marketplace
```bash
vsce publish
```
### To *open vsx*

Publish vxis to open vsx
```bash
ovsx publish simplicite-vscode-tools-<x.y.z>.vsix -p <token>
```


