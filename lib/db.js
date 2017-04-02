var Sequelize = require('sequelize');
var sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: process.cwd() + '/wechat.sqlite'
});

var Post = sequelize.define('Post', {
  biz: Sequelize.STRING, //每个账号的唯有标记，base64
  appmsgid: Sequelize.STRING, //每个账号一个文章的 ID，注意，这里不是全局唯一的，多个账号可能重复
  accoutName: Sequelize.STRING, //公众号名称，比如 赤兔金马奖
  author: Sequelize.STRING, //作者名称，比如 金马
  title: Sequelize.STRING,
  cover: Sequelize.STRING(1234),
  contentUrl: Sequelize.STRING(1234),
  digest: Sequelize.TEXT,
  multiIdx: Sequelize.INTEGER, //多篇文章的时候的排序，第一篇是 1，第二篇是 2
  sourceUrl: Sequelize.STRING(1234),
  createTime: Sequelize.DATE,
  readNum: Sequelize.INTEGER, //阅读数
  likeNum: Sequelize.INTEGER, //点赞数
  rewardNum: Sequelize.INTEGER, //赞赏数
}, {
  tableName: 'posts'
});

var insertOne = function(author, biz, appmsgid, title, contentUrl, cover, digest, multiIdx, sourceUrl, createTime) {
  sequelize.sync().then(function() {
    return Post.create({
        author: author,
        biz: biz,
        appmsgid: appmsgid,
        title: title,
        contentUrl: contentUrl,
        cover: cover,
        digest: digest,
        multiIdx: multiIdx,
        sourceUrl: sourceUrl,
        createTime, createTime,
      })
  }).then(function(post) {
    // console.log(post.get({
    //   plain: true
    // }));
  });
};

var updateOne = function(contentUrl, authorName, readNum, likeNum, rewardNum) {
    return Post.update(
      {
        authorName: authorName,
        readNum: readNum,
        likeNum: likeNum,
        rewardNum: rewardNum,
      },
      {
        where: {
          contentUrl : contentUrl
        }
      }
    ).then(function() { 
      console.log("update count success");
    }).catch(function(error) { 
      console.log("Update failed: " + error);
    });
};

var all = function() {
  return Post.findAll();
}

module.exports = {
  insertOne: insertOne,
  updateOne: updateOne,
  all: all
};

// insertOne('test', 'http://www');
// updateOne('http://www', 111);
// var posts = Post.findAll().then(function(posts) {
//   posts.forEach(function(post) {
//     console.log(post.get());
//   });
// });