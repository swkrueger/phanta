var sys=require('sys'),
    rclient=require('redis').createClient(),
    session=require('../lib/session/core.js').session,
    util=require('../util'),
    Step = require('../lib/step.js');

sys.debug("loaded module " + __filename);

auth = exports;

var sessions = {};

auth.session = { };
auth.session.GET = function(req, res) {
    return res.simpleJSON(200, {
        userid     : req.session.data.userid,
        username   : req.session.data.username,
        authorized : req.session.data.authorized
    });
}

auth.login = { };
auth.login.POST = function(req, res) {
    // TODO: Show "already logged in"
    // Extract POST data
    username = req.data.username;
    hashreq = req.data.hash;
    console.log(username);
    console.log(hashreq);
    if (username=="" || username===undefined) return mkError(400, 'No username specified')(req, res);
    if (hashreq=="" || hashreq===undefined) return mkError(400, 'No hash specified')(req, res);
    if  (req.session.data.user!="Guest") {
		  res._headers['Location'] = '/';
      return res.writeHTML(302, '<h1>Already logged in. Redirecting...</h1>');
	}
    // Get USERID from database
    rclient.get("username:"+username+":userid", function(err, userid) {
        if (err) return mkError(500, "Database error")(req, res);
        // User doesn't exist in database
        if (userid===null) {
            console.log("Login failed: User '"+username+"' does not exist");
            return auth.unauthorized(req, res);
        }
        // Save USERID in session data
        req.session.data.userid = userid;
        // Get hash from database
        rclient.get("userid:"+userid+":hash", function(err, hashdb) {
            if (err) return mkError(500, "Database error")(req, res);
            // Is the hash correct?
            if (hashreq==hashdb) {  // Yes
                console.log("User '"+username+"' has sucessfully logged in");
                req.session.data.username = username;
                req.session.data.authorized = true;
                res._headers['Location'] = '/';
                //res.writeText(302, 'Sucessfully logged in. Redirecting...');
                res.writeHTML(302, '<h1>Redirecting...</h1>');
            } else {  // No
                console.log("Login failed for user '"+username+"': Incorrect password");
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
    var username;
    if (req.data.email) username = req.data.email;
    else username = req.data.cellphone;
    if (username=="" || username===undefined) return mkError(400, 'No username specified')(req, res);
    if (req.data.hash=="" || req.data.hash===undefined) return mkError(400, 'No hash specified')(req, res);
    req.data.username = username;
    // TODO: Check for integrity
    sys.debug("Registering new user '"+username+"'.");
    rclient.exists("username:"+username+":userid", function(err, exists) {
        if (err) return mkError(500, "Database error")(req, res);
        // Username already exists?
        if (exists) {
            console.log("Registration of user '"+username+"' failed: Username already exist");
            return res.simpleJSON(409, { failed: "Username already exists" });
        }
        rclient.incr("next:userid", function(err, userid) {
            if (err || userid===null) return mkError(500, "Database error")(req, res);
            var profile = { userid : userid,
                            username : username };
            Step(function storeValues() {
                    // Store values in database
                    rclient.multi()
                        .mset([ "username:"+username+":userid", userid,
                                "userid:"+userid+ ":profile",  JSON.stringify(profile),
                                "userid:"+userid+":username", username,
                                "userid:"+userid+":hash", req.data.hash,
                                "userid:"+userid+":email", req.data.email,
                                "userid:"+userid+":cellphone", req.data.cellphone ])
                        .zadd("usernames:username", 0, username)
                        .zadd("usernames:userid", 0, userid)
                        .exec(this.parallel());
                },
                function showPage(err) {
                    if (err) return mkError(500, "Database error")(req, res);
                    res.simpleJSON(201, { ok: "User created" });
                    console.log("Registered user '"+username+"' with USERID "+userid);
                    // TODO: automatically login when finished registering
                });
        });
    });

}

auth.logoff = { };
auth.logoff.GET = function(req, res) {
    req.session.data.username = "Guest";
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
        if (req.session.data.username=="Guest" && handler.authReq===true) auth.unauthorized(req, res);
        handler(req, res);
    });
}

