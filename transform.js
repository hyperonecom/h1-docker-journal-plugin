const stream = require('stream');

const {messages} = require('./parse');

class ParseDockerStream extends stream.Transform {
    constructor(options = {}) {
        super(Object.assign(options, {objectMode: true}));
        this._buf = Buffer.alloc(0);
    }

    _transform(chunk, encoding, callback) {
        this._buf = Buffer.concat([this._buf, chunk]);
        if (this._buf.length < 4) { // check if have header
            return callback(null); // wait for more data
        } else { // check if have full body
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
}

class ParseJournalStream extends stream.Transform {
    constructor(options = {}) {
        super(Object.assign(options, {objectMode: true}));
        this._buf = Buffer.alloc(0);
    }

    _transform(chunk, encoding, callback) {
        this._buf = Buffer.concat([this._buf, chunk]);
        let offset = this._buf.indexOf("\n");
        while (offset !== -1) { // consume buffer
            // parse msg
            try {
                const data = this._buf.slice(0, offset).toString('utf-8');
                const msg = JSON.parse(data);
                this.push(msg);
            } catch (err) {
                return callback(err);
            }
            this._buf = this._buf.slice(offset + 1);
            offset = this._buf.indexOf("\n");
        }
        return callback(null);
    }

    _flush(cb) {
        try {
            if (this._buf.length > 0) {
                this.push(JSON.parse(this._buf.toString('utf-8')));
            }
            cb(null);
        } catch (err) {
            cb(err)
        }
    }

}

module.exports = {
    ParseDockerStream,
    ParseJournalStream
};
