# Simplicite VSCode

This extension provides an easy way to edit the java files of one or multiple simplicite modules and apply changes without having to commit & push.


![login-apply](images/login-apply.gif)

---

## How does it work ?

Simply add your modules into the vscode workspace. Then authenticate yourself using the credentials of **each simplicite instance** you need to log in.
Opening the same workspace will **automatically connect you**.

From now on, you can edit your java files and run the command: `Simplicite: Apply change(s)` to load the files on your simplicite instance(s).

*NB: the extension only works with java files*

---

## Available commands
* `Simplicite: Log into detected instances`: connects to the instances that have been detected in the modules contained in the workspace.
* `Simplicite: Log into a specific instance`: expects the url of your instance or the name of the module related to this instance, then connects you.
* `Simplicite: Log out from all instances`: disconnects all the instances. You will need to manually reconnect after executing this command.
* `Simplicite: Log out from a specific instance`: asks for the name of the module you want to log out (name of the folder). 
* `Simplicite: Apply changes`: loads the java files into their modules You need to be connected to do so.
* `Simplicite: Get the list of connected instances`: gives you the list of the connected instances.
* `Simplicite: Compile the java code in your current workspace`: executes the compilation command of the [vscode-java extension](https://github.com/redhat-developer/vscode-java). Note that it executes the code inside the workspace.

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
