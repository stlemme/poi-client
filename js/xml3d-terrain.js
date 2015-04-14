var XML3D = XML3D || {};
	
(function() {

XML3D.Terrain = function(geo, group, tf_scale) {
	this.geo = geo || null;
	this.ground = ground || null;
	this.tf_scale = tf_scale || null;
	this.tileCount = 0;
	this.tilePositions = [];
};


XML3D.Terrain.prototype.load = function( api_tiles, layers, bbox ) {
	
	var min = this.geo.tile(bbox.north, bbox.west);
	var max = this.geo.tile(bbox.south, bbox.east);
	var z = this.geo.level;
	
	var layers = layers || ["plane"];
	
	for (var x = min.x; x <= max.x; x++)
	{
		for (var y = min.y; y <= max.y; y++)
		{
			var tile_uri = api_tiles + "/" + z + "/" + x + "/" + y + "-asset.xml";
			var tile_id = "tile_" + z + "_" + x + "_" + y + '_';
			layers.forEach(function(layer) { 
				var tile = XML3D.createElement("model");
				tile.setAttribute("id", tile_id + layer);
				tile.setAttribute("src", tile_uri + "#" + layer);
				tile.setAttribute("transform", tile_uri + "#tf");
				this.ground.appendChild(tile);
			});
		}
	}
	
	this.tileCount = (max.x-min.x+1)*(max.y-min.y+1);

	this.tf_scale.setAttribute("scale", this.geo.tile_size + " 1 " + this.geo.tile_size);
}

XML3D.Terrain.prototype.dynamicLoad = function( api_tiles, layers, bbox, dynamicbbox) {
	var min = this.geo.tile(bbox.north, bbox.west);
	var max = this.geo.tile(bbox.south, bbox.east);
	var z = this.geo.level;
	
	//limit dynamic bounds to bbox
	// dynamicbbox contains tile coordinates, not lat/lon
	
	min.x = Math.max(min.x,dynamicbbox.min.x);
	min.y = Math.max(min.y,dynamicbbox.min.y);
	
	max.x = Math.min(max.x,dynamicbbox.max.x);
	max.y = Math.min(max.y,dynamicbbox.max.y);
	
	
	var layers = layers || ["plane"];
	var i=0;
	var new_bounds=new XML3D.Bbox(min.x,min.y,max.x,max.y);
	
	for (var x = min.x; x <= max.x; x++)
	{
		for (var y = min.y; y <= max.y; y++){
			var curr={
				"x": x,
				"y": y
			}
			if(!contains(this.tilePositions,curr)){
				var tile_uri = api_tiles + "/" + z + "/" + x + "/" + y + "-asset.xml";
				var tile_id = "tile_" + z + "_" + x + "_" + y + '_';
				
				//tile re-use possible?
				for(var j=0;j<layers.length;j++){
					while(i<this.tileCount){
						var pos=this.tilePositions[i];
						if(!new_bounds.isInside(pos.x,pos.y)){
							break;
						}
						i++;
					}
					
				
					if(i<this.tileCount){
						//reuse tile
						console.log("reused tile!");
						
						this.ground.children[i].setAttribute("id", tile_id + layers[j]);
						this.ground.children[i].setAttribute("src", tile_uri + "#" + layers[j]);
						this.ground.children[i].setAttribute("transform", tile_uri + "#tf");
						this.tilePositions[i]={
							"x": x,
							"y": y
						}
						
						i++;
						
						
					}
					else{
						//create new tile
						console.log("new tile!");
						var tile = XML3D.createElement("model");
						tile.setAttribute("id", tile_id + layers[j]);
						tile.setAttribute("src", tile_uri + "#" + layers[j]);
						tile.setAttribute("transform", tile_uri + "#tf");
						this.ground.appendChild(tile);
						this.tilePositions[i]={
							"x": x,
							"y": y
						}
						i++;
					}
					
				
				}

			}
			
		}
	}

	

	this.tileCount=this.ground.children.length;

	this.tf_scale.setAttribute("scale", this.geo.tile_size + " 1 " + this.geo.tile_size);
}

function contains(a, obj) {
    var i = a.length;
    while (i--) {
       if (a[i].x == obj.x && a[i].y == obj.y) {
           return true;
       }
    }
    return false;
}

})();
