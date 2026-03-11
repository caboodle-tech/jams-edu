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
    backup, -backup, --backup
        Create a full site backup (tar.gz) of the project. Stored in
        .jamsedu/backups/ as site-backup-<timestamp>.tar.gz. Archive root
        is the project root (no leading directory). Excludes only
        node_modules, .jamsedu/backups, and .git. Includes .gitignore,
        .vscode, .jamsedu (config/manifest), and other dotfiles. Requires
        "tar" on your PATH.

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
        Interactive update for JamsEdu template files. Lets you choose which
        components to update, creates backups when needed, and handles conflicts
        per file (overwrite, skip, or backup then overwrite).

    force, -force, --force
        With --update: include files marked as customized and overwrite them
        with the template versions. Use this to reset or downgrade customized
        files to the JamsEdu template even when there are no new updates. Use
        with caution.

    restore-backup, -restore-backup, --restore-backup TIMESTAMP
        Restore all files from a backup created during an update (by timestamp;
        format YYYY-MM-DD-HH-MM-SS). This restores the whole backup, not
        individual files. To restore a single file, copy it from the backup
        folder under .jamsedu/backups/<timestamp>/.

    restore, -restore, --restore [PORT1] [PORT2] ...
        Clear ports by terminating processes that are using them. Useful for
        freeing ports blocked by orphaned or unresponsive server processes.
        You can provide one or more port numbers. The command will prompt you
        to confirm before killing each process.

    where, -where, --where
        Print the absolute path where JamsEdu is installed and running from.

# Arguments
    -config FILE, --config=FILE
        The path to the config file to use (relative to the project root), file
        extension included. You can use any file as the config as long as you
        specify it here. By default `.jamsedu/config.js` is used.

    PORT1 [PORT2] ...
        Port numbers to clear when using the restore command. Can be used with
        `--restore` flag or as standalone arguments (e.g., `jamsedu 5000 5001`).
