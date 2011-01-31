var sys=require('sys'),
    rclient=require('redis').createClient(),
    session=require('../lib/session/core.js').session,
    util=require('../util'),
    Step = require('../lib/step.js');

sys.debug("  auth module to your service!");

auth = exports;

var sessions = {};

auth.session = { };
auth.session.GET = function(req, res) {
    return res.simpleJSON(200, {
        user: req.session.data.user,
        authorized: req.session.data.user!="Guest"
        }
    );
}

auth.login = { };
auth.login.POST = function(req, res) {
    // TODO: Show "already logged in"
    // Extract POST data
    user = req.data.username;
    hashreq = req.data.hash;
    if (user=="" || user===undefined) return mkError(400, 'No username specified')(req, res);
    if (hashreq=="" || hashreq===undefined) return mkError(400, 'No hash specified')(req, res);
    if  (req.session.data.user!="Guest") {
		res._headers['Location'] = '/';
        return res.writeHTML(302, '<h1>Already logged in. Redirecting...</h1>');
	}
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
                //res.writeText(302, 'Sucessfully logged in. Redirecting...');
                res.writeHTML(302, '<h1>Redirecting...</h1>');
            } else {  // No
                console.log("Login failed for user '"+user+"': Incorrect password");
                return auth.unauthorized(req, res);
            }
        });
    });
}

auth.register = {};
auth.register.POST = function(req, res) {
    // TODO: Check whether a password is set
    // TODO: Check whether a username was specified (undefined)
    // TODO: Username may not have a space
    // Extract POST data
    if (req.data.email) user = req.data.email;
    else user = req.data.cellphone;
    if (user=="" || user===undefined) return mkError(400, 'No username specified')(req, res);
    if (req.data.hash=="" || req.data.hash===undefined) return mkError(400, 'No hash specified')(req, res);
    req.data.username = user;
    // TODO: Check for integrity
    sys.debug("Registering new user '"+user+"'.");
    rclient.exists("username:"+user+":uid", function(err, exists) {
        if (err) return mkError(500, "Database error")(req, res);
        // Username already exists?
        if (exists) {
            console.log("Registration of user '"+user+"' failed: Username already exist");
            return res.simpleJSON(409, { failed: "Username already exists" });
        }
        rclient.incr("globals:uid", function(err, uid) {
            if (err || uid===null) return mkError(500, "Database error")(req, res);
            Step(
                function storeValues() {
                    // Store values in database
                    rclient.setnx("username:"+user+":uid", uid, this.parallel());
                    rclient.setnx("uid:"+uid+":username", user, this.parallel());
                    rclient.setnx("uid:"+uid+":hash", req.data.hash, this.parallel());
                    rclient.setnx("uid:"+uid+":email", req.data.email, this.parallel());
                    rclient.setnx("uid:"+uid+":cellphone", req.data.cellphone, this.parallel());
                    rclient.zadd("usernames", 0, user, this.parallel());
                },
                function showPage(err) {
                    if (err) return mkError(500, "Database error")(req, res);
                    res.simpleJSON(201, { ok: "User created" });
                    console.log("Registered user '"+user+"' with UID "+uid);
                }
                );
        });
    });

}

auth.logoff = { };
auth.logoff.GET = function(req, res) {
    req.session.data.user = "Guest";
	res.simpleJSON(200, {
        ok: "logged off"
	});
}


auth.unauthorized = function(req, res) {
	res.simpleJSON(401, {
        error: "unauthorized"
	});
}

auth.index = { };
auth.index.GET = function(req, res) {
    res.loadFile("./files/login.html");
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

auth.listall = { };
auth.listall.GET = function(req, res) {
    var start = req.params.start || 0;
    var count = req.params.count-1 || -1;
    rclient.zrange("usernames", start, start+count, function (err, keys) {
        if (err) return mkError(500, "Database error [keys]")(req, res);
        console.log(keys);
        return res.simpleJSON(200, {
            usernames: keys,
        });
    });
};
auth.search ={ }
auth.search.GET = function(req, res) {

}



// List users

// Search users (wildcard)


