
var XML3D = XML3D || {};
	
(function() {

	XML3D.Terrain = function( group, tf ) {
	
		this.ground = ground || null;
		this.tf = tf || null;
	
		this.deg2rad = function (angle) {
			return angle * 0.017453292519943295; // (angle / 180) * Math.PI;
		}
		
		this.lon2xtile_fract = function (lon, zoom) {
			return Math.pow(2, zoom) * (lon + 180.0) / 360.0;
		}
		
		this.lat2ytile_fract = function (lat, zoom) {
			return (1 - Math.log(Math.tan(this.deg2rad(lat)) + 1 / Math.cos(this.deg2rad(lat))) / Math.PI) /2 * Math.pow(2, zoom);
		}

		this.lon2xtile = function (lon, zoom) { return Math.floor(this.lon2xtile_fract(lon, zoom)); }
		this.lat2ytile = function (lat, zoom) { return Math.floor(this.lat2ytile_fract(lat, zoom)); }

		this.load = function( api_tiles, config ) {
			var z = config.zoom;
			var xtile = {
				"min": this.lon2xtile(config.west, config.zoom),
				"max": this.lon2xtile(config.east, config.zoom)
			};

			var ytile = {
				"min": this.lat2ytile(config.north, config.zoom),
				"max": this.lat2ytile(config.south, config.zoom)
			};
			
			for (var x = xtile.min; x <= xtile.max; x++)
			{
				for (var y = ytile.min; y <= ytile.max; y++)
				{
					var tile_uri = api_tiles + "/" + z + "/" + x + "/" + y + "-asset.xml";
					var tile_id = "tile_" + z + "_" + x + "_" + y;
					
					var tile = XML3D.createElement("model");
					tile.setAttribute("id", tile_id);
					tile.setAttribute("src", tile_uri + "#plane");
					tile.setAttribute("transform", tile_uri + "#tf");

					this.ground.appendChild(tile);
				}
			}

			// The distance represented by one tile T (in meters) is given by
			var C = 40075017; // earth equatorial circumference in meters
			var T = C * Math.cos(this.deg2rad(config.origin.lat)) / Math.pow(2, z)

			console.log("Tile size: " + T);
			// scale by T -> 1 unit = 1 meter
			var s = T;
			var x = this.lon2xtile_fract(config.origin.lon, config.zoom);
			var y = this.lat2ytile_fract(config.origin.lat, config.zoom);
			
			this.tf.setAttribute("translation", -s*x + " 0 " + -s*y);
			this.tf.setAttribute("scale", s + " 1 " + s);
		}
	
	};

		
})();
