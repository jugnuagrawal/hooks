module.exports.getContent = (data) => {
    return `const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const log4js = require('log4js');
const faker = require('faker');
const _ = require('lodash');

const PORT = ${data.port};
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

const logger = log4js.getLogger('${data.path}');
const app = express();


log4js.configure({
    appenders: { 'out': { type: 'stdout' }, server: { type: 'file', filename: 'logs/${data.path}.log', maxLogSize: 52428800 } },
    categories: { default: { appenders: ['out', 'server'], level: LOG_LEVEL } }
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use((req, res, next) => {
    logger.info(req.method, req.headers['x-forwarded-for'] || req.connection.remoteAddress, req.path, req.params, req.query, req.body);
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
                    res.json({ logs: arr.splice(arr.length - req.query.tail, arr.length) });
                } else if (req.query.head) {
                    res.json({ logs: arr.splice(0, req.query.head) });
                } else {
                    res.json({ logs: arr });
                }
            } else {
                res.json({ message: 'No logs!' });
            }
        });
    } catch (e) {
        if (req.headers['content-type'] === 'application/json') {
            res.json({ message: 'No logs!' });
        } else {
            res.end('No logs!');
        }
    }
});

app.post('/${data.path}', (req, res) => {
    ${data.code}
});

app.listen(PORT, (err) => {
    if (!err) {
        logger.info('Server is listening on port', PORT);
    } else {
        logger.error(err);
    }
});`;
}