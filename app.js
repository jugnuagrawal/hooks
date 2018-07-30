const express = require('express');
const bodyParser = require('body-parser');
const log4js = require('log4js');
const vm = require('vm');
const logger = log4js.getLogger('Server');
const app = express();

logger.level = 'info';

const usedPaths = ['deploy',''];

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

app.get('/routes', (req, res) => {
    res.json({ routes: app._router.stack.filter(e => e.name === 'bound dispatch') });
});

app.post('/deploy', (req, res) => {
    if(usedPaths.indexOf(req.body.path)>-1){
        res.status(400).json({message:'cannot use this path'});
        return;
    }
    const findIndex = app._router.stack.findIndex(e => e.path === '/' + req.body.path);
    if (findIndex > -1) {
        app._router.stack.splice(findIndex, 1);
    }
    const script = new vm.Script(`app.post('/${req.body.path}',(req,res)=>{${req.body.code}});app.put('/${req.body.path}',(req,res)=>{${req.body.code}});`);
    script.runInThisContext();
    res.status(200).json(req.body);
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
})

const server = app.listen(9000, () => {
    logger.info('App running on http://localhost:' + server.address().port);
});