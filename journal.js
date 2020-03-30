'use strict';
const qs = require('qs');
const logger = require('superagent-logger');
const jwt = require('jsonwebtoken');
const WebSocket = require('ws');
const { FilterJournalDockerStream, ParseJournalStream } = require('./transform');

module.exports = (config) => {
    const proto = config['journal-unsecure'] ? 'http' : 'https';
    const url = `${proto}://${config['journal-fqdn']}/log`;
    const agent = require('superagent').agent().use(logger);

    let cred_req;

    const get_headers = async () => {
        if (config['journal-password']) {
            return { 'x-auth-password': config['journal-password'] };
        }

        if (config['journal-passport']) {
            const passport = JSON.parse(config['journal-passport'].trim());
            const token = jwt.sign({}, passport.private_key, {
                algorithm: 'RS256',
                expiresIn: '5m',
                keyid: passport.certificate_id,
                audience: config['journal-fqdn'],
                issuer: passport.issuer,
                subject: passport.subject_id,
            });

            return {
                Authorization: `Bearer ${token}`,
            };
        }

        if (config['journal-credential-endpoint']) {
            if (!cred_req) { // no credential
                cred_req = agent.post(config['journal-credential-endpoint'])
                    .set({ Metadata: 'true' })
                    .send({ audience: config['journal-fqdn'] });
            }
            const cred_resp = await cred_req;
            const ts = Math.round(new Date().getTime() / 1000);
            // expired response
            if (cred_resp.body.expires_on <= ts - 30) {
                cred_req = undefined;
                console.log(`Refreshing token for ${config['journal-fqdn']}`);
                return get_headers();
            }
            const token = cred_resp.body.access_token;

            return {
                Authorization: `Bearer ${token}`,
            };
        }

        return {};
    };

    return {
        checkJournalToken: async () => agent
            .head(url)
            .query({ follow: 'false' })
            .set(await get_headers()),
        send: async (messages) => {
            const body = Array.isArray(messages) ? messages : [messages];
            const content = body.map(x => JSON.stringify(x)).join('\n');
            return agent
                .post(url)
                .send(content)
                .set(await get_headers());
        },
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
            const ws_url = `${url}?${qs.stringify(query)}`;
            console.log('WS', ws_url);
            return get_headers().then(headers => {
                const ws = new WebSocket(ws_url, {
                    headers,
                });

                ws.on('open', () => {
                    console.log(config['journal-fqdn'], 'websocket opened');
                    const stream = WebSocket.createWebSocketStream(ws).
                        pipe(new ParseJournalStream()).
                        pipe(new FilterJournalDockerStream());
                    stream.pause();
                    resolve(stream);
                });

                ws.on('close', () => {
                    console.log(config['journal-fqdn'], 'websocket closed');
                });
                ws.on('error', reject);
            }).catch(resolve);

        }),
    };
};
