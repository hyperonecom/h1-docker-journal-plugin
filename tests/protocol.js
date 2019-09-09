'use strict';
const { ParseJournalStream, ParseDockerStream } = require('../transform');
const { Readable } = require('stream');

const test = require('ava');

const header = Buffer.from('00000068', 'hex');
const payload = Buffer.from('0a067374646f757410f5d196bdc9d3b4da151a542f7379732f6b65726e656c2f736c61622f3a74412d303030303230302f6367726f75702f766d5f617265615f73747275637428313838303a736d62642e73657276696365292f73616e6974795f636865636b730d', 'hex');

test('parse docker stream', async t => new Promise((resolve, reject) => Readable.from([header, payload])
    .pipe(new ParseDockerStream())
    .on('data', msg => {
        t.true(msg.source === 'stdout');
        return resolve();
    })
    .on('error', reject)
));

test('parse journal stream', async t => new Promise((resolve, reject) => {
    let count = 0;

    Readable.from([
        Buffer.from(`${JSON.stringify({ x: '25' })}\n`),
        Buffer.from(`${JSON.stringify({ x: '25' })}\n`),
    ])
        .pipe(new ParseJournalStream())
        .on('data', msg => {
            t.true(msg.x === '25');
            count+=1;
        })
        .on('error', reject)
        .on('end', () => {
            t.true(count == 2);
            return resolve();
        });
}));
