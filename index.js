'use strict';

const Koa = require('koa');
const coBody = require('co-body');
const logger = require('koa-logger');
const Router = require('koa-router');
const fs = require('fs');

const { ParseDockerStream, EncodeDockerStream } = require('./transform');

const app = new Koa();
const router = new Router();

const driver = require('./driver')();

router.get('/', ctx => {
    ctx.body = {
        Implements: ['LogDriver'],
    };
});

router.post('/LogDriver.StartLogging', async ctx => {
    const stream = fs.createReadStream(ctx.request.body.File).pipe(new ParseDockerStream());
    console.dir({ body: ctx.request.body }, { depth: null });
    const { File, Info } = ctx.request.body;
    ctx.body = await driver.startLogging(stream, File, Info);
});

router.post('/LogDriver.StopLogging', async ctx => {
    const { File } = ctx.request.body;
    ctx.body = await driver.stopLogging(File);
});

router.post('/LogDriver.Capabilities', ctx => {
    ctx.body = {
        Cap: {
            ReadLogs: !!driver.readLogs,
        },
    };
});

router.post('/LogDriver.ReadLogs', async ctx => {
    ctx.type = 'application/x-json-stream';
    console.log({ body: ctx.request.body }, { depth: null });
    const { Info, Config } = ctx.request.body;
    const stream = (await driver.readLogs(Info, Config))
        .pipe(new EncodeDockerStream());
    ctx.status = 200;
    ctx.response.flushHeaders();
    stream.resume();
    ctx.body = stream;
});

app
    .use(logger())
    .use(async (ctx, next) => {
        try {
            return await next();
        } catch (err) {
            ctx.status = err.status || 500;
            ctx.body = { Err: err.message };
            ctx.app.emit('error', err, ctx);
        }
    })
    .use(async (ctx, next) => {
        ctx.request.body = await coBody.json(ctx.req, { limit: '10kb' });
        return next();
    })
    .use(router.routes())
    .use(router.allowedMethods())
    .listen(process.env.PORT || '/run/docker/plugins/h1-journal.sock', function () {
        console.log('listening on', this.address());
    });
