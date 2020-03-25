# h1-docker-journal-plugin

[![Build Status](https://travis-ci.com/hyperonecom/h1-docker-journal-plugin.svg?branch=master)](https://travis-ci.com/hyperonecom/h1-docker-journal-plugin)

This Docker plugin extends and expands Docker's logging capabilities so that customers can push their Docker and container logs to [HyperOne Journal](http://www.hyperone.com/services/storage/journal) service.

## Prerequisites

* HyperOne Journal [created in accordance with the documentation](http://www.hyperone.com/services/storage/journal/guides/creating.html),
* password for the HyperOne resource indicated in the previous item

## Install Docker logging plugin from ```Registry```

1. Download plugin

```bash
docker plugin install h1cr.io/h1-docker-logging-plugin
```

2. Enable plugin

```bash
docker plugin enable h1cr.io/h1-docker-logging-plugin
```

## Install Docker logging plugin from source

1. Clone the repository and check out release branch:

```bash
cd h1-docker-journal-plugin
git checkout release
```

2. Build the plugin:

```
$ make build
```

3. Enable the plugin:

```.env
$ make install enable
```

## Usage

Configure the plugin separately for each container when using the docker run command. For example:

```bash
docker run --rm --label x \
    --log-driver 'h1cr.io/h1-docker-logging-plugin:latest' \
    --log-opt journal-fqdn=5d78e1427fd7e0228fe18f46.journal.pl-waw-1.hyperone.cloud \
    --log-opt journal-password=test \
    -it alpine id
```

Now that the plugin is installed and configured, it will send logs while the container is running.

## Tags

Each message has the following tags assigned by default. The user has the ability to define your own tags through optional variables and they take precedence.

### Required variables

* ```journal-fqdn``` – Journal FQDN that will receive logs

* credential source (one of the following):
  * password:
    * ```journal-password``` – Credential (password) to journal indicated in the parameter ```journal-fqdn```
  * service account:
    * ```journal-sa-id``` – eg. ```/iam/sa/project/5e7b89edd93046f509ca38d7/sa/5e7b89edd93046f509ca38d7```
    * ```journal-sa-kid``` – ID of certificate of service account eg. ```5e7b89edd93046f509ca38d7```
    * ```journal-private-key``` – private key of certificate added to actor
  * ```journal-credential-endpoint``` – credential endpoint eg. metadata service

### Optional variables

* ```labels``` – comma-separated list of keys of labels used for tagging of logs. Disabled by default.
* ```env``` – comma-separated list of keys of labels used for tagging of logs.  Disabled by default.
* ```env-regex``` – A regular expression to match logging-related environment variables. Used for advanced log tag options. If there is collision between the label and env keys, env wins. Disabled by default.
* ```flush-buffer-size``` –  How many pending messages can be collected before sending to journal immediately. Default: 500
* ```flush-interval``` –  How long (in miliseconds) the buffer keeps messages before flushing them. Default: 15000
* ```journal-unsecure``` – Use unsecure (HTTP) connection to Journal

## Development

1. Customize config.json for logging plugin stdout

```.env
  "entrypoint": ["sh","-c","node /src/index.js &> logs.txt"],
```

2. Run following command to access logs:

```bash
sudo bash -c 'tail -f -n 1000 /var/lib/docker/plugins/*/rootfs/src/logs.txt'
```

## Release Notes

* 1.0.0 - First version.

## Read also

* https://docs.docker.com/engine/extend/plugins_logging/
