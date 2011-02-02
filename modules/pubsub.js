
var http  = require("http");
var redis = require("redis");
var fs    = require("fs");
var fail  = require("../common").fail;

console.log("loaded module: pubsub");


/*
  Two kinds:

    -> realtime : as they come in you get it and it is removed from the queue
                  Q: anything coming in when you are not there is lost/buffered ?
       probably best implemented using Redis PubSub & Websockets

    -> historic : first request gives you everything since the last time 
                  as they come in you get it and it is removed from the queue and appended to the historic queue
                  anything coming in when you are not there is buffered
                  optional: you can request any past message within a date/numeric range

   next:userid
   usernames:username                     // zset of usernames (emails)
   usernames:userid                       // set of userids
   userid:<userid>:username
   userid:<userid>:hash
   userid:<userid>:channelid          // can add multiple channels later
   userid:<userid>:timeline           // zset of <messageid>
   userid:<userid>:following          // set of <uid>   <--- 
   userid:<userid>:followers          // set of <uid>   <--- Can follow someone without subcribing to a channel. 
                                                             Also see: channelid:(userid:<userid>:channelid):subscribers
   userid:<userid>:email
   username:<username>:userid

   next:channelid
   channels:channel                   // zset of channel names
   channelid:<channelid>:timeline     // ZADD channelid:<channelid>:buffer <timestamp> <message>
   channelid:<channelid>:subscribers  // subscribers' <uid>'s
   channel:<channel>:channelid        // channel name - usually user email by default

   next:messageid
   messageid:<messageid>:message

   // Posting a message
   <userid>      = request.session.data.userid
   <channelid>   = GET  userid:<userid>:channelid
   <subscribers> = GET  channelid:<channelid>:subscribers
   <messageid>   = INCR next:messageid
   <message>     = SET  messageid:<messageid>:message = { timestamp : <seconds>,
                                                          channelid : <channelid>,
                                                          data      : <data> }
   ZADD channelid:<channelid>:timeline <timestamp> <messageid>    // channel keeps a permanent timeline of everything posted to it   
   PUSH userid:<userid>:timeline <messageid>
   foreach <userid> in <subscribers>
     PUSH userid:<userid>:timeline <messageid>

*/

// next:channelid, channel:<channel>:channelid, channels:channel, userid:<userid>:channelid
// channel is usually <username/email>
// returns channelid in continuation
function channel_create(client, userid, channel, continuation) {
  if (!channel) { // use userid's username as the channel name
    return client.get("userid:" + userid + ":username", function(error, username) {
      if (error) return continuation(error);
      if (!username) return continuation("could not find username for userid: " + userid);
      create(userid, username);
    });
  } 
  if (!userid) { // assume that channel name matches a username
    return client.get("username:" + channel + ":userid", function(error, userid) {
      if (error) return continuation(error);
      if (!userid) return continuation("could not find userid for channel: " + userid);
      create(userid, channel);
    });
  }
  create(userid, channel);
  function create(userid, channel) {
    client.incr("next:channelid", function(error, channelid) {
      if (error || !channelid) return continuation(error ? error : "null channelid");
      client.multi()
          .set("userid:"  + userid  + ":channelid", channelid)
          .set("channel:" + channel + ":channelid", channelid)
          .sadd("channelid:" + channelid + ":subscribers", userid)
          .zadd("channels:channel", 0, channel)
          .exec(function(error, reply) {
            return continuation(error, channelid);
          });
    });
  }
};


// publish -> POST /pubsub/publish?[channel=<channel>] { message : <message> } -> <channel>  
//            if no channel specified, channel name is assumed to be <request.session.data.username>
// ccurl -X POST -d '{"message":"this is a message"}' http://127.0.0.1:8000/pubsub
exports.POST = function(request, response) {
  if (!request.session.data.authorized) return response.fin(401, "not logged in");
  if (!request.data || !request.data.message) return response.fin(400, "invalid message");
  var client = request.redis();
  var message = request.data ? request.data : {};
  message.timestamp = (new Date()).valueOf();
  message.userid    = request.session.data.userid;
  message.username  = request.session.data.username;
  message.channel   = request.session.data.username;   // no channel specified - use username as the channel name
  
  if (request.files && Object.keys(request.files)[0]) { // message has a file attached, include it
    filename = Object.keys(request.files)[0];
    message.image = filename; // TODO should only be set after save
    fs.writeFile("webroot/uploads/" + filename, 
                 request.files[filename], "binary", function(error) { // TODO: store data in redis, not local filesystem
      if (error) console.log("ERROR SAVING FILE: " + error);
      console.log("saved: " + filename);
    }); 
  }

  return client.get("channel:" + request.session.data.username + ":channelid", function(error, channelid) {
    if (error) return response.fin(500, error);
    if (!channelid) { // we need to create the channel, then post to the channel
      return channel_create(client, request.session.data.userid, request.session.data.username, function(error, channelid) {
        if (error) return response.fin(500, error);
        post(channelid, message);
      });
    } 
    post(channelid, message); // post to the channel
  });

  function post(channelid, message) {
    message.channelid = channelid;
    client.multi()
        .incr("next:messageid")
        .smembers("channelid:" + channelid + ":subscribers")
        .exec(function(error, reply) {
          if (error) return response.fin(500, error ? error : "null replies on message post");
          var messageid   = reply[0];
          var subscribers = reply[1];
          var multi = client.multi()
              .set("messageid:" + messageid + ":message", JSON.stringify(message))
              .zadd("channelid:" + channelid + ":timeline", (new Date()).valueOf(), messageid)
              .lpush("userid:" + request.session.data.userid + ":timeline", messageid)
              .lpush("userid:0:timeline", messageid); // global timeline
          for (var i in subscribers) {
            multi.lpush("userid:" + subscribers[i] + ":timeline", messageid);
          }
          multi.exec(function(error, reply) {
            if (error || !reply) return response.fin(500, error ? error : "null replies on message post");
            response.fin(302, messageid, { // redirect
              'Location' : '/villagebus.tests.html'
            });
          });
        });    
  };
};


