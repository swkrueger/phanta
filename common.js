var sys=require('sys'),
    util=require('./util');

/*var rclient = redisclient.createClient();

function dbget(key, callback) {
    rclient.get(key, function (err, value) {
        if (err) callback(err);
    });
}

function dbget(key, callback) {
    rclient.get(key, function (err, exists) {
        if (err) callback(err);
    });
}

