'use strict';
const test = require('ava');
const { extract_tag } = require('../utils');

const demo = {
    File: '/run/docker/logging/ffcd8ba3422674be770c93a7a9325ff02d54f46bda6710d0bd7625eaae0358f1',
    Info: {
        Config: {
            'journal-fqdn': '5d78e1427fd7e0228fe18f46.journal.pl-waw-1.hyperone.cloud',
            'journal-token': 'x',
        },
        ContainerID: '956d79af66ec1e85cc409d1153af23ace3b2b55a6fdfa2dc39cd80ff8e7416bf',
        ContainerName: '/xenodochial_jang',
        ContainerEntrypoint: 'id',
        ContainerArgs: [],
        ContainerImageID: 'sha256:961769676411f082461f9ef46626dd7a2d1e2b2a38e6a44364bcbecf51e66dd4',
        ContainerImageName: 'alpine',
        ContainerCreated: '2019-09-11T22:36:15.846941583Z',
        ContainerEnv: [
            'xxx',
            'PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
        ],
        ContainerLabels: { x: '256' },
        LogPath: '',
        DaemonName: 'docker',
    },
};

test('extract_tag - tag based on labels', t => {
    const result = extract_tag({ labels: 'x' }, demo.Info);
    t.deepEqual(result, {
        x: '256',
    });
});

test('extract_tag - tag based on env', t => {
    const result = extract_tag({ env: 'PATH' }, demo.Info);
    t.deepEqual(result, {
        PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
    });
});

test('extract_tag - tag based on env-regexp', t => {
    const result = extract_tag({ 'env-regexp': 'PATH' }, demo.Info);
    t.deepEqual(result, {
        PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
    });
});

