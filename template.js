module.exports.getContent = (data) => {
    return `const fs = require('fs');
const path = require('path');
const express = require('express');
const log4js = require('log4js');
const faker = require('faker');
const lodash = require('lodash');
const moment = require('moment');
const validator = require('validator');

const PORT = ${data.port};
const LOG_LEVEL = 'debug';

const logger = log4js.getLogger('${data.path}');
const app = express();


log4js.configure({
    appenders: { 'out': { type: 'stdout' }, server: { type: 'file', filename: path.join(__dirname, 'logs/${data.path}.log'), maxLogSize: 52428800 } },
    categories: { default: { appenders: ['out', 'server'], level: LOG_LEVEL } }
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
    if (req.method === 'POST') {
        logger.info(req.method, req.headers['x-forwarded-for'] || req.connection.remoteAddress, req.path, req.params, req.query, req.body);
    }
    next();
});

app.get('/${data.path}/console', (req, res) => {
    const file = path.join(__dirname, 'logs/${data.path}.log');
    try {
        fs.statSync(file);
        fs.readFile(file, 'utf8', (err, data) => {
            if (data) {
                var arr = data.split('\\n');
                if (req.query.tail) {
                    arr = arr.splice(arr.length - req.query.tail, arr.length);
                } else if (req.query.head) {
                    arr = arr.splice(0, req.query.head);
                }
                if (req.headers['content-type'] === 'application/json') {
                    res.json({ logs: arr });
                } else {
                    res.end(arr.join('\\n'));
                }
            } else {
                res.json({ message: 'No logs!' });
            }
        });
    } catch (e) {
        logger.error(e);
        if (req.headers['content-type'] === 'application/json') {
            res.json({ message: 'No logs!' });
        } else {
            res.end('No logs!');
        }
    }
});

app.post('/${data.path}', (req, res) => {
    try {
        ${data.code}
    } catch(e) {
        logger.error(e);
        res.status(500).json({ message: e.message });
    }
});

app.listen(PORT, (err) => {
    if (!err) {
        logger.info('Server is listening on port', PORT);
    } else {
        logger.error(err);
    }
});`;
}