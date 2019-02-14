module.exports.getContent = (data)=>{
    return `
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
    `;
}