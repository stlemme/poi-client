
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
	return {
		fw_core: {
			category: 'cafe', // poi_data.services[0].name,
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
	if (color === 'undefined')
		return false;
	color.setScriptValue(mapStatus2Color(status));
}

function createPOI(poi_data)
{
	var id = poi_data.uuid;
	
	var model = pois.addPOI(id, buildPOI(poi_data));

	var ad = XML3D.createElement("assetdata");
	ad.setAttribute("name", "config");
	model.appendChild(ad);
	
	var color = XML3D.createElement("float3");
	color.setAttribute("name", "diffuseColor");
	ad.appendChild(color);

	poi_id2color[id] = color;
	updatePOI(id, 0);
}

function loadTransmusicales()
{
	config.fetchJSON(
		config.api_poi.location,
		function( data ) {
			// console.log(data);
			$.each( data, function( idx, poi_data ) {
				createPOI(poi_data);
			});
		}
	);
}

function updateTransmusicales()
{
	config.fetchJSON(
		config.api_poi.update,
		function( data ) {
			console.log(data);
			$.each( data, function( id, status ) {
				updatePOI(id, status);
			});
		}
	);
}

function onload()
{
	var geo_tf = document.getElementById("geo_tf");
	geo = new XML3D.Geo(geo_tf, config.level, null);
	
	
	var ground_group = document.getElementById("ground");
	var ground_tf_scale = document.getElementById("ground_tf_scale");
	
	terrain = new XML3D.Terrain(geo, ground_group, ground_tf_scale);
	geo.registerMoveCallback(function (pos) {
		terrain.load(config.api_tiles, config.layers, bboxAroundPosition(pos));
	});

	
	var pois_group = document.getElementById("pois");
	pois = new XML3D.POI(geo, pois_group, 0.2);
	geo.registerMoveCallback(function (pos) {
		loadTransmusicales();
	});
	
	// geo.goToMyPosition(function () {
	//	geo.setOrigin(config.origin);
	// });
	// DEBUG: hardcoded position
	geo.setOrigin(config.origin);

	animator = new XML3D.Animator();
	animator.registerAnimation(pois);

	var xml3d = document.getElementById("myxml3dcanvas");
	var loader = document.getElementById("loader");
	busy = new XML3D.BusyIndicator(xml3d, loader);

	
	var view = document.getElementById("defaultView");
	controller = new XML3D.DeviceOrientationController(view);
	// controller.connect();
	
	// DEBUG: mouse controller
	var camController = XML3D.Xml3dSceneController.controllers[0];
	camController.detach();
	camController.mode = "walk";
	camController.useKeys = false;
	camController.attach();
}


window.addEventListener('load', onload, false);
window.setInterval(updateTransmusicales, 2000);

})();