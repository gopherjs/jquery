//Javascript Version:

var URL         = "http://localhost:3000",
    showConsole = function() {
        return $("input[name='console']").is(":checked");
    };

console.log(" in test.js");


$("#btnAjaxJs").click(function () {
	
	if (showConsole()) 
		console.log("pure JS here")
	
    $.ajax({
        async: true,
        type: "POST",
        url: URL + "/nestedjson/",
        contentType: "application/json; charset=utf-8",
        dataType: "json",
        beforeSend: function (data) {
        	if (showConsole()) 
            	console.log(" before:", data);
        },
        success: function (data) {
        	var dataStr = JSON.stringify(data);
            $("#inTextArea").val(dataStr);
            if (showConsole()) 
          		console.log(" success:", data);  
          	
        },
        error: function (status) {
        	if (showConsole()) 
          		console.log(" error:", status);
        }
    });
});

$("#btnClear").click(function () {
    $("textarea").val("");
    $("#result").html("<p><small>GopherJS Rocks !</small></p>");
});


$("#btnLoadJs").on("click", function() {
    
    $("#result").load("/load.html", function() {
        if (showConsole()) 
            console.log("load was performed");
    });

});


$("#btnGetJs").on("click", function() {
    $.get( "/get.html", function( data ) {
        $( "#result" ).html( data );

    });
})

$("#btnPostJs").on("click", function() {
    $.post( "/jquery", function( data ) {
        $( "#result" ).html( data );
    });
});


//getjson
$("#btnJsonJs").on("click", function() {
    $.getJSON( "/json/1", function( data ) {
        if (data.json)
            $("#inTextArea").val(data.json);
    });
})


//getscript
$("#btnGetScriptJs").on("click", function() {
    $.getScript( "/script", function( data ) {
        $("#inTextArea").val(data);
    });
})

//ajaxSetup
$("#btnAjaxsetupJs").on("click", function() {

    $.ajaxSetup({
        async: true,
        type: "POST",
        url: URL + "/nestedjson/",
        contentType: "application/json; charset=utf-8",
        dataType: "json"
    });

    $.ajax({
        beforeSend: function (data) {
            if (showConsole()) 
                console.log(" before:", data);
        },
        success: function (data) {
            var dataStr = JSON.stringify(data);
            $("#inTextArea").val(dataStr);
            if (showConsole()) 
                console.log(" success:", data);  
            
        },
        error: function (status) {
            if (showConsole()) 
                console.log(" error:", status);
        }
    });
})

$("#btnAjaxPrefilterJs").one("click", function() {
    
    $.ajaxPrefilter( "+json", function( options, originalOptions, jqXHR ) {
        if (showConsole()) 
            console.log(" ajax prefilter options:", options);
    });

}).on("click", function() {

    $.getJSON( "/json/3", function( data ) {
        if (data.json)
            $("#inTextArea").val(data.json);
    });
});

$("#btnAjaxTransportJs").one("click", function() {
 
    $.ajaxTransport( "+json", function( options, originalOptions, jqXHR ) {
        if (showConsole()) 
            console.log(" ajax transport options:", options);
    });
    
}).on("click", function() {

    $.getJSON( "/json/4", function( data ) {
        if (data.json)
            $("#inTextArea").val(data.json);
    });
});

//Transform to QUnit.js


