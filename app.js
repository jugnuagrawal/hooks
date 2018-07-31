const express = require('express');
const bodyParser = require('body-parser');
const log4js = require('log4js');
const vm = require('vm');
const logger = log4js.getLogger('server');
const app = express();

log4js.configure({
    appenders: { server: { type: 'file', filename: 'server.log', maxLogSize: 5242880 } },
    categories: { default: { appenders: ['server'], level: 'info' } }
});

const usedPaths = ['deploy', ''];

app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
app.use(express.static('public'))
app.use((req, res, next) => {
    logger.info(req.method, req.path, req.params, req.body)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Method', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    next();
});

global.app = app;
global.require = require;
global.__dirname = __dirname;

app.get('/routes', (req, res) => {
    res.json({ routes: app._router.stack.filter(e => e.name === 'bound dispatch') });
});

app.post('/deploy', (req, res) => {
    if (usedPaths.indexOf(req.body.path) > -1) {
        res.status(400).json({ message: 'cannot use this path' });
        return;
    }
    __dirname
    const findIndex = app._router.stack.findIndex(e => e.path === '/' + req.body.path);
    if (findIndex > -1) {
        app._router.stack.splice(findIndex, 1);
    }
    const script = new vm.Script(`
    const log4js = require('log4js');
    const path = require('path');
    const fs = require('fs');
    app.get('/${req.body.path}/console',(req,res)=>{
        const file = path.join(__dirname,'logs/${req.body.path}.log');
        try{
            fs.statSync(file);
            res.sendFile(file);
        }catch(e){
            res.end('No logs!');
        }
    });
    app.post('/${req.body.path}',(req,res)=>{
        log4js.configure({
            appenders: { ${req.body.path}: { type: 'file', filename: './logs/${req.body.path}.log', maxLogSize: 5242880 } },
            categories: { 
                default: { appenders: ['${req.body.path}'], level: 'off' },
                ${req.body.path}: { appenders: ['${req.body.path}'], level: 'info' }
            }
        });
        const logger = log4js.getLogger('${req.body.path}');
        logger.info(req.method,req.query,req.body);
        ${req.body.code}
    });
    app.put('/${req.body.path}',(req,res)=>{
        log4js.configure({
            appenders: { ${req.body.path}: { type: 'file', filename: './logs/${req.body.path}.log', maxLogSize: 5242880 } },
            categories: {
                default: { appenders: ['${req.body.path}'], level: 'off' },
                ${req.body.path}: { appenders: ['${req.body.path}'], level: 'info' }
            }
        });
        const logger = log4js.getLogger('${req.body.path}');
        logger.info(req.method,req.query,req.body);
        ${req.body.code}
    });
    `);
    script.runInThisContext();
    res.status(200).json(req.body);
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
})

const server = app.listen(8000, () => {
    logger.info('App running on http://localhost:' + server.address().port);
});