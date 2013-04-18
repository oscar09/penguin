/**
 * Jabber client.
 *
 * **Markdown** So far, the client has been tested with Openfire.
 *
 * Dependencies:
 * JQuery UI {@link http://jqueryui.com/download/}
 * JQuery {@link http://jquery.com/download/}
 * Strophe {@link http://strophe.im/strophejs/}
 *
 *
 *      @example
 *      var BOSH_SERVICE = "http://jabber.server/http-bind";
		var connection = new Strophe.Connection(BOSH_SERVICE);

		$('#chatcontainer').penguin(
		{
			connection: connection,
			username: 'user@domain.com',
		password: 'p@ssw0rd'
		});
 *
 * Supported events:
 *  - afterSend(to, msg).- triggered when a message is sent.
 *  - onOpen.- triggered when the chat window is opened.
 *  - onChatReceived(from, msg).- triggered when a chat request is received.
 *
 * **Note:** Not all the methods have been implemented yet. The XMPP server
 * must support BOSH (http bind).
 *
 * Version: 0.5
 * [0.5]
 */

(function($, undefined)
{
	/**
	 * Contact object. It stores the info linked to a contact.
	 */
	function Contact() {
		this.chatid = "";
		this.jid = "";
		this.name = "";
		this.resources = {};
		this.subscription = "none";
		this.ask = "";
		this.state = "unavailable";
		this.groups = [];
	}


	var window_pos = 0; //@todo - this should be changed. It is currently used to avoid windows overlapping.
	var window_displacement = 15;

	/**
	 * Main widget. It will keep track of the user's roster and chat windows.
	 *
	 * @property {Object} connection Strophe connection.
	 * @property {String} username Username.
	 * @property {String} password User's password.
	 */
	$.widget('qs.penguin',
	{
		options: {
			//default values
			connection: null,
			username: null,
			password: null
		},
		/**
		 * @private
		 */
		_create: function()
		{
			var conn = this.options.connection;
			if(!conn)
			{
				console.log("Connection must be provided");
				return false;
			}
			var that = this;

			//build roster
			this._buildRoster();

			/* @todo - this might be needed if minimize/maximize is implemented
			$('body').append("<div id='dialog_window_minimized_container'></div>");
			*/

			//sends the connection request
			conn.connect(this.options.username, this.options.password,
			function(status){
				if(status === Strophe.Status.CONNECTED)
				{
					that._setHandlers(conn);
					that._onConnected();
				}else if(status === Strophe.Status.DISCONNECTED)
				{
					//@todo - I need to add the 'logout' link
					that._onDisconnected();
				}
			});
		},
		/**
		 * @private
		 * Builds the roster UI.
		 */
		_buildRoster: function()
		{
			var that = this;
			//build UI
			var container = $(that.element);
			var im_list = $("<div class='im-roster'></div>");
			var contacts = $("<div class='im-header'>"+ that.options.username + "<div>");
			container.addClass('im-container one-edge-shadow');

			//add listener
			im_list.on('click', 'div.contact', function(el)
			{
				var jid = $(el.currentTarget).find('.jid').text();
				var contact = that.contacts[jid];

				//if user is offline, do nothing. @todo - notify the user.
				if(contact.state === 'unavailable')
				{
					return true;
				}

				//the window will be rendered bottom and right-dynamic value.
				var pos = "right-"+ window_pos +" bottom";

				//opens the chat dialog
				var target = $(el.currentTarget);
				if(target.data('qsChatwindow'))
				{
					target.chatwindow('open');
				}else
				{
					target.chatwindow(
					{
						title: that.contacts[jid].name,
						send: function(el, msg){
							that._sendMessage(jid, msg);
							that._trigger('afterSend', null, jid, msg);
						},
						position: pos,
						open: function()
						{
							window_pos = window_pos + window_displacement;
							that._trigger('onOpen');
						}
					});
				}

			});

			container.append(contacts);
			container.append(im_list);
			that.contactList = im_list;
		},
		/**
		 * Adds handlers for Strophe's connection object (presence, set, get, message)
		 * @param {Object} [conn] Strophe connection
		 * @private
		 */
		_setHandlers: function(conn)
		{
			var that = this;
			conn.addHandler(that._onPresence.bind(that), null, "presence");

			conn.addHandler(that._onSet.bind(that), null, "iq", "set");

			conn.addHandler(that._onGet.bind(that), null, "iq", "get");

			conn.addHandler(that._onMessage.bind(that), null, "message");
		},
		/**
		 * Handles the 'message' stanzas.
		 * @param {Object} [stanza] Stanza
		 * @returns {boolean}
		 * @private
		 */
		_onMessage: function(stanza)
		{
			var sFrom = $(stanza).attr('from');
			var sType = $(stanza).attr('type');
			var sBareJid = Strophe.getBareJidFromJid(sFrom);
			var sBody = $(stanza).find('body').text();
			if(sType === 'chat')
			{
				this._trigger('onChatReceived', null, sBareJid, sBody);
				this._receiveMessage(sBareJid, sBody);
			}
			return true;
		},
		/**
		 * Handles the 'IQ - Get' stanzas.
		 * @param {Object} [stanza] Stanza
		 * @returns {boolean}
		 * @private
		 */
		_onGet: function(stanza)
		{
			//@todo
			return true;
		},
		/**
		 * Handles the 'IQ - Set' stanzas.
		 * @param {Object} [stanza] Stanza
		 * @returns {boolean}
		 * @private
		 */
		_onSet: function(stanza)
		{
			//@todo
			return true;
		},
		/**
		 * Handles 'Presence' stanzas.
		 * @param {Object} [stanza] Stanza
		 * @returns {boolean}
		 * @private
		 */
		_onPresence: function(stanza)
		{
			var from = $(stanza).attr("from");
			var jid = Strophe.getBareJidFromJid(from);
			var resource = Strophe.getResourceFromJid(from);

			var ptype = $(stanza).attr("type") || "available";

			if (!this.contacts[jid] || ptype === "error") {
				// ignore presence updates from things not on the roster as well as error presence
				return true;
			}

			if (ptype === "unavailable") {

				// remove resource, contact went offline
				delete this.contacts[jid].resources[resource];

				//check if user is logged with a different client.
				this.contacts[jid].state = ptype;
				for(var key in this.contacts[jid].resources) {
					this.contacts[jid].state = this.contacts[jid].resources[key].show;
					break;
				}
			} else {
				// contact came online or changed status
				var r_show = $(stanza).find("show").text() || "online";
				this.contacts[jid].resources[resource] = {
					show: r_show,
					status: $(stanza).find("status").text()
				};

				this.contacts[jid].state = r_show;
			}

			//adds the contact into the roster.
			this._renderContact(this.contacts[jid]);

			return true;

		},
		/** todo
		 * @private
		 */
		_onDisconnected: function()
		{
			for (var contact in this.contacts) {
				this.contacts[contact].resources = {};
			}
			window_pos = 0;
		},
		/**
		 * Executed when the user goes online. The roster list is fetched and stored into a local object.
		 * @private
		 */
		_onConnected: function()
		{
			//get contacts
			var that = this;
			that.contacts = {};
			var iq = $iq({type: 'get'}).c('query', {xmlns: 'jabber:iq:roster'});
			var conn = that.options.connection;

			conn.sendIQ(iq, function (iq)
			{
				$(iq).find("item").each(function () {
					// build a new contact and add it to the roster
					var contact = new Contact();
					contact.name = $(this).attr('name') || "";
					contact.subscription = $(this).attr('subscription') || "none";
					contact.ask = $(this).attr('ask') || "";
					$(this).find("group").each(function (el){
						contact.groups.push($(this).text());
					});
					contact.jid = $(this).attr('jid');
					contact.chatid = 'chat-' + (new Date()).getTime();
					that.contacts[$(this).attr('jid')] = contact;
					that._renderContact(contact);
				});
			});

			conn.send($pres());
		},
		/**
		 *
		 * @private
		 */
		_init: function()
		{
			//todo
		},
		/**
		 * Destroy method.
		 */
		destroy: function()
		{
			$.Widget.prototype.destroy.call(this);
		},
		/**
		 *Renders a contact into the roster.
		 * @param {Contact} [contact] Contact object.
		 * @private
		 */
		_renderContact: function(contact)
		{
			var list = this.contactList;
			var contact_el = list.find('contact,#'+contact.chatid);

			var html = [];
			html.push("<div id='"+ contact.chatid + "' class='contact'>");
			html.push('<div class="name '+ contact.state + '">');
			html.push(contact.name || contact.jid);
			html.push("<div class='jid'>" + contact.jid + "</div>");
			html.push("</div>");			
			html.push("</div>");

			if(contact_el.length > 0){
				contact_el.replaceWith(html.join(''));
			}else
			{
				list.append(html.join(''));
			}			
		},
		/**
		 * Sends an XMPP message.
		 * @param {String} [to] Recipent's JID.
		 * @param {String} [to] Message
		 * @private
		 */
		_sendMessage: function(to, msg)
		{
			var conn =  this.options.connection;
			if (conn.connected && conn.authenticated) {
				if (msg.length > 0) {
					var from = Strophe.getNodeFromJid(conn.jid);
					var reply = $msg({
						to: to,
						from: from,
						type: "chat"
					}).c("body").t(msg);

					conn.send(reply.tree());
				}
			}
			else {
				//@todo display an error...
				console.log("You have to log in.");
			}
		},
		/**
		 *
		 * @param {String} [from] JID.
		 * @param {String} [msg] Message.
		 * @private
		 */
		_receiveMessage: function(from, msg)
		{
			var contact = this.contacts[from];
			var chat_id = contact.chatid;
			var contact_el = this.contactList.find("#" +chat_id);
			var that = this;

			if(contact_el.data('qsChatwindow'))
			{
				contact_el.chatwindow('open');
			}else
			{
				var pos = "right-"+ window_pos +" bottom";
				contact_el.chatwindow(
					{
						title: contact.name,
						'send': function(el, msg){
							that._sendMessage(contact.jid, msg);
							that._trigger('afterSend', null, contact.jid, msg);
						},
						position: pos,
						open: function()
						{
							window_pos = window_pos + window_displacement;
							that._trigger('onOpen');
						}
					});
			}

			contact_el.chatwindow('writeMsg', contact.name, msg);
		}
	});

	/**
	 * Chat window.
	 *  @property {String} title window title.
	 * @property {String} height window height.
	 */
	$.widget('qs.chatwindow',
	{
		options: {
			title: 'anonymous',
			height: 200
		},
		/**
		 *
		 * @private
		 */
		_create: function()
		{
			var that = this;
			var window = $("<div class='im-chat-window' title='"+ that.options.title +"'></div>");
			var content = $("<div class='im-chat-content'></div>");
			var textarea = $("<textarea></textarea>");

			/*
			Captures keystrokes and send the message on ENTER.
			 */
			textarea.on('keyup', function(ev)
			{
				if (ev.which == 13)
				{
					ev.preventDefault();
					ev.stopPropagation();

					var msg = textarea.val();
					if(msg.length > 0)
					{
						textarea.val("");
						textarea.focus();
					}

					that._writeMsg("<span class='im-chat-me'>me: </span>", msg);
					that._trigger("send", null, msg);
				}
			});

			window.append(content).append(textarea);
			textarea.wrap("<div class='im-chat-input'>");

			this.element.append(window);

			//keep reference of chat window and chat textarea
			this.chatWindow = window;
			this.chatarea = content;
		},
		/**
		 *
		 * @private
		 */
		_init: function()
		{
			var that = this;
			this.chatWindow.dialog(
				{
					modal: false,
					resizable: false,
					position: that.options.position,
					open: function()
					{
						if($.isFunction(that.options.open))
						{
							that.options.open();
						}
					}
				}
			);

		},
		/**
		 * Destroy method.
		 */
		destroy: function()
		{
			$.Widget.prototype.destroy.call(this);
		},
		/**
		 * Writes a new message into the chat area.
		 * @param {String} [who] JID
		 * @param {String} [txt_msg] Message
		 */
		writeMsg: function(who, txt_msg)
		{
			who = "<span class='im-chat-other'>"+ who + ": </span>";
			this._writeMsg(who, txt_msg);

		},
		/**
		 * Writes a new message into the chat area.
		 * @param {String} [who] JID
		 * @param {String} [txt_msg] Message
		 * @returns {boolean}
		 * @private
		 */
		_writeMsg: function(who, txt_msg)
		{
			txt_msg = $.trim(txt_msg);

			if(txt_msg.length < 1)
			{
				return true;
			}

			var div_msg = $("<div class='im-chat-msg'>"+ who + txt_msg + "</div>");
			this.chatarea.append(div_msg);
		},
		open: function()
		{
			this.chatWindow.dialog('open');
		}
	});
}(jQuery));
