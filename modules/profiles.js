var sys=require('sys'),
    rclient=require('redis').createClient(),
    util=require('../util'),
    Step = require('../lib/step.js');

sys.debug("loaded module " + __filename);

var pubsub = require("./pubsub");

profiles = exports;

// curl -X GET http://127.0.0.1:8080/profiles/list
profiles.list = { };
profiles.list.GET = function(req, res) {
    var start = parseInt(req.params.start) || 0;
    var count = parseInt(req.params.count)-1 || 20;
    console.log("Get list of profiles: start="+start+"; count="+count);

    return rclient.zrange("usernames:userid", start, start+count, function(err, userids) {
        if (err) return res.mkError(500, err)(req, res);
        var multi = rclient.multi();
        for (var i in userids) {
            multi.get("userid:" + userids[i] + ":profile")
                 .smembers("userid:" + userids[i] + ":followers")
                 .smembers("userid:" + userids[i] + ":following");
        }
        multi.exec(function(err, reply) {
            var profiles = [];
            for (var i=0; i<reply.length;) {
                var profile = JSON.parse(reply[i++]);
                profile.followers = reply[i++];
                profile.following = reply[i++];
                profiles.push(profile);
            }
            return res.simpleJSON(200, profiles);
        });
    });
};

profiles.search ={ };
profiles.search.GET = function(req, res) {
    var q = req.params.q;
    if (q=="") return mkError(400, "Please spesify the query string")(req, res);
    var last = q.substring(0,q.length-1) + String.fromCharCode(q.charCodeAt(q.length-1)+1);
    var count = parseInt(req.params.count) || 10;
    var creatednew, lcreatednew, rank, lrank;
    results = [];
    Step(
        function addTempKey() {
            rclient.zadd("usernames:username", 0, q, this.parallel());
            rclient.zadd("usernames:username", 0, last, this.parallel());
        },
        function getIndex(err, result, lresult) {
            if (err) return mkError(500, err.stack)(req, res);
            creatednew = result;
            lcreatednew = lresult;
            rclient.zrank("usernames:username", q, this.parallel());
            rclient.zrank("usernames:username", last, this.parallel());
        },
        function delTempKey(err, r, lr) {
            if (err) return mkError(500, err.stack)(req, res);
            rank = r;
            lrank = lr;
            if (creatednew==1) rclient.zrem("usernames:username", q, this.parallel());
            if (lcreatednew==1) {
                lrank--;
                rclient.zrem("usernames:username", last, this.parallel());
            }
            if (creatednew==0 && lcreatednew==0) this(false, 2, 2);
        },
        function getResults(err, removed, lremoved) {
            if (err) return mkError(500, err.stack)(req, res);
            //TODO: Ignore temp keys by other clients
            var start = rank;
            var stop = start+count;
            if (lrank<stop) stop=lrank;
            console.log("Getting usernames from "+start+" to "+stop);
            rclient.zrange("usernames:username", start, stop-1, this);
        },
        function returnResults(err, keys) {
            if (err) return mkError(500, err.stack)(req, res);
            console.log(keys);
            return res.simpleJSON(200, {
                usernames: keys,
            });
        }
    );

};

// List users

// Search users (wildcard)




// following -> POST /profiles/following { username|userid : <username|userid> }
//              follow username or userid
// following -> DELETE /profiles/following?[username|userid=]
//              unfollow username or userid
// ccurl -X POST -d '{"username":"antoine@7degrees.co.za"}' "http://127.0.0.1:8080/profiles/following"
// ccurl -X DELETE "http://127.0.0.1:8080/profiles/following?username=antoine@7degrees.co.za"
profiles.following = {
  POST : function(request, response) {
    if (!request.session.data.authorized) return response.fin(401, "not logged in");
    if (!request.data.username && !request.data.userid) return response.fin(400, "specify username or userid");
    var client = request.session.redis();
    if (request.data.username) { // if username specified, need to look up uid
      return client.get("username:" + request.data.username + ":userid", function(error, userid) {
        if (error) return response.fin(500, error);
        if (!userid) return response.fin(404, "no username:" + request.data.username);
        follow(userid);
      });
    }
    follow(request.data.userid);
    function follow(userid) {
      client.multi()
          .get ("userid:" + userid + ":username")
          .sadd("userid:" + request.session.data.userid + ":following", userid)
          .sadd("userid:" + userid + ":followers", request.session.data.userid)
          .exec(function(error, reply) {
            if (error) return response.fin(500, error);
            if (!reply[0]) return response.fin(404, "no username found for userid:" + userid);
            request.data.channel = reply[0];
            return pubsub.subscribers.POST(request, response);
          });
    }
  },

  DELETE : function(request, response) {
    if (!request.session.data.authorized)           return response.fin(401, "not logged in");
    if (!request.query.username && !request.query.userid) return response.fin(400, "specify username or userid");
    var client = request.session.redis();
    if (request.query.username) { // if username specified, need to look up uid
      return client.get("username:" + request.query.username + ":userid", function(error, userid) {
        if (error) return response.fin(500, error);
        unfollow(userid);
      });
    }
    unfollow(request.query.userid);
    function unfollow(userid) {
      client.multi()
          .get ("userid:" + userid + ":channelid")
          .srem("userid:" + request.session.data.userid + ":following", userid)
          .srem("userid:" + userid + ":followers", request.session.data.userid)
          .exec(function(error, reply) {
            if (error) return response.fin(500, error);
            if (!reply[0]) return response.fin(500, "no channelid found for userid:" + userid);
            request.query.channelid = reply[0];
            return pubsub.subscribers.DELETE(request, response);
          });
    }
  }
};