// When DOM is ready
$(document).ready(function(){
    // Launch MODAL BOX if the Login Link is clicked
    $("#loginbtn").click(function(){
        $('#login_form').modal();
        $('#login_response').html();
        return false;
    });

    // When the form is submitted
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
            //$('#login_form').modal.close();
            //checklogin();
            window.location.reload();  // TODO: Change that the box will only close
        });

        return false;
    });
});
	/*if (event.target.email.value==''&& event.target.cellphone.value=='') {
            $("span").text("Please type your e-mail address and or cellphone").show().fadeOut(10000);
	    return false;
	}

        // -- Start AJAX Call --
    });
});

/*    $.ajax({
        type: "POST",
        url: "do-login.php",  // Send the login info to this page
        data: str,
        success: function(msg){
            $("#status").ajaxComplete(function(event, request, settings){  
            // Show 'Submit' Button
            $('#submit').show();

            // Hide Gif Spinning Rotator
            $('#ajax_loading').hide();

            if(msg == 'OK') // LOGIN OK?
            {
                var login_response = '<div id="logged_in">' +
                    '<div style="width: 350px; float: left; margin-left: 70px;">' + 
                    '<div style="width: 40px; float: left;">' +
                    '<img style="margin: 10px 0px 10px 0px;" align="absmiddle" src="images/ajax-loader.gif">' +
                    '</div>' +
                    '<div style="margin: 10px 0px 0px 10px; float: right; width: 300px;">'+ 
                    "You are successfully logged in! <br /> Please wait while you're redirected...</div></div>";  

            $('a.modalCloseImg').hide();  

            $('#simplemodal-container').css("width","500px");
            $('#simplemodal-container').css("height","120px");
    
            $(this).html(login_response); // Refers to 'status'

            // After 3 seconds redirect the 
            setTimeout('go_to_private_page()', 3000); 
    }  
    else // ERROR?
    {  
    var login_response = msg;
    $('#login_response').html(login_response);
    }  
        
    });  
    
    }  
    
    });  
    
    // -- End AJAX Call --

    return false;

    }); // end submit event

});

function go_to_private_page()
{
window.location = 'private.php'; // Members Area
}*/
