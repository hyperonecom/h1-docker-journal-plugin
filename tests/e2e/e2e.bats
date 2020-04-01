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

@test "plugin send logs" {
    run docker run \
    --log-driver 'h1cr.io/h1-docker-logging-plugin:latest' \
    --label dockerbats="$BATS_TEST_NAME" \
    --log-opt labels=dockerbats \
    --log-opt journal-fqdn=${JOURNAL_ID}.journal.pl-waw-1.hyperone.cloud \
    --log-opt journal-password=${JOURNAL_TOKEN} \
    alpine sh -c 'echo $RANDOM';
    [ "$status" -eq 0 ];
    containerId=$(docker container ls -a -q --filter label=dockerbats="$BATS_TEST_NAME");
    run docker logs "${containerId}";
    echo "Output of logs: ${output}";
    [ "$status" -eq 0 ]
}

@test "plugin flush logs" {
    run docker run -d \
    --log-driver 'h1cr.io/h1-docker-logging-plugin:latest' \
    --label dockerbats="$BATS_TEST_NAME" \
    --log-opt labels=dockerbats \
    --log-opt journal-fqdn=${JOURNAL_ID}.journal.pl-waw-1.hyperone.cloud \
    --log-opt journal-password=${JOURNAL_TOKEN} \
    alpine sh -c 'seq 1 10; sleep 30';
    [ "$status" -eq 0 ];
    # Wait for flush (15 second default)
    sleep 20;
    containerId=$(docker container ls -a -q --filter label=dockerbats="$BATS_TEST_NAME");
    run docker logs "${containerId}";
    echo "Output of logs: ${output}";
    [ "$status" -eq 0 ]
}

@test "plugin sends multiple lines of logs" {
    token=${RANDOM};
    run docker run \
    --log-driver 'h1cr.io/h1-docker-logging-plugin:latest' \
    --label dockerbats="$BATS_TEST_NAME-${token}" \
    --log-opt labels=dockerbats \
    --log-opt journal-fqdn=${JOURNAL_ID}.journal.pl-waw-1.hyperone.cloud \
    --log-opt journal-password=${JOURNAL_TOKEN} \
    alpine sh -c "seq 100 | while read line; do echo \"multiple-\${line}-${token}\"; done;";
    [ "$status" -eq 0 ]
    containerId=$(docker container ls -a -q --filter label=dockerbats="${BATS_TEST_NAME}-${token}");
    echo "Container id: ${containerId}";
    run docker logs "${containerId}";
    echo "Output of logs: ${output}";
    [[ $output =~ "multiple-1-${token}" ]]
    [[ $output =~ "multiple-100-${token}" ]]
    [ "$status" -eq 0 ]
}

@test "plugin require token" {
    run docker run -d \
    --log-driver 'h1cr.io/h1-docker-logging-plugin:latest' \
  --log-opt labels=dockerbats \
    --label dockerbats="$BATS_TEST_NAME" \
    alpine id;
    [[ $output =~ "Missing 'journal-fqdn' option of log driver" ]]
    [ "$status" -eq 125 ]
}

@test "plugin validate token" {
    run docker run -d \
    --log-driver 'h1cr.io/h1-docker-logging-plugin:latest' \
    --label dockerbats="$BATS_TEST_NAME" \
    --log-opt journal-fqdn=${JOURNAL_ID}.journal.pl-waw-1.hyperone.cloud \
    --log-opt journal-password="invalid token" \
    alpine id;
    [[ $output =~ "Invalid/missing access data for journal" ]]
    [ "$status" -eq 125 ]
}