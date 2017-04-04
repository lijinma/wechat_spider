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
        list.forEach(function (item) {
            if (item["app_msg_ext_info"] === undefined) {
                return;
            }
            var idx = 1;
            var msgInfo = item.app_msg_ext_info;
            var datetime = item.comm_msg_info.datetime;
            msgInfo.idx = idx;
            msgInfo.datetime = datetime;
            that.writePost(msgInfo);
            // 解决一次多篇文章的问题
            if (item["app_msg_ext_info"]["multi_app_msg_item_list"] === undefined) {
                return;
            }
            var multiList = item["app_msg_ext_info"]["multi_app_msg_item_list"];
            multiList.forEach(function (item) {
                item.idx = ++idx;
                item.datetime = datetime;
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
            var nextUrl = 'https://mp.weixin.qq.com/s?__biz=MjM5NDA0Mjc0MQ==&mid=2651552192&idx=1&sn=7e26978613beeb61b03efcce5ba78d4d&chksm=bd721fda8a0596ccdcd29c5b28401da97293483dc3d5bdbbe059dd7e93a61b1adb4468528dfc&scene=0&key=7d5fc353b9b96224eef12a4bbd1d173bd8a727a2492a1a58e306341c70596e048f716f1c1f97a12f0fa02dec9f0ef19c08f4a8517c367f0495d6e1c986be2f47930e9531ab9f714da7563b677ef936b7&ascene=0&uin=OTM1MDQxMDQw&devicetype=iMac+MacBookPro11%2C1+OSX+OSX+10.12+build(16A323)&version=12020110&nettype=WIFI&fontScale=100&pass_ticket=2%2FUV2AmxXs5c%2F7vN78C3LUNJBLtey4YUeu%2BLUJscWyxnufnaEKIEZ7w0DIG8ifSj';
            return nextUrl;
        }
        var rawQuery = '';
        var rawQuery = this.getRawQuery(currentUrl);

        var lastId = lastOne.comm_msg_info.id;
        var nextUrl = "http://mp.weixin.qq.com/mp/getmasssendmsg?" + rawQuery + "frommsgid=" + lastId + "&count=10"
        return nextUrl;
    },

    getBizFromUrl: function(url) {
        var rawQuery = this.getRawQuery(url);
        var parsedQuery = this.parseQuery(rawQuery);
        return parsedQuery.__biz;
    },

    getIdxFromUrl: function(url) {
        var rawQuery = this.getRawQuery(url);
        var parsedQuery = this.parseQuery(rawQuery);
        return parsedQuery.idx;
    },

    getMidFromUrl: function(url) {
        var rawQuery = this.getRawQuery(url);
        var parsedQuery = this.parseQuery(rawQuery);
        if (parsedQuery.mid) {
            return parsedQuery.mid;
        } else if (parsedQuery['amp;mid']) {
            return parsedQuery['amp;mid']
        } else if (parsedQuery['amp;amp;mid']) {
            return parsedQuery['amp;amp;mid']
        } else {
            return parsedQuery.appmsgid;
        }
    },

    writePost: function (msgInfo) {
        var author = msgInfo.author;
        var title = msgInfo.title;
        var contentUrl = msgInfo.content_url;
        contentUrl = msgInfo.content_url.replace(/amp;/g, "");
        var biz = this.getBizFromUrl(contentUrl);
        var appmsgid = this.getMidFromUrl(contentUrl);
        var cover = msgInfo.cover; //.replace(/\\\//g, "/");
        var digest = msgInfo.digest;
        var idx = msgInfo.idx;
        var sourceUrl = msgInfo.source_url;
        var createTime = new Date(msgInfo.datetime * 1000);

        db.insertOne(author, biz, appmsgid, title, contentUrl, cover, digest, idx, sourceUrl, createTime);
    },

    getNextChunk: function (url, delay) {
        var next = '<script>setTimeout(function(){window.location.href="' + url + '";},' + delay +');';
        next += '</script>';
        next += '<script>setTimeout(function(){window.location.href="' + url + '";},10000);';
        next += '</script>';
        return next;
    },

    getNextPostUrl: function (appmsgid, callback) {
        console.log('debug:', 'getNextPostUrl');
        db.getNextUnupdatedPostContentUrl(appmsgid, callback);
    },

    getContentUrl: function (reqUrl) {
        return 'http://mp.weixin.qq.com' + reqUrl;
    },

    //替换服务器响应的数据
    replaceServerResDataAsync: function (req, res, serverResData, callback) {
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
                if (nextUrl) {
                    var next = this.getNextChunk(nextUrl, 1000);
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
                if (nextUrl) {
                    var next = this.getNextChunk(nextUrl, 1000);
                    serverResData = next + serverResData;
                    //callback(serverResData);
                    callback(serverResData);
                    return;
                }
                callback(serverResData);
            }
            catch (e) {
                console.log(e);
            }
        } else if(/s\?__biz=/i.test(req.url)) {
            try {
                var biz = this.getBizFromUrl(req.url);
                var appmsgid = this.getMidFromUrl(req.url);
                var idx = this.getIdxFromUrl(req.url);
                var reg = /<strong class=\"profile_nickname\">(.*?)<\/strong>/;
                var ret = reg.exec(serverResData.toString());
                if (ret) {
                    db.updateOne(biz, appmsgid, idx, {
                        accoutName: ret[1],
                    });
                }
                that.getNextPostUrl(appmsgid, function (nextUrl) {
                    var next = that.getNextChunk(nextUrl, 3000);
                    serverResData = serverResData + next;
                    callback(serverResData);
                });
            }
            catch (e) {
                console.log('debug2:', req.url);
                console.log(e);
            }
        } else if(/mp\/getappmsgext\?__biz/i.test(req.url)) {
            try {
                var appmsgext = JSON.parse(serverResData.toString());
                if (!appmsgext.appmsgstat) {
                    callback(serverResData);
                    return;
                }
                var biz = this.getBizFromUrl(req.url);
                var appmsgid = this.getMidFromUrl(req.url);
                var idx = this.getIdxFromUrl(req.url);
                db.updateOne(biz, appmsgid, idx, {
                    readNum: appmsgext.appmsgstat.read_num,
                    likeNum: appmsgext.appmsgstat.like_num,
                    rewardNum: appmsgext.reward_total_count
                });

                callback(serverResData);
            } catch (e) {
                console.log(e);
            }

        } else if(/mp\/appmsg_comment\?action=getcommen/i.test(req.url)) {
            //这个是回复列表
            try {
                var appmsgComment = JSON.parse(serverResData.toString());
                var biz = this.getBizFromUrl(req.url);
                var appmsgid = this.getMidFromUrl(req.url);
                var idx = this.getIdxFromUrl(req.url);
                db.updateOne(biz, appmsgid, idx, {
                    electedCommentNum: appmsgComment.elected_comment_total_cnt,
                });
                callback(serverResData);
            } catch (e) {
                console.log(e);
            }
        } else if(/wechat_spider\.html/i.test(req.url)) {
            console.log('debug wechat_spider:' + req.url);
            //这个是回复列表
            try {
                callback(serverResData);
            } catch (e) {
                console.log(e);
            }

        } else {
            console.log('debug else:' + req.url);
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