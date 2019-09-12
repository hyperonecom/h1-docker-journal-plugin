'use strict';

const safe_split = (text, sep, max) => {
    const parts = text.split(sep);
    const result = parts.slice(0, max);
    if (result.length < max && result.length !== parts.length) {
        result.push(parts.slice(max).join(sep));
    }
    return result;
};

const env_to_obj = (envs) => Object.assign(...envs.map(x => safe_split(x, '=', 2)).map(([key, value]) => ({ [key]: value })));

const extract_tag = (config, info) => {
    const tag = {};

    const container_labels = info.ContainerLabels || {};

    if (config.labels) {
        config.labels.split(',').filter(x => container_labels[x]).forEach(name => {
            tag[name] = container_labels[name];
        });
    }

    if (config.env && info.ContainerEnv) {
        const env = env_to_obj(info.ContainerEnv);
        console.log(env);
        config.env.split(',').filter(x => env[x]).forEach(name => {
            tag[name] = env[name];
        });
    }
    if (config['env-regexp'] && info.ContainerEnv) {
        const r = new RegExp(config['env-regexp']);
        Object.assign(tag, env_to_obj(info.ContainerEnv.filter(x => r.test(x))));
    }

    return tag;
};

module.exports = {
    extract_tag,
};
