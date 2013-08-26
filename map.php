<?php

	require_once("config.php");

?>
<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">

<head>
	<title>POI-Client Demo</title>

	<style type="text/css">
		html, body, #basicMap {
			width: 100%;
			height: 100%;
			margin: 0;
		}
		
		div.poi-json {
			font-size: 12px;
			font-family: monospace;
			white-space: pre;
		}
	</style>

	<script type="text/javascript" src="js/OpenLayers.debug.js"></script>
	<script type="text/javascript" src="js/persistence.js"></script>
	
	<script type="text/javascript">
	// <![CDATA[
	
		/////////////////////////////////////////////////////////////////////////
	
		// var host = "<?php echo $config["host"]; ?>";
		var api_tiles = <?php echo json_encode($config["api_tiles"]); ?>;

		var api_poi = "<?php echo $config["api_poi"]; ?>";
		// var api_poi = "dummy/sb-hotel.php";
		var api_poi_params = {
			// tag: "geonames.org_feature_code_HTL",
			// limit: 100
		};

		var marker = {
			poi_black: "img/MB_0001_poi_black.png",
			poi_blue: "img/MB_0001_poi_blue.png",
			self_red_nocircle: "img/MB_0000_navigation_red_nocircle.png"
		};
		
		var followMe = <?php echo ((isset($_GET["followMe"]) && ($_GET["followMe"] == "true")) ? "true" : "false"); ?>;

		/////////////////////////////////////////////////////////////////////////
				
		var map, poilayer, selflayer, selffeature, geolocate;
		

		/**
		 * A specific format for parsing POI API JSON responses.
		 */
		OpenLayers.Format.POI = OpenLayers.Class(OpenLayers.Format, {
		
			// initialize: function() {
				// var size = new OpenLayers.Size(24,24);
				// var offset = new OpenLayers.Pixel(-(size.w/2), -(size.h/2));
				// var icon = new OpenLayers.Icon("img/marker.png",size,offset);
			// },
			
			read: function(response) {
				if (response.status != "ok") {
					throw new Error(
						["POI failure response (",
						 response.status,
						 ') '].join(''));
				}
				
				if (!response || !response.result || !OpenLayers.Util.isArray(response.result)) {
					throw new Error("Unexpected POI response");
				}
				
				var pois = response.result, poi, x, y, point, feature, features = [];
				
				for (var i = 0, l = pois.length; i < l; i++)
				{
					poi = pois[i];
					
					var wgs84 = null;
					for (var j = 0, k = poi.features.length; j < k; j++)
						if (poi.features[j].method == "wgs84") {
							wgs84 = poi.features[j];
							break;
						}
					
					x = wgs84.long;
					y = wgs84.lat;
					point = new OpenLayers.Geometry.Point(x, y);

					var label = "no label";
					
					for (var j = 0, k = poi.contents.length; j < k; j++)
						if (poi.contents[j].type == "label") {
							// TODO: check language
							label = poi.contents[j].label;
							break;
						}

					// TODO: retrieve thumbnail, symbol, category, etc.
					feature = new OpenLayers.Feature.Vector(point, {
						title: label,
						tooltip: label,
						contents: poi.contents,
						poi: poi
					});
					
					feature.id = "POI_" + poi.id;
					
					features.push(feature);
				}
				
				console.log("Retrieved POIs: " + response.count_query_mongo + " (query_mongo), " + response.count_query_approximate + " (query_approximate), " + response.count_return + " (return), " + response.count_total + " (total)");
				
				return features;
			}
		});

		
		function mapEvent(event) {
			var mapView = {
				"lon":event.object.center.lon,
				"lat":event.object.center.lat,
				"zoom":event.object.zoom
			};
			
			if(!store("mapView", mapView))
				console.log("mapView update failed.");
		}


		var deviceHeading = 0.0;
		
		function retrieveDeviceOrientation() {
			return deviceHeading;
		}
		
		window.addEventListener('deviceorientation', function (event) {
			deviceHeading = 360.0 - event.alpha;
		});
		

		window.onload = function init()
		{
		
			// the map
			
			map = new OpenLayers.Map(
				"basicMap",
				{
					// TODO: use movestart to switch of the follow mode
					eventListeners: {
						"moveend": mapEvent, // fired on pan and zoom
						// "zoomend": mapEvent
						// "changelayer": mapLayerChanged,
						// "changebaselayer": mapBaseLayerChanged
					}
				}
			);
			
			// base layer are open street map tiles
			
			var mapnik = new OpenLayers.Layer.OSM("MapQuest", api_tiles, {numZoomLevels: 20});
			map.addLayer(mapnik);
			
			
			// position the map view
			
			// default position: center of berlin
			var mapCenter = new OpenLayers.LonLat(13.41, 52.52).transform("EPSG:4326", "EPSG:900913");
			var mapLevel = 15;
			
			// load the last map view position from the cookie if any
			var mapView = load("mapView", null);
			if (mapView) {
				mapCenter.lon = mapView.lon;
				mapCenter.lat = mapView.lat;
				mapLevel = mapView.zoom;
			}
			
			map.setCenter(mapCenter, mapLevel);

			
			// poi layer
			
			var defaultStyle = new OpenLayers.Style({
				externalGraphic: marker.poi_black,
				pointRadius: 20,
				cursor: "pointer",
				// clickable: "on",
				title: "${tooltip}"
			});

			var selectStyle = new OpenLayers.Style({
				externalGraphic: marker.poi_blue,
			});
			
			poilayer = new OpenLayers.Layer.Vector("POI", {
				projection: "EPSG:4326",
				strategies: [new OpenLayers.Strategy.BBOX({
					resFactor: 1,
					ratio: 1
				})],
				protocol: new OpenLayers.Protocol.Script({
					url: api_poi,
					params: api_poi_params,
					callbackKey: "jsoncallback",
					format: new OpenLayers.Format.POI()
				}),
				styleMap: new OpenLayers.StyleMap({
					"default": defaultStyle,
					"select": selectStyle
				})
			});
			
			map.addLayer(poilayer);
			
			
			// pois are selectable
			
			var select = new OpenLayers.Control.SelectFeature([poilayer]);
			map.addControl(select);
			select.activate();


			// popup for selected poi
			
			poilayer.events.on({"featureselected": function(event) {
				var feature = event.feature;
				var center = feature.geometry.getCentroid();
				
				var popup = new OpenLayers.Popup.FramedCloud(
					"selectedpoi", 
					new OpenLayers.LonLat(center.x, center.y),
					null,
					'<div class="poi-json">' + JSON.stringify(feature.attributes.poi, null, "  ") + '</div>',
					null,
					true
				);
				
				console.log("POI selected: " + feature.attributes.title + " (" + feature.attributes.poi.id +")");
				
				map.addPopup(popup, true);
			}});

			
			
			// self position


			selflayer = new OpenLayers.Layer.Vector("self");
			map.addLayer(selflayer);

			var style = {
				fillColor: '#000',
				fillOpacity: 0.1,
				strokeWidth: 0
			};
			
			geolocate = new OpenLayers.Control.Geolocate({
				bind: false,
				geolocationOptions: {
					enableHighAccuracy: true,
					maximumAge: 3000,
					timeout: 7000
				}
			});
			map.addControl(geolocate);
			
			
			var firstGeolocation = true;
			var lastAccuracy;
			
			geolocate.events.register("locationupdated", geolocate, function(e) {
				console.log("My position: " + e.position.coords.heading);
				
				var heading = e.position.coords.heading;
				
				if (!heading)
					heading = retrieveDeviceOrientation();
				
				selflayer.removeAllFeatures();
				
				var circle = new OpenLayers.Feature.Vector(
					OpenLayers.Geometry.Polygon.createRegularPolygon(
						new OpenLayers.Geometry.Point(e.point.x, e.point.y),
						e.position.coords.accuracy/2,
						40,
						0
					),
					{},
					style
				);
				
				selflayer.addFeatures([
					new OpenLayers.Feature.Vector(
						e.point,
						{},
						{
							externalGraphic: marker.self_red_nocircle,
							pointRadius: 30,
							rotation: heading
						}
					),
					circle
				]);
				
				var myPosition = new OpenLayers.LonLat(e.point.x, e.point.y);
				// explicit panTo instead on bind geolocate control in favor of smooth transitions
				if (followMe) {
					map.panTo(myPosition);

					if (firstGeolocation || (e.position.coords.accuracy < lastAccuracy)) {
						map.zoomToExtent(selflayer.getDataExtent());
						firstGeolocation = false;
						lastAccuracy = e.position.coords.accuracy;
					}
				}
			});
			
			geolocate.events.register("locationfailed", this, function() {
				OpenLayers.Console.log('Location detection failed');
			});

			geolocate.watch = true;
			firstGeolocation = true;
			geolocate.activate();
		}
		
		
		
	// ]]>
	</script>
</head>

<body>
	<div id="basicMap"></div>
</body>

</html>
