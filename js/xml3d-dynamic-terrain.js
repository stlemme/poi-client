var XML3D = XML3D || {};
	
(function() {

XML3D.DynamicTerrain = function(geo, group, tf_scale, camera, api_tiles, options) {
	this.geo = geo || null;
	this.ground = group || null;
	this.tf_scale = tf_scale || null;
	this.camera=camera||null;
	this.api_tiles=api_tiles||null;
	
	//optional information
	this.bounds=options.bounds||null;
	this.layer=options.layer||"all";

	this.tileCount = 0;
	this.maxtileCount = 0;
	this.tiles_in_bbox=0;
	this.updatedtiles=0;
	this.maxupdatedtiles=0;
	this.newtiles=0;
	this.reusedtiles=0;
	this.framecount=0;
	
	this.far_plane=50000;
	this.lodLayers=[];
	this.maxloddelta=4;
	this.grp_diameter=4;
	
	this.handle_invisible=this.handle_invisible_delete;
};

XML3D.DynamicTerrain.prototype.DELETE_OLD_TILES = 0;
XML3D.DynamicTerrain.prototype.REUSE_OLD_TILES = 1;

XML3D.DynamicTerrain.prototype.set_mode = function(mode) {
	if(mode==XML3D.DynamicTerrain.prototype.DELETE_OLD_TILES){
		this.handle_invisible=this.handle_invisible_delete;
		return;
	}
	if(mode==XML3D.DynamicTerrain.prototype.REUSE_OLD_TILES){
		this.handle_invisible=this.handle_invisible_reuse;
		return;
	}
	console.log("invalid terrain mode");
}

XML3D.DynamicTerrain.prototype.render_tiles = function() {

	var ratio=Math.tan(this.camera.fieldOfView/2);

	var x_frustum=(this.camera.width)/this.camera.height*ratio;
	var y_frustum=(this.camera.height)/this.camera.height*ratio;
			
	var f1=this.camera.getRayDirection(x_frustum,y_frustum);
	var f2=this.camera.getRayDirection(-x_frustum,y_frustum);
	var f3=this.camera.getRayDirection(-x_frustum,-y_frustum);
	var f4=this.camera.getRayDirection(x_frustum,-y_frustum);
	
	//no intersection with xz-plane done since hight values can be negative!
			
	var p1=this.camera.position.add(f1.scale(this.far_plane));
	var p2=this.camera.position.add(f2.scale(this.far_plane));
	var p3=this.camera.position.add(f3.scale(this.far_plane));
	var p4=this.camera.position.add(f4.scale(this.far_plane));
			

			
	//create bounds of view frustum projection
			
	var p1_tile=this.geo.backproject(p1.x,p1.z);
	var p1_proj=this.geo.backproject(p1.x,p1.z);
	p1_tile.x=Math.floor(p1_tile.x);
	p1_tile.y=Math.floor(p1_tile.y);
			
	var p2_tile=this.geo.backproject(p2.x,p2.z);
	var p2_proj=this.geo.backproject(p2.x,p2.z);
	p2_tile.x=Math.floor(p2_tile.x);
	p2_tile.y=Math.floor(p2_tile.y);
			
	var p3_tile=this.geo.backproject(p3.x,p3.z);
	var p3_proj=this.geo.backproject(p3.x,p3.z);
	p3_tile.x=Math.floor(p3_tile.x);
	p3_tile.y=Math.floor(p3_tile.y);
			
	var p4_tile=this.geo.backproject(p4.x,p4.z);
	var p4_proj=this.geo.backproject(p4.x,p4.z);
	p4_tile.x=Math.floor(p4_tile.x);
	p4_tile.y=Math.floor(p4_tile.y);
			
	var camera_tile=this.geo.backproject(this.camera.position.x,this.camera.position.z);
	var camera_proj=this.geo.backproject(this.camera.position.x,this.camera.position.z);
	camera_tile.x=Math.floor(camera_tile.x);
	camera_tile.y=Math.floor(camera_tile.y);
			
			
			
			
	//camera coordinates in tile space
	var camera_origin={
		"x":camera_proj.x,
		"y":this.camera.position.y/geo.tile_size,
		"z":camera_proj.y
	}
			
	var projections=new Array(p1_proj,p2_proj,p3_proj,p4_proj);
	var frustum=new XML3D.Frustum(camera_proj,projections);
			
	var dynamicbbox=new XML3D.Bbox(p1_tile.x,p1_tile.y,p1_tile.x,p1_tile.y);
	dynamicbbox.extend(p2_tile.x,p2_tile.y);
	dynamicbbox.extend(p3_tile.x,p3_tile.y);
	dynamicbbox.extend(p4_tile.x,p4_tile.y);
	dynamicbbox.extend(camera_tile.x,camera_tile.y);


	var z = this.geo.level;
	var min;
	var max;
	if(this.bounds!=null){
		min = this.geo.tile(this.bounds.north, this.bounds.west);
		max = this.geo.tile(this.bounds.south, this.bounds.east);


		//limit dynamic bounds to bbox
		min.x = Math.max(min.x,dynamicbbox.min.x);
		min.y = Math.max(min.y,dynamicbbox.min.y);
	
		max.x = Math.min(max.x,dynamicbbox.max.x);
		max.y = Math.min(max.y,dynamicbbox.max.y);
	}
	else{
		min=dynamicbbox.min;
		max=dynamicbbox.max;
	}
	
	this.tiles_in_bbox=(max.x-min.x+1)*(max.y-min.y+1);

	//for all tiles in frustum: add to required tiles
	var required_tiles=[];
	for (var x = min.x; x <= max.x; x++){
		for (var y = min.y; y <= max.y; y++){
			this.generate_tiles (x,y,z,camera_origin,frustum,required_tiles);
		}
	}
	
	this.draw_tiles(required_tiles);
	
	if(this.framecount>0){
		this.maxupdatedtiles=Math.max(this.maxupdatedtiles,this.updatedtiles);
	}
	this.framecount++;
	
	this.tileCount=0;
	for(var i=0; i<this.ground.children.length;i++){
		this.tileCount+=this.ground.children[i].children.length;
	}
	this.maxtileCount=Math.max(this.tileCount,this.maxtileCount);

	this.tf_scale.setAttribute("scale", this.geo.tile_size + " 1 " + this.geo.tile_size);
}

XML3D.DynamicTerrain.prototype.generate_tiles = function(x,y,z,camera_origin,frustum,tiles){
	//camera origin in the 3d camera origin transformed into tile space
	var delta=z-this.geo.level;
	var tilesize=1/Math.pow(2,delta);
	var bounds=new XML3D.Bbox(x*tilesize,y*tilesize,(x+1)*tilesize,(y+1)*tilesize);
	if(!frustum.intersectBbox(bounds)){
		//no need to draw this!
		return;
	}
	
	if(get_squared_distance((x+0.5)*tilesize,(y+0.5)*tilesize,camera_origin)<Math.pow(tilesize*this.grp_diameter,2) && delta<this.maxloddelta){
		//split up tile
		this.generate_tiles(x*2,y*2,z+1,camera_origin,frustum,tiles,this.api_tiles);
		this.generate_tiles(x*2+1,y*2,z+1,camera_origin,frustum,tiles,this.api_tiles);
		this.generate_tiles(x*2,y*2+1,z+1,camera_origin,frustum,tiles,this.api_tiles);
		this.generate_tiles(x*2+1,y*2+1,z+1,camera_origin,frustum,tiles,this.api_tiles);
	}
	else{
		//draw current tile
		if(tiles[delta]==null){
			tiles[delta]=[];
		}
		var tile=tiles[delta];
		var tile_uri = this.api_tiles + "/" + z + "/" + x + "/" + y + "-asset.xml";
		tile[tile_uri]=true;
	}	
}

function get_squared_distance(x,y,camera_origin){
	//carefull! y in tile coordinates refers to z axis in real space!
	
	//z axis is scaled by a factor of 2 since lod has a very low effect for high altitude cameras
	//ways cheaper than making the actual computation but still good enough
	//this was suggested in another paper
	return Math.pow((camera_origin.x-x),2)+Math.pow((camera_origin.z-y),2)+Math.pow(camera_origin.y*2,2);
}

XML3D.DynamicTerrain.prototype.draw_tiles = function(tiles){
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
		}
		else{
			group_index=this.lodLayers[key];
		}

		var group=this.ground.children[group_index];

		var needed_tiles=tiles[key];

		var index=0; // corresponding index in group

		var free_tiles= new Iterator(group.children.length); //contains reusable tiles
			
		while (index<group.children.length) {
			// is old tile still supposed to be displayed???
			if(needed_tiles[group.children[index].getAttribute("id")]==null){
				//handle currently invisible tiles depending on set mode;
				index=this.handle_invisible(index,group,free_tiles);
			}
			else{
				//remove tile from needed_tiles!
				delete needed_tiles[group.children[index].getAttribute("id")];
				index++;
			}
		}	

		
		for (tile_key in needed_tiles){
			//create all remaining tiles
			tile=this.create_or_reuse_tile(free_tiles,group);
			tile.setAttribute("id", tile_key);
			tile.setAttribute("src", tile_key + "#" + this.layer);
			tile.setAttribute("transform", tile_key + "#tf");
		}

		//delete remaining free_tiles
		while(free_tiles.hasNext()){
			var tile=free_tiles.next();
			tile.parentNode.removeChild(tile);
		
			this.updatedtiles++;
			this.reusedtiles++;

		}
	}
	
	//tiles may not contain tiles for every layer!
	for (key in this.lodLayers){
		//if no tiles in this layer are requested, delete all tiles in this layer
		if(tiles[key]==null){
			//delete all tiles from layer
			var grp=this.ground.children[this.lodLayers[key]];
			while(grp.children.length>0){
				//remove first node until empty
				this.updatedtiles++;
				this.reusedtiles++;
				grp.removeChild(grp.children[0]);
			}
		}
	}
}


