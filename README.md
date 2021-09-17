# Simplicite VSCode

This extension provides an easy way to edit the java files of one or multiple simplicite modules and apply changes without having to commit & push.

---

## Features
- Simplified workflow for designers who prefer to edit java code in their favorite IDE.
- Field completion on your modules objects fields.
- Automatic authentication on the Simplicite API.

![login-apply](ressources/images/login-apply.gif)

---

## How does it work ?

Simply add your modules into the vscode workspace. Then authenticate yourself using the credentials of **each simplicite instance** you need to log in.
Opening the same workspace will **automatically connect you**.

From now on, you can edit your java files and run the command: `Simplicite: Apply change(s)` to load the files on your simplicite instance(s).

*NB: the extension only works with java files*

---

## Available commands
* `Simplicite: Apply changes`: loads the java files into their modules. Requires to be logged in.
* `Simplicite: Compile java code in current workspace`: executes the compilation command of the [vscode-java extension](https://github.com/redhat-developer/vscode-java).
* `Simplicite: Log into detected instances`: logs into the instances that have been detected in the modules contained in the workspace.
* `Simplicite: Log into specific instance`: logs into a specific instance. Both module name and instance url are accepted.
* `Simplicite: Log out from all instances`: logs out all the instances.
* `Simplicite: Log out from specific instance`: logs out a specific instance. Both module name and instance url are accepted. 

* `Simplicite: Get list of connected instances`: gives you the list of the connected instances.


---

## Extension Settings

Incoming

---

## Known Issues

* Using multiple VSCode instances with various simplicite modules will result in some conflict.

---

## Release Notes

### 0.0.1

Initial release

---
