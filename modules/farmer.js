var sys=require('sys');

sys.debug("  farmer module to your service!");

/* Farmer module */
farmer = exports;

farmer.fields = {};

farmer.POST = function(req, res) {
    //increase UID

}

farmer.PUT = function(req, res) {

}
farmer.DELETE = function(req, res) {

}

farmer.GET = function(req, res) {
	res.simpleJSON(200, {
        ok: true
	});
    // Get UID
    //fields = util.extractFields();
    //validateFields();
    //value = composeJSON();
    //dbget();
    // right type?

}
farmer.GET.authReq = false;

