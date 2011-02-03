var sys=require('sys'),
    http = require('http');

/*SMS interface
 * register
 * post <price>:<description>:[<long description>]
 * follow <user>
 * following
 * ping
*/

sms = exports;

sys.debug("loaded module " + __filename);

sms.send = function(cellnr, message) {
    console.log("Sending SMS to "+cellnr+" | "+message);
    var smssrv = http.createClient(80, '10.8.0.1');
    var request = smssrv.request('POST', '/cgi-bin/sendsms?cellnr='+cellnr, {'host':'10.8.0.1','Content-Length':message.length});
    request.write(message);
    request.end();
    request.on('response', function (response) {
    console.log('STATUS: ' + response.statusCode);
    console.log('HEADERS: ' + JSON.stringify(response.headers));
    response.setEncoding('utf8');
    response.on('data', function (chunk) {
        console.log('BODY: ' + chunk);
    });
});
}


