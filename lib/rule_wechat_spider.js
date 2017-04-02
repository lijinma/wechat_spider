var utils = require("./util"),
    bodyParser = require("body-parser"),
    path = require("path"),
    fs = require("fs"),
    Promise = require("promise");

var isRootCAFileExists = require("./certMgr.js").isRootCAFileExists(),
    interceptFlag = false,
    db = require('./db.js'),
    csv = require('./csv.js');

//e.g. [ { keyword: 'aaa', local: '/Users/Stella/061739.pdf' } ]
var mapConfig = [],
    configFile = "mapConfig.json";
function saveMapConfig(content, cb) {
    new Promise(function (resolve, reject) {
        var anyproxyHome = utils.getAnyProxyHome(),
            mapCfgPath = path.join(anyproxyHome, configFile);

        if (typeof content == "object") {
            content = JSON.stringify(content);
        }
        resolve({
            path: mapCfgPath,
            content: content
        });
    })
        .then(function (config) {
            return new Promise(function (resolve, reject) {
                fs.writeFile(config.path, config.content, function (e) {
                    if (e) {
                        reject(e);
                    } else {
                        resolve();
                    }
                });
            });
        })
        .catch(function (e) {
            cb && cb(e);
        })
        .done(function () {
            cb && cb();
        });
}
function getMapConfig(cb) {
    var read = Promise.denodeify(fs.readFile);

    new Promise(function (resolve, reject) {
        var anyproxyHome = utils.getAnyProxyHome(),
            mapCfgPath = path.join(anyproxyHome, configFile);

        resolve(mapCfgPath);
    })
        .then(read)
        .then(function (content) {
            return JSON.parse(content);
        })
        .catch(function (e) {
            cb && cb(e);
        })
        .done(function (obj) {
            cb && cb(null, obj);
        });
}

setTimeout(function () {
    //load saved config file
    getMapConfig(function (err, result) {
        if (result) {
            mapConfig = result;
        }
    });
}, 1000);


