var XML3D = XML3D || {};
	
(function() {

XML3D.Terrain = function(geo, group, tf_scale) {
	this.geo = geo || null;
	this.ground = group || null;
	this.tf_scale = tf_scale || null;
	this.tileCount = 0;
	this.maxtileCount = 0;
	this.tilePositions = [];
	this.lodLayers=[];
	this.lastfrustum=null;
	this.tiles_in_bbox=0;
	this.updatedtiles=0;
	this.maxupdatedtiles=0;
	this.newtiles=0;
	this.reusedtiles=0;
	this.framecount=0;
	this.maxloddelta=4;
	this.grp_diameter=4;
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

XML3D.Terrain.prototype.dynamicLoad = function( api_tiles, layers, bbox, dynamicbbox, frustum,camera_origin) {
	var min = this.geo.tile(bbox.north, bbox.west);
	var max = this.geo.tile(bbox.south, bbox.east);
	var z = this.geo.level;

	//limit dynamic bounds to bbox
	// dynamicbbox contains tile coordinates, not lat/lon
	
	min.x = Math.max(min.x,dynamicbbox.min.x);
	min.y = Math.max(min.y,dynamicbbox.min.y);
	
	max.x = Math.min(max.x,dynamicbbox.max.x);
	max.y = Math.min(max.y,dynamicbbox.max.y);
	
	this.tiles_in_bbox=(max.x-min.x+1)*(max.y-min.y+1);
	
	var layers = layers || ["plane"];

	var new_bounds=new XML3D.Bbox(min.x,min.y,max.x,max.y);
	
	//console.log(api_tiles);
	
	//for all tiles in frustum: add to required tiles
	var required_tiles=[];
	//required_tiles[0]=[];
	for (var x = min.x; x <= max.x; x++){
		for (var y = min.y; y <= max.y; y++){
		
			this.generate_tiles (x,y,z,camera_origin,frustum,required_tiles,api_tiles);
			/*
			var curr=new XML3D.Bbox(x,y,x+1,y+1);
			
			
			if(frustum.intersectBbox(curr)){
				var tile_uri = api_tiles + "/" + z + "/" + x + "/" + y + "-asset.xml";
				var list=required_tiles[0];
				list[tile_uri]=true;
			}
			*/
			
			
		}
	}
	
	this.draw_tiles(required_tiles,layers);
	
	if(this.framecount>0){
		this.maxupdatedtiles=Math.max(this.maxupdatedtiles,this.updatedtiles);
	}
	this.framecount++;
	
	this.tileCount=0;
	for(var i=0; i<this.ground.children.length;i++){
		this.tileCount+=this.ground.children[i].children.length;
	}
	this.maxtileCount=Math.max(this.tileCount,this.maxtileCount);
	//console.log(this.maxtileCount);
	//console.log(this.tileCount);

	this.tf_scale.setAttribute("scale", this.geo.tile_size + " 1 " + this.geo.tile_size);
}

XML3D.Terrain.prototype.generate_tiles = function(x,y,z,camera_origin,frustum,tiles,api_tiles){
	//camera origin in the 3d camera origin transformed into tile space
	var delta=z-this.geo.level;
	var tilesize=1/Math.pow(2,delta);
	var bounds=new XML3D.Bbox(x*tilesize,y*tilesize,(x+1)*tilesize,(y+1)*tilesize);
	if(!frustum.intersectBbox(bounds)){
		//no need to draw this!
		return;
	}
	
	if(get_distance((x+0.5)*tilesize,(y+0.5)*tilesize,camera_origin)<tilesize*this.grp_diameter && delta<this.maxloddelta){
		//split up tile
		this.generate_tiles(x*2,y*2,z+1,camera_origin,frustum,tiles,api_tiles);
		this.generate_tiles(x*2+1,y*2,z+1,camera_origin,frustum,tiles,api_tiles);
		this.generate_tiles(x*2,y*2+1,z+1,camera_origin,frustum,tiles,api_tiles);
		this.generate_tiles(x*2+1,y*2+1,z+1,camera_origin,frustum,tiles,api_tiles);
	}
	else{
		//draw current tile
		if(tiles[delta]==null){
			tiles[delta]=[];
		}
		var tile=tiles[delta];
		var tile_uri = api_tiles + "/" + z + "/" + x + "/" + y + "-asset.xml";
		tile[tile_uri]=true;
	}	
}

function get_distance(x,y,camera_origin){
	//carefull! y in tile coordinates refers to z axis in real space!
	
	//z axis is scaled by a factor of 2 since lod has a very low effect for high altitude cameras
	return Math.sqrt(Math.pow((camera_origin.x-x),2)+Math.pow((camera_origin.z-y),2)+Math.pow(camera_origin.y*2,2));
}



XML3D.Terrain.prototype.draw_tiles = function(tiles,layers){
	// tiles contains a map, mapping level (as delta from minimum level) to a map of tile uris.
	this.updatedtiles=0;
	this.reusedtiles=0;
	this.newtiles=0;

	
	for(key in tiles){
		//do tiles of this level allready exist?
		var group_index;
		if(!(key in this.lodLayers)){
			console.log("new group!");
		
			//if not, create a new grop containing those tiles
			group_new=XML3D.createElement("group");
			var scale=1/Math.pow(2,key);
			//scale relative to tf_scale
			group_new.setAttribute("style", "transform: scale(" + scale + ", 1, " + scale +")");
			group_new.setAttribute("id", "Lod "+key);
			this.ground.appendChild(group_new);
			//remember we created this group
			group_index=this.ground.children.length-1;
			this.lodLayers[key]=group_index;
			//initally the new group is empty
			this.tilePositions[key]=[];
		}
		else{
			group_index=this.lodLayers[key];
		}

		var group=this.ground.children[group_index];
		
		var current_tiles=this.tilePositions[key];
		

	
		var needed_tiles=tiles[key];
	
	
		var index=0; // corresponding index in group

		//delete tiles, which should not be displayed
	
		while (index<group.children.length/layers.length) {
			//if tile should not be displayed
			if(needed_tiles[current_tiles[index]]==null){
				//remove tile from list and dom (multiple deletes if multiple layers!!)
				current_tiles.splice(index,1);
				
				for(var i=0;i<layers.length;i++){
					var tile=group.children[index*layers.length];
					tile.parentNode.removeChild(tile);
			
					this.updatedtiles++;
					this.reusedtiles++;
				}
				//console.log("removed child");
			}
			else{
				//remove tile from needed_tiles!
				delete needed_tiles[current_tiles[index]];
				index++;
			}
		}	
		
		
		
		for (tile_key in needed_tiles){
			//add all remaining tiles to the dom and the list!
		
			//remember we added this tile
			current_tiles.push(tile_key);
			for(var i=0;i<layers.length;i++){
				//create new tile
				//console.log("new tile!");
				var tile = XML3D.createElement("model");
				tile.setAttribute("id", tile_key + layers[i]);
				tile.setAttribute("src", tile_key + "#" + layers[i]);
				tile.setAttribute("transform", tile_key + "#tf");
				group.appendChild(tile);
			
				this.updatedtiles++;
				this.newtiles++;
			}
		}
	}
	
	//tiles may not contain tiles for every layer!
	for (key in this.lodLayers){
		//if no tiles in this layer are requested, delete all tiles in this layer
		if(tiles[key]==null){
			//remember that there are no more tiles in this layer
			this.tilePositions[key]=[];
			//delete all tiles from layer
			var grp=this.ground.children[this.lodLayers[key]];
			while(grp.children.length>0){
				//remove first node until empty
				this.updatedtiles++;
				this.reusedtiles++;
				this.lodLayers[key].removeChild(this.lodLayers[key].childNodes[0]);
			}
		
		}
	}
}


})();
