var XML3D = XML3D || {};
	
(function() {

XML3D.DynamicTerrain = function(geo, group, tf_scale, camera, bounds, layers, api_tiles) {
	this.geo = geo || null;
	this.ground = group || null;
	this.tf_scale = tf_scale || null;
	
	this.camera=camera||null;
	this.bounds=bounds||null;
	this.layers=layers||["all"];
	this.api_tiles=api_tiles||null;
	
	this.tileCount = 0;
	this.maxtileCount = 0;
	this.tilePositions = [];
	this.lodLayers=[];
	this.tiles_in_bbox=0;
	this.updatedtiles=0;
	this.maxupdatedtiles=0;
	this.newtiles=0;
	this.reusedtiles=0;
	this.framecount=0;
	
	this.far_plane=50000;
	this.maxloddelta=4;
	this.grp_diameter=4;
	this.mode=this.DELETE_OLD_TILES;
};

XML3D.DynamicTerrain.prototype.DELETE_OLD_TILES = 0;
XML3D.DynamicTerrain.prototype.REUSE_OLD_TILES = 1;

XML3D.DynamicTerrain.prototype.render_tiles = function() {

	var ratio=Math.tan(this.camera.fieldOfView/2);

	var x_frustum=(this.camera.width)/this.camera.height*ratio;
	var y_frustum=(this.camera.height)/this.camera.height*ratio;
			
	var f1=this.camera.getRayDirection(x_frustum,y_frustum);
	var f2=this.camera.getRayDirection(-x_frustum,y_frustum);
	var f3=this.camera.getRayDirection(-x_frustum,-y_frustum);
	var f4=this.camera.getRayDirection(x_frustum,-y_frustum);
			
			
	//height values can be negative!
	//intersection with xz plane can create holes!
			
	var p1=this.camera.position.add(f1.scale(this.far_plane));//=intersect_xz_plane(f1,camera.position,far_plane);
	var p2=this.camera.position.add(f2.scale(this.far_plane));//=intersect_xz_plane(f2,camera.position,far_plane);
	var p3=this.camera.position.add(f3.scale(this.far_plane));//=intersect_xz_plane(f3,camera.position,far_plane);
	var p4=this.camera.position.add(f4.scale(this.far_plane));//=intersect_xz_plane(f4,camera.position,far_plane);
			
			
			
			/*
			if(p1==undefined){
				p1=camera.position.add(f1.scale(far_plane));
			}
			if(p2==undefined){	
				p2=camera.position.add(f2.scale(far_plane));
			}
			if(p3==undefined){
				p3=camera.position.add(f3.scale(far_plane));			
			}
			if(p4==undefined){	
				p4=camera.position.add(f4.scale(far_plane));
			}
			*/
			
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

	/*
	XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
	OLD CODE
	XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
	*/
	var min = this.geo.tile(this.bounds.north, this.bounds.west);
	var max = this.geo.tile(this.bounds.south, this.bounds.east);
	var z = this.geo.level;

	//limit dynamic bounds to bbox
	// dynamicbbox contains tile coordinates, not lat/lon
	
	min.x = Math.max(min.x,dynamicbbox.min.x);
	min.y = Math.max(min.y,dynamicbbox.min.y);
	
	max.x = Math.min(max.x,dynamicbbox.max.x);
	max.y = Math.min(max.y,dynamicbbox.max.y);
	
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
	//console.log(this.maxtileCount);
	//console.log(this.tileCount);

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
	
	if(get_distance((x+0.5)*tilesize,(y+0.5)*tilesize,camera_origin)<tilesize*this.grp_diameter && delta<this.maxloddelta){
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

function get_distance(x,y,camera_origin){
	//carefull! y in tile coordinates refers to z axis in real space!
	
	//z axis is scaled by a factor of 2 since lod has a very low effect for high altitude cameras
	return Math.sqrt(Math.pow((camera_origin.x-x),2)+Math.pow((camera_origin.z-y),2)+Math.pow(camera_origin.y*2,2));
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

		
		if(this.mode=this.DELETE_OLD_TILES){
			/*
			XXXXXXXXX
			Code for Delete_old_tiles here
			XXXXXXXXX
			*/
			//delete tiles, which should not be displayed
			while (index<group.children.length/this.layers.length) {
				//if tile should not be displayed
				if(needed_tiles[current_tiles[index]]==null){
					//remove tile from list and dom (multiple deletes if multiple layers!!)
					current_tiles.splice(index,1);
				
					for(var i=0;i<this.layers.length;i++){
						var tile=group.children[index*this.layers.length];
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
				for(var i=0;i<this.layers.length;i++){
					//create new tile
					//console.log("new tile!");
					var tile = XML3D.createElement("model");
					tile.setAttribute("id", tile_key + this.layers[i]);
					tile.setAttribute("src", tile_key + "#" + this.layers[i]);
					tile.setAttribute("transform", tile_key + "#tf");
					group.appendChild(tile);
			
					this.updatedtiles++;
					this.newtiles++;
				}
			}
		}
		
		
		
		
		else{
			/*
			XXXXXXXXX
			Code for Reuse_old_tiles here
			XXXXXXXXX
			*/
			var freetiles=[]; //contains reusable tiles
			
			//delete tiles, which should not be displayed
			while (index<group.children.length/this.layers.length) {
				//if tile should not be displayed
				if(needed_tiles[current_tiles[index]]==null){
				//tile can be reused
				freetiles.push(index);
				index++;
				}
				else{
					//remove tile from needed_tiles!
					delete needed_tiles[current_tiles[index]];
					index++;
				}
			}	
			
			index=0;
			
			for (tile_key in needed_tiles){
				if(index<freetiles.length){
					//reuse tiles as long as free tiles are available
					for(var j=0;j<this.layers.length;j++){
						//remember new uri for tile
						current_tiles[freetiles[index]]=tile_key;
						//reuse old tile
						group.children[freetiles[index]*this.layers.length+j].setAttribute("id", tile_key + this.layers[j]);
						group.children[freetiles[index]*this.layers.length+j].setAttribute("src", tile_key + "#" + this.layers[j]);
						group.children[freetiles[index]*this.layers.length+j].setAttribute("transform", tile_key + "#tf");
						this.updatedtiles++;
						this.reusedtiles++;
					}
					index++;
				}
				else{
					//add all remaining tiles to the dom and the list!
					//remember we added this tile
					current_tiles.push(tile_key);
					for(var i=0;i<this.layers.length;i++){
						//create new tile
						//console.log("new tile!");
						var tile = XML3D.createElement("model");
						tile.setAttribute("id", tile_key + this.layers[i]);
						tile.setAttribute("src", tile_key + "#" + this.layers[i]);
						tile.setAttribute("transform", tile_key + "#tf");
						group.appendChild(tile);
			
						this.updatedtiles++;
						this.newtiles++;
					}
				}
			}
		
			var deleted=0;
		
			//delete remaining free_tiles
			while(index<freetiles.length){
				
				var tile_index=freetiles[index];
				//remove tile from list and dom (multiple deletes if multiple layers!!)
				current_tiles.splice(tile_index-deleted,1);
					
				
				for(var i=0;i<this.layers.length;i++){
					var tile=group.children[(tile_index-deleted)*this.layers.length];
					tile.parentNode.removeChild(tile);
			
					this.updatedtiles++;
					this.reusedtiles++;
				}
				index++;
				deleted++;
			}
		}
	}
	
	/*
	XXXXXXXXX
	Code for all modes
	XXXXXXXXX
	*/
	
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
				grp.removeChild(grp.children[0]);
			}
		
		}
	}
}


})();
