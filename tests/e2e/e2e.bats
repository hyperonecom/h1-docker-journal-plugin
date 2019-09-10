# Required parameters
: ${JOURNAL_ID:?}
: ${JOURNAL_TOKEN:?}

# Required tools
command -v docker >/dev/null 2>&1 || {
    echo "'docker' must be installed" >&2
    exit 1
}

teardown() {
    docker container ls -a -q --filter label=dockerbats \
        | xargs -r docker rm -f;
}

@test "plugin sends logs" {
    run docker run -d \
	--log-driver 'h1cr.io/h1-docker-logging-plugin:latest' \
    --label dockerbats="$BATS_TEST_NAME" \
	--log-opt journal-id=${JOURNAL_ID} \
	--log-opt journal-token=${JOURNAL_TOKEN} \
	alpine sh -c 'echo $RANDOM; sleep 30';
    [ "$status" -eq 0 ]
    run docker logs "${output}";
    [ "$status" -eq 0 ]
}

@test "plugin sends multiple lines of logs" {
    token=${RANDOM};
    run docker run \
	--log-driver 'h1cr.io/h1-docker-logging-plugin:latest' \
    --label dockerbats="$BATS_TEST_NAME" \
	--log-opt journal-id=${JOURNAL_ID} \
	--log-opt journal-token=${JOURNAL_TOKEN} \
	alpine sh -c "seq 100 | while read line; do echo \"multiple-\${line}-${token}\"; done;";
    [ "$status" -eq 0 ]
    containerId=$(docker container ls -a -q --filter label=dockerbats="$BATS_TEST_NAME");
    run docker logs "${containerId}";
    [[ $output =~ "multiple-1-${token}" ]]
    [[ $output =~ "multiple-100-${token}" ]]
    [ "$status" -eq 0 ]
}

@test "plugin require token" {
    run docker run -d \
	--log-driver 'h1cr.io/h1-docker-logging-plugin:latest' \
    --label dockerbats="$BATS_TEST_NAME" \
	alpine id;
    [[ $output =~ "Missing 'journal-id option of log driver." ]]
    [ "$status" -eq 125 ]
}

@test "plugin validate token" {
    run docker run -d \
	--log-driver 'h1cr.io/h1-docker-logging-plugin:latest' \
    --label dockerbats="$BATS_TEST_NAME" \
	--log-opt journal-id="${JOURNAL_ID}" \
	--log-opt journal-token="invalid token" \
	alpine id;
    [[ $output =~ "Invalid journal-token." ]]
    [ "$status" -eq 125 ]
}