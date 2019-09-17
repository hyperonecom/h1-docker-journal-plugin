'use strict';
const test = require('ava');

const { Readable } = require('stream');

const driver = require('./../driver');

const getRandom = () => (+new Date()).toString(36);

const hasCredentialEnv = fn => async (t, ...args) => {
    const missing = [
        'JOURNAL_ID', 'JOURNAL_TOKEN',
    ].filter(x => !process.env[x]);

    if (missing.length > 0) {
        t.fail(`Missing environment variables: ${missing.join(', ')}.`);
    }
    await fn(t, ...args);
};

class LogGenerator extends Readable {
    constructor(opt) {
        super({ objectMode: true, ...opt });
        this._max = 100;
        this._index = 1;
    }

    _read() {
        const i = this._index++;
        if (i > this._max)
            this.push(null);
        else {
            this.push({
                source: 'stdout',
                line: String(i),
            });
        }
    }
}

const defaultInfo = () => ({
    Config: {
        'journal-fqdn': `${process.env.JOURNAL_ID}.journal.pl-waw-1.hyperone.cloud`,
        'journal-token': process.env.JOURNAL_TOKEN,
    },
    ContainerID: getRandom(),
    ContainerName: '/confident_carson',
    ContainerEntrypoint: 'sh',
    ContainerArgs: [],
    ContainerImageID: 'sha256:...',
    ContainerImageName: 'alpine',
    ContainerCreated: '2019-08-03T15:18:16.671601144Z',
    ContainerEnv: [],
    ContainerLabels: [],
    LogPath: '',
    DaemonName: 'docker',
});

test.serial('driver.startLogging with credentials starts', hasCredentialEnv(async t => {
    const d = driver();
    const stream = new LogGenerator();
    const resp = await d.startLogging(stream, '/tmp/file.sock', defaultInfo());
    t.true(!!resp);
    stream.destroy();
}));

test.serial('driver.stopLogging', hasCredentialEnv(async t => {
    const d = driver();
    const stream = new LogGenerator();
    const file = '/tmp/file.sock';
    await d.startLogging(stream, file, defaultInfo());
    const resp = d.stopLogging(file);
    stream.destroy();
    t.true(!!resp);
}));

test.serial('driver.stopLogging without credentials raise error', async t => {
    const d = driver();
    const stream = new LogGenerator();
    const file = '/tmp/file.sock';
    await t.throwsAsync(() => d.startLogging(stream, file, { ...defaultInfo(), Config: {} }));
});

test.serial('driver.startLogging consume logs', hasCredentialEnv(async t => {
    const d = driver();
    const stream = new LogGenerator();
    const file = '/tmp/file.sock';
    await d.startLogging(stream, file, defaultInfo());
    await d.stopLogging(file);
    t.true(stream._index > 100);
}));

test.serial('driver.startLogging consume & reads logs from journal', hasCredentialEnv(async t => {
    const d = driver();
    const token = getRandom();
    const instream = new Readable.from([
        {
            time_nano: +new Date(),
            source: 'stdout',
            line: Buffer.from(token),
        },
    ]);
    const file = '/tmp/file.sock';
    const info = defaultInfo();
    await d.startLogging(instream, file, info);
    await d.stopLogging(file);
    const outstream = await d.readLogs(info, {
        Follow: false,
    });
    let found = false;
    outstream.on('data', msg => {
        found = found || msg.line.toString() === token;
    });
    await new Promise(resolve => {
        outstream.on('end', resolve);
        outstream.resume();
    });
    t.true(found);
}));
