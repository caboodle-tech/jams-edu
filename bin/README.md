# bin
The files in this directory are the key to the JamsEDU CLI application.

## globals
---
The `globals` file is for setting global variables that should be available to every compiler. This is a good place to set variables you know will be used often by many files. This saves resources by removing the need to duplicate this variable in all the files that need it. Here is an example of making a organization variable that holds an organizations name:

```
${{ORG}} = "Caboodle Tech Inc.";
```

**NOTE:** that you should use double quotes and not single quotes when declaring a JamsEDU variable. There should only be one variable per line and each line should end with a semi-colon.

## settings.json
---
The `settings.json` file contains all the settings you want your site (project) to use. You can set which files and directories to ignore during compiling. You can also control the supported (allowed to compile) file types and compilers from this file.