var utils      = require("./util"),
    bodyParser = require("body-parser"),
    path       = require("path"),
    fs         = require("fs"),
    Promise    = require("promise");

var isRootCAFileExists = require("./certMgr.js").isRootCAFileExists(),
    interceptFlag      = false;

//e.g. [ { keyword: 'aaa', local: '/Users/Stella/061739.pdf' } ]
var mapConfig = [],
    configFile = "mapConfig.json";
function saveMapConfig(content,cb){
    new Promise(function(resolve,reject){
        var anyproxyHome = utils.getAnyProxyHome(),
            mapCfgPath   = path.join(anyproxyHome,configFile);

        if(typeof content == "object"){
            content = JSON.stringify(content);
        }
        resolve({
            path    :mapCfgPath,
            content :content
        });
    })
    .then(function(config){
        return new Promise(function(resolve,reject){
            fs.writeFile(config.path, config.content, function(e){
                if(e){
                    reject(e);
                }else{
                    resolve();
                }
            });
        });
    })
    .catch(function(e){
        cb && cb(e);
    })
    .done(function(){
        cb && cb();
    });
}
function getMapConfig(cb){
    var read = Promise.denodeify(fs.readFile);

    new Promise(function(resolve,reject){
        var anyproxyHome = utils.getAnyProxyHome(),
            mapCfgPath   = path.join(anyproxyHome,configFile);

        resolve(mapCfgPath);
    })
    .then(read)
    .then(function(content){
        return JSON.parse(content);
    })
    .catch(function(e){
        cb && cb(e);
    })
    .done(function(obj){
        cb && cb(null,obj);
    });
}

setTimeout(function(){
    //load saved config file
    getMapConfig(function(err,result){
        if(result){
            mapConfig = result;
        }
    });
},1000);


module.exports = {
    token: Date.now(),
    summary:function(){
        var tip = "the default rule for AnyProxy.";
        if(!isRootCAFileExists){
            tip += "\nRoot CA does not exist, will not intercept any https requests.";
        }
        return tip;
    },

    shouldUseLocalResponse : function(req,reqBody){
        //intercept all options request
        var simpleUrl = (req.headers.host || "") + (req.url || "");
        mapConfig.map(function(item){
            var key = item.keyword;
            if(simpleUrl.indexOf(key) >= 0){
                req.anyproxy_map_local = item.local;
                return false;
            }
        });


        return !!req.anyproxy_map_local;
    },

    dealLocalResponse : function(req,reqBody,callback){
        if(req.anyproxy_map_local){
            fs.readFile(req.anyproxy_map_local,function(err,buffer){
                if(err){
                    callback(200, {}, "[AnyProxy failed to load local file] " + err);
                }else{
                    var header = {
                        'Content-Type': utils.contentType(req.anyproxy_map_local)
                    };
                    callback(200, header, buffer);
                }
            });
        }
    },

    replaceRequestProtocol:function(req,protocol){
    },

    replaceRequestOption : function(req,option){
    },

    replaceRequestData: function(req,data){
    },

    replaceResponseStatusCode: function(req,res,statusCode){
    },

    replaceResponseHeader: function(req,res,header){
    },

    // Deprecated
    // replaceServerResData: function(req,res,serverResData){
    //     return serverResData;
    // },
    getNextChunk: function(list, callback) {
        this.postJson(list, '/api/next_chunk', callback);
    },

    postJson: function(jsonArray, path, callback) {

        var http=require('http');
        var bodyString = JSON.stringify(jsonArray);
        var headers = {
            'Content-Type': 'application/json',
        };


        var options = {
            host: 'mp.lijinma.com',
            port: 80,
            // host: 'localhost',
            // port: 8000,
            path: path,
            method: 'POST',
            headers: headers
        };

        var req=http.request(options,function(res){
            res.setEncoding('utf-8');
            var responseString = '';
            res.on('data', function(data) {
                responseString += data;
            });

            res.on('end', function() {
              callback(responseString);
              console.log('---- add one list ----', responseString);
          });

            req.on('error', function(e) {
                console.log('-----error-------',e);
            });
        });
        req.write(bodyString);
        req.end();
    },

    //替换服务器响应的数据
    //replace the response from the server before it's sent to the user
    //you may return either a Buffer or a string
    //serverResData is a Buffer. for those non-unicode reponse , serverResData.toString() should not be your first choice.
    replaceServerResDataAsync: function (req, res, serverResData, callback) {

        if (/mp\/getmasssendmsg/i.test(req.url)) {//当链接地址为公众号历史消息页面时(第一种页面形式)
            if (serverResData.toString() !== "") {
                try {//防止报错退出程序
                    var reg = /msgList = (.*?);\r\n/;//定义历史消息正则匹配规则
                    var ret = reg.exec(serverResData.toString());//转换变量为string
                    //console.log(ret[1]);
                    var list = JSON.parse(ret[1]);
                    list.current_url = req.url;
                    this.getNextChunk(list, function(nextChunk) {
                        serverResData += nextChunk;
                        callback(serverResData);
                    });
                } catch (e) {
                    console.log(e);
                }
            }
        }
        else {
            callback(serverResData);
        }
    },
    pauseBeforeSendingResponse: function(req,res){
    },

    shouldInterceptHttpsReq:function(req){
        return interceptFlag;
    },

    //[beta]
    //fetch entire traffic data
    fetchTrafficData: function(id,info){},

    setInterceptFlag: function(flag){
        interceptFlag = flag && isRootCAFileExists;
    },

    _plugIntoWebinterface: function(app,cb){

        app.get("/filetree",function(req,res){
            try{
                var root = req.query.root || utils.getUserHome() || "/";
                utils.filewalker(root,function(err, info){
                    res.json(info);
                });
            }catch(e){
                res.end(e);
            }
        });

        app.use(bodyParser.json());
        app.get("/getMapConfig",function(req,res){
            res.json(mapConfig);
        });
        app.post("/setMapConfig",function(req,res){
            mapConfig = req.body;
            res.json(mapConfig);

            saveMapConfig(mapConfig);
        });

        cb();
    },

    _getCustomMenu : function(){
        return [
            // {
            //     name:"test",
            //     icon:"uk-icon-lemon-o",
            //     url :"http://anyproxy.io"
            // }
        ];
    }
};