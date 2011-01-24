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

var sys=require('sys'),
    http=require('http'),
    url=require('url'),
    qs=require('querystring'),
    fs=require('fs'),
    path=require('path'),
    util=require('./util');

// Globals
HOST="127.0.0.1";
PORT=8124;
MODULES_PATH="./modules/";
DIRECTORY_INDEX="index.html";
modules = {};


// TODO: Write separate class for mkError, notfound, unauth, etc.

////
// Load modules:
//  Maps all modules in /modules/ in an array
//  Assume all the files in /modules/ are .js  FIXME
////
load_modules = function(callback) {
    fs.readdir(MODULES_PATH, function (err, files) {
        var count = files.length,
             actions = files.map(function(filename) {
                modname = path.basename(filename, '.js');
                sys.debug("Mapping module "+modname);
                modules[modname] = require(MODULES_PATH+filename);
                return function(callback) { callback(); };
            });
        fork(actions, function(results) {
            console.log("Loaded "+files.length+" modules");
            callback();
        });
    });
}

////
// Error handler
////
mkError = function(code, description) {
    return function(req, res) {
        res.simpleJSON(code, {
            error: description
        });
    }
};

////
// POST handler
////
POST_handler = function(req, callback)
{
    req.POSTcontent = {};
    var _CONTENT = '';

    if (req.method == 'POST') {
        req.addListener('data', function(chunk) {
            _CONTENT+=chunk;
        });
        req.addListener('end', function() {
            req.POSTcontent = qs.parse(_CONTENT);
            callback();
        });
    };
};


////
// Not found
////
not_found = function(req, res) {
    res.writeText(404, 'Not Found');
};

////
// Moved Permanently
////
/*moved_permanently = function(req, res) {
    res.writeText(404, 'Not Found');
};*/

////
// Load file
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
    if (modules[modname]===undefined) {
        sys.debug("Module '"+modname+ "' does not exist");
        return false;
    }
    sys.debug("Dispatch to module "+modname);
    var func = 'modules[modname].'+req.method;
    if (typeof eval(func) != 'function') {
        sys.debug(func+" does not exist");
        return mkError(501, "Module '"+modname+ "' method '"+req.method+"' not implemented");
    }
    req.path.shift();
    return eval(func);
};

////
// Start server
////
startServer = function() {
    //var rclient = redisclient.createClient();
    http.createServer(function (req, res) {
        res._headers = {};
        req.uri = url.parse(req.url).pathname;
        req.path = req.uri.split("/");
        req.path.shift();
	    req.params = qs.parse(url.parse(req.url).query);
        var handler = dispatch_module(req) || load_file('./files'+req.uri) || not_found;
        console.log(dispatch_module(req).required);

        res.simpleJSON = function(code, obj) {
            var body = JSON.stringify(obj);
            res._headers['Content-Type'] = 'text/json';
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
        if (modules['auth']===undefined) handler(req, res);
        else {
            modules['auth'].checkSession(req, res, handler);
        }
    }).listen(PORT, HOST);
    console.log("Server at http://" + HOST + ':' + PORT.toString() + '/');
}

load_modules( startServer );


//sys.debug();


// Load web server

/// Check module
/// Do not exist? Check file (security: check in /files/ -> /)
/// Do not exist? 404

