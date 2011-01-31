#!/usr/bin/env node

//////////////////////////////////////////
//         _                 _          //
//   _ __ | |__   __ _ _ __ | |_ __ _   //
//  | '_ \| '_ \ / _` | '_ \| __/ _` |  //
//  | |_) | | | | (_| | | | | || (_| |  //
//  | .__/|_| |_|\__,_|_| |_|\__\__,_|  //
//  |_|                                 //
//                                      //
//////////////////////////////////////////

// TODO: Cleanup code + debug output
// TODO: Test code
// TODO: Validations, check POST data (eg. whether username is set)

var sys=require('sys'),
    http=require('http'),
    url=require('url'),
    qs=require('querystring'),
    fs=require('fs'),
    path=require('path'),
    opts = require('opts'),
    util=require('./util');

//// NPM requirements: redis, opts, sesh

// TODO: Put globals in global array
////
// Globals
////
VERSION="0.01 alpha";
// HOST: HTTP server host
HOST="127.0.0.1";
// PORT: HTTP server port
PORT=8080;
// MODULES_PATH: Directory containing all modules
MODULES_PATH="./modules/";
// DIRECTORY_INDEX: Filename to append to a file request ending with "/"
DIRECTORY_INDEX="index.html";

modules = {};


////
// Load modules:
//  Maps all modules in /modules/ in an array
////
load_modules = function(callback) {
    console.log("Loading modules...");
    // Get the filenames of all files in /modules/
    fs.readdir(MODULES_PATH, function (err, files) {
        var count = files.length,
        // Map the filenames to funtions loading the modules
        actions = files.map(function(filename) {
            // Make sure the file is a .js file
            if (path.extname(filename)!='.js') return function(callback) { callback(); };
            modname = path.basename(filename, '.js');
            sys.debug("Mapping module "+modname);
            // Load the module
            modules[modname] = require(MODULES_PATH+filename);
            return function(callback) { callback(); };
            });
        // Run the funtions
        fork(actions, function(results) {
            console.log("Loaded "+files.length+" modules");
            callback();
        });
    });
}

////
// Error handler
//  Returns a function that will output some JSON with the error description
////
mkError = function(code, description) {
    return function(req, res) {
        res.simpleJSON(code, {
            error: description
        });
    }
};

////
// Not found
////
not_found = function(req, res) {
    //res.writeText(404, 'Not Found');
    res.writeHTML(404, '<h1>404 Not Found</h1>');
};

////
// POST handler
//  Loads the POST data into the request object
////
POST_handler = function(req, callback)
{
    if (req.method == 'POST') {
        req.data = {};
        var _CONTENT = '';
        // Load chucks of POST data
        req.addListener('data', function(chunk) {
            _CONTENT+=chunk;
        });
        // Parse data as JSON or QueryString and load into request object 
        req.addListener('end', function() {
            try {
                req.data = JSON.parse(_CONTENT);
                return;
            } catch (e) { }
            try {
                req.data = querystring.parse(_CONTENT);
            } catch (e) { }
            callback();
        });
    } else callback();
};

////
// Load file
//  Static file handler
//  TODO: Cache files
////
load_file = function(filename) {
	var body;
    sys.debug("-- Enter load_file function");
    if (filename.charAt(filename.length-1)=="/") filename+=DIRECTORY_INDEX;

	function loadResponseData(callback) {
		fs.readFile(filename, function(err, data) {
			if (err) {
				sys.debug('Error loading file ' + filename);
			} else {
				sys.debug('Loading file ' + filename);
				body = data;
			}
			callback();
		});
	}

    return function(req, res) {
        path.exists(filename, function(exists) {
            if (!exists) {
                sys.debug("File "+filename+ " does not exist");
                return not_found(req, res);
            }
            loadResponseData(function() {
                res.writeHTML(200, body);
            });
        });
    };


};

////
// Dispatch module
////
dispatch_module = function(req) {
    var modname = req.path[0];
    var funcname = req.path[1];
    // There may not be a dot in the funcname, else the dispatcher will fail if
    // the function doesn't exist
    if (funcname=="" || funcname===undefined) funcname = "index";
    funcname = funcname.replace(".", "_");
    if (modules[modname]===undefined) {
        sys.debug("Module '"+modname+ "' does not exist");
        return false;
    }
    var func = 'modules[modname].'+funcname;
    // TODO: Check for "subfunctions", eg. /auth/user/register --> auth.user.register
    // TODO: Check whether type exists - the following fail, because of you type
    // in /auth/test.jpg, it will fail
    if (eval(func)===undefined) {
        sys.debug(func+" does not exist");
        return mkError(404, "Module '"+modname+ "' function '"+funcname+"' does not exist");
    }
    func = func+'.'+req.method;
    if (typeof eval(func) != 'function') {
        sys.debug(func+" does not exist");
        return mkError(501, "Module '"+modname+ "' function '"+funcname+"' method '"+req.method+"' not implemented");
    }
    sys.debug("Dispatch to module '"+modname+"' function '"+funcname+"' method '"+req.method+"'");
    req.path.shift();
    req.path.shift();
    return eval(func);
};

////
// Start server
////
startServer = function() {
    //var rclient = redisclient.createClient();
    http.createServer(function (req, res) {
        console.log("Received HTTP request for the URL "+req.url);
        res._headers = {};
        req.uri = url.parse(req.url).pathname;
        req.path = req.uri.split("/");
        req.path.shift();
	    req.params = qs.parse(url.parse(req.url).query);
        var handler = dispatch_module(req) || load_file('./files'+req.uri) || not_found;

        res.simpleJSON = function(code, obj) {
            var body = JSON.stringify(obj);
            res._headers['Content-Type'] = 'text/plain';
            //res._headers['Content-Type'] = 'text/json';
            res._headers['Content-Length'] = body.length;
            res.writeHead(code, res._headers);
            res.write(body);
            res.end();
        };
        res.writeText = function(code, body) {
            res._headers['Content-Type'] = 'text/plain';
            res._headers['Content-Length'] = body.length;
            res.writeHead(body, res._headers);
            res.write(body);
            res.end();
        };
        res.writeHTML = function(code, body) {
            res._headers['Content-Type'] = 'text/html';
            res._headers['Content-Length'] = body.length;
            res.writeHead(code, res._headers);
            res.write(body);
            res.end();
        };
        res.loadFile = function(filename) {
            load_file(filename)(req, res);
        }
        POST_handler(req, function() {
            if (modules['auth']===undefined) handler(req, res);
            else {
                modules['auth'].checkSession(req, res, handler);
            }
        });
    }).listen(PORT, HOST);
    console.log("Server at http://" + HOST + ':' + PORT.toString() + '/');
}

var options = [
  { short       : 'v'
  , long        : 'version'
  , description : 'Show version and exit'
  , callback    : function () { console.log('v'+VERSION); process.exit(1); }
  },
  { short       : 'h'
  , long        : 'host'
  , description : 'The hostname phanta server must bind to'
  , value       : true
  , callback    : function (host) { HOST = host; } // override host value
  },
  { short       : 'p'
  , long        : 'port'
  , description : 'The port phanta server must bind to'
  , value       : true
  , callback    : function (port) { PORT = port; }
  },
];

opts.parse(options, true);

load_modules( startServer );