module.exports = {
    token: Date.now(),
    summary: function () {
        var tip = "the default rule for AnyProxy.";
        if (!isRootCAFileExists) {
            tip += "\nRoot CA does not exist, will not intercept any https requests.";
        }
        return tip;
    },

    shouldUseLocalResponse: function (req, reqBody) {
        //intercept all options request
        var simpleUrl = (req.headers.host || "") + (req.url || "");
        mapConfig.map(function (item) {
            var key = item.keyword;
            if (simpleUrl.indexOf(key) >= 0) {
                req.anyproxy_map_local = item.local;
                return false;
            }
        });


        return !!req.anyproxy_map_local;
    },

    dealLocalResponse: function (req, reqBody, callback) {
        if (req.anyproxy_map_local) {
            fs.readFile(req.anyproxy_map_local, function (err, buffer) {
                if (err) {
                    callback(200, {}, "[AnyProxy failed to load local file] " + err);
                } else {
                    var header = {
                        'Content-Type': utils.contentType(req.anyproxy_map_local)
                    };
                    callback(200, header, buffer);
                }
            });
        }
    },

    replaceRequestProtocol: function (req, protocol) {
    },

    replaceRequestOption: function (req, option) {
    },

    replaceRequestData: function (req, data) {
    },

    replaceResponseStatusCode: function (req, res, statusCode) {
    },

    replaceResponseHeader: function (req, res, header) {
    },

    getPosts: function (rawList) {
        var list = JSON.parse(rawList);
        return list.list;
    },
    savePosts: function (rawList) {
        var that = this;
        var list = this.getPosts(rawList);
        console.log(list);
        list.forEach(function (item) {
            if (item["app_msg_ext_info"] === undefined) {
                return;
            }
            var multiIdx = 1;
            var msgInfo = item;
            msgInfo.app_msg_ext_info.multiIdx = multiIdx;
            that.writePost(msgInfo);
            // 解决一次多篇文章的问题
            if (item["app_msg_ext_info"]["multi_app_msg_item_list"] === undefined) {
                return;
            }
            var multiList = item["app_msg_ext_info"]["multi_app_msg_item_list"];
            multiList.forEach(function (item) {
                item.multiIdx = multiIdx ++;
                that.writePost(item);
            });
        })
    },

    splitOnce: function (input, splitBy) {
        var i = input.indexOf(splitBy);

        return [input.slice(0, i), input.slice(i + 1)];
    },

    parseQuery: function (qstr) {
        var query = {};
        var a = qstr.split('&');
        for (var i = 0; i < a.length; i++) {
            var b = this.splitOnce(a[i], '=');
            query[b[0]] = b[1] || '';
        }
        return query;
    },

    getRawQuery: function (webUrl) {
        var url = require('url');
        var parsedUrl = url.parse(webUrl);
        var query = parsedUrl.query;
        query = this.parseQuery(query);
        delete query.frommsgid;
        delete query.count;
        delete query.f;
        var result = '';
        for (var key in query) {
            if (query.hasOwnProperty(key)) {
                result += key + '=' + query[key] + '&';
            }
        }

        return result;
    },

    getNextUrl: function (currentUrl, rawList) {

        var list = this.getPosts(rawList);
        if (!list) {
            return '';
        }
        var lastOne = list.pop();
        if (!lastOne) {
            //如果列表中没有数据，开始抓文章
            csv.saveAll();
            return '';
        }
        var rawQuery = '';
        var rawQuery = this.getRawQuery(currentUrl);

        var lastId = lastOne.comm_msg_info.id;
        var nextUrl = "http://mp.weixin.qq.com/mp/getmasssendmsg?" + rawQuery + "frommsgid=" + lastId + "&count=10"
        return nextUrl;
    },

    getBizFromUrl: function(contentUrl) {
        var rawQuery = this.getRawQuery(contentUrl);
        var parsedQuery = this.parseQuery(rawQuery);
        return parsedQuery.__biz;
    },

    writePost: function (msgInfo) {
        var author = msgInfo.app_msg_ext_info.author;
        var appmsgid = msgInfo.comm_msg_info.id;
        var title = msgInfo.app_msg_ext_info.title;
        var contentUrl = msgInfo.app_msg_ext_info.content_url.replace(/\\\//g, "/");
        var biz = this.getBizFromUrl(contentUrl);
        var cover = msgInfo.app_msg_ext_info.cover;
        var digest = msgInfo.app_msg_ext_info.digest;
        var multiIdx = msgInfo.app_msg_ext_info.multiIdx;
        var sourceUrl = msgInfo.app_msg_ext_info.source_url;
        var createTime = new Date(msgInfo.comm_msg_info.datetime * 1000);

        console.log("debug:",  "A link was saved in urls.txt!");
        db.insertOne(author, biz, appmsgid, title, contentUrl, cover, digest, multiIdx, sourceUrl, createTime);
    },

    getNextChunk: function (url) {
        var next = '<script>setTimeout(function(){window.location.href="' + url + '";},1000);';
        next += '</script>';
        return next;
    },

    //替换服务器响应的数据
    replaceServerResDataAsync: function (req, res, serverResData, callback) {
        console.log('debug:', __dirname);
        var that = this;
        if (/mp\/getmasssendmsg/i.test(req.url)) {
            try {
                var reg = /msgList = (.*?);\r\n/;
                var ret = reg.exec(serverResData.toString());
                if (!ret) {
                    callback(serverResData);
                    return;
                }
                ret = ret[1]
                this.savePosts(ret)

                var nextUrl = this.getNextUrl(req.url, ret);
                console.log('debug:', nextUrl);
                if (nextUrl) {
                    var next = this.getNextChunk(nextUrl);
                    console.log('debug:', next);
                    serverResData += next;
                    callback(serverResData);
                }
                callback(serverResData);
            } catch (e) {
                console.log(e);
            }
        } else if (/mp\/profile_ext\?action=home/i.test(req.url)) {
            try {
                var reg = /var msgList = \'(.*?)\';/;
                var ret = reg.exec(serverResData.toString());
                var ret = ret[1].replace(/&quot;/g,'"');
                if (!ret) {
                    callback(serverResData);
                    return;
                }
                this.savePosts(ret)

                var nextUrl = this.getNextUrl(req.url, ret);
                console.log('debug:', nextUrl);
                if (nextUrl) {
                    var next = this.getNextChunk(nextUrl);
                    console.log('debug:', next);
                    serverResData = next + serverResData;
                    console.log('debug:', serverResData);
                    //callback(serverResData);
                    callback(serverResData);
                    return;
                }
                callback(serverResData);
            }
            catch (e) {
                console.log(e);
            }
        } else {
            callback(serverResData);
        }
    },
    pauseBeforeSendingResponse: function (req, res) {
    },

    shouldInterceptHttpsReq: function (req) {
        return interceptFlag;
    },

    //[beta]
    //fetch entire traffic data
    fetchTrafficData: function (id, info) {
    },

    setInterceptFlag: function (flag) {
        interceptFlag = flag && isRootCAFileExists;
    },

    _plugIntoWebinterface: function (app, cb) {

        app.get("/filetree", function (req, res) {
            try {
                var root = req.query.root || utils.getUserHome() || "/";
                utils.filewalker(root, function (err, info) {
                    res.json(info);
                });
            } catch (e) {
                res.end(e);
            }
        });

        app.use(bodyParser.json());
        app.get("/getMapConfig", function (req, res) {
            res.json(mapConfig);
        });
        app.post("/setMapConfig", function (req, res) {
            mapConfig = req.body;
            res.json(mapConfig);

            saveMapConfig(mapConfig);
        });

        cb();
    },

    _getCustomMenu: function () {
        return [
            // {
            //     name:"test",
            //     icon:"uk-icon-lemon-o",
            //     url :"http://anyproxy.io"
            // }
        ];
    }
};