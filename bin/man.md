# Name
    jamsedu - A Jam Stack app for Educational websites:
              [More info here](https://github.com/caboodle-tech/jams-edu)

# Synopsis
    jamsedu [options] [arguments]

# Description
    This will come later.

# Options
    build, -build, --build
        Perform a one time build of the sites source files.

    init, -init, --init
        Initializes a new JamsEDU project; follow terminal prompts to complete
        the setup process.
    
    watch, -watch, --watch
        Starts a local server to view live changes to the sites files and also
        starts a watcher that auto builds the site source files when changed.

# Arguments
    -config FILE, --config=FILE
        The relative path from the projects root to the config file to use, file
        extension included. By default `jamsedu.config.js` is searched for and
        automatically used when this argument is missing.