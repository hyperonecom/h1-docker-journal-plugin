'use strict';

const journalClient = require('./journal');
const { ParseJournalStream } = require('./transform');

module.exports = () => {
    const containers = {};

    const flushLogBuffer = log => {
        const bufferLength = log.buffer.length;
        const req = log.client.send(log.buffer
        ).catch(err => {
            console.log(err);
            log.stats.entry.failure += bufferLength;
            log.stats.requests.failure += 1;
        }).then(() => {
            log.stats.entry.success += bufferLength;
            log.stats.requests.success += 1;
        }).finally(() => {
            log.requests.delete(req);
            if (log.requests.size < 400) {
                log.stream.resume();
            }
        });

        log.stats.entry.send += bufferLength;
        log.stats.requests.send += 1;

        log.buffer = [];
        log.requests.add(req);

        if (log.requests.size > 500) {
            log.stream.pause();
            console.error('Log consumer paused. Too many pending requests');
        }
    };
    const driver = {};

    driver.startLogging = async (stream, File, Info) => {
        ['journal-id', 'journal-token'].forEach(name => {
            if (!Info.Config[name]) {
                throw new Error(`Missing '${name} option of log driver`);
            }
        });
        const log = {
            stream,
            info: Info,
            client: journalClient(Info.Config),
            requests: new Set(),
            buffer: [],
            stats: {
                entry: {
                    received: 0,
                    send: 0,
                    success: 0,
                    failure: 0,
                },
                requests: {
                    send: 0,
                    success: 0,
                    failure: 0,
                },
            },
        };
        try {
            await log.client.checkJournalToken();
        } catch (err) {
            console.error(err);
            throw new Error('Invalid journal-token');
        }
        log.interval = setInterval(flushLogBuffer, 15000, log);

        containers[File] = log;

        stream.on('data', msg => {
            log.stats.entry.received += 1;
            msg.line = msg.line.toString('utf-8');
            msg.tag = {
                containerId: Info.ContainerID,
            };
            log.buffer.push(msg);
            if (log.buffer.length > 1000) {
                flushLogBuffer(log);
            }
        });

        stream.on('close', () => {
            clearInterval(log.interval);
            delete containers[File];
        });
        return {};
    };

    driver.stopLogging = async (File) => {
        const log = containers[File];
        console.log(File, 'Waiting to read all data of log.');
        for (; ;) {
            // We must read everything before we responds.
            // However, the file being read is FIFO, which has no end.
            // The kernel maintains the pipe for each FIFO special file
            // that is opened by at least one writer process.
            const start = log.stream.bytesRead;
            await new Promise(resolve => setTimeout(resolve, 50));
            if (log.stream.bytesRead === start) break;
        }
        log.stream.destroy();
        flushLogBuffer(log);
        console.log(File, `Finishing log with ${log.requests.size} in fly.`);
        await Promise.all(log.requests);
        console.log(File, 'Finished processing log with following stats: ', log.stats);
        return {};
    };

    driver.readLogs = async (Info, Config) => {
        // {
        //   Info: {
        //     Config: [Object],
        //     ContainerID: '...',
        //     ContainerName: '/confident_carson',
        //     ContainerEntrypoint: 'sh',
        //     ContainerArgs: [Array],
        //     ContainerImageID: 'sha256:...',
        //     ContainerImageName: 'alpine',
        //     ContainerCreated: '2019-08-03T15:18:16.671601144Z',
        //     ContainerEnv: [Array],
        //     ContainerLabels: [Object],
        //     LogPath: '',
        //     DaemonName: 'docker'
        //   },
        //   Config: {
        //     Since: '0001-01-01T00:00:00Z',
        //     Until: '0001-01-01T00:00:00Z',
        //     Tail: -1,
        //     Follow: false
        //   }
        // }
        const client = journalClient(Info.Config);
        const stream = await client.read(Config, Info);
        return stream.pipe(new ParseJournalStream());
    };

    return driver;
};
