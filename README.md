# h1-docker-journal-plugin

Installation:
```bash
sudo make clean install enable;
```

Create journal:
```bash
h1 log create --name x --password test
```

Test:

```bash
docker run --rm --label x \
	--log-driver 'h1-docker-logging-plugin:latest' \
	--log-opt journal-id=5d4362e4939bdbe421cb09ee \
	--log-opt journal-token=test \
	--log-opt auth-token=fe9ce7309e2242e38cdf18e92fc37025 \
	-it alpine id
```

Logs:

```bash
sudo bash -c 'tail -f -n 1000 /var/lib/docker/plugins/*/rootfs/src/logi.txt'
```


## Read also

* https://docs.docker.com/engine/extend/plugins_logging/
