/** - grf -------------------------------------------------------------- */
if (typeof(window.console) == "undefined") {  // Some browsers really have no console at all
  window.console = { debug   : function(){},
                     warning : function(){},
                     error   : function(){},
                     log     : function(){} };
  console = window.console;
}

// ?
var villagebus = function() {
  var ret = [];
  for (var p in this) { if (p != "prototype") ret.push(p); }
  return ret;
};


/** - utilities --------------------------------------------------------- */
function type(value) {
  var s = typeof value;
  if (s == 'object') {
    if (value) {
      if (typeof value.length == 'number' && typeof value.splice != 'undefined' && !value.propertyIsEnumerable('length'))
        return 'array';
      if (typeof value.call != 'undefined')
        return 'function';
    } else 
      return 'null';
  } else if (s == 'function' && typeof value.call == 'undefined') 
    return 'object';
  return s;
};
function extend (target, source) {
  for (var field in source) {
    if (target[field] && type(target[field]) == "object"
                      && type(source[field]) == "object") {
      target[field] = extend(target[field], source[field]);
    } else {
      target[field] = source[field]; 
    }
  }
  return target;
};


/** - channels ---------------------------------------------------------- */
villagebus.publish = function(channel, message) {
};

villagebus.subscribe = function(channel, continuation) {
};


/** - REST -------------------------------------------------------------- */
villagebus.proxy = function(prefix) {
  return prefix + "/cgi-bin/villagebus.lua/http/";
};

villagebus.xhr = function() {
  try { return new XMLHttpRequest(); } catch(e) { }
  try { return new ActiveXObject("Msxml2.XMLHTTP"); } catch (e) { }
  try { return new ActiveXObject("Microsoft.XMLHTTP"); } catch (e) { }
  alert("XMLHttpRequest not supported");
  return null;
};

villagebus.http = function(rest, continuation) { // { verb, host, port, path, query, data }
  // TODO - check if we need a proxy
  console.log("villagebus.http(" + JSON.stringify(rest) + ")");
  console.log("WINDOW.LOCATION.HOSTNAME: " + window.location.hostname + "  REST.HOST: " + rest.host);
  if (rest.host && window.location.hostname != rest.host) {
    rest.path = villagebus.proxy("") + rest.host + ":" + rest.port + "/" + rest.path;
  }
  console.log(rest.verb + " " + rest.path);
  var xhr = villagebus.xhr();
  xhr.open(rest.verb, rest.path + (rest.query ? rest.query : ""), continuation != null);
  xhr.onreadystatechange = function() {
    if (xhr.readyState != 4) return; // TODO handle all error states
    console.log("villagebus reply: " + xhr.responseText);
    try {
      var response = JSON.parse(xhr.responseText);
      if (response.error) {
        return continuation(response.error, null);
      }
    } catch (e) {
      console.warn("Reply is not JSON encoded: " + e);
      return continuation(null, xhr.responseText);
    }
    return continuation(null, response);
  };
  if (rest.data) {
    xhr.send(JSON.stringify(rest.data));
  } else {
    xhr.send(null);
  }
  return xhr;
};

villagebus.parse = function(rest) { // { verb, url, ... }
  var a = document.createElement("a");
  a.href = rest.url; // { hostname, port, pathname, search } 
  rest.host  = a.hostname;
  rest.port  = a.port != 0 ? a.port : 80;
  rest.path  = a.pathname;
  rest.query = a.search;
  return rest;
};

// HTTP Verbs: http://www.w3.org/Protocols/rfc2616/rfc2616-sec9.html
// . Safe: No action except retrieval
// . Idempotent: Side effects of N > 0 identical requests is same as for a single request


// idempotent, safe
villagebus.GET = function(url, continuation) { // curl 'http://127.0.0.1:8000/test/farmer?foo=bar&oink=ank'
  var rest = villagebus.parse({ verb : "GET", url : url });
  return villagebus.http(rest, continuation);
};

// idempotent, safe
villagebus.HEAD = function(url, continuation) {
  var rest = villagebus.parse({ verb : "HEAD", url : url });
  return villagebus.http(rest, continuation);
};

// idempotent, unsafe
villagebus.PUT = function(url, data, continuation) {
  var request = villagebus.parse({ verb : "PUT", url : url, data : data });
  return villagebus.http(request, continuation);
};

// idempotent, unsafe
villagebus.DELETE = function(url, continuation) {
  var rest = villagebus.parse({ verb : "DELETE", url : url });
  return villagebus.http(rest, continuation);
};

// unsafe 
villagebus.POST = function(url, data, continuation) { // curl -X POST -d '{"a":"b"}' 'http://127.0.0.1:8000/test/farmer?foo=bar&oink=ank'
  var request = villagebus.parse({ verb : "POST", url : url, data : data });
  return villagebus.http(request, continuation);
};

// no side-effects
villagebus.TRACE = function() {
};

// no side-effects
villagebus.OPTIONS = function() {
};

// ? "This specification reserves the method name CONNECT for use with a 
//    proxy that can dynamically switch to being a tunnel (e.g. SSL 
//    tunneling [44])."
villagebus.CONNECT = function() {
};


console.log("loaded villagebus.js");