// poll -> GET /pubsub?[channel|lastn|daterange] -> <messages>
//         if no channel specificied, then all messages from all channels associated with <userid>
// ccurl -X GET http://127.0.0.1:8000/pubsub
exports.GET = function(request, response) {
  // global timeline if not logged in
  var userid = request.session.data.authorized ? request.session.data.userid : 0;
  var client = request.redis();
  return client.lrange("userid:" + userid + ":timeline", 0, -1, function(error, messageids) {
    if (error) return response.fin(500, error); 
    if (!messageids.length) return response.fin(200, []);
    var q = messageids.map(function(messageid) { return "messageid:" + messageid + ":message"; });
    client.mget(q, function(error, messages) {
      if (error) return response.fin(500, error); 
      messages = messages.map(function(message) { return JSON.parse(message); }); // objects are stored stringified
      return response.fin(200, messages);
    });
  });
};


// subscribers -> POST /pubsub { channel|channelid : <channel|channelid> } -> ?
//                subscribes <request.session.data.userid> to channel 
// subscribers -> DELETE /pubsub[?channel|channelid] -> ?
//                unsubscribes <request.session.data.userid> from channel 

exports.subscribers = {
  POST : function(request, response) {
    if (!request.session.data.authorized) return response.fin(401, "not logged in");
    if (!request.data.channel && !request.data.channelid) return response.fin(400, "specify channel or channelid");
    var client = request.redis();
    if (request.data.channel) { // lookup channelid from channel name
      return client.get("channel:" + request.data.channel + ":channelid", function(error, channelid) {
        console.log("Tried to find channelid for: " + request.data.channel + " -> " + channelid);
        if (error) return response.fin(500, error);
        if (!channelid) { // create channel from channelname
          return channel_create(client, null, request.data.channel, function(error, channelid) {
            if (error) return response.fin(500, error);
            subscribe(channelid);
          });
        }
        subscribe(channelid);
      });
    }
    subscribe(request.data.channelid);
    function subscribe(channelid) {
      client.sadd("channelid:" + channelid + ":subscribers", request.session.data.userid, function(error, reply) {
        if (error) return response.fin(500, error);
        console.log("SUBSCRIBED: " + channelid);
        return response.fin(200, channelid);
      });
    };
  },

  DELETE : function(request, response) {
    if (!request.session.data.authorized) return response.fin(401, "not logged in");
    if (!request.query.channel && !request.query.channelid) return response.fin(400, "specify channel or channelid");
    var client = request.redis();
    if (request.query.channel) {
      return client.get("channel:" + request.query.channel + ":channelid", function(error, channelid) {
        if (error) return response.fin(500, error);
        unsubscribe(channelid);
      });
    }
    unsubscribe(request.query.channelid);
    function unsubscribe(channelid) {
      client.srem("channelid:" + channelid + ":subscribers", request.session.data.userid, function(error, reply) {
        if (error) return response.fin(500, error);
        return response.fin(200, channelid);
      });
    };
  }
};


// purge -> DELETE http://127.0.0.1:8000/pubsub/purge
//              delete all data for all channels 
// curl -X DELETE http://127.0.0.1:8000/pubsub/purge
exports.purge = {
  DELETE : function(request, response) {
    console.log("purging...");
    var client = request.redis();
    var del = [ "channels:channel", "next:channelid", "next:messageid",
                "channel:antoine@7degrees.co.za:channelid",
                "channel:hummingbird@hivemind.net:channelid" ];
    for (var i = 0; i < 20; i++) {
      del.push("messageid:" + i + ":message");
      del.push("channelid:" + i + ":timeline");
      del.push("userid:" + i + ":timeline");
    }
    client.del(del, function(error, replies) {
      if (error) return abort(error, 500); 
      return response.fin(200, "fin");
    });
  }
};
