
OpenLayers.Layer.FIWARE = OpenLayers.Layer.FIWARE || {};

OpenLayers.Layer.FIWARE.POI = OpenLayers.Class(OpenLayers.Layer.Vector, {

	initialize: function(name, url, options) {
		options = options || {};
		options.projection = "EPSG:4326";
		options.strategies = [new OpenLayers.Strategy.BBOX({
			resFactor: 2,
			ratio: 1
		})];
		var api = options.api || {};
		options.protocol = new OpenLayers.Protocol.HTTP({
			url: url,
			headers: api.headers,
			params: api.params,
			filterToParams: this.api_poi_filterToParams,
			format: new OpenLayers.Format.FIWARE.POIFormat()
		});
		OpenLayers.Layer.Vector.prototype.initialize.apply(this, [name, options]);
	},

	api_poi_filterToParams: function(filter, params) {
		if (filter.type != 'BBOX')
			return;
		
		bounds = filter.value;
		
		params.north = bounds.top;
		params.south = bounds.bottom;
		params.west  = bounds.left;
		params.east  = bounds.right;
		
		return params;
	}

});


function parseIntlContent(obj, prefer) {
	prefer = prefer || [];
	
	if (obj == null)
		return 'invalid string';
	
	prefer.push('');
	if ('_def' in obj)
		prefer.push(obj['_def']);
	
	for (var i in prefer) {
		if (prefer[i] in obj)
			return obj[prefer[i]];
	}
	
	return 'no proper content for requested language';
}


OpenLayers.Format.FIWARE = OpenLayers.Format.FIWARE || {};

/**
 * A specific format for parsing POI API JSON responses.
 */
OpenLayers.Format.FIWARE.POIFormat = OpenLayers.Class(OpenLayers.Format, {

	// initialize: function() {
		// var size = new OpenLayers.Size(24,24);
		// var offset = new OpenLayers.Pixel(-(size.w/2), -(size.h/2));
		// var icon = new OpenLayers.Icon("img/marker.png",size,offset);
	// },
	
	read: function(response) {
		
		// console.log(response);
		
		if (!response) {
			throw new Error("Unexpected POI response");
		}
		
		var json;
		if (typeof response == 'string') {
			json = JSON.parse(response);
		} else {
			json = response;
		}
		
		var pois = json.pois, x, y, point, feature, features = [];

		for (var id in pois)
		{
			poi = pois[id];
			
			var wgs84 = null;
			// TODO: ensure existence of property
			wgs84 = poi.fw_core.location.wgs84;
			if (wgs84 == null)
				continue;
			
			x = wgs84.longitude;
			y = wgs84.latitude;
			point = new OpenLayers.Geometry.Point(x, y);

			var label = "no label";
			// TODO: ensure existence of property
			// console.log(poi.fw_core.label);
			var language = window.navigator.userLanguage || window.navigator.language;
			
			label = parseIntlContent(poi.fw_core.label, [language]);
			// console.log(label);
			
			// TODO: retrieve thumbnail, symbol, category, etc.

			feature = new OpenLayers.Feature.Vector(point, {
				title: label,
				tooltip: label,
				contents: poi,
				poi: poi
			});
			
			feature.id = "POI_" + id;
			
			features.push(feature);
		}
		
		return features;
	}
});