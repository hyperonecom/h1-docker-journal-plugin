PLUGIN_NAME=h1cr.io/h1-docker-logging-plugin
PLUGIN_DIR=rootfs
PLUGIN_TAG=latest
all: clean package enable
package: clean docker build archive
node: clean node-install node-lint node-test

docker:
	@echo "### docker build"
	docker build -t ${PLUGIN_NAME}:${PLUGIN_TAG} .

build: docker
	@echo "### create rootfs"
	docker create --name tmprootfs ${PLUGIN_NAME}:${PLUGIN_TAG}
	mkdir -p ${PLUGIN_DIR}/rootfs
	docker export "tmprootfs" | tar -x -C ${PLUGIN_DIR}/rootfs
	docker rm -vf "tmprootfs"
	cp config.json ${PLUGIN_DIR}

archive: build
	@echo "### create package.tar.gz"
	tar -cvzf package.tar.gz ${PLUGIN_DIR}

clean:
	@echo "### rm ${PLUGIN_DIR}"
	rm -rf ${PLUGIN_DIR}
	@docker plugin rm -f ${PLUGIN_NAME}:${PLUGIN_TAG} || true

install: build
	@echo "### install plugin ${PLUGIN_NAME}:${PLUGIN_TAG}"
	docker plugin disable ${PLUGIN_NAME}:${PLUGIN_TAG} || true
	@docker plugin rm ${PLUGIN_NAME}:${PLUGIN_TAG} || true
	docker plugin create ${PLUGIN_NAME}:${PLUGIN_TAG} ./rootfs

enable: install
	@echo "### enable plugin ${PLUGIN_NAME}:${PLUGIN_TAG}"
	docker plugin enable ${PLUGIN_NAME}:${PLUGIN_TAG}

push: install
	@echo "### push plugin ${PLUGIN_NAME}:${PLUGIN_TAG}"
	docker plugin push ${PLUGIN_NAME}:${PLUGIN_TAG}

node-install:
	docker run -v ${PWD}:/src -w /src node npm ci

node-lint:
	docker run -v ${PWD}:/src -w /src node npm run lint

node-test:
	docker run -v ${PWD}:/src -e JOURNAL_TOKEN -e JOURNAL_ID -w /src node npm run test

integration:
	docker build -t "${PLUGIN_NAME}-e2e" tests/e2e
	docker run -v /var/run/docker.sock:/var/run/docker.sock -e JOURNAL_TOKEN -e JOURNAL_ID "${PLUGIN_NAME}-e2e"