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
    multipart=require('multipart'),
    opts = require('opts'),
    util=require('./util');

//// NPM requirements: redis, opts, sesh, multipart

////
// Globals
////
GLOBALS = {
    'VERSION': "0.01 alpha",
    // HOST: HTTP server host
    'HOST': "127.0.0.1",
    // PORT: HTTP server port
    'PORT': 8080,
    // MODULES_PATH: Directory containing all modules
    'MODULES_PATH': "./modules/",
    // DIRECTORY_INDEX: Filename to append to a file request ending with "/"
    'DIRECTORY_INDEX': "index.html"
};

// fix response.writeHead
var _writeHead = http.ServerResponse.prototype.writeHead;
http.ServerResponse.prototype.setHeader = function (key, value) {
  this._additionalHeaders = this._additionalHeaders || {}; 
  this._additionalHeaders[key] = value;
};
http.ServerResponse.prototype.writeHead = function (status, headers) {
  var that = this;
  if (this._additionalHeaders) {
    Object.keys(this._additionalHeaders).forEach(function (k) {
      headers[k] = headers[k] || that._additionalHeaders[k];
    });
  }
  _writeHead.call(this, status, headers);
};

modules = {};

////
// Load modules:
//  Maps all modules in /modules/ into an array
////
load_modules = function(callback) {
    console.log("Loading modules...");
    // Get the filenames of all files in /modules/
    fs.readdir(GLOBALS['MODULES_PATH'], function (err, files) {
        var count = files.length,
        // Map the filenames to funtions loading the modules
        actions = files.map(function(filename) {
            // Make sure the file is a .js file
            if (path.extname(filename)!='.js') return function(callback) { callback(); };
            modname = path.basename(filename, '.js');
            sys.debug("Mapping module "+modname);
            // Load the module
            modules[modname] = require(GLOBALS['MODULES_PATH']+filename);
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
    res.writeHTML(404, '<h1>404 Not Found</h1>');
};

////
// POST handler
//  Loads the POST data into the request object
////
POST_handler = function(req, callback)
{
    if (req.method == 'POST') {
        req.setEncoding("binary"); // otherwise multipart gets nuked
        _CONTENT = {};
        var _CONTENT = '';
        // Load chucks of POST data
        req.addListener('data', function(chunk) {
            _CONTENT+=chunk;
        });
        // Parse data as multipart, JSON or QueryString and load into request object 
        req.addListener('end', function() {
            if (_CONTENT && _CONTENT.substring(0, 4) == "----") {
                var data = {};
                var parser = multipart.parser();
                var fields = {};
                var files  = {};
                var buffer = "";
                parser.headers = req.headers;
                parser.onpartend = function (part)  {  
                    if (part.filename) files [part.filename] = buffer; 
                    else               fields[part.name] = buffer; 
                    buffer = "";
                };
                parser.ondata = function (chunk) { buffer += chunk; };
                parser.onend = function () { 
                    req.data  = fields;
                    req.files = files;
                };
                parser.write(_CONTENT);
                parser.close();
                return callback();
            }
            try {
                req.data = JSON.parse(_CONTENT);
                return callback();
            } catch (e) { }
            try {
                req.data = qs.parse(_CONTENT);
                return callback();
            } catch (e) { }
        });
    } else callback();
};

////
// Load file
//  Static file handler
//  TODO: Cache files
////
load_file = function(filename) {
    // TODO: Update file handler!!!
	var body;
    //sys.debug("-- Enter load_file function");
    if (filename.charAt(filename.length-1)=="/") filename+=GLOBALS['DIRECTORY_INDEX'];

	function loadResponseData(callback) {
		fs.readFile(filename, "binary", function(err, data) {
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
                res.writeHead(200);
                res.write(body, "binary");
                res.end();
            });
        });
    };


};

////
// Dispatch module
////
dispatch_module = function(req) {
    // TODO: output debug info
    var module = modules[req.path[0]];
    if (!module) {
        //sys.debug("Module '"+req.path[0]+ "' does not exist");
        return false;
    }
    console.log(".. dispatch to module "+req.path[0]);
    req.path.shift();
    var func = module;
    while (req.path && func[req.path]) {
        console.log(".. dispatch down to "+req.path[0]);
        func = func[req.path.shift()];
    }
    if (func[req.method]) return func[req.method];
    else if (func) return func;
    else return mkError(501, "Could not dispatch");
};

////
// Start server
////
startServer = function() {
    //var rclient = redisclient.createClient();
    http.createServer(function (req, res) {
        console.log("Received HTTP request for the URL "+req.url);
        res._headers = {};
        var a = url.parse(unescape(req.url), true);
        req.uri   = a.pathname;
        req.path  = req.uri.split("/");
        req.query = a.query;
        req.path.shift();
        req.params = qs.parse(url.parse(req.url).query);
        var handler = dispatch_module(req) || load_file('./files'+req.uri) || not_found;

        res.fin = function(status, reply, headers, type, module) {
            status  = status  ? status         : 200;
            headers = headers ? headers        : {};
            module  = module  ? module + ": "  : "";
            type  = type  ? type               : "text/plain";
            console.log("fin " + module + status + " " + reply + " " + type);
            headers["Content-Type"] = type;
            res.writeHead(status, headers);
            if (reply) res.write(JSON.stringify(reply));
            res.end();
        };
        res.simpleJSON = function(code, obj) {
            var body = JSON.stringify(obj);
            res._headers['Content-Type'] = 'text/json';
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
    }).listen(GLOBALS['PORT'], GLOBALS['HOST']);
    console.log("Server at http://" + GLOBALS['HOST'] + ':' + GLOBALS['PORT'].toString() + '/');
}

var options = [
  { short       : 'v'
  , long        : 'version'
  , description : 'Show version and exit'
  , callback    : function () { console.log('v'+GLOBALS['VERSION']); process.exit(1); }
  },
  { short       : 'h'
  , long        : 'host'
  , description : 'The hostname phanta server must bind to'
  , value       : true
  , callback    : function (host) { GLOBALS['HOST'] = host; } // override host value
  },
  { short       : 'p'
  , long        : 'port'
  , description : 'The port phanta server must bind to'
  , value       : true
  , callback    : function (port) { GLOBALS['PORT'] = port; }
  },
];

opts.parse(options, true);

load_modules( startServer );

