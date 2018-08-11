const express = require('express');
const bodyParser = require('body-parser');
const log4js = require('log4js');
const vm = require('vm');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const logger = log4js.getLogger('server');
const app = express();

const schema = new mongoose.Schema({
    _id: {
        type: 'String'
    },
    code: {
        type: 'String'
    },
    timestamp: {
        type: 'Date'
    }
});

const model = mongoose.model('controller', schema);
const mongo_url = process.env.MONGO_URL || 'mongodb://localhost:27017/hooks';

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


//checking mongodb is available
app.use((req, res, next) => {
    if (mongoose.connections.length == 0 || mongoose.connections[0].readyState !== 1) {
        mongoose.connect(mongo_url, (err) => {
            if (err) {
                logger.error(err);
                res.status(500).json({ message: 'We are unable to process your request please try again later.' });
            } else {
                next();
            }
        });
    } else {
        next();
    }
});

global.app = app;
global.log4js = log4js;
global.path = path;
global.fs = fs;
global.__dirname = __dirname;

app.get('/hook', (req, res) => {
    model.find({}, (err, data) => {
        if (err) {
            res.status(500).json({ message: 'Unable to fetch hooks' })
        } else {
            res.status(200).json({ hooks: data });
        }
    });
});

app.get('/hook/:path', (req, res) => {
    model.findById(req.params.path, (err, data) => {
        if (err) {
            res.status(500).json({ message: 'Unable to fetch hook' })
        } else {
            res.status(200).json(data);
        }
    });
});

app.post('/deploy', (req, res) => {
    if (usedPaths.indexOf(req.body.path) > -1) {
        res.status(400).json({ message: 'This path is reserved, please change your path' });
        return;
    }
    model.findById(req.body.path, (err1, data1) => {
        if (err1) {
            res.status(500).message({ message: 'Unable to create hook' });
            return;
        }
        let body = {
            _id: req.body.path,
            code: req.body.code,
            timestamp: new Date()
        };
        let query;
        if (data1) {
            query = model.findByIdAndUpdate(req.body.path, body).exec();
        } else {
            query = model.create(body);
        }
        query.then(data2 => {
            const findIndex = app._router.stack.findIndex(e => e.path === '/' + req.body.path);
            if (findIndex > -1) {
                app._router.stack.splice(findIndex, 1);
            }
            createHook(req.body);
            res.status(200).json({ message: 'Hook created' });
        }).catch(err2 => {
            res.status(500).message({ message: 'Unable to create hook' });
        });
    });
});

app.delete('/deploy/:path', (req, res) => {
    if (usedPaths.indexOf(req.params.path) > -1) {
        res.status(400).json({ message: 'Cannot delete this hook' });
        return;
    }
    model.findByIdAndRemove(req.params.path, (err, data) => {
        if (err) {
            res.status(500).message({ message: 'Unable to delete hook' });
            return;
        }
        const findIndex = app._router.stack.findIndex(e => e.path === '/' + req.params.path);
        if (findIndex > -1) {
            app._router.stack.splice(findIndex, 1);
        }
        res.status(200).json({ message: 'Hook deleted' });
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const server = app.listen(8000, () => {
    model.find({}, (err, data) => {
        for (let i in data) {
            const d = {
                path: data[i]._id,
                code: data[i].code
            }
            createHook(d);
        }
    });
    logger.info('App running on http://localhost:' + server.address().port);
});


function createHook(data) {
    const script = new vm.Script(`
            app.get('/${data.path}/console',(req,res)=>{
                const file = path.join(__dirname,'logs/${data.path}.log');
                try{
                    fs.statSync(file);
                    if(req.headers['content-type'] === 'application/json'){
                        fs.readFile(file,'utf8',(err,data)=>{
                            if(data){
                                var arr = data.split('\\n');
                                arr.splice(0,arr.length-1000);
                                res.json({logs:arr});
                            }else{
                                res.json({message:'No logs!'});    
                            }
                        });
                    }else{
                        res.sendFile(file);
                    }
                }catch(e){
                    if(req.headers['content-type'] === 'application/json'){
                        res.json({message:'No logs!'});
                    }else{
                        res.end('No logs!');
                    }
                }
            });
            app.post('/${data.path}',(req,res)=>{
                log4js.configure({
                    appenders: { '${data.path}': { type: 'file', filename: './logs/${data.path}.log', maxLogSize: 5242880 } },
                    categories: { 
                        default: { appenders: ['${data.path}'], level: 'off' },
                        '${data.path}': { appenders: ['${data.path}'], level: 'info' }
                    }
                });
                const logger = log4js.getLogger('${data.path}');
                logger.info(req.method,req.query,req.body);
                ${data.code}
            });
            app.put('/${data.path}',(req,res)=>{
                log4js.configure({
                    appenders: { '${data.path}': { type: 'file', filename: './logs/${data.path}.log', maxLogSize: 5242880 } },
                    categories: {
                        default: { appenders: ['${data.path}'], level: 'off' },
                        '${data.path}': { appenders: ['${data.path}'], level: 'info' }
                    }
                });
                const logger = log4js.getLogger('${data.path}');
                logger.info(req.method,req.query,req.body);
                ${data.code}
            });
            `);
    script.runInThisContext();
}