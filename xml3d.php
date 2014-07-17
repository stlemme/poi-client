<?xml version="1.0" encoding="UTF-8"?>
<?php

	require_once(__DIR__ . '/config.php');

?>
<html xmlns="http://www.w3.org/1999/xhtml">

<head>
	<title>POI-Client Demo</title>

	<style type="text/css">
		html, body, #myxml3d {
			width: 100%;
			height: 100%;
			margin: 0;
		}
	</style>

	<script type="text/javascript" src="js/xml3d-asset.js"></script>
    <script type="text/javascript" src="js/three.min.js"></script>
    <script type="text/javascript" src="js/xml3d-deviceorientation.js"></script>
    <script type="text/javascript" src="js/xml3d-terrain.js"></script>
	
	<script type="text/javascript">
	// <![CDATA[
	
		/////////////////////////////////////////////////////////////////////////
		
		var global = <?php echo json_encode($config); ?>;
	
		var api_tiles = global.api.ground_tiles;
		var api_poi = global.api.poi;

		var default_config = {
			"zoom": 17,
			"west": 7.027427,
			"south": 49.249020,
			"east": 7.053348,
			"north": 49.261289,
			"origin": {
				"lon": 7.041700,
				"lat": 49.254104
			}
		};
				
		var controller, terrain, poi;
		
		function build_config(lat, lon) {
			var d = 0.02;
			var zoom = 17;
			return {
				"zoom": zoom,
				"west": lon-d,
				"south": lat-d,
				"east": lon+d,
				"north": lat+d,
				"origin": {
					"lon": lon,
					"lat": lat
				}
			};
		}
		
		
		var getJSON = function(url, successHandler, errorHandler) {
			var xhr = typeof XMLHttpRequest != 'undefined'
				? new XMLHttpRequest()
				: new ActiveXObject('Microsoft.XMLHTTP');
			xhr.open('get', url, true);
			xhr.onreadystatechange = function() {
				var status;
				var data;
				// http://xhr.spec.whatwg.org/#dom-xmlhttprequest-readystate
				if (xhr.readyState == 4) { // `DONE`
					status = xhr.status;
					if (status == 200) {
						data = JSON.parse(xhr.responseText);
						successHandler && successHandler(data);
					} else {
						errorHandler && errorHandler(status);
					}
				}
			};
			xhr.send();
		};

		
		XML3D.POI = function( group, terrain ) {
		
			this.group = group || null;
			this.terrain = terrain || null;
			
			this.show_pois = function(config, data) {
				//console.log(data);
				var pois = data.pois;
				
				for(var id in pois)
				{
					var p = pois[id];
					
					var loc = p.fw_core.location.wgs84 || null;
					
					if (loc === null)
						continue;
						
					var x = this.terrain.project_lon(loc.longitude, config.zoom);
					var y = this.terrain.project_lat(loc.latitude, config.zoom);
					
					//console.log(this.terrain.lon2xtile_fract);
					
					var t = XML3D.createElement("transform");
					t.setAttribute("id", "poi_tf_" + id);
					t.setAttribute("translation", x + " 20 " + y);
					t.setAttribute("scale", "10 30 10");
					
					this.group.appendChild(t);
					
					var m = XML3D.createElement("model");
					m.setAttribute("id", "poi_" + id);
					m.setAttribute("src", "resources/basic.xml#cube_asset");
					m.setAttribute("transform", "#poi_tf_" + id);
					//m.setAttribute("style", "transform: translate3d(" + x + "px 20px " + y + "px);");
					
					//console.log(m);

					this.group.appendChild(m);
				}
			}
			
			var that = this;
			this.load = function(config) {
				getJSON(
					api_poi + '?north=' + config.north + '&south=' + config.south + '&west=' + config.west + '&east=' + config.east,
					function(data) {
						console.log(data);
						that.show_pois(config, data);
					},
					function(status) {
						alert('Something went wrong.');
					}
				);
			}

		}
		

		function geo_success(position) {
			// do_something(position.coords.latitude, position.coords.longitude);
			var config = build_config(
				position.coords.latitude,
				position.coords.longitude
			);
			console.log(config);
			
			terrain.load(api_tiles, config);
			
			poi.load(config);
		}

		function geo_error() {
			alert("Sorry, no position available.");
		}

		var geo_options = {
			enableHighAccuracy: true, 
			maximumAge        : 30000, 
			timeout           : 27000
		};
		
		function onload()
		{
			var ground = document.getElementById("ground");
			var ground_tf_trans = document.getElementById("ground_tf_translation");
			var ground_tf_scale = document.getElementById("ground_tf_scale");
			
			terrain = new XML3D.Terrain(ground, ground_tf_trans, ground_tf_scale);
			//terrain.load(api_tiles, default_config);
			
			var pois_group = document.getElementById("pois");
			poi = new XML3D.POI(pois_group, terrain);
			//poi.load(default_config);

			var view = document.getElementById("defaultView");
			controller = new XML3D.DeviceOrientationController(view);
			controller.connect();
			
			var wpid = navigator.geolocation.getCurrentPosition(geo_success, geo_error, geo_options);
		}
		
		window.addEventListener('load', onload, false);
		
	// ]]>
	</script>
</head>

<body>
	<div id="myxml3d">
		<xml3d activeView="#defaultView" style="width: 100%; height: 100%; background-color:lightgray;" >

			<!-- Skybox -->
			<!-- <shader id="texShader" script="urn:xml3d:shader:debug-box">
                <texture name="skyboxTex" wrapS="repeat" wrapT="clamp">
                    <img src="resources/polar_half_art_1.jpg" id="skymap"/>
                </texture>
            </shader>
			
			<group style="shader: url(#texShader); transform: scale3d(1, 1, 1);">
                <mesh type="triangles" src="resources/basic.xml#mesh_cube"></mesh>
            </group> -->


			<!-- Asset Instance -->
			<transform id="ground_tf_translation" translation="0 0 0"></transform>
			<transform id="ground_tf_scale" translation="0 0 0"></transform>
			
			<group transform="#ground_tf_translation">
				<group transform="#ground_tf_scale">
					<group id="ground"></group>
				</group>
				<group id="pois"></group>
			</group>
			
			
			<!-- Light and View -->
			<view id="defaultView" position="0 10 0"></view>
			
			<lightshader id="light1" script="urn:xml3d:lightshader:directional">
				<float3 name="intensity">0.6 0.6 0.6</float3>
			</lightshader>
			
			<group style="transform: rotateX(-30deg)" >
				<light shader="#light1"></light>
			</group>

		</xml3d>
	</div>
</body>

</html>
