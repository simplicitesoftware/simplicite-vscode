# Simplicite VSCode

This extension provides an easy way to edit the java files of one or multiple simplicite modules and apply changes without having to commit & push.


![login-apply](images/login-apply.gif)

---

## How does it work ?

Simply add your modules into the vscode workspace. Then authenticate yourself using the credentials of **each simplicite instance** you need to log in.
Opening the same workspace will **automatically connect you**.

From now on, you can edit your java files and run the command: `Simplicite: Apply change(s)` to load the files on your simplicite instance(s).\

*NB: the extension only works with java files*

---

## Available commands
* `Simplicite: Log into detected modules`: manually connects to all detected modules.
* `Simplicite: Log into a specific module`: asks for the name of the module you want to log in (name of the folder).
* `Simplicite: Log out from all modules`: disconnects all the modules. You will need to manually reconnect after doing this command.
* `Simplicite: Log out from a specific module`: asks for the name of the module you want to log out (name of the folder). 
* `Simplicite: Apply changes`: loads the java files into their modules You need to be connected to do so.
* `Simplicite: Get the list of connected instances`: gives you the list of the connected instances.
* `Simplicite: Get the list of modified files`: gives you the list of modified java files.

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
