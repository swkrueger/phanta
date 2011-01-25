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
                console.log(hashreq);
                console.log(hashdb);
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
    // Extract POST data
    if (req.POSTcontent.email) user = req.POSTcontent.email;
    else user = req.POSTcontent.cellphone;
    req.POSTcontent.username = user;
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
            sys.debug(" - UID of user: "+uid);
            Step(
                function storeValues() {
                    // Store values in database
                    rclient.setnx("username:"+user+":uid", uid, this.parallel());
                    rclient.setnx("uid:"+uid+":username", user, this.parallel());
                    rclient.setnx("uid:"+uid+":hash", req.POSTcontent.hash, this.parallel());
                    rclient.setnx("uid:"+uid+":email", req.POSTcontent.email, this.parallel());
                    rclient.setnx("uid:"+uid+":cellphone", req.POSTcontent.cellphone, this.parallel());
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


