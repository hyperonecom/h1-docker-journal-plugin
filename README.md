# h1-docker-journal-plugin

Installation:
```bash
sudo make clean install enable;
```

Test:

```bash
docker run --rm --label x \
	--log-driver 'h1-docker-logging-plugin:latest' \
	--log-opt journal-id=xxxxxxxxx \
	--log-opt journal-token=xxxxxxxxxx \
	--log-opt auth-token=xxxxxxxxxx \
	-it alpine id
```

Logs:

```bash
sudo bash -c 'tail -f -n 1000 /var/lib/docker/plugins/*/rootfs/src/logi.txt'
```


## Read also

* https://docs.docker.com/engine/extend/plugins_logging/
