USAGE:

	<html>
    <head>
    <meta http-equiv="Content-type" content="text/html;charset=UTF-8">
    <title>Penguin</title>
    <link rel='stylesheet' href='http://code.jquery.com/ui/1.10.2/themes/sunny/jquery-ui.css'>
    <script src="//ajax.googleapis.com/ajax/libs/jquery/1.9.1/jquery.min.js"></script>
    <script src="//ajax.googleapis.com/ajax/libs/jqueryui/1.10.2/jquery-ui.min.js"></script>

    <script src='penguin/penguin.js'></script>
    <script src='strophejs/strophe.js'></script>
    <link rel='stylesheet' type='text/css' href='penguin/css/penguin.css'>
    <script>
    $(document).ready(function() {

    	var BOSH_SERVICE = "http://jabber.server/http-bind";
        	var connection = new Strophe.Connection(BOSH_SERVICE);

        	$('#chatcontainer').penguin(
            {
                connection: connection,
                username: 'user@jabber.server',
                password: 'p@ssw0rd'
            });
     });
    </script>
    </head>

    <body>
    	<div id="chatcontainer">
    	</div>
    </body>
    </html>

	NOTE: This widget is under development. And it has been tested with jQuery 1.9.1, jQuery UI 1.10.2, Strophe 1.0.2 and Openfire as the XMPP server.

	FEATURES:
	- Send/receive messages.
	- Display roster.
	- Change contacts status (online, away, dnd, offline).

