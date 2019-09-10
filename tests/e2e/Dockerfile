FROM alpine:3.10
RUN apk add bats docker-cli
WORKDIR /src
ADD ./ ./
CMD ["bats","e2e.bats"]