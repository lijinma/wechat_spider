var utils = require("./util"),
    bodyParser = require("body-parser"),
    path = require("path"),
    fs = require("fs"),
    Promise = require("promise");

var interceptFlag = false,
    db = require('./db.js'),
    csv = require('./csv.js');

const Entities = require('html-entities').AllHtmlEntities;
const entities = new Entities();

var firstLink;
var nowOffset = 0;
var accountName;
var homeServerRespData;

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

    replaceResponseHeader: function(req,res,header){
        header = header || {};
        if(/mp\/profile_ext\?action=getmsg/i.test(req.url)) {
            // 报头由json改为html
            header['content-type'] = "text/html; charset=UTF-8";
        }
        return header;
    },

    getPosts: function (rawList) {
        var list = JSON.parse(rawList);
        return list.list;
    },
    savePosts: function (rawList, accountName) {
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
            msgInfo.accountName = accountName;
            that.writePost(msgInfo);
            // 解决一次多篇文章的问题
            if (item["app_msg_ext_info"]["multi_app_msg_item_list"] === undefined) {
                return;
            }
            var multiList = item["app_msg_ext_info"]["multi_app_msg_item_list"];
            multiList.forEach(function (item) {
                item.idx = ++idx;
                item.datetime = datetime;
                item.accountName = accountName;
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

    //获取下一页历史消息
    getNextUrl: function (currentUrl, rawList, appmsg_token) {
        console.log("==> 开始捕获下一页历史消息、");
        if (!rawList) {
            return '';
        }
        var currentUrlArr = currentUrl.split("&");
        var nextHistoryPageArr = [];
        for(var item in currentUrlArr){
            //console.log(currentUrlArr[item]);
            if(currentUrlArr[item].substring(0,5)=="/mp/p"||currentUrlArr[item].substring(0,5)=="__biz"||
                currentUrlArr[item].substring(0,5)=="scene"|| currentUrlArr[item].substring(0,5)=="pass_"){
                    nextHistoryPageArr.push(currentUrlArr[item]);
            }
        }

        nextHistoryPageUrl = nextHistoryPageArr.join('&');
        nextHistoryPageUrl += "&f=json";
        //偏移量将在主函数中由函数自动修改 这里不必更改
        nextHistoryPageUrl += "&offset=10";
        nextHistoryPageUrl += "&count=10&is_ok=1";
        nextHistoryPageUrl += "&uin=777&key=777";
        nextHistoryPageUrl += "&wxtoken=";
        nextHistoryPageUrl += "&appmsg_token=";
        nextHistoryPageUrl += appmsg_token;
        nextHistoryPageUrl = "https://mp.weixin.qq.com" + nextHistoryPageUrl;
        nextHistoryPageUrl = nextHistoryPageUrl.replace("home", "getmsg");

        console.log("==>", nextHistoryPageUrl);
        // firstLink = nextHistoryPageUrl;
        return nextHistoryPageUrl;
    },

    getBizFromUrl: function (url) {
        var rawQuery = this.getRawQuery(url);
        var parsedQuery = this.parseQuery(rawQuery);
        return parsedQuery.__biz;
    },

    getIdxFromUrl: function (url) {
        var rawQuery = this.getRawQuery(url);
        var parsedQuery = this.parseQuery(rawQuery);
        return parsedQuery.idx;
    },

    getMidFromUrl: function (url) {
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
        var accountName = msgInfo.accountName;
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

        // console.log("|==> ", contentUrl);
        db.insertOne(accountName, author, biz, appmsgid, title, contentUrl, cover, digest, idx, sourceUrl, createTime);
    },

    getNextChunk: function (url, delay, nonce) {
        if (nonce) {
            var next = '<script nonce="' + nonce + '" type="text/javascript">';
        } else {
            var next = '<script type="text/javascript">';
        }
        next += 'setTimeout(function(){window.location.href="' + url + '";},' + delay + ');';
        next += 'setTimeout(function(){window.location.href="' + url + '";},10000);';
        next += '</script>';
        return next;
    },

    getNotification: function () {
        return '<h1 style="color:red; font-size:20px; text-align: center; margin-top: 10px; margin-bottom: 10px;">3秒后没有自动刷新请手动刷新 ' + nowOffset.toString() + '</h1>';
    },

    getNextPostUrl: function (appmsgid, nonce, callback) {
        db.getNextUnupdatedPostContentUrl(appmsgid, nonce, callback);
    },

    getContentUrl: function (reqUrl) {
        return 'http://mp.weixin.qq.com' + reqUrl;
    },

    //替换服务器响应的数据
    replaceServerResDataAsync: function (req, res, serverResData, callback) {
        var that = this;
        if (/mp\/profile_ext\?action=home/i.test(req.url)) {
            try {
                homeServerRespData = serverResData;
                var reg = /var msgList = \'(.*?)\';/;
                var ret = reg.exec(serverResData.toString());
                var ret = entities.decode(ret[1].toString());
                if (!ret) {
                    console.log("==> 空包");
                    callback(serverResData);
                    return;
                }
                //公众号名称
                var nickname_pattern = /var nickname = \"(.*?)\"/;
                accountName = nickname_pattern.exec(serverResData.toString())[1];
                this.savePosts(ret, accountName);
                
                // token
                var appmsg_token_pattern = /window.appmsg_token = \"(.*?)\";/;
                var appmsg_token = appmsg_token_pattern.exec(serverResData.toString())[1];

                firstLink = this.getNextUrl(req.url, ret, appmsg_token);
                var nextUrl = firstLink;
                if (nextUrl) {
                    nowOffset = 0;
                    var next = this.getNextChunk(nextUrl, 2000);
                    var note = that.getNotification();
                    serverResData = note + serverResData + next;
                    callback(serverResData);
                    return;
                }
                callback(serverResData);
            }
            catch (e) {
                console.log(e);
            }
        } else if(/mp\/profile_ext\?action=getmsg/i.test(req.url)){
            try {
                if(!serverResData){
                    console.log("==> 抓取公众号全部历史文章结束！");
                    return;
                }
                var ResDataobj = JSON.parse(serverResData.toString());
                var rawGeneralMsgList = ResDataobj['general_msg_list'].replace(/\\\"/g, '"');
                
                this.savePosts(rawGeneralMsgList, accountName);
                
                //注入跳转再下一页的js
                nowOffset += 10;
                firstLink = firstLink.replace("&offset="+nowOffset.toString(), "&offset="+(nowOffset+10).toString());
                console.log("==>", firstLink);
                nextUrl = firstLink;
                if (nextUrl) {
                    //注入跳转下一历史页面的js
                    var next = this.getNextChunk(nextUrl, 2000);
                    var note = that.getNotification();
                    serverResData = note + homeServerRespData.toString() + next;
                    callback(serverResData);
                }
                callback(serverResData);
            }
            catch (e){
                console.log(e);
            }
        } else if (/s\?__biz=/i.test(req.url)) {
            try {
                var biz = this.getBizFromUrl(req.url);
                var appmsgid = this.getMidFromUrl(req.url);
                var idx = this.getIdxFromUrl(req.url);
                var reg = /<strong class=\"profile_nickname\">(.*?)<\/strong>/;
                var ret = reg.exec(serverResData.toString());
                if (ret) {
                    db.updateOne(biz, appmsgid, idx, {
                        accountName: ret[1],
                    });
                }
                var nonce = 0;
                var reg = /<script nonce=\"(.*?)\"/;
                var ret = reg.exec(serverResData.toString());
                if (ret) {
                    nonce = ret[1];
                }
                that.getNextPostUrl(appmsgid, nonce, function (nextUrl, nonce) {
                    var next = that.getNextChunk(nextUrl, 3000, nonce);
                    var note = that.getNotification();
                    serverResData = note + serverResData + next;
                    callback(serverResData);
                });
            }
            catch (e) {
                console.log(e);
            }
        } else if (/mp\/getappmsgext\?__biz/i.test(req.url)) {
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

        } else if (/mp\/appmsg_comment\?action=getcommen/i.test(req.url)) {
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
        } else if (/wechat_spider\.html/i.test(req.url)) {
            //这个是回复列表
            try {
                callback(serverResData);
            } catch (e) {
                console.log(e);
            }
        } else if (/wechat_begin\.html/i.test(req.url)) {
            //这个是回复列表
            try {
                var appmsgid = 0;
                that.getNextPostUrl(appmsgid, 0, function (nextUrl) {
                    var next = that.getNextChunk(nextUrl, 3000);
                    serverResData = serverResData + next;
                    callback(serverResData);
                });
            } catch (e) {
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
        interceptFlag = flag;
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