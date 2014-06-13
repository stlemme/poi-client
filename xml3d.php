<?xml version="1.0" encoding="UTF-8"?>
<?php

	require_once(__DIR__ . "/config.php");

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
	<script type="text/javascript" src="js/camera.js"></script>
	
	<script type="text/javascript">
	// <![CDATA[
	
		/////////////////////////////////////////////////////////////////////////
	
		var api_tiles = "<?php echo $config['ground_tiles']; ?>";

		var config = {
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
		
		function deg2rad(angle) {
			return angle * 0.017453292519943295; // (angle / 180) * Math.PI;
		}
		
		function lon2xtile_fract(lon, zoom) {
			return Math.pow(2, zoom) * (lon + 180.0) / 360.0;
		}
		
		function lat2ytile_fract(lat, zoom) {
			return (1 - Math.log(Math.tan(deg2rad(lat)) + 1 / Math.cos(deg2rad(lat))) / Math.PI) /2 * Math.pow(2, zoom);
		}

		function lon2xtile(lon, zoom) { return Math.floor(lon2xtile_fract(lon, zoom)); }
		function lat2ytile(lat, zoom) { return Math.floor(lat2ytile_fract(lat, zoom)); }


		function onload()
		{
			var ground = document.getElementById("ground");
			
			var z = config.zoom;
			var xtile = {
				"min": lon2xtile(config.west, config.zoom),
				"max": lon2xtile(config.east, config.zoom)
			};

			var ytile = {
				"min": lat2ytile(config.north, config.zoom),
				"max": lat2ytile(config.south, config.zoom)
			};
			
			for (var x = xtile.min; x <= xtile.max; x++)
			{
				for (var y = ytile.min; y <= ytile.max; y++)
				{
					var tile_uri = api_tiles + z + "/" + x + "/" + y + "-asset.xml";
					var tile_id = "tile_" + z + "_" + x + "_" + y;
					
					var tile = XML3D.createElement("model");
					tile.setAttribute("id", tile_id);
					tile.setAttribute("src", tile_uri + "#asset");
					tile.setAttribute("transform", tile_uri + "#tf");

					ground.appendChild(tile);
				}
			}

			// The distance represented by one tile T (in meters) is given by
			var C = 40075017; // earth equatorial circumference in meters
			var T = C * Math.cos(deg2rad(config.south)) / Math.pow(2, z)

			console.log("Tile size: " + T);
			// scale by T -> 1 unit = 1 meter
			var s = T;
			var x = lon2xtile_fract(config.origin.lon, config.zoom);
			var y = lat2ytile_fract(config.origin.lat, config.zoom);
			
			var groundtf = document.getElementById("ground_tf");
			groundtf.setAttribute("translation", -s*x + " 0 " + -s*y);
			groundtf.setAttribute("scale", s + " 1 " + s);
			
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

			<!-- Asset Instance -->
			<transform id="ground_tf" translation="0 0 0"></transform>
			<group id="ground" transform="#ground_tf">
			</group>

			<!-- Light and View -->
			<!-- <view id="defaultView" position="0 0 0.0364"></view> //-->
			<view id="defaultView" position="-196.91888427734375 518.8063354492188 615.4326782226562" orientation="0.8991211652755737 0.4186078608036041 0.12786167860031128 5.588346411841806"></view>
			
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
