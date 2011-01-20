var sys = require('sys'),
fs = require('fs'),
qs = require('querystring'),
url = require('url'),
util = exports;

fork = function(async_funcs, shared_func) {
    var cnt = async_funcs.length;
    var results = [];
    function mkCallback (ind) {
        return function () {
            cnt --;
            var func_results = [];
            for (var i=0;i<arguments.length;i++)
                func_results.push(arguments[i]);
            results[ind] = func_results;
            if (cnt == 0) {
                shared_func(results);
            }
        }
    }

    for (var i=0;i<async_funcs.length;i++) {
        async_funcs[i](mkCallback(i));
    }
}

