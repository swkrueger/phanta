var sys=require('sys'),
    util=require('./util'),
    redisclient=require('./lib/redis-client.js');

var rclient = redisclient.createClient();

function dbget(key, callback) {
    rclient.get(key, function (err, value) {
        if (err) callback(err);
    });
}

