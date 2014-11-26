var XML3D = XML3D || {};
	
(function() {

XML3D.Geo = function ( geo_tf, level, origin )
{
	this.origin = null;
	this.level = level || 16;
	this.tpl = Math.pow(2, this.level);
	this.geo_tf = geo_tf || null;
	this.moveCBs = Array();
	
	//this.adjustTileSize();
	//console.log("Tile size: " + this.tile_size);
	this.fixTileSize = false;

	if (origin !== null) this.setOrigin(origin);
}


XML3D.Geo.prototype.xtile = function ( lon ) {
	return this.tpl * (lon + 180.0) / 360.0;
}

XML3D.Geo.prototype.ytile = function ( lat ) {
	return (1 - Math.log(Math.tan(this.deg2rad(lat)) + 1 / Math.cos(this.deg2rad(lat))) / Math.PI) /2 * this.tpl;
}

XML3D.Geo.prototype.project = function ( lat, lon ) {
	return {
		"x": this.tile_size * this.xtile(lon),
		"y": this.tile_size * this.ytile(lat)
	};
}

XML3D.Geo.prototype.backproject = function ( x, y ) {
	return null;
}

XML3D.Geo.prototype.tile = function ( lat, lon ) {
	return {
		"x": Math.floor(this.xtile(lon)),
		"y": Math.floor(this.ytile(lat))
	};
}

XML3D.Geo.prototype.adjustTileSize = function ( ) {
	if (this.fixTileSize) return;
	// The distance represented by one tile T (in meters) is given by
	var C = 40075017; // earth equatorial circumference in meters
	this.tile_size = C * Math.cos(this.deg2rad(this.origin.lat)) / this.tpl
}

XML3D.Geo.prototype.setOrigin = function ( origin ) {
	this.origin = origin;
	this.adjustTileSize();
	// console.log(this.origin);
	if (this.geo_tf !== null) {
		var x = this.xtile(this.origin.lon, this.level);
		var y = this.ytile(this.origin.lat, this.level);
		
		this.geo_tf.setAttribute("translation", -this.tile_size*x + " 0 " + -this.tile_size*y);
	}
	
	this.moveCBs.forEach( function (cb) { cb(origin); } );
}

XML3D.Geo.prototype.registerMoveCallback = function ( cb ) {
	this.moveCBs.push(cb);
	if (this.origin !== null) {
		// call once initially
		cb(this.origin);
	}
}


XML3D.Geo.prototype.goToMyPosition = function ( options ) {
	var scope = this;
	options = options || {};
	
	var geo_success = function (position) {
		// console.log("position available.");
		var pos = {
			"lat": position.coords.latitude,
			"lon": position.coords.longitude
		};

		if (options.success !== 'undefined')
			pos = options.success.call(scope, pos);

		// console.log(pos);
		scope.setOrigin(pos);
	}

	var geo_error = function () {
		console.log("Sorry, no position available.");
		
		var pos = null;
		if (options.error !== 'undefined')
			pos = options.error.call(scope);
		
		if (pos != null)
			scope.setOrigin(pos);
	}

	var geo_options = options.geo_options || {
		enableHighAccuracy: true, 
		maximumAge        : 30000, 
		timeout           : 2000
	};

	var wpid = navigator.geolocation.getCurrentPosition(geo_success, geo_error, geo_options);
}

XML3D.Geo.prototype.watchMyPosition = function ( options ) {
	var scope = this;
	options = options || {};
	
	var geo_success = function (position) {
		// console.log("position available.");
		var pos = {
			"lat": position.coords.latitude,
			"lon": position.coords.longitude
		};

		if (options.success !== 'undefined')
			pos = options.success.call(scope, pos);

		// console.log(pos);
		scope.setOrigin(pos);
		
		// we need to fix the tile size according to the first acquired position
		// otherwise, we continuously need to update the position of other objects (i.e. POIs)
		scope.fixTileSize = true;
	}

	var geo_error = function () {
		console.log("Sorry, no position available.");
		
		var pos = null;
		if (options.error !== 'undefined')
			pos = options.error.call(scope);
		
		if (pos != null)
			scope.setOrigin(pos);
	}

	var geo_options = options.geo_options || {
		enableHighAccuracy: true, 
		maximumAge        : 30000, 
		timeout           : 2000
	};

	var wpid = navigator.geolocation.watchPosition(geo_success, geo_error, geo_options);
}



XML3D.Geo.prototype.deg2rad = function ( angle ) {
	return angle * 0.017453292519943295; // (angle / 180) * Math.PI;
}


})();