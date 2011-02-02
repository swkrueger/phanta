function loadtimeline() {
    villagebus.GET("/pubsub",function(error,msgs){
        if (error){
            // TODO: Show error message
            return false;
        }

        var timeline = $("div#timeline");
        timeline.html("");
        jQuery.each(msgs, function(i, msg) {
            timeline.append("<div class=\"msg\"><span class=\"msgtext\">"+msg.username+": "+msg.message+"</span>");
            if (msg.image) timeline.append("<span class=\"msgimg\"><img src=\"/upload/"+msg.image+"\"></span>");
            timeline.append("</div");
            return true;
        });
        if (msgs.length==0) {
            timeline.html("You don't have any messages. Follow some more people!");
        }
        // TODO: Show "no messages"
    });

}
function populate_profile() {
    villagebus.GET("/profiles",function(error,profile){
        console.log(profile.username);
        var following = $("#following");
        following.html("");
        jQuery.each(profile.following, function(i, follower) {
            following.append("<li class=\"follower\">"+follower.username+"<span class=\"unfollowbtn\" id=\""+follower.userid+"\">-</span></li>");
            return true;
        });
        if (following.html()=="") following.html("<li>You are not following any people</li>");
        var followers = $("#followers");
        followers.html("");
        jQuery.each(profile.followers, function(i, follower) {
            followers.append("<li class=\"follower\">"+follower.username+"</li>");
            return true;
        });
        if (followers.html()=="") followers.html("<li>No people are following you</li>");

        $(".unfollowbtn").click(function(event) {
            console.log(event.target.id);
            villagebus.DELETE("/profiles/following?userid="+event.target.id, function(error,reply){
                // TODO: error handler
                console.log(reply);
            });
            populate_profile();
            loadtimeline();
        });
    });

}
function checklogin() {
    console.log("I'm here");
    villagebus.GET("/auth/session", function(error, session) {
        if (error) {
        return $("#auth-status").html("Error while getting auth status");
        }
        console.log("Test:" + session.authorized);
        if (session.authorized) {
        $("#auth-status").html("Logged in as <i>"+session.username+"</i>");
        $("div#timeline").html("");
        $(".notauthed").hide();
        $(".authed").show();
        populate_profile();
        } else {
        $("#auth-status").html("Not logged in");
        $(".authed").hide();
        $(".notauthed").show();
        }
    });
    loadtimeline();
}
$(document).ready(function() {
    checklogin();
    $("#loginbtn").click(function(){
        $("input[name=username]").focus();
        return false;
    });
    $("#logoffbtn").click(function() {
        villagebus.GET("/auth/logoff", function(error, response) {
            checklogin();
        });
        return false;
    });
    /*$("#post").click(function() {
        var data = $("form[name=publish]");
        console.log(data);
        villagebus.POST("/pubsub/publish", function(error, response) {
            checklogin();
        });
        return true;
    });*/
    // When the login form is submitted
    $("form[name=login]").submit(function(event) {
        var login_fail = function(message) {
            if (message=="unauthorized") message = "Incorrect username or password";
            $('#ajax_loading').hide();
            $('#login_response').html(message);
            return false;
        }
        // Show Gif Spinning Rotator
        $('#ajax_loading').show();

	    if (event.target.username.value=='') {
            event.target.username.focus();
            return login_fail("No username specified");
        }

	    if (event.target.password.value=='') {
            event.target.password.focus();
            return login_fail("No password specified");
        }

        var hash = hex_sha1(event.target.username.value + event.target.password.value);
        event.target.password.value = "";
        event.target.hash.value = hash;

        var str = $(this).serialize();
        villagebus.POST("/auth/login", {username: event.target.username.value, hash: hash}, function(error, response) {
            $('#ajax_loading').hide();
            if (error) return login_fail(error);
            if (response.ok==undefined || response.ok!="logged in") return login_fail(response.error);
            event.target.username.value = "";
            event.target.password.value = "";
            event.target.hash.value = "";
            //$('#login_form').modal.close();
            checklogin();
            //window.location.reload();  // TODO: Change that the box will only close
        });

        return false;
    });
	$("#profilesearch").autocomplete({
		url: '/profiles/search',
		showResult: function(value, data) {
			return value;
		},
		onItemSelect: function(item) {
		    var text = 'You selected <b>' + item.value + '</b>';
		    if (item.data.length) {
		        text += ' <i>' + item.data.join(', ') + '</i>';
		    }
		    $("#last_selected").html(text);
		},
		maxItemsToShow: 5
	});
    $("#dofollow").click(function(event){
        var value = $("#profilesearch").val();
        console.log("Value: "+value);
        villagebus.POST("/profiles/following", { username: value }, function(error,reply){
            // TODO: error handler
            console.log(reply);
            populate_profile();
            $("#profilesearch").val("");
        });

    });
    $("#browseprofiles").click(function(){
        villagebus.GET("/profiles/list",function(error,profiles){
            if (error){
                // TODO
                return false;
            }

            var output = $('#profilesbox');
            output.html("<ul class=\"profiles\">");
            jQuery.each(profiles, function(i, profile) {
                output.append("<li class=\"profile\" id=\""+profile.userids+"\">"+profile.username+"</li>");
            });
            output.append("</ul>");
            $('#profilesbox').modal();

        });
    });
});

