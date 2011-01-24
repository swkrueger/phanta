var sys=require('sys'),
    rclient=require('redis-client').createClient(),
    session=require('../lib/session/core.js').session,
    util=require('../util'),
    Step = require('../lib/step.js');

sys.debug("auth module to your service!");

auth = exports;

var sessions = {};

auth.login = function(req, res) {
    // Extract POST data
    user = req.POSTcontent.username;
    hashreq = req.POSTcontent.hash;
    // Get UID from database
    rclient.get("username:"+user+":uid", function(err, uid) {
        if (err) return mkError(500, "Database error")(req, res);
        // User doesn't exist in database
        if (uid===null) {
            console.log("Login failed: User '"+user+"' does not exist");
            return auth.unauthorized(req, res);
        }
        // Save UID in session data
        req.session.data.uid = uid;
        // Get hash from database
        rclient.get("uid:"+uid+":hash", function(err, hashdb) {
            if (err) return mkError(500, "Database error")(req, res);
            // Is the hash correct?
            if (hashreq==hashdb) {  // Yes
                console.log("User '"+user+"' has sucessfully logged in");
                req.session.data.user = user;
                res._headers['Location'] = '/';
                res.writeText(302, 'Sucessfully logged in. Redirecting...');
            } else {  // No
                console.log("User '"+user+"' has sucessfully logged in");
                return auth.unauthorized(req, res);
            }
        });
    });
}

auth.register = function(req, res) {
    // Extract POST data
    user = req.POSTcontent.username;
    // TODO: Check for integrity
    // TODO: Check whether the user already exists
    sys.debug("Registering new user '"+user+"'.");
    rclient.exists("username:"+user+":uid", function(err, exists) {
        if (err) return mkError(500, "Database error")(req, res);
        // Username already exists
        if (exists) {
            console.log(" - Username already exists");
            return res.simpleJSON(409, { failed: "Username already exists" });
        }
        rclient.incr("globals:uid", function(err, uid) {
            if (err || uid===null) return mkError(500, "Database error")(req, res);
            sys.debug(" - UID of user: "+uid);
            // Store values
            // TODO: Error handlers
            Step(
                function storeValues() {
                    rclient.setnx("username:"+user+":uid", uid, this.parallel());
                    rclient.setnx("uid:"+uid+":username", user, this.parallel());
                    rclient.setnx("uid:"+uid+":hash", req.POSTcontent.hash, this.parallel());
                    rclient.setnx("uid:"+uid+":email", req.POSTcontent.email, this.parallel());
                    rclient.setnx("uid:"+uid+":cellphone", req.POSTcontent.cellphone, this.parallel());
                },
                function showPage(err) {
                    if (err) return mkError(500, "Database error")(req, res);
                    res.simpleJSON(201, { ok: "User created" });
                }
                );
        });
    });

}

auth.logoff = function(req, res) {
    req.session.data.user = "Guest";
}

auth.GET = function(req, res) {
    if (cmd=="logoff") auth.logoff(req, res);
}

auth.POST = function(req, res) {
    POST_handler(req, function() {
        var cmd = req.path.shift();
        if (cmd=="login") auth.login(req, res);
        else if (cmd=="register") auth.register(req, res);
    });
}

auth.unauthorized = function(req, res) {
	res.simpleJSON(401, {
        error: "unauthorized"
	});
}


// EXPIRE session - let redis expire the cookie after x seconds - err - then it
// has to be refreshed

auth.checkSession = function(req, res, handler) {
    // refresh expire
    //console.log();
    session(req, res, function(req, res) {
        if (req.session.data.user=="Guest" && handler.authReq===true) auth.unauthorized(req, res);
        handler(req, res);
    });
}

