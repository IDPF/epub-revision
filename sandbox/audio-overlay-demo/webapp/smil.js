// the main object for smil playback
function SmilPlayer()
{
	this.rate = 1;
	
	// the root of the smil tree
	this.smil_root = null;
	// LIFO-like stack of currently-playing nodes
	this.currently_playing = [];
	//list of @role values to skip
	this.skip_roles = [];
	// play state
	this.started = false;
	// the temporary database for keeping track of IDs
	this.db = new DB();	
	// a callback for play events
	this.play_position_changed_callback = null;
	// the base text document
	this.textdoc = "";
	// a convenience for collecting IDs while parsing
	this.temp_par_node = null;
	// the address of the current file
	this.smil_url = "";
}
// load a file (expected: a full path to the file)
SmilPlayer.prototype.load_smil = function(filepath)
{
	/*
	Use this command line on Mac OSX to launch Chrome and avoid running a webserver (bypassing the XMLHttpRequest cross-origin / local file restrictions):
	/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --disable-web-security
	Note:
	--allow-file-access-from-files
	should work but it doesn't anymore (change in Chrome implementation ?)
	Note:
	open -b com.google.chrome --args --allow-file-access-from-files
	this should also work but the "--args" is somewhat invalid !   :(
	*/
	
	debug_trace("SmilPlayer load_smil(" + filepath + ")");
	this.smil_url = filepath;
	try {
		var xml_doc = null;
		
		var strToMatch = "file:";
		if (false &&
			filepath.substr(0, strToMatch.length) === strToMatch
			//filepath.indexOf(strToMatch) !== 0
			) {
			//LOCAL FILE (see Alice.html for "jQuery.twFile.js" and the applet at the bottom of the HTML "body")
			
			filepath = $.twFile.convertUriToLocalPath(filepath);
			var xmlString = $.twFile.load(filepath);
			if (xmlString) {
				var domParser = new DOMParser();
				var xmlObject = domParser.parseFromString(xmlString , "text/xml");
				xml_doc = xmlObject.documentElement;
			}
		}
		else {
			//REMOTE FILE
			
	        var xml_http = new window.XMLHttpRequest();
	        xml_http.overrideMimeType("text/xml");
	        xml_http.open("GET", filepath, false);
/*			
			// TODO: this should probably be an asynchronous request
			xml_http.onreadystatechange = function() {
		        if (xhr.readyState == 4) {
		          //xml_http.overrideMimeType("text/xml");
		        var xml_doc = xml_http.responseXML.documentElement;
					.....
		        }
		      };
			xml_http.open("GET", filepath, true);
*/
	        xml_http.send(null);
	        xml_doc = xml_http.responseXML.documentElement;
		}
		this.textdoc = xml_doc.getAttribute("textdoc");
		
        // expected: everything should be wrapped up in a seq
	    var main_seq = xml_doc.getElementsByTagName("seq")[0];
	    if (!main_seq) {
	        debug_error("No main seq element found in SMIL")
	        return;
	    }
		this.db.create_db();
	    this.smil_root = this.make_smil_tree(main_seq);
		this.started = false;
		return true;
	}
    catch(e) {
        debug_trace(e.message);
		this.smil_root = null;
		return false;
    }
	
}
//expects a full file path
SmilPlayer.prototype.load_smilrefs_file = function(filename) {
	if (!this.db.load_smilrefs_textfile(filename)) {
        debug_trace("Error loading smilrefs into database " + filename);
    	return;
	}
}
// stop everything from playing
SmilPlayer.prototype.stop_and_clear_all = function()
{
	debug_trace("SmilPlayer stop_and_clear_all()")
	this.smil_root.stop();
	this.currently_playing = [];
	this.audio_elements = [];
}
// is audio playing right now?
SmilPlayer.prototype.is_playing = function()
{
	var retval = false;
	
	var audio_renderer = Renderers.find_renderer_for_type("audio");
	if (audio_renderer) {
		retval = audio_renderer.is_playing();
	}
	
	debug_trace("SmilPlayer is_playing() returns " + retval.toString());
	return retval;
	
}
SmilPlayer.prototype.is_document_loaded = function()
{
	var retval = (this.smil_root) ? true : false;
	debug_trace("SmilPlayer is_document_loaded() returns " + retval.toString());
	return retval;
}
// start playback at the smil tree's root
SmilPlayer.prototype.play_from_beginning = function()
{
	debug_trace("SmilPlayer play_from_beginning()");
	this.started = true;
	debug_trace("SmilPlayer.play_from_beginning() starting playback on " + this.smil_root.to_string());
	this.smil_root.play();
}
SmilPlayer.prototype.play_from_text_id = function(id) 
{
	var smilid = this.db.find_smilid(id, function(smilid) {
        if (smilid != undefined && smilid != "") {
			smil_player.play_from_id(smilid);
		}
        else{
            debug_error("could not find smil id for " + id);
		}
    });
}
SmilPlayer.prototype.has_text_id = function(id, callback) 
{
	var smilid = this.db.find_smilid(id, callback);
}
// start playback from a specific ID
SmilPlayer.prototype.play_from_id = function(id)
{
	debug_trace("SmilPlayer play_from_id(" + id + ")");
	var node = this.find_node_by_id(this.smil_root, id);
	if (!node) {
		debug_error("ID " + id + " not found");
		return;
	}
	if (!(node instanceof TimeContainerNode)) {
		debug_error("This simple implementation only supports playback from par and seq nodes");
		return;
	}
	this.stop_and_clear_all();
	var parent = node.parent;
	var tmparr = [];
	while (parent) {
		tmparr.push(parent);
		parent = parent.parent;
	}
	tmparr = tmparr.reverse();
	for (var i = 0; i<tmparr.length; i++)
	{
		this.add_currently_playing(tmparr[i]);
	}
	this.started = true;
	debug_trace("SmilPlayer.play_from_id() starting playback on " + node.to_string());
	
	node.play();
}
// pause playback
SmilPlayer.prototype.pause = function() 
{
	debug_trace("SmilPlayer pause()");
	var audio_renderer = Renderers.find_renderer_for_type("audio");
	if (audio_renderer) {
		var elm = this.find_currently_playing_by_type("audio");
		if (elm) {
			audio_renderer.pause(elm);
		}
		else {
			debug_trace("... but no audio is currently playing");
		}
	}
	else {
		debug_trace("... but there is no audio renderer");
	}
}
// resume playback from a paused state, or start from the beginning
SmilPlayer.prototype.resume = function()
{
	debug_trace("SmilPlayer resume()");
	if (!this.is_document_loaded()) {
		debug_error("no smil document loaded");
		return;
	}
	
	if (!this.started) {
		debug_trace("SmilPlayer starting from beginning");
		this.play_from_beginning();
	}
	else {
		var audio_renderer = Renderers.find_renderer_for_type("audio");
		if (audio_renderer) {
			var elm = this.find_currently_playing_by_type("audio");
			if (elm) {
				audio_renderer.resume(elm);
			}
		}
	}
}
// search node and its subtree for a node with the given ID
SmilPlayer.prototype.find_node_by_id = function(node, id)
{
	if (node.smil_elm) {
		if (node.smil_elm.hasAttribute("id") && 
			node.smil_elm.getAttribute("id") == id) {
				return node;
		}
		else if (node.children != undefined) {
			for (var i = 0; i<node.children.length; i++) {
				var n = this.find_node_by_id(node.children[i], id);
				if (n) break;
			}
			if (n) return n;
			else return null;
		}
		else {
			return null;
		}
	}
}
// starting from an XML DOM element representing a smil time container, make a tree
SmilPlayer.prototype.make_smil_tree = function(elm)
{
    var node = this.smil_node_factory(elm);
    if (node instanceof TimeContainerNode) {   
        var child_count = 0;
        var child = elm.firstElementChild;
        var max = elm.childElementCount;
        while (child_count < max) {
            child_count++;
            var subtree = this.make_smil_tree(child);
            if (subtree) {
                subtree.parent = node;
                node.children.push(subtree);
            }
            child = child.nextElementSibling;
        }
    }
    return node;
}
SmilPlayer.prototype.resolve_media = function(node)
{
    if (!node.html_elm) {
		var src = node.smil_elm.getAttribute("src");
		src = resolve_frag(src, smil_player.textdoc);
        if (src != null && url_has_target(src) && this.book_doc)
        	node.html_elm = this.book_doc.getElementById(url_get_target(src));	
	}
    if (!node.html_elm) 
    	debug_trace("no associated html element");
}
// make smil nodes
SmilPlayer.prototype.smil_node_factory = function(elm)
{
    if (elm.nodeName == "seq") {
        var node = new SeqNode();
        node.smil_elm = elm;
		this.add_ids_to_db(node);
        return node;
    }
	else if (elm.nodeName == "par") {
		var node = new ParNode();
		node.smil_elm = elm;
		this.temp_par_node = node;
		return node;
	}
    else if (elm.nodeName == "audio" || elm.nodeName == "text") {
        var node = new MediaNode();
        node.smil_elm = elm;
		if (elm.nodeName == "text") {
			this.add_ids_to_db(node);
			
    		this.resolve_media(node);
			if (node.html_elm)
				$(node.html_elm).toggleClass('smilAware', true);
		}
		return node;
    }
    else {
		return null;
	}
}
SmilPlayer.prototype.add_ids_to_db = function(node)
{
	var textid = "";
	var smilid = "";
	if (node.smil_elm.nodeName == "seq") {
		textid = remove_hash(node.smil_elm.getAttribute("textref"));
		smilid = node.smil_elm.getAttribute("id");
	}
	else if (node.smil_elm.nodeName == "text") {
		textid = remove_hash(node.smil_elm.getAttribute("src"));
		smilid = this.temp_par_node.smil_elm.getAttribute("id");
	}
	
	if (textid && smilid && textid.length > 0 && smilid.length > 0) {
		this.db.insert_row(textid, smilid);
	}
	
}
// push a node onto the currently_playing stack
SmilPlayer.prototype.add_currently_playing = function(node)
{
	// stop any already-playing media nodes
    if (node instanceof MediaNode){
        var similar_elms = this.find_currently_playing_by_type([node.smil_elm.nodeName]);
        if (similar_elms) similar_elms.stop;
    }
    this.currently_playing.push(node);
	var string = "Current after add: [";
	this.currently_playing.forEach(function(n) {
		string += n.to_string();
		string += ", ";
	});
	string += "]";
	debug_trace(string);
}
// remove a node from the currently_playing stack (we could probably replace this with pop() instead of explicitly removing a certain node)
SmilPlayer.prototype.remove_currently_playing = function(node)
{
	array_remove(this.currently_playing, node);
	var string = "Current after remove: [";
	this.currently_playing.forEach(function(n) {
		string += n.to_string();
		string += ", ";
	});
	string += "]";
	debug_trace(string);
}
// filter what's currently playing by media type (look at the smil element name to find out media type)
// return only one node.  this could be extended if multiple simultaneous media types were to be supported.
SmilPlayer.prototype.find_currently_playing_by_type = function(typearray)
{
    var results = this.currently_playing.filter(function(node) {
        if (typearray.indexOf(node.smil_elm.nodeName) != -1)
            return true;
        else 
            return false;
    });
    
    if (results && results.length > 0)
        return results[0];
    else
        return null;
}
// add or remove a role to the list of things that should be skipped
SmilPlayer.prototype.toggle_role = function(role)
{
	var already_exists = $.inArray(role, this.skip_roles);
	
	if (already_exists == -1) {
		this.skip_roles.push(role);
		debug_trace("SmilPlayer toggle_role(" + role + ").  Will be skipped.");
	}
	else {
		array_remove(this.skip_roles, role);
		debug_trace("SmilPlayer toggle_role(" + role + ").  Will be played.");
	}
}
// print the smil tree (node names and IDs)
SmilPlayer.prototype.debug_print = function(debug_region_elm)
{
	var string = "<p>The SMIL tree</p> <ul>" + this.smil_root.to_html_string() + "</ul>"
	if (debug_region_elm) debug_region_elm.innerHTML += string;
}
SmilPlayer.prototype.is_node_currently_playing = function(node)
{
	if ($.inArray(node, this.currently_playing) == -1)
		return false;
	else
		return true;
}
SmilPlayer.prototype.play_next = function()
{
	debug_trace("SmilPlayer play_next()");
	//find the innermost seq in the currently playing list
	var tmparr = this.currently_playing.reverse();
	var seq = null;
	for (var i = 0; i<tmparr.length; i++) {
		if (tmparr[i] instanceof SeqNode) {
			seq = tmparr[i];
			break;
		}
	}
	if (!seq) {
		debug_trace("no seq currently playing; cannot advance to next phrase");
		return;
	}
	
	var current = null;
	for (i=0; i<seq.children.length; i++) {
		if (this.is_node_currently_playing(seq.children[i])){
			current = seq.children[i];
			break;
		}
	}
	seq.stop();
	seq.play_next(current);
	
}
SmilPlayer.prototype.play_previous = function()
{
	//find the innermost seq in the currently playing list
	var tmparr = this.currently_playing.reverse();
	var seq = null;
	for (var i = 0; i<tmparr.length; i++) {
		if (tmparr[i] instanceof SeqNode) {
			seq = tmparr[i];
			break;
		}
	}
	if (!seq) {
		debug_trace("no seq currently playing; cannot advance to next phrase");
		return;
	}
	
	var current = null;
	for (i=0; i<seq.children.length; i++) {
		if (this.is_node_currently_playing(seq.children[i])){
			current = seq.children[i];
			break;
		}
	}
	seq.stop();
	seq.play_previous(current);
	
}
SmilPlayer.prototype.set_rate = function(rate)
{
	debug_trace("SmilPlayer set_rate(" + rate.toString() + ")");
	this.rate = rate;
	var audio_renderer = Renderers.find_renderer_for_type("audio");
	var elm = this.find_currently_playing_by_type("audio");
	audio_renderer.set_rate(elm, rate);
}
SmilPlayer.prototype.set_volume = function(volume)
{
	debug_trace("SmilPlayer set_volume(" + volume.toString() + ")");
	var audio_renderer = Renderers.find_renderer_for_type("audio");
	var elm = this.find_currently_playing_by_type("audio");
	audio_renderer.set_volume(elm, volume);
}
// main abstract object representing a node in the smil tree
function SmilNode()
{
    this.parent = null;
    this.smil_elm = null;
}
// for debugging
SmilNode.prototype.to_html_string = function()
{
	var string = "<li>" + this.smil_elm.nodeName;
	
	for (var i = 0; i < this.smil_elm.attributes.length; i++) {
		string += " @" + this.smil_elm.attributes.item(i).nodeName + "=" + this.smil_elm.attributes.item(i).nodeValue;
		
	}
		
	if (this instanceof TimeContainerNode) {
		if (this.children.length > 0) {
			string += "<ul>";
			this.children.forEach(function(node) {
				string += node.to_html_string();
			});
			string += "</ul>";
		}
	}
	string += "</li>"
	return string;
}
SmilNode.prototype.to_string = function()
{
	var string = "<" + this.smil_elm.nodeName;
	
	for (var i = 0; i < this.smil_elm.attributes.length; i++) {
		string += " " + this.smil_elm.attributes.item(i).nodeName + "=" + this.smil_elm.attributes.item(i).nodeValue;
	}
	string += ">";
	return string;
}
// a par or a seq node in the smil tree
function TimeContainerNode()
{
	this.children = [];
}
TimeContainerNode.prototype = new SmilNode();
TimeContainerNode.prototype.notify_done = function(node)
{
	debug_trace("TimeContainerNode.notify_done received from " + node.to_string());
}
// start playing a node
TimeContainerNode.prototype.play = function()
{
	debug_trace("TimeContainerNode playing " + this.to_string());
}
// stop everything from the top down
TimeContainerNode.prototype.stop = function()
{
	debug_trace("TimeContainerNode stopping " + this.to_string());
	smil_player.remove_currently_playing(this);
	
	this.children.forEach(function(node) {
		if (smil_player.is_node_currently_playing(node))
			node.stop();
	});
}
function SeqNode()
{
	this.children = [];
}
SeqNode.prototype = new TimeContainerNode();
SeqNode.prototype.play = function()
{
	// first, check if this node should be skipped
	if (this.smil_elm.getAttribute("role") != null) {
		var role = this.smil_elm.getAttribute("role");
		var should_skip = $.inArray(role, smil_player.skip_roles);
		if (should_skip != -1) {
			debug_trace("skipping node " + this.to_string());
			if (this.parent) this.parent.notify_done(this);
			return;
		}
	}
	if (smil_player.play_position_changed_callback!= undefined) smil_player.play_position_changed_callback(this.smil_elm.getAttribute("id"));
	
	smil_player.add_currently_playing(this);
	if (this.children.length > 0) {
		debug_trace("SeqNode.play(), this = " + this.to_string() + " starting playback on child = " + this.children[0].to_string());
		this.children[0].play();
	}
}
// called by a child node to let its parent know that it has finished playing
SeqNode.prototype.notify_done = function(child)
{
	debug_trace(this.to_string() + " received notify_done from " + child.to_string());
	var idx = this.children.indexOf(child);
	var idx_last = this.children.length - 1;
	
	// start the next one
	if (idx == idx_last) {	
		smil_player.remove_currently_playing(this);
		if (this.parent) this.parent.notify_done(this);
	}
    else if (idx != -1 && idx < idx_last) {
        idx++;
		debug_trace("SeqNode.notify_done() received from " + child.to_string() + ", this = " + this.to_string() + " starting playback on next child = " + this.children[idx].to_string());
        this.children[idx].play();
    }
    else {	
		debug_trace("error, child not found in seq children");	    
	}
}
SeqNode.prototype.play_next = function(current)
{
	debug_trace(this.to_string() + " play next relative to " + current.to_string());
	var idx = this.children.indexOf(current);
	var idx_last = this.children.length - 1;
	TimeContainerNode.prototype.play.call(this);
	
	// start the next one
	if (idx == idx_last) {	
		smil_player.remove_currently_playing(this);
		if (this.parent) this.parent.play_next(this);
	}
    else if (idx != -1 && idx < idx_last) {
        idx++;
		debug_trace("SeqNode.play_next(), this = " + this.to_string() + " starting playback on child = " + this.children[idx].to_string());
        this.children[idx].play();
    }
    else {	
		debug_trace("error, node not found in seq children");	    
	}	
}
SeqNode.prototype.play_previous = function(current)
{
	debug_trace(this.to_string() + " play previous relative to " + current.to_string());
	var idx = this.children.indexOf(current);
	TimeContainerNode.prototype.play.call(this);
	
	// start the next one
	if (idx == 0) {	
		smil_player.remove_currently_playing(this);
		if (this.parent) this.parent.play_previous(this);
	}
    else if (idx > 0) {
        idx--;
		debug_trace("SeqNode.play_previous(), this = " + this.to_string() + " starting playback on child = " + this.children[idx].to_string());
        this.children[idx].play();
    }
    else {	
		debug_trace("error, node not found in seq children");	    
	}
}
function ParNode()
{
	this.children = [];
}
ParNode.prototype = new TimeContainerNode();
ParNode.prototype.play = function()
{
	// first, check if this node should be skipped
	if (this.smil_elm.getAttribute("role") != null) {
		var role = this.smil_elm.getAttribute("role");
		var should_skip = $.inArray(role, smil_player.skip_roles);
		if (should_skip != -1) {
			debug_trace("skipping node " + this.to_string());
			if (this.parent) this.parent.notify_done(this);
			return;
		}
	}
	if (smil_player.play_position_changed_callback!= undefined) smil_player.play_position_changed_callback(this.smil_elm.getAttribute("id"));
	
	smil_player.add_currently_playing(this);
	for (var i = 0; i < this.children.length; i++) {
		debug_trace("ParNode.play(), this = " + this.to_string() + " starting playback on child = " + this.children[i].to_string());
		this.children[i].play();
	}
}
ParNode.prototype.notify_done = function(child)
{
	debug_trace(this.to_string() + " received notify_done from " + child.to_string());
	// assume all have finished playing
	// this is par handling the easy way: just assume only one time-based child media at a time
	// also, in this implementation, only audio media gives a notify_done signal
	this.children.forEach(function(node) {
    	if (node.smil_elm.nodeName == "text")
			node.stop();
     });
	smil_player.remove_currently_playing(this);

    if (this.parent) this.parent.notify_done(this);
    else debug_trace("par has null parent");
}
// play prev/next not meaningful for pars, so just pass the message along
ParNode.prototype.play_next = function(child)
{
	if (this.parent) {
		debug_trace("ParNode.play_next(), this = " + this.to_string());
		this.parent.playnext(this);
	}
}
ParNode.prototype.play_previous = function(child)
{
	if (this.parent) {
		debug_trace("ParNode.play_previous(), this = " + this.to_string());
		this.parent.playprevious(this);
	}
}
// media objects in the smil tree
function MediaNode()
{
    this.html_elm = null;
    this.renderer = null;
}
MediaNode.prototype = new SmilNode();
// send the media object to its renderer
MediaNode.prototype.play = function()
{
	debug_trace("MediaNode playing " + this.to_string());
	// find a renderer if one does not already exist
    if (!this.renderer)
		this.renderer = Renderers.find_renderer_for_node(this);
	
	if (this.renderer) {	
		smil_player.add_currently_playing(this);
		this.renderer.start_render(this);
	}
}
// stop playback
MediaNode.prototype.stop = function()
{
	debug_trace("MediaNode stopping " + this.to_string());
	smil_player.remove_currently_playing(this);
    if (this.renderer)
        this.renderer.stop_render(this);
}
// notify the parent smil tree node that this media object has finished rendering
MediaNode.prototype.notify_done = function()
{
	debug_trace("MediaNode received notify_done renderer " + this.to_string());
    smil_player.remove_currently_playing(this);
    this.parent.notify_done(this);
}

// an abstract object to represent a renderer
function Renderer(){}
// the "api" for a renderer
Renderer.prototype.can_render = null;
Renderer.prototype.resolve_media = null;
Renderer.prototype.start_render = null;
Renderer.prototype.stop_render = null;

// renderer for highlighting text
function HighlightTextRenderer()
{
    //this.saved_bgcolor = "";
    this.supported = "text";
}
HighlightTextRenderer.prototype = new Renderer();
// returns whether or not the given node can be rendered by this renderer
HighlightTextRenderer.prototype.can_render = function(node)
{
    if (!node) return false;
    if (!node.smil_elm) return false;
    if (node.smil_elm.nodeName == this.supported) return true;
    return false;
}
// highlight a node
HighlightTextRenderer.prototype.start_render = function(node)
{
	debug_trace("HighilghtTextRenderer start: " + node.to_string());
    this.resolve_media(node);

    //this.saved_bgcolor = node.html_elm.style.backgroundColor;

    node.html_elm.focus();

    // note that this is totally annoying in an iframe
    if (node.html_elm["scrollIntoViewIfNeeded"] != undefined)
        node.html_elm.scrollIntoViewIfNeeded();
    else
        node.html_elm.scrollIntoView();
    
	//node.html_elm.style.backgroundColor = "yellow";
	$(node.html_elm).toggleClass('smilActive', true);
	
	if (node.html_elm.nodeName == "VIDEO" || node.html_elm.nodeName == "AUDIO") {
		
		node.html_elm.defaultPlaybackRate = smil_player.rate;
		// node.html_elm.volume = this.volume;
			
		AudioEventManager.add_listeners(node);
		if (node.html_elm.currentTime != 0) {
			node.html_elm.currentTime = 0;
		}
		else {
			node.html_elm.play();
		}
	}
}
// unhighlight a node
HighlightTextRenderer.prototype.stop_render = function(node)
{
	debug_trace("HighlightTextRenderer stop: " + node.to_string());
    
	//node.html_elm.style.backgroundColor = this.saved_bgcolor;
	$(node.html_elm).toggleClass('smilActive', false);
	
	if (node.html_elm.nodeName == "VIDEO" || node.html_elm.nodeName == "AUDIO") {
		node.html_elm.pause();
		//node.html_elm.currentTime = 0;
	}
}
// find the text element referenced by this node
HighlightTextRenderer.prototype.resolve_media = function(node)
{
    if (!node.html_elm) {
		var src = node.smil_elm.getAttribute("src");
		src = resolve_frag(src, smil_player.textdoc);
        if (src != null && url_has_target(src) && smil_player.book_doc)
        	node.html_elm = smil_player.book_doc.getElementById(url_get_target(src));	
	}
    if (!node.html_elm) 
    	debug_trace("no associated html element");
}

// audio media renderer
function AudioRenderer()
{
    this.rate = 1;
	this.volume = 0.6;
    this.supported = "audio";
	// keep a list of audio media html elements (one entry per audio file) so we don't re-create them
	this.audio_media = [];
	this.event_listeners = 0;
}
AudioRenderer.prototype = new Renderer();
// whether or not the given node can by rendered
AudioRenderer.prototype.can_render = function(node)
{
    if (!node) return false;
    if (!node.smil_elm) return false;
    if (node.smil_elm.nodeName == this.supported) return true;
    return false;
}
// start playing the audio
AudioRenderer.prototype.start_render = function(node)
{
	// create an html element (or find one we've already created) for this audio media
    this.resolve_media(node);

    try {
        node.html_elm.defaultPlaybackRate = this.rate;
		node.html_elm.volume = this.volume;
        debug_trace("AudioRenderer start: " + node.to_string());

       AudioEventManager.add_listeners(node);
		
        var cb = parseFloat(node.smil_elm.getAttribute("clipBegin"));
        if (cb != node.html_elm.currentTime) {

			try {
            	node.html_elm.currentTime = cb;
		    } 
			catch(e) {
				debug_trace("Audio set currentTime exception: " + e.message);
		      function setThisTime() {
            	node.html_elm.currentTime = cb;
		        node.html_elm.removeEventListener("canplay", setThisTime, true);
		      }
		      node.html_elm.addEventListener("canplay", setThisTime, true);
		    }
		}
        else
            node.html_elm.play();
        
    }
    catch(e) {
		debug_error(e.message);
        node.notify_done();
    }
}
// pause the audio
AudioRenderer.prototype.stop_render = function(node)
{
	debug_trace("AudioRenderer stopped " + node.to_string());
    node.html_elm.pause();
}
// create an html element to represent this audio media, or find one in our array of already-created elements
AudioRenderer.prototype.resolve_media = function(node)
{
	if (!node.html_elm) {
		var src = node.smil_elm.getAttribute("src");
		
		var base_path = url_get_path(smil_player.smil_url);
        var src_fullpath = go_relative(base_path, src);
		
		// look in the collection of media elements already created by this renderer
		for (var i = 0; i < this.audio_media.length; i++) {
			if (this.audio_media[i].hasAttribute("src") && this.audio_media[i].getAttribute("src") == src_fullpath) {
				node.html_elm = this.audio_media[i];
				break;
			}
		}
		// if it still was not found, create it
		if (!node.html_elm) {
			node.html_elm = new Audio(src_fullpath);
		    this.audio_media.push(node.html_elm);
		}
	}
}
//additional functions outside of the basic renderer "api"
// pause playback
AudioRenderer.prototype.pause = function(node)
{
	debug_trace("AudioRenderer paused " + node.to_string());
    node.html_elm.pause();
}
// resume playback
AudioRenderer.prototype.resume = function(node)
{	
	debug_trace("AudioRenderer resume " + node.to_string());
    node.html_elm.play();
}
// set the rate
// 1 = normal speed, forward playback
// and, according to the HTML5 draft (http://www.w3.org/TR/html5/video.html):
// "If the playbackRate  is positive or zero, then the direction of playback is forwards. Otherwise, it is backwards.
AudioRenderer.prototype.set_rate = function(node, rate)
{
    this.rate = rate;
    if (node && node.html_elm) {
        var was_playing = !node.html_elm.paused;
        if (was_playing)
            node.html_elm.pause();
            
        node.html_elm.defaultPlaybackRate = this.rate;
        
        if (was_playing)
            node.html_elm.play();
    }
    
}
AudioRenderer.prototype.set_volume = function(node, volume)
{
	this.volume = volume;
    if (node && node.html_elm) {
        var was_playing = !node.html_elm.paused;
        if (was_playing)
            node.html_elm.pause();
            
        node.html_elm.volume = this.volume;
        
        if (was_playing)
            node.html_elm.play();
    }
}
// are we playing audio?
AudioRenderer.prototype.is_playing = function() {
	var retval = false;
	
	for (var i = 0; i < this.audio_media.length; i++) {
		if (this.audio_media[i].paused == false) 
			retval = true;
	}
	
	debug_trace("AudioRenderer is_playing() returns " + retval.toString());
	return retval;
}

// renderer instances and the global Renderers.renderers array
function Renderers(){}
Renderers.renderers = [];
Renderers.find_renderer_for_node = function(node)
{
    var results = Renderers.renderers.filter(function(rend) {
        if (rend.can_render(node)) return true;
        else return false;
    });
    if (results.length > 0)
        return results[0];
    else
        return null;
}
// return a renderer that supports this media type (e.g. "text", "audio")
Renderers.find_renderer_for_type = function(type)
{
    var results = Renderers.renderers.filter(function(rend) {
        if (rend.supported == type) return true;
        else return false;
    });
    if (results.length > 0)
        return results[0];
    else
        return 0;
}

// our two renderers
Renderers.renderers.push(new HighlightTextRenderer());
Renderers.renderers.push(new AudioRenderer());

// audio event helper
// it only manages two events at once
function AudioEventManager(){}
AudioEventManager.current_node = null;
AudioEventManager.add_listeners = function(node)
{
	// if (!(
	// 		node.smil_elm.nodeName == "audio" || (node.html_elm.nodeName == "VIDEO" || node.html_elm.nodeName == "AUDIO")
	// 		)) {
	// 		debug_error("cannot add listener for non-audio/video nodes!");
	// 		return;
	// 	}
	AudioEventManager.current_node = node;
	
	debug_trace("AudioEventManager adding seeked listener for " + node.to_string());
	node.html_elm.addEventListener("seeked", AudioEventManager.seeked_callback, true);
	
	if (AudioEventManager.current_node.smil_elm.hasAttribute("clipEnd")) {
		debug_trace("AudioEventManager adding timeupdate listener for " + node.to_string());
		node.html_elm.addEventListener("timeupdate", AudioEventManager.timeupdate_callback, false);
	}
	else {
		debug_trace("AudioEventManager adding ended listener for " + node.to_string());
		node.html_elm.addEventListener("ended", AudioEventManager.ended_callback, false);
	}	
}
AudioEventManager.cleanup = function()
{
	if (AudioEventManager.current_node == null
		|| AudioEventManager.current_node.html_element == null) return;
	
	AudioEventManager.current_node.html_element.removeEventListener("seeked", AudioEventManager.seeked_callback, true);
	
	if (AudioEventManager.current_node.smil_elm.hasAttribute("clipEnd")) {
		AudioEventManager.current_node.html_element.removeEventListener("timeupdate", AudioEventManager.timeupdate_callback, false);
	}
	else {
		AudioEventManager.current_node.html_element.removeEventListener("ended", AudioEventManager.timeupdate_callback, false);
	}
	
	AudioEventManager.current_node = null;
}
AudioEventManager.timeupdate_callback = function()
{
	var ce = parseFloat(AudioEventManager.current_node.smil_elm.getAttribute("clipEnd"));
	
	if(AudioEventManager.current_node.html_elm.currentTime >= ce) {
		debug_trace("Audio renderer done " +  AudioEventManager.current_node.to_string());

	    AudioEventManager.current_node.html_elm.pause();
	    AudioEventManager.current_node.notify_done();
	
		AudioEventManager.cleanup();
	}
}

AudioEventManager.seeked_callback = function()
{
	debug_trace("Audio renderer seeked " + AudioEventManager.current_node.to_string());
	AudioEventManager.current_node.html_elm.play();
}

AudioEventManager.ended_callback = function()
{
	debug_trace("Audio renderer ended " + AudioEventManager.current_node.to_string());
	var node = AudioEventManager.current_node;
	AudioEventManager.cleanup();
    node.html_elm.pause();
    node.notify_done();
}