
var XML3D = XML3D || {};

(function () {

var geo, terrain, pois;
var animator;
var controller;
var busy;

function bboxAroundPosition( pos ) {
	var d = 0.004;
	return {
		"west": pos.lon-d,
		"south": pos.lat-d,
		"east": pos.lon+d,
		"north": pos.lat+d
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
	updatePOI(id, 0);
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
	// console.log(data);
	$.each( data, function( id, status ) {
		updatePOI(id, status);
	});
}


var evtribe;

function setupEventribe() {
	
	if (typeof EVENTRIBE !== 'undefined') {
	
		evtribe = {
			load: function(handler) {
				var data = JSON.parse(EVENTRIBE.loadLocations());
				handler.call(data);
			},
			
			requestUpdates: function(handler) {
				// TODO: pass handler via EVENTRIBE.requestUpdates(handler) instead of hardcoded naming convention
				window.updateStatus = function(data) {
					handler.call(data);
					EVENTRIBE.successUpdate();
				};
				// Request first update
				EVENTRIBE.requestUpdates();
			}
		};
		
	} else {
	
		evtribe = {
			load: function(handler) {
				config.fetchJSON(config.api_poi.location, handler);
			},
			
			requestUpdates: function(handler) {
				window.setInterval(function() {
					config.fetchJSON(config.api_poi.update, handler); },
					2000
				);
			}
		};
	
	}
}


function onload()
{
	var geo_tf = document.getElementById("geo_tf");
	geo = new XML3D.Geo(geo_tf, config.level, null);

	setupEventribe();

	var ground_group = document.getElementById("ground");
	var ground_tf_scale = document.getElementById("ground_tf_scale");

	terrain = new XML3D.Terrain(geo, ground_group, ground_tf_scale);
	geo.registerMoveCallback(function (pos) {
		terrain.load(config.api_tiles, config.layers, bboxAroundPosition(pos));
	});


	var pois_group = document.getElementById("pois");
	pois = new XML3D.POI(geo, pois_group, 0.2);
	geo.registerMoveCallback(function (pos) {
		evtribe.load(loadTransmusicales);
	});

	geo.goToMyPosition({
		'success': function (pos) {
			// TODO: bound pos to venue location - otherwise use default
			return config.origin;
		},
		'error': function () {
			// console.log("No pos");
			return config.origin;
		}
	});
	// DEBUG: hardcoded position
	//geo.setOrigin(config.origin);

	animator = new XML3D.Animator();
	animator.registerAnimation(pois);

	var xml3d = document.getElementById("myxml3dcanvas");
	var loader = document.getElementById("loader");
	busy = new XML3D.BusyIndicator(xml3d, loader);


	var view = document.getElementById("defaultView");
	controller = new XML3D.DeviceOrientationController(view);
	controller.connect();

	// DEBUG: mouse controller
	var camController = XML3D.Xml3dSceneController.controllers[0];
	camController.detach();
	camController.mode = "walk";
	camController.useKeys = false;
	camController.attach();

	evtribe.requestUpdates(updateTransmusicales);
}


window.addEventListener('load', onload, false);


})();