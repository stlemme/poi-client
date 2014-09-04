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

	<script type="text/javascript" src="js/xml3d-dev.js"></script>
	<script type="text/javascript" src="js/camera.js"></script>
    <!-- <script type="text/javascript" src="js/three.min.js"></script> -->
    <!-- <script type="text/javascript" src="js/xml3d-deviceorientation.js"></script> -->
    <script type="text/javascript" src="js/xml3d-terrain.js"></script>
    <script type="text/javascript" src="js/3d-map-tiles.js"></script>
	
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
		
		function build_config(lat, lon, layers) {
			var d = 0.002;
			var zoom = 16;
			return {
				"zoom": zoom,
				"west": lon-d,
				"south": lat-d,
				"east": lon+d,
				"north": lat+d,
				"origin": {
					"lon": lon,
					"lat": lat
				},
				"layers": layers || ["plane"]
			};
		}
				
		// function geo_success(position) {
			// do_something(position.coords.latitude, position.coords.longitude);
			// var config = build_config(
				// position.coords.latitude,
				// position.coords.longitude
			// );
			// console.log(config);
			
			// terrain.load(api_tiles, config);
			
			// poi.load(config);
		// }

		// function geo_error() {
			// alert("Sorry, no position available.");
		// }

		// var geo_options = {
			// enableHighAccuracy: true, 
			// maximumAge        : 30000, 
			// timeout           : 27000
		// };
		
		function onload()
		{
			var ground = document.getElementById("ground");
			var ground_tf_trans = document.getElementById("ground_tf_translation");
			var ground_tf_scale = document.getElementById("ground_tf_scale");
			
			terrain = new XML3D.Terrain(ground, ground_tf_trans, ground_tf_scale);
			//terrain.load(api_tiles, default_config);
			
			var config = build_config(
				64.993295416111, // latitude,
				25.559692382812, // longitude
				["plane", "buildings"]
			);
			console.log(config);
			
			terrain.load(api_tiles, config);

			// var wpid = navigator.geolocation.getCurrentPosition(geo_success, geo_error, geo_options);
			
			var camController = XML3D.Xml3dSceneController.controllers[0];
			camController.detach();
			camController.mode = "walk";
			camController.useKeys = true;
			camController.attach();
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
				<float3 name="intensity">0.9 0.9 0.9</float3>
			</lightshader>
			
			<group style="transform: rotateX(-30deg)" >
				<light shader="#light1"></light>
			</group>

		</xml3d>
	</div>
</body>

</html>
