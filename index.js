var proxy = require("anyproxy");

module.exports = function (silent) {
    //create cert when you want to use https features
    //please manually trust this rootCA when it is the first time you run it
    !proxy.isRootCAFileExists() && proxy.generateRootCA();

    var options = {
        type          : "http",
        port          : 8001,
        hostname      : "localhost",
        rule          : require("./lib/rule_wechat_spider.js"),
        dbFile        : null,  // optional, save request data to a specified file, will use in-memory db if not specified
        webPort       : 8002,  // optional, port for web interface
        socketPort    : 8003,  // optional, internal port for web socket, replace this when it is conflict with your own service
        disableWebInterface : false, //optional, set it when you don't want to use the web interface
        setAsGlobalProxy : false, //set anyproxy as your system proxy
        silent        : false, //optional, do not print anything into terminal. do not set it when you are still debugging.
        interceptHttps: true
    };
    new proxy.proxyServer(options);
};
