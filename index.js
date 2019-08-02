'use strict';

const Koa = require('koa');
const logger = require('koa-logger');
const Router = require('koa-router');
const fs = require('fs');

const {ParseDockerStream} = require('./transform');

const app = new Koa();
const router = new Router();

const agent = require('superagent').agent()
    .use(require('superagent-logger'));

const containers = {};

const journalDriver = (config) => {


    return {
        checkJournalToken: () => agent.get(`https://api.hyperone.com/v1/logArchive/${config['journal-id']}`)
            .set('x-auth-password', config['journal-token']),
        checkAuthToken: () => agent.get(`https://api.hyperone.com/v1/logArchive/${config['journal-id']}`)
            .set('x-auth-token', config['auth-token']),
        send: (msgs) => new Promise((resolve, reject) => agent
            .post(`https://${config['journal-id']}.logArchive.pl-waw-1.hyperone.cloud/event`)
            .send(Array.isArray(msgs) ? msgs : [msgs])
            .set('x-auth-password', config['journal-token'])
            .then(resolve)
            .catch(reject)
        ),
        // read: (read_config) => {
        //
        // }
    };
};

const parseBody = async (ctx, next) => {
    if (!['POST'].includes(ctx.request.method)) {
        return next();
    }

    const textBody = await new Promise((resolve, reject) => {
        const buffer = [];
        ctx.req.on('error', reject);
        ctx.req.on('data', data => buffer.push(data));
        ctx.req.on('end', () => {
            return resolve(Buffer.concat(buffer).toString('utf-8'));
        });
    });
    if (textBody.length > 0) {
        ctx.request.body = JSON.parse(textBody);
    }
    return next();
};

const flushLogBuffer = log => {
    const bufferLength = log.buffer.length;
    const req = log.journal.send(log.buffer
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

router.get('/', ctx => {
    ctx.body = {
        Implements: ['LogDriver'],
    };
});

router.post('/LogDriver.StartLogging', async ctx => {
    const stream = fs.createReadStream(ctx.request.body.File);
    console.dir({body: ctx.request.body}, {depth: null});

    ['journal-id', 'auth-token', 'journal-token'].forEach(name => {
        if (!ctx.request.body.Info.Config[name]) {
            return ctx.throw(400, `Missing '${name} option of log driver`);
        }
    });

    const log = {
        stream,
        info: ctx.request.body.Info,
        journal: journalDriver(ctx.request.body.Info.Config),
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

    log.interval = setInterval(flushLogBuffer, 15000, log);

    try {
        await log.journal.checkJournalToken();
    } catch (err) {
        throw ctx.throw(400, 'Invalid journal-token');
    }

    try {
        await log.journal.checkAuthToken();
    } catch (err) {
        throw ctx.throw(400, 'Invalid auth-token');
    }

    containers[ctx.request.body.File] = log;

    stream.pipe(new ParseDockerStream()).on('data', msg => {
        log.stats.entry.received += 1;
        log.buffer.push({
            source: msg.source,
            time: msg.time_nano,
            line: msg.line.toString('utf-8'),
        });
        if (log.buffer.length > 1000) {
            flushLogBuffer(log);
        }
    });

    stream.on('close', () => {
        clearInterval(containers[ctx.request.body.File].interval);
        delete containers[ctx.request.body.File];
    });

    ctx.body = {};
});

router.post('/LogDriver.StopLogging', async ctx => {
    console.log({body: ctx.request.body});
    const log = containers[ctx.request.body.File];
    await Promise.all(log.requests);
    console.log(ctx.request.body.File, 'Waiting to read all data of log.');
    for (;;) {
        // We must read everything before we responds.
        // However, the file being read is FIFO, which, as a rule, has no end.
        // The kernel maintains exactly the pipe for each FIFO special file
        // that is opened by at least one process.
        const start = log.stream.bytesRead;
        await new Promise(resolve => setTimeout(resolve, 50));
        if (log.stream.bytesRead === start) break;
    }
    log.stream.close();
    flushLogBuffer(log);
    console.log(ctx.request.body.File, `Finishing log with ${log.requests.size} in fly.`);
    await Promise.all(log.requests);
    console.log(ctx.request.body.File, 'Finished processing log with following stats: ', log.stats);
    ctx.body = {};
});

router.post('/LogDriver.Capabilities', ctx => {
    ctx.body = {
        Cap: {
            ReadLogs: false,
        },
    };
});

router.post('/LogDriver.ReadLogs', ctx => {
    ctx.type = 'application/x-json-stream';

    // ctx.body = encode({
    //     source: 'stdout',
    //     time_nano: new Date() * 1000,
    //     line: Buffer.from(new Date().toString()),
    //     partial: false,
    //     partial_log_metadata: null
    // });
});

app.use(async (ctx, next) => {
    try {
        return await next();
    } catch (err) {
        ctx.status = err.status || 500;
        ctx.body = {Err: err.message};
        ctx.app.emit('error', err, ctx);
    }
});

app
    .use(logger())
    .use(parseBody)
    .use(router.routes())
    .use(router.allowedMethods())
    .listen(process.env.PORT || '/run/docker/plugins/h1-journal.sock', function () {
        console.log('listening on', this.address());
    });
