# Name
    jamsedu - A feature rich static site generator designed for open source
              content[More info here](https://github.com/caboodle-tech/jams-edu)

# Synopsis
    jamsedu [options] [arguments]

# Description
    A feature-rich yet user-friendly static site generator designed specifically
    for open-source content. Originally developed to facilitate rapid creation
    and deployment of university courses, JamsEdu offers an ideal solution for
    non-technical users to swiftly build dynamic static websites.

# Options
    build, -build, --build
        Perform a one time build of the sites source files.

    h, -h, --h, help, -help, --help
        Display JamsEdu's manual page; what your currently reading.

    init, -init, --init
        Initializes a new JamsEdu project; follow terminal prompts to complete
        the setup process.

    man, -man, --man
        Alias for the `h` (`help`) option.

    verbose, -verbose, --verbose
        Enable verbose mode which prints additional information to the console.
    
    watch, -watch, --watch
        Starts a local server to view live changes to the sites files and also
        starts a watcher that auto builds the site source files when changed.

    update, -update, --update
        Interactive update utility for JamsEdu template files and components.
        Guides you through updating TinyDocument, TinyWysiwyg, CSS components,
        ESLint configuration, and documentation. Creates backups automatically
        and allows selective component updates with conflict resolution.

    restore-backup, -restore-backup, --restore-backup TIMESTAMP
        Restore your project from a backup created during an update operation.
        Provide the timestamp of the backup you wish to restore (format:
        YYYY-MM-DD-HH-MM-SS).

    restore, -restore, --restore [PORT1] [PORT2] ...
        Clear ports by terminating processes that are using them. Useful for
        freeing ports blocked by orphaned or unresponsive server processes.
        You can provide one or more port numbers. The command will prompt you
        to confirm before killing each process.

# Arguments
    -config FILE, --config=FILE
        The relative path from the projects root to the config file to use, file
        extension included. By default `.jamsedu/config.js` is searched for and
        automatically used when this argument is missing.

    PORT1 [PORT2] ...
        Port numbers to clear when using the restore command. Can be used with
        `--restore` flag or as standalone arguments (e.g., `jamsedu 5000 5001`).
