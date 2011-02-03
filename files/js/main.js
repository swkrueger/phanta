function loadtimeline() {
    villagebus.GET("/pubsub",function(error,msgs){
        if (error){
            // TODO: Show error message
            return false;
        }

        var timeline = $("div#timeline");
        var html = "";
        jQuery.each(msgs, function(i, msg) {
            var add = "";
            if (msg.image) add += "<div class=\"msg\" style=\"min-height: 100px;\">";  // TODO: Change this hack into CSS
            else add += "<div class=\"msg\">";
            // TODO: Vertically align image in center
            if (msg.image) add+="<span class=\"msgimg\"><img src=\"/upload/"+msg.image+"\" /></span>";
            add += "<span class=\"msgtext\"><b>"+msg.username+":</b> "+msg.message+"</span>";
            add += "</div>";
            html += add;
            return true;
        });
        timeline.html(html);
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
        var html = "<b>Username:</b> "+profile.name+"<br />";
        html += "<b>Surname:</b> "+profile.surname+"<br />";
        $("#myprofile").html(html);
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

        //var str = $(this).serialize();
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
            var html = "";
            html += "<ul class=\"profiles\">";
            jQuery.each(profiles, function(i, profile) {
                html+="<li class=\"profile\" id=\""+profile.username+"\">"+profile.username+"</li>";
            });
            html+="</ul>";
            output.html(html);
            $('#profilesbox').modal({containerCss: {width:250, height:350}});
            $("ul.profiles li.profile").click(function(event) {
                $("#profilesearch").val(event.target.id);
                $.modal.close();
            });

        });
    });
    $("#chprofileclick").click(function(){
   villagebus.GET("/profiles",function(error,profile){
           console.log(profile);
	   $("input[name=userid]").val(profile.userid);
     $("input[name=username]").val(profile.username);
           if (profile.name) $("input[name=name]").val(profile.name);
           if (profile.surname) $("input[name=surname]").val(profile.surname);
           if (profile.longitude) $("input[name=longitude]").val(profile.longitude);
           if (profile.latitude) $("input[name=latitude]").val(profile.latitude);
   });
function success(position) {
  var s = document.querySelector('#status');
  if (s.className == 'success' ) {
    // not sure why we're hitting this twice in FF, I think it's to do with a cached result coming back    
    return;
  }
  s.innerHTML = "found you!";
  s.className = 'success';
  
  var mapcanvas = document.createElement('div');
  mapcanvas.id = 'mapcanvas';
  mapcanvas.style.height = '200px';
  mapcanvas.style.width = '330px';
    
  document.querySelector('#map').appendChild(mapcanvas);
  
  var latlng = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
  var myOptions = {
    zoom: 15,
    center: latlng,
    mapTypeControl: false,
    navigationControlOptions: {style: google.maps.NavigationControlStyle.SMALL},
    mapTypeId: google.maps.MapTypeId.ROADMAP
  };
  var map = new google.maps.Map(document.getElementById("mapcanvas"), myOptions);
  
  var marker = new google.maps.Marker({
      position: latlng, 
      map: map,
      draggable: true, 
      title:"You are here!"
  });
  google.maps.event.addListener(marker, 'mouseup', function() {
    console.log(marker.position);
    $("#longitude").val(marker.position.xa ? marker.position.xa : marker.position.wa);
    $("#latitude").val(marker.position.za  ? marker.position.za : marker.position.ya);
  });

}
function error(msg) {
  var s = document.querySelector('#status');
  s.innerHTML = typeof msg == 'string' ? msg : "failed";
  s.className = 'fail';
  // console.log(arguments);
}

if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(success, error);
} else {
  error('not supported');
}
        $('#chprofilebox').modal({containerCss: {width:400, height:500}});

    });
    /*$("#chprofilesubmit").click(function(){
        console.log("I'm here!");
        var str = $("chprofileform").serialize();
        villagebus.POST("/profiles", str, function(error, response) {
            if (error) return login_fail(error);
            loadtimeline();
        });
        return false;
    });*/

});