XML3D.DynamicTerrain.prototype.handle_invisible_reuse = function (index,group,free_tiles){
	free_tiles.push(group.children[index]);
	return index+1;
}


XML3D.DynamicTerrain.prototype.handle_invisible_delete = function (index,group,free_tiles){
	//remove tile from dom
	var tile=group.children[index];
	tile.parentNode.removeChild(tile);
			
	this.updatedtiles++;
	this.reusedtiles++;

	return index;
}

XML3D.DynamicTerrain.prototype.create_or_reuse_tile = function (free_tiles,group){
	this.updatedtiles++;
	if(free_tiles.hasNext()){
		this.reusedtiles++;
		//reuse tile if possible
		return free_tiles.next();
	}
	//we need a new tile
	var tile = XML3D.createElement("model");
	group.appendChild(tile);
	
	this.newtiles++;
	
	return tile;
}


Iterator = function(capacity) {
	this.length=0;
	this.current_position=0;
	this.values=new Array(capacity);
};


Iterator.prototype.getFreeCapacity = function() {
	return this.values.length-this.length;
}

Iterator.prototype.getTotalCapacity = function() {
	return this.values.length;
}

Iterator.prototype.getLength = function() {
	return this.length;
}

Iterator.prototype.push = function(value) {
	this.values[this.length]=value;
	this.length++;
}

Iterator.prototype.hasNext = function() {
	return(this.length-this.current_position>0);
}

Iterator.prototype.next = function() {
	this.current_position++;
	return(this.values[this.current_position-1]);
}


})();
