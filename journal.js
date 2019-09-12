'use strict';
const qs = require('qs');
const logger = require('superagent-logger');
const WebSocket = require('ws');

module.exports = (config) => {
    const url = `http://${config['journal-fqdn']}/log`;
    const agent = require('superagent').agent().use(logger);
    return {
        checkJournalToken: () => agent.head(url).query({ follow: false })
            .set('x-auth-password', config['journal-token']),
        send: (messages) => new Promise((resolve, reject) => {
            const body = Array.isArray(messages) ? messages : [messages];
            const content = body.map(x => JSON.stringify(x)).join('\n');
            return agent
                .post(url)
                .send(content)
                .set('x-auth-password', config['journal-token'])
                .then(resolve)
                .catch(reject);
        }),
        read: (read_config, read_info) => new Promise((resolve, reject) => {
            const query = {
                follow: read_config.Follow,
                tag: {
                    containerId: read_info.ContainerID,
                },
            };
            if (read_config.Since !== '0001-01-01T00:00:00Z') {
                query.since = read_config.since;
            }
            if (read_config.Until !== '0001-01-01T00:00:00Z') {
                query.until = read_config.until;
            }
            if (read_config.Tail) {
                query.Tail = read_config.Tail;
            }

            console.log('query', query);

            const ws = new WebSocket(`${url}?${qs.stringify(query)}`, {
                headers: { 'x-auth-password': config['journal-token'] },
            });

            ws.on('open', () => {
                console.log(config['journal-fqdn'], 'websocket opened');
                const stream = WebSocket.createWebSocketStream(ws);
                resolve(stream);
            });

            ws.on('close', () => {
                console.log(config['journal-fqdn'], 'websocket closed');
            });
            ws.on('error', reject);
        }),
    };
};
