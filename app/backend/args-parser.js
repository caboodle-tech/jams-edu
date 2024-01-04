import Process from 'process';

class ArgParser {

    static parse(argv) {

        const parsedArgs = {
            cwd: Process.cwd(),
            executing: argv[1],
            execPath: argv[0]
        };

        argv.splice(0, 2);

        for (let i = 0; i < argv.length; i++) {
            const arg = argv[i];

            if (arg.startsWith('--')) {
                const key = arg.slice(2);
                let value = true;

                if (i + 1 < argv.length && !argv[i + 1].startsWith('-')) {
                    value = argv[i + 1];
                    i += 1;
                }

                parsedArgs[key] = value;
            } else if (arg.startsWith('-')) {
                const key = arg.slice(1);
                let value = true;

                if (i + 1 < argv.length && !argv[i + 1].startsWith('-')) {
                    value = argv[i + 1];
                    i += 1;
                }

                parsedArgs[key] = value;
            } else {
                parsedArgs[arg] = true;
            }
        }

        return parsedArgs;
    }

}

export default ArgParser;
