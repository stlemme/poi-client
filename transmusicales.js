
var XML3D = XML3D || {};

(function () {

var geo, terrain, pois;
var animator;
var controller;
var busy;

function bboxAroundPosition( pos ) {
	var d = 0.002;
	return {
		"west": Math.max(pos.lon-d, config.venue[1]),
		"south": Math.max(pos.lat-d, config.venue[0]),
		"east": Math.min(pos.lon+d, config.venue[3]),
		"north": Math.min(pos.lat+d, config.venue[2])
	};
}

var poi_id2color = {};

function mapStatus2Color(status) {
	if (status < 0 || status >= config.status2color.length)
		status = 0;
	return config.status2color[status];
}

function buildPOI(poi_data)
{
	var serviceName = "";

	for (var i in poi_data.services)
		serviceName += poi_data.services[i].name;

	return {
		fw_core: {
			category: serviceName,
			location: {
				wgs84: {
					latitude: poi_data.lat,
					longitude: poi_data.lng
				}
			}
		}
	};
}

function updatePOI(id, status)
{
	// console.log("poi: "+ id + " status: "+status);
	color = poi_id2color[id];
	if (color === undefined)
		return false;
	color.setScriptValue(mapStatus2Color(status));
}

function createPOI(poi_data)
{
	var id = poi_data.uuid;

	var model = pois.addPOI(id, buildPOI(poi_data));
	if (model === undefined)
		return false;

	var ad = XML3D.createElement("assetdata");
	ad.setAttribute("name", "config");
	model.appendChild(ad);

	var color = XML3D.createElement("float3");
	color.setAttribute("name", "diffuseColor");
	ad.appendChild(color);

	poi_id2color[id] = color;

	updatePOI(id, poi_data.status);
	return true;
}


function loadTransmusicales(data)
{
	// console.log(data);
	$.each(data, function (idx, poi_data) {
		createPOI(poi_data);
	});
}

function updateTransmusicales(data) {
	// console.log("UT"+data);
	$.each( data, function( id, status ) {
		updatePOI(id, status);
	});
}


var evtribe;

function setupEventribe() {

	if (typeof EVENTRIBE !== 'undefined') {

		evtribe = {
			load: function(handler) {
				if (this.loaded) return;
				var data = JSON.parse(EVENTRIBE.loadLocations());
				handler(data);
				this.loaded = true;
			},
			requestUpdates: function(tag, handler) {
				// Reference handler with tag as a string key
				this.handlers[tag] = handler;
				// Request first update. Will enable update push later on
				EVENTRIBE.requestUpdates(tag);
			},
			// referenced via window.evtribe.updateStatus() and called from Java side
			updateStatus: function(tag, data) {
				// Executing handler with tag key
				console.log("in update status with tag: "+tag+" and data:"+data);
				this.handlers[tag](data);
			},
			handlers: {},
			loaded: false
		};

	} else {

		evtribe = {
			load: function(handler) {
				if (this.loaded) return;
				config.fetchJSON(config.api_poi.location, handler);
				this.loaded = true;
			},

			requestUpdates: function(tag, handler) {
				window.setInterval(function() {
					config.fetchJSON(config.api_poi.update, handler); },
					2000
				);
			},
			
			loaded: false
		};

	}
}


function onload()
{
	var geo_tf = document.getElementById("geo_tf");
	geo = new XML3D.Geo(geo_tf, config.level, null);

	setupEventribe();
	// Reference evtribe globally
	window.evtribe = evtribe;

	var ground_group = document.getElementById("ground");
	var ground_tf_scale = document.getElementById("ground_tf_scale");

	terrain = new XML3D.Terrain(geo, ground_group, ground_tf_scale);
	geo.registerMoveCallback(function (pos) {
		console.log("terrain.load()");
		terrain.load(config.api_tiles, config.layers, bboxAroundPosition(pos));
	});


	var pois_group = document.getElementById("pois");
	pois = new XML3D.POI(geo, pois_group, 0.15);
	geo.registerMoveCallback(function (pos) {
		// TODO: @Stefan: Why?
		// we request (nearby) POIs, when a (new) position was determined
		evtribe.load(loadTransmusicales);
	});

	var insideVenueRegion = function(pos, region) {
		if (pos.lat < region[0])
			return false;
		if (pos.lat > region[2])
			return false;
		if (pos.lon < region[1])
			return false;
		if (pos.lon > region[3])
			return false;
		return true;
	};
	
	var geoOperator = {
		'success': function (pos) {
			// bound pos to venue location - otherwise use default
			if (insideVenueRegion(pos, config.venue))
				return pos;
			console.log("use default position");
			return config.origin;
		},
		'error': function () {
			// console.log("No pos");
			return config.origin;
		}
	};
	// geo.goToMyPosition(geoOperator);
	
	// initial position is somewhere at the venue - this position needs to fix the scaling
	geo.setOrigin(config.origin);
	geo.fixTileSize = true;
	
	// then request real position to be updated frequently
	geo.watchMyPosition(geoOperator);

	animator = new XML3D.Animator();
	animator.registerAnimation(pois);

	var xml3d = document.getElementById("myxml3dcanvas");
	var loader = document.getElementById("loader");
	busy = new XML3D.BusyIndicator(xml3d, loader);


	var view = document.getElementById("defaultView");
	controller = new XML3D.DeviceOrientationController(view);
	controller.connect();

	// DEBUG: mouse controller
	// var camController = XML3D.Xml3dSceneController.controllers[0];
	// camController.detach();
	// camController.mode = "walk";
	// camController.useKeys = false;
	// camController.attach();

	// Do first load - this fails if no position was acquired before
	// evtribe.load(loadTransmusicales);
	// Init update requests with unique tag
	evtribe.requestUpdates("transmusicales", updateTransmusicales);
}


window.addEventListener('load', onload, false);


})();