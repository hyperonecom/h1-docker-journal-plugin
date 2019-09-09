'use strict';
const qs = require('qs');
const logger = require('superagent-logger');
const dayjs = require('dayjs');
const WebSocket = require('ws');

module.exports = (config) => {
    const url = `http://${config['journal-id']}.journal.pl-waw-1.hyperone.cloud/resource/${config['journal-id']}/log`;
    const agent = require('superagent').agent().use(logger);
    return {
        checkJournalToken: () => agent.head(url).query({follow: false})
            .set('x-auth-password', config['journal-token']),
        send: (msgs) => new Promise((resolve, reject) => agent
            .post(url)
            .send(Array.isArray(msgs) ? msgs : [msgs])
            .set('x-auth-password', config['journal-token'])
            .then(resolve)
            .catch(reject)
        ),
        read: (read_config, read_info) => new Promise((resolve, reject) => {
            const query = {
                //until: dayjs().format('YYYY-MM-DD'),
                //since: dayjs().format('YYYY-MM-DD'),
                follow: read_config.Follow,
                tag: {
                    containerId: read_info.ContainerID,
                },
            };
            console.log('query', query);

            const ws = new WebSocket(`${url}?${qs.stringify(query)}`, {
                headers: { 'x-auth-password': config['journal-token'] },
            });

            ws.on('open', () => {
                console.log(config['journal-id'], 'websocket opened');
                const stream = WebSocket.createWebSocketStream(ws);
                resolve(stream);
            });

            ws.on('close', () => {
                console.log(config['journal-id'], 'websocket closed');
            });
            ws.on('error', reject);
        }),
    };
};
