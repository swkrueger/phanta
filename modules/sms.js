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
    var smssrv = http.createClient(80, '127.0.0.1');
    var request = google.request('POST', '/cgi-bin/sendsms?cellnr='+cellnr);
    request.end(message);
    request.on('response', function (response) {
    console.log('STATUS: ' + response.statusCode);
    console.log('HEADERS: ' + JSON.stringify(response.headers));
    response.setEncoding('utf8');
    response.on('data', function (chunk) {
        console.log('BODY: ' + chunk);
    });
});
}


