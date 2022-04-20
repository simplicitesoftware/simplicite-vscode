![Simplicit&eacute; Software](https://www.simplicite.io/resources/logos/logo250-grey.png)
* * *

Change Log
==========

All notable changes to the "simplicite-vscode" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

* * *

[1.0.21]
--------

### Added
- Various code snippets
- Completion on values typed in commands such as urls, modules name and api modules name. 

### Changed
- New behavior for api module => an api module in an undefined workspace will be deleted on vscode closing. While in a defined workspace, the module will persists.

### Fixed
- Connexion prompt won't appear multiple time when instance is already connected

* * *

[1.0.20]
--------

### Updated
- Updated dependencies

* * *

[1.0.19]
--------

### Fixed
- Using get on row ID instead of search on name/code

### Updated
- Updated dependencies

* * *

[1.0.18]
--------

### Changed
- Simplicite lib

* * *

[1.0.17]
--------

### Added
- Api file system

### Changed
- Readme

### Modified
- Many internal refactors

* * *

[1.0.15]
--------

### Added
- Refresh modified file handler button and command

### Fixed
- Fixed a bug that occured when the project folder name was different than the module name

* * *

[1.0.14]
--------

### Added
- Refresh tree view button and command

* * *

[1.0.13]
--------

### Changed
- Changes with simplicite npm lib

* * *

[1.0.11]
--------

### Changed
- Updated simplicite module

* * *

[1.0.10]
--------

### Changed
- Vscode engine ^1.52.0 instead of ^1.60.0 for theia compatibility

### Removed
- Readme character

* * *

[1.0.7]
-------

### Added
- Theia compatibility

* * *

[1.0.6]
-------

### Modified
- Code for web compatibility.

### Removed
- Language Support for Java(TM) by Red Hat from the extension dependencies, because it is not yet supported on browsers.

* * *

[1.0.5]
-------

### Added
- Feature to change Simplicite resource files such as *.css*, *.less*, *.js*, *.html*, *.md*, *.xml*, *.xml*, *.txt*, *.yaml*.
- File icons in the file tree view. 

### Removed
- Feature to track/untrack a file only with its file name, due to the implementation of the resource files that implies that some files have the same name.

* * *

[1.0.4]
-------

### Changed
- Mostly refactored some code.

* * *

[1.0.3]
-------

### Added
- Module info tree view copy label on double click. 

* * *

[1.0.2]
-------

### Changed
- Commands name.
### Removed
- Refresh tree view command and button.
- Modified file list from bar item.

* * *

[1.0.1]
-------

### Added
- Completion on internal object fields.
- Apply changes features.
- Automatic connexion.
- Tree views.
