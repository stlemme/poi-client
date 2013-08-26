function set_cookie(my_cookie,value,days) {
	if (days) {
		var date = new Date();
		date.setTime(date.getTime()+(days*24*60*60*1000));
		var expires = "; expires="+date.toGMTString();
	} else expires = "";
	document.cookie = my_cookie+"="+value+expires+"; path=/";
}

function read_cookie(my_cookie) {
	var my_cookie_eq = my_cookie + "=";
	var ca = document.cookie.split(';');
	for(var i=0;i< ca.length;i++) {
		var c = ca[i];
		while (c.charAt(0)==' ') {
		c = c.substring(1,c.length);
		}
		if (c.indexOf(my_cookie_eq) == 0) {
			return c.substring(my_cookie_eq.length,c.length);
		}
	}
	return null;
}

function delete_cookie(my_cookie) {
	set_cookie(my_cookie,"",-1);
}


function load(key, defaultValue)
{
	var data = read_cookie("poi-client");
	if (!data) return defaultValue;
	var json = JSON.parse(data);
	return json[key];
}

function store(key, value)
{
	var json = { };

	var data = read_cookie("poi-client");
	if (data) json = JSON.parse(data);
		
	json[key] = value;
	
	data = JSON.stringify(json);
	set_cookie("poi-client", data);
	
	return true;
}