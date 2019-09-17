'use strict';
const stream = require('stream');

const { messages } = require('./parse');

class ParseDockerStream extends stream.Transform {
    constructor(options = {}) {
        super({ objectMode: true, ...options });
        this._buf = Buffer.alloc(0);
        this.bytes = 0;
    }

    _transform(chunk, encoding, callback) {
        this.bytes += chunk.length;
        this._buf = Buffer.concat([this._buf, chunk]);
        if (this._buf.length < 4) { // check if have header
            return callback(null); // wait for more data
        }  // check if have full body
        let headerSize = this._buf.readUInt32BE();
        while (this._buf.length >= 4 + headerSize) { // consume buffer
            // parse msg
            try {
                const msg = messages.LogEntry.decode(
                    this._buf.slice(4, headerSize + 4)
                );
                this.push(msg);
            } catch (err) {
                return callback(err);
            }
            // strip consumed data
            this._buf = this._buf.slice(headerSize + 4);
            // check if have header
            if (this._buf.length < 4) {
                break;
            }
            headerSize = this._buf.readUInt32BE();
        }
        return callback(null);

    }
}

class ParseJournalStream extends stream.Transform {
    constructor(options = {}) {
        super({ objectMode: true, ...options });
        this.chunks = 0;
    }

    _transform(chunk, encoding, callback) {
        this.chunks += 1;
        try {
            const message = JSON.parse(chunk.toString('utf-8'));
            if (message.message) {
                message.line = Buffer.from(message.message);
                delete message.message;
            }
            return callback(null, message);
        } catch (err) {
            return callback(err);
        }
    }
}

class FilterJournalDockerStream extends stream.Transform {
    constructor(options = {}) {
        super(Object.assign(options, { objectMode: true }));
        this.chunks = 0;
    }

    _transform(chunk, encoding, callback) {
        this.chunks += 1;
        if (!['source', 'time_nano', 'line'].every(x => Object.keys(chunk).includes(x))) {
            return callback(null);
        }
        return callback(null, chunk);
    }
}

class EncodeDockerStream extends stream.Transform {
    constructor(options = {}) {
        super(Object.assign(options, { objectMode: true }));
        this.chunks = 0;
    }

    _transform(chunk, encoding, callback) {
        this.chunks += 1;
        chunk.line = Buffer.from(`${chunk.line}\n`);
        const payload = messages.LogEntry.encode(chunk);
        const header = Buffer.alloc(4);
        header.writeInt32BE(payload.length, 0);
        this.push(header);
        this.push(payload);
        return callback(null);
    }
}


module.exports = {
    ParseDockerStream,
    ParseJournalStream,
    FilterJournalDockerStream,
    EncodeDockerStream,
};
