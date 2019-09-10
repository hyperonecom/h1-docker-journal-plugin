# h1-docker-journal-plugin

[![Build Status](https://travis-ci.com/hyperonecom/h1-docker-journal-plugin.svg?branch=master)](https://travis-ci.com/hyperonecom/h1-docker-journal-plugin)

This Docker plugin extends and expands Docker's logging capabilities so that customers can push their Docker and container logs to [HyperOne Journal](http://www.hyperone.com/services/storage/logArchive/) service.

## Prerequisites

* HyperOne Journal [created in accordance with the documentation](http://www.hyperone.com/services/storage/journal/guides/creating.html),
* password for the HyperOne resource indicated in the previous item

## Install Docker logging plugin from ```Registry```

1. Download plugin

```bash
$ docker plugin install h1cr.io/h1-docker-logging-plugin
```

2. Enable plugin

```bash
$ docker plugin enable h1cr.io/h1-docker-logging-plugin
```

## Install Docker logging plugin from source

1. Clone the repository and check out release branch:

```bash
$ cd h1-docker-journal-plugin
$ git checkout release
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
	--log-opt journal-id=5d4362e4939bdbe421cb09ee \
	--log-opt journal-token=test \
	-it alpine id
```

Now that the plugin is installed and configured, it will send logs while the container is running.

### Required variables

| Name | Description |
| -----| ------------
| ```journal-id``` | Journal ID that will receive logs
| ```journal-token``` | Credential (password) to journal indicated in the parameter ```journal-id```

### Optional variables

|       Name        |                                                                               Description                                                                               |                   Default value                   |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| tag               | TODO: See Docker's log ```tag``` option documentation                                                                                                                   | ```{{.ID}}``` (12 characters of the container ID) |
| labels            | TODO: See Docker's log ```labels``` option documentation                                                                                                                | ```{{.ID}}``` (12 characters of the container ID) |
| env               | TODO: See Docker's log ```env``` option documentation                                                                                                                   | ```{{.ID}}``` (12 characters of the container ID) |
| env-regex         | A regular expression to match logging-related environment variables. Used for advanced log tag options. If there is collision between the label and env keys, env wins. | (disabled)                                        |
| flush-buffer-size | TODO: How many pending messages can be before sending to journal immediately.                                                                                           | ```500```                                         |
| flush-interval    | TODO: How long (in miliseconds) the buffer keeps buffer before flushing them.                                                                                           | ```15000```                                       |

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
