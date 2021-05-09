# BIN
The files in this directory are the key to the JamsEDU CLI application.

### CLI
The `cli.js` file loads the JamsEDU CLI application and all the other components it needs from the components folder.

### Globals
The `globals` file is for setting global variables that should be available to every compiler. This is a good place to set variables you know will be used often by many files. This saves resources by removing the need to duplicate this variable in all the files that need it. Here is an example of making a organization variable that holds an organizations name:

```
${{ORG}} = "Caboodle Tech Inc.";
```

**NOTE:** that you should use double quotes and not single quotes when declaring a JamsEDU variable. There should only be one variable per line and each line should end with a semi-colon.

### Settings
The `settings.json` file contains all the settings you want your project to use. You can set which files and directories will be compiled and which ones to ignore. You can also add new file types, compilers, and restrict which types of files are allowed in your released project.