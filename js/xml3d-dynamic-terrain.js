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
	this.removedtiles=0;
	this.framecount=0;
	
	this.far_plane=150000;
	this.lodLayers=[];
	this.maxloddelta=2;
	this.grp_diameter=2;
	
	//used for stitching
	this.displayed_tiles=[];
	
	this.handle_invisible=this.handle_invisible_delete;
	
	//used in draw_tiles only!
	this.freetiles=new Iterator(1);
	
	//used for wireframe rendering
	this.wireframe=false;
	
	//used for pre-loading
	this.cached_tiles=[];
	
	this.loading=XML3D.createElement("group");
	this.loading.setAttribute("style", "transform: scale(0,0,0)");
	this.loading.setAttribute("id", "loading");
	this.ground.appendChild(this.loading);
	
	//currently disabled!
	this.max_preload_requests=20;
	
	this.preload_range=[500000,75000];
	
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
	
	var map_center={
		"x":Math.floor(camera_proj.x*Math.pow(2,this.maxloddelta)),
		"y":Math.floor(camera_proj.y*Math.pow(2,this.maxloddelta))
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
	
	//create image with same dimensions as canvas
	var element = document.getElementById("map");
    var c = element.getContext("2d");

    var width = element.width;
    var height = element.height;

    var imageData = c.createImageData(width, height);
	
	this.tiles_in_bbox=(max.x-min.x+1)*(max.y-min.y+1);
	
	//this.preload_tiles(camera_origin);

	//for all tiles in frustum: add to required tiles
	var required_tiles=[];
	for (var x = min.x; x <= max.x; x++){
		for (var y = min.y; y <= max.y; y++){
			this.generate_tiles (x,y,z,camera_origin,frustum,required_tiles);
		}
	}
	
	draw_map(required_tiles,imageData,map_center,this.maxloddelta,projections);
	c.putImageData(imageData, 0, 0);
	
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

function draw_map(required_tiles,imageData,map_center,maxloddelta,projections){
	var scale=2;
	var center_x= Math.floor(imageData.width/2);
	var center_y= Math.floor(imageData.height/2);
	for(delta in required_tiles){
		var size=Math.pow(2,(maxloddelta-delta));
		var n= delta%3;
		var colour=new Array(3); //rgb without alpha
		if(n==0){
			colour[0]=256;
		}
		else if(n==1){
			colour[1]=256;
		}
		else{
			colour[2]=256;
		}
		
		var tiles = required_tiles[delta];
		
		for(key in tiles){
			var pos= tiles[key];
			var x_pos=(pos[0]*size-map_center['x'])*scale+center_x;
			var y_pos=(pos[1]*size-map_center['y'])*scale+center_y;
			for (var x=0;x<size*scale;x++){
				for(var y=0;y<size*scale;y++){
					setPixel(imageData, x_pos+x, y_pos+y, colour[0], colour[1], colour[2], 255);
				}
			}
		}
	}
	//center
	for(var x=-1;x<=1;x++){
		for(var y=-1;y<=1;y++){
			setPixel(imageData, center_x+x, center_y+y, 127, 127, 255, 255);
		}
	}
	for(var i=0;i<projections.length;i++){
		var pos_x= Math.floor(projections[i].x*Math.pow(2,maxloddelta)-map_center['x'])*scale+center_x;
		var pos_y= Math.floor(projections[i].y*Math.pow(2,maxloddelta)-map_center['y'])*scale+center_y;
		for(var x=-1;x<=1;x++){
			for(var y=-1;y<=1;y++){
				setPixel(imageData, pos_x+x, pos_y+y, 63, 63, 63, 255);
			}
		}
	}

}

function setPixel(imageData, x, y, r, g, b, a) {
	if(x<0||y<0||x>=imageData.width||y>=imageData.height){
		//console.log("out of bounds");
		return;
	}
    index = (x + y * imageData.width) * 4;
    imageData.data[index+0] = r;
    imageData.data[index+1] = g;
    imageData.data[index+2] = b;
    imageData.data[index+3] = a;
}


XML3D.DynamicTerrain.prototype.preload_tiles = function(camera_origin){
	if(this.preload_range.length==0){
		return;
	}
	var range=Math.ceil(this.preload_range[0]/this.geo.tile_size)+1;
	for(var x=Math.floor(camera_origin.x)-range;x<=Math.floor(camera_origin.x)+range;x++){
		for(var y=Math.floor(camera_origin.z)-range;y<=Math.floor(camera_origin.z)+range;y++){
			if(get_squared_distance((x+0.5),(y+0.5),camera_origin)<=Math.pow(this.preload_range[0]/this.geo.tile_size,2)){
				this.preload_tiles_recursive(x,y,0,camera_origin);
			}
		}
	}
}

XML3D.DynamicTerrain.prototype.preload_tiles_recursive = function(x,y,delta,camera_origin){
	var z= this.geo.level+delta;
	var scale= Math.pow(2,delta);
	//preload small tiles only after large tiles have allready been loaded!
	if(this.load_tile(x,y,z)&&delta<this.preload_range.length-1&&get_squared_distance_y_adjusted((x+0.5)/scale,(y+0.5)/scale,camera_origin)<Math.pow(this.preload_range[delta+1]/this.geo.tile_size,2)){
		this.preload_tiles_recursive(x*2,y*2,delta+1,camera_origin);
		this.preload_tiles_recursive(x*2+1,y*2,delta+1,camera_origin);
		this.preload_tiles_recursive(x*2,y*2+1,delta+1,camera_origin);
		this.preload_tiles_recursive(x*2+1,y*2+1,delta+1,camera_origin);
	}
}


XML3D.DynamicTerrain.prototype.generate_tiles = function(x,y,z,camera_origin,frustum,tiles){
	//camera origin is the 3d camera origin transformed into tile space
	var delta=z-this.geo.level;
	var tilesize=1/Math.pow(2,delta);
	var distance_squared=get_squared_distance((x+0.5)*tilesize,(y+0.5)*tilesize,camera_origin);
	//distance test to avoid flickering at terrain boarder
	if(!frustum.intersectRectangle(x*tilesize,y*tilesize,(x+1)*tilesize,(y+1)*tilesize)||(distance_squared>Math.pow(this.far_plane/this.geo.tile_size,2))){
		//no need to draw this!
		return;
	}
	
	//draw more detailed tiles if near camera and max lod has not been reached and all tiles are ready to be displayed
	if(get_squared_distance_y_adjusted((x+0.5)*tilesize,(y+0.5)*tilesize,camera_origin)<Math.pow(tilesize*this.grp_diameter,2) && delta<this.maxloddelta && this.load_tile(x*2,y*2,z+1)&& this.load_tile(x*2+1,y*2,z+1)&& this.load_tile(x*2,y*2+1,z+1)&& this.load_tile(x*2+1,y*2+1,z+1)){
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
		//remember x/y/z coordinates to use them later on!
		tile[tile_uri]=[x,y,z];
	}	
}
/*
XML3D.DynamicTerrain.prototype.tile_onload= function (event,key,tiles,api_tiles){
	//remember this tile has been cached and can be used without creating holes is the terrain.
	tiles[key]=true;
	//remove loaded tile from dom
	var node=event.target;
	node.parentNode.removeChild(node);
}
*/
XML3D.DynamicTerrain.prototype.tile_onload= function (event,key,that){
	//remember this tile has been cached and can be used without creating holes is the terrain.
	that.cached_tiles[key]=true;
	//remove loaded tile from dom
	var node=event.target;
	node.parentNode.removeChild(node);
}

XML3D.DynamicTerrain.prototype.load_tile= function (x,y,z){
	//returns true if tile is chached
	//otherwise false; starts loading the tile
	var key=this.api_tiles + "/" + z + "/" + x + "/" + y + "-asset.xml";
	var lookup=this.cached_tiles[key];
	if(lookup==true){
		//tile is ready to be displayed
		return true;
	}
	else if(lookup==null){
		//tile has not been requested yet
		//are we allowed to load it?
		/*
		//currently not working!
		if(this.loading.children.length>=this.max_preload_requests){
			return false;
		}
		*/
		//load it!
		var tile = XML3D.createElement("model");
		var that = this;
		this.loading.appendChild(tile);
		tile.setAttribute("src", key + "#" + this.layer);
		//make sure we are alerted if tile is loaded
		tile.addEventListener('load', function( evt ) {
			that.tile_onload(evt,key,that);
		});
		
		//remember we are allready attempting to load this tile
		this.cached_tiles[key]=false;
		return false;
	}
	//tile has been requested, but has not finished loading
	return false;
}

XML3D.DynamicTerrain.prototype.set_additional_attributes= function  (node,options){
	
	var x= options[0];
	var y= options[1];
	var z= options[2];
	var stitching=[0,0,0,0];
	
	
	//at max 2x stitching since 1 bigger tile gets replaced by 4 smaller ones (so 2 adjacent tiles are at least of the same lod or a higher lod (so they will handle stitching to the current tile))
	/*
	
	.--.--.
	|  |  |
	.--.--.
	|  |  |
	.--.--.
	
	*/
	var delta=1;
	
	var center_x=Math.floor(x/2);
	var center_y=Math.floor(y/2);
	
	var horizontal;
	var horizontal_index;
	
	var vertical;
	var vertical_index;
	
	if(x%2==0){
		horizontal_index=0;
		horizontal=Math.floor((x-1)/2);
	}
	else{
		horizontal_index=2;
		horizontal=Math.floor((x+1)/2);
	}
	if(y%2==0){
		vertical_index=3;
		vertical=Math.floor((y-1)/2);
	}
	else{
		vertical_index=1;
		vertical=Math.floor((y+1)/2);
	}
	
	var layer=this.displayed_tiles[z-1-this.geo.level];
	
	//if horizontal/vertical is the same as the center coordinates, they tiles will not exist at this layer or above as they would cover the original tile!
	while((z-delta)>=this.geo.level&&!((vertical==center_y||stitching[vertical_index]!=0)&&(horizontal==center_x||stitching[horizontal_index]!=0))){
		var lookup_string;
		if(layer!=null){
			if(vertical!=center_y&&stitching[vertical_index]==0){
				lookup_string=this.api_tiles + "/" + (z-delta) + "/" + center_x + "/" + vertical + "-asset.xml";
				if(layer[lookup_string]!=null){
					stitching[vertical_index]=delta;
				}
			}
		
			if(horizontal!=center_x&&stitching[horizontal_index]==0){
				lookup_string=this.api_tiles + "/" + (z-delta) + "/" + horizontal + "/" + center_y + "-asset.xml";
				if(layer[lookup_string]!=null){
					stitching[horizontal_index]=delta;
				}
			}
		}

		center_x=Math.floor(center_x/2);
		center_y=Math.floor(center_y/2);
		vertical=Math.floor(vertical/2);
		horizontal=Math.floor(horizontal/2);
		delta++;
		layer=this.displayed_tiles[z-delta-this.geo.level];
	}
	
	
	var stitching_string = stitching[0]+" "+stitching[1]+" "+stitching[2]+" "+stitching[3];
	
	if(!node.hasChildNodes()){
		//create child nodes!
		
		var terrain_morph=XML3D.createElement("assetdata");
		terrain_morph.setAttribute("name", "terrain_morph");
		
		var terrain_stitching=XML3D.createElement("int");
		terrain_stitching.setAttribute("name", "stitching");
		terrain_stitching.innerHTML = stitching_string;
		
		terrain_morph.appendChild(terrain_stitching);
		
		if(this.layer=="all"){
			//additional node needed!
			var terrain=XML3D.createElement("asset");
			terrain.setAttribute("name", "terrain");
			
			terrain.appendChild(terrain_morph);
			node.appendChild(terrain);
		}
		else if(this.layer=="terrain"){
			node.appendChild(terrain_morph);
		}
	}
	else if(this.layer=="terrain" && node.children[0].children[0].innerHTML != stitching_string){
		//only touch node if stitching has changed. touching the node triggers a recalculation!
		node.children[0].children[0].innerHTML = stitching_string;
	}
	else if(this.layer=="all" && node.children[0].children[0].children[0].innerHTML != stitching_string){
		//only touch node if stitching has changed. touching the node triggers a recalculation!
		node.children[0].children[0].children[0].innerHTML = stitching_string;
	}
	

}

function get_squared_distance_y_adjusted(x,y,camera_origin){
	//carefull! y in tile coordinates refers to z axis in real space!
	
	//z axis is scaled by a factor of 2 since lod has a very low effect for high altitude cameras
	//ways cheaper than making the actual computation but still good enough
	//this was suggested in another paper
	return Math.pow((camera_origin.x-x),2)+Math.pow((camera_origin.z-y),2)+Math.pow(camera_origin.y*2,2);
}

function get_squared_distance(x,y,camera_origin){
	//carefull! y in tile coordinates refers to z axis in real space!
	return Math.pow((camera_origin.x-x),2)+Math.pow((camera_origin.z-y),2);
}

XML3D.DynamicTerrain.prototype.draw_tiles = function(tiles){
	// tiles contains a map, mapping level (as delta from minimum level) to a map of tile uris.
	this.updatedtiles=0;
	this.reusedtiles=0;
	this.newtiles=0;
	this.removedtiles=0;
	
	//copy array
	this.displayed_tiles=$.extend(true, [], tiles);
	
	for(key in tiles){
		//do tiles of this level allready exist?
		var group_index;
		if(!(key in this.lodLayers)){
			//if not, create a new grop containing those tiles
			group_new=XML3D.createElement("group");
			var scale=1/Math.pow(2,key);
			//scale relative to tf_scale
			group_new.setAttribute("style", "transform: scale(" + scale + ", 1, " + scale +")");
			group_new.setAttribute("id", "Lod "+key);
			if(this.wireframe){
				group_new.setAttribute("shader", "#wireframe"+key%3);
			}
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

		this.freetiles.clear_and_allocate(group.children.length);
			
		while (index<group.children.length) {
			// is old tile still supposed to be displayed???
			var tile=group.children[index];
			var lookup=needed_tiles[tile.getAttribute("id")];
			if(lookup==null){
				//handle currently invisible tiles depending on set mode;
				index+=this.handle_invisible(tile);
			}
			else{
				//update stitching!
				this.set_additional_attributes(tile,lookup);
				//remove tile from needed_tiles!
				delete needed_tiles[group.children[index].getAttribute("id")];
				index++;
			}
		}	

		
		for (tile_key in needed_tiles){
			//create all remaining tiles
			tile=this.create_or_reuse_tile(group);
			tile.setAttribute("id", tile_key);
			tile.setAttribute("src", tile_key + "#" + this.layer);
			tile.setAttribute("transform", tile_key + "#tf");
			this.set_additional_attributes(tile,this.displayed_tiles[key][tile_key]);
		}

		//delete remaining this.freetiles
		while(this.freetiles.hasNext()){
			var tile=this.freetiles.next();
			tile.parentNode.removeChild(tile);
		
			this.updatedtiles++;
			this.removedtiles++;

		}
	}
	
	//tiles may not contain tiles for every layer!
	for (key in this.lodLayers){
		//if no tiles in this layer are requested, delete all tiles in this layer
		if(tiles[key]==null){
			//delete all tiles from layer
			var grp=this.ground.children[this.lodLayers[key]];
			while(grp.firstChild){
				//remove first node until empty
				this.updatedtiles++;
				this.removedtiles++;
				grp.removeChild(grp.firstChild);
			}
		}
	}
}


XML3D.DynamicTerrain.prototype.handle_invisible_reuse = function (tile){
	this.freetiles.push(tile);
	
	//increment index
	return 1;
}


XML3D.DynamicTerrain.prototype.handle_invisible_delete = function (tile){
	//remove tile from dom
	tile.parentNode.removeChild(tile);
			
	this.updatedtiles++;
	this.deletedtiles++;
	
	//do not increment index
	return 0;
}

XML3D.DynamicTerrain.prototype.create_or_reuse_tile = function (group){
	this.updatedtiles++;
	if(this.freetiles.hasNext()){
		this.reusedtiles++;
		//reuse tile if possible
		return this.freetiles.next();
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
	return(this.values[this.current_position++]);
}

Iterator.prototype.clear_and_allocate = function(capacity) {
	this.length=0;
	this.current_position=0;
	if(this.values.length<capacity){
		//only allocate array if needed
		this.values=new Array(capacity);
	}
}

})();
