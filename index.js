'use strict';

const Koa = require('koa');
const logger = require('koa-logger');
const Router = require('koa-router');
const fs = require('fs');
const {decode, encode, messages} = require('./parse');
const agent = require('superagent').agent();
const app = new Koa();
const router = new Router();

const containers = {};


const logArchive = (config) => {


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
        read: (read_config) => {

        }
    }
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
            return resolve(Buffer.concat(buffer).toString('utf-8'))
        });
    });
    if (textBody.length > 0) {
        ctx.request.body = JSON.parse(textBody);
    }
    return next();
};

router.get('/', ctx => {
    ctx.body = {
        "Implements": ["LogDriver"]
    }
});

router.post('/LogDriver.StartLogging', async ctx => {
    const stream = fs.createReadStream(ctx.request.body.File);
    console.dir({body: ctx.request.body}, {depth: null});

    if (!ctx.request.body.Info.Config['journal-id']) {
        return ctx.throw(400, "Missing journal-id")
    }
    if (!ctx.request.body.Info.Config['auth-token']) {
        return ctx.throw(400, "Missing auth-token")
    }

    if (!ctx.request.body.Info.Config['journal-token']) {
        return ctx.throw(400, "Missing journal-token")
    }

    const log = {
        stream,
        info: ctx.request.body.Info,
        driver: logArchive(ctx.request.body.Info.Config)
    };
    try {
        await log.driver.checkJournalToken()
    }catch(err) {
        throw ctx.throw(400, 'Invalid journal-token')
    }

    try {
        await log.driver.checkAuthToken()
    }catch(err) {
        throw ctx.throw(400, 'Invalid auth-token')
    }

    containers[ctx.request.body.File] = log;

    stream.on('readable', () => {
        let header = null;
        header = header || stream.read(4);
        while (header !== null) {
            console.log({header});
            console.log({headerHex: header.toString('hex')});
            const payload = stream.read(header.readUInt32BE());
            if (payload === null) break;
            console.log({payloadHex: payload.toString('hex')});
            const msg = messages.LogEntry.decode(payload);
            console.log({
                msg,
                msgLine: msg.line.toString('utf-8')
            });
            const requests = new Set();
            const req = log.driver.send({
                source: msg.source,
                time: msg.time_nano,
                line: msg.line.toString('utf-8')
            }).finally(() => {
                requests.delete(req);
                if (requests.size < 500) {
                    stream.resume();
                }
            });
            requests.add(req);
            if (requests.size > 2000) {
                stream.pause();
                console.error('lineReader paused.');
            }
            header = stream.read(4);
        }
    });

    stream.on('close', () => {
        delete containers[ctx.request.body.File];
    });

    ctx.body = {};
});

router.post('/LogDriver.StopLogging', async ctx => {
    console.log({body: ctx.request.body});

    containers[ctx.request.body.File].stream.destroy();

    ctx.body = {}
});

router.post('/LogDriver.Capabilities', ctx => {
    ctx.body = {
        Cap: {
            ReadLogs: false
        }
    }
});

// router.post('/LogDriver.ReadLogs', ctx => {
//     ctx.type = 'application/x-json-stream';
//
//     ctx.body = encode({
//         source: 'stdout',
//         time_nano: new Date() * 1000,
//         line: Buffer.from(new Date().toString()),
//         partial: false,
//         partial_log_metadata: null
//     });
// });

app.use(async (ctx, next) => {
    try {
        await next();
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
    .listen(process.env.PORT || "/run/docker/plugins/h1-journal.sock", function () {
        console.log('listening on', this.address());
    });
