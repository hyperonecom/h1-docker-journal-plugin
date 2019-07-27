'use strict';

const protobuf = require('protocol-buffers');

exports.messages = protobuf(` 
syntax = "proto3";

message LogEntry {
\tstring source = 1;
\tint64 time_nano = 2;
\tbytes line = 3;
\tbool partial = 4;
\tPartialLogEntryMetadata partial_log_metadata = 5;
}

message PartialLogEntryMetadata {
\tbool last = 1;
\tstring id = 2;
\tint32 ordinal = 3;
}
`);

exports.decode = (buffer) => {
    const size = buffer.readInt32BE(4);
    return exports.messages.LogEntry.decode(buffer.slice(4, size));
};

exports.encode = (message) => {
    const buffer = exports.messages.LogEntry.encode(message);
    const buffer2 = Buffer.alloc(4);
    buffer2.writeInt32BE(buffer.length, 0);
    return Buffer.concat([buffer2, buffer])
};
