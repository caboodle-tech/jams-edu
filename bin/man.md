# Name
    jamsedu - A Jam Stack app for educational websites:
              [More info here](https://github.com/caboodle-tech/jams-edu)

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

# Arguments
    -config FILE, --config=FILE
        The relative path from the projects root to the config file to use, file
        extension included. By default `jamsedu.config.js` is searched for and
        automatically used when this argument is missing.
