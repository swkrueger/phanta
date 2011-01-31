var sys=require('sys'),
    rclient=require('redis').createClient(),
    util=require('../util'),
    Step = require('../lib/step.js');

sys.debug("loaded module " + __filename);

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


