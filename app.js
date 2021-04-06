const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const log4js = require('log4js');
const mongoose = require('mongoose');
const getPort = require('get-port');
const killPort = require('kill-port');
const makeDir = require('make-dir');
const request = require('request');

const template = require('./template');
const PORT = process.env.PORT || 8000;

const logger = log4js.getLogger('server');
const app = express();
const routeMap = {};

const schema = new mongoose.Schema({
    _id: {
        type: 'String'
    },
    code: {
        type: 'String'
    },
    port: {
        type: 'Number'
    },
    timestamp: {
        type: 'Date'
    }
});

const model = mongoose.model('controller', schema);
const mongo_url = process.env.MONGODB_URL || 'mongodb://localhost:27017/hooks';

log4js.configure({
    appenders: {
        out: { type: 'console' },
        server: { type: 'file', filename: 'server.log', maxLogSize: 5242880 }
    },
    categories: { default: { appenders: ['out', 'server'], level: 'info' } }
});

const usedPaths = ['deploy', 'hook', ''];

mongoose.connect(mongo_url, (err) => {
    if (err) {
        logger.error(err);
        process.exit(0);
    } else {
        logger.info('Database Connected');
    }
});

app.use((req, res, next) => {
    const segments = req.path.split('/').filter(e => e);
    const mappedPort = routeMap[segments[0]];
    if (mappedPort) {
        const proxyUrl = 'http://localhost:' + mappedPort + req.originalUrl;
        logger.info('Proxy Pass', proxyUrl);
        req.pipe(request(proxyUrl)).pipe(res);
    } else {
        next();
    }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(express.static('node_modules'));

app.use((req, res, next) => {
    const clientIP = req.headers['remote-addr'] || req.headers['x-forwaded-for'] || req.ip;
    logger.info(req.method, clientIP, req.path);
    next();
});

app.get('/hook', (req, res) => {
    model.find({}).then(data => {
        res.status(200).json({ hooks: data });
    }).catch(err => {
        logger.error(err);
        res.status(500).json({ message: 'Unable to fetch hooks' });
    });
});

app.get('/hook/:path(*)', (req, res) => {
    model.findById(req.params.path).then(data => {
        res.status(200).json(data);
    }).catch(err => {
        logger.error(err);
        res.status(500).json({ message: 'Unable to fetch hook' });
    });
});

app.post('/deploy', (req, res) => {
    if (usedPaths.indexOf(req.body.path) > -1) {
        res.status(400).json({ message: 'This path is reserved, please change your path' });
        return;
    }
    model.findById(req.body.path).then(data => {
        configurePort(data).then(portData => {
            let payload = {
                _id: req.body.path,
                code: req.body.code,
                port: portData.port,
                timestamp: new Date()
            };
            let query;
            if (data) {
                query = model.findOneAndUpdate({ _id: req.body.path }, payload).exec();
            } else {
                query = model.create(payload);
            }
            query.then(doc => {
                payload.path = payload._id;
                createHook(payload);
                routeMap[payload.path] = payload.port;
                res.status(200).json({ message: 'Hook created' });
            }).catch(err => {
                logger.error(err);
                res.status(500).json({ message: 'Unable to save hook' });
            });
        }).catch(err => {
            logger.error(err);
            res.status(500).json({ message: 'Unable to find port' });
        });
    }).catch(err => {
        logger.error(err);
        res.status(500).json({ message: 'Unable to create hook' });
    });
});

app.delete('/deploy/:path', (req, res) => {
    if (usedPaths.indexOf(req.params.path) > -1) {
        res.status(400).json({ message: 'Cannot delete this hook' });
        return;
    }
    model.findByIdAndRemove(req.params.path).then(data => {
        killPort(data.port, 'tcp').then(status => { }).catch(err => { });
        delete routeMap[req.params.path];
        res.status(200).json({ message: 'Hook deleted' });
    }).catch(err => {
        logger.error(err);
        res.status(500).json({ message: 'Unable to delete hook' });
    });
});


app.delete('/logs/:path', (req, res) => {
    if (usedPaths.indexOf(req.params.path) > -1) {
        res.status(400).json({ message: 'Cannot clear logs' });
        return;
    }
    const logPath = `./logs/${req.params.path}.log`;
    fs.writeFileSync(path.join(__dirname, logPath), '', 'utf-8');
    res.status(200).json({ message: 'Logs cleared' });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    model.find({}).then(data => {
        data.forEach(doc => {
            const temp = {
                path: doc._id,
                code: doc.code,
                port: doc.port
            };
            killPort(temp.port, 'tcp').then(status => {
                createHook(temp);
                logger.info('Started Hook', temp.path, temp.port);
                routeMap[temp.path] = temp.port;
            }).catch(err => {
                logger.error(err);
            });
        });
    }).catch(err => {
        logger.error(err);
    });
    logger.info('Server is listening on port', PORT);
});


function createHook(data) {
    const content = template.getContent(data);
    const location = path.join(__dirname, 'apps', data.path);
    makeDir.sync(location);
    fs.writeFileSync(path.join(location, 'app.js'), content, 'utf8');
    const nodeApp = spawn('node', [path.join(location, 'app.js')]);
    // nodeApp.stdout.on('data', (data) => {
    //     console.log(`stdout: ${data}`);
    // });
    // nodeApp.stderr.on('data', (data) => {
    //     console.log(`stderr: ${data}`);
    // });
    // nodeApp.on('close', (code) => {
    //     console.log(`child process exited with code ${code}`);
    // });
}

function configurePort(data) {
    return new Promise((resolve, reject) => {
        if (data) {
            killPort(data.port, 'tcp').then(res => {
                resolve(data);
            }).catch(err => {
                reject(err);
            });
        } else {
            getPort({
                from: 20000
            }).then(port => {
                resolve({
                    port: port
                });
            }).catch(err => {
                reject(err);
            });
        }
    });
}