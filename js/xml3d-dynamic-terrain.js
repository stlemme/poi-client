var XML3D = XML3D || {};
	
(function() {

XML3D.DynamicTerrain = function(geo, group, tf_scale, camera, api_tiles, options) {
	this.geo = geo || null;
	this.ground = group || null;
	this.tf_scale = tf_scale || null;
	this.camera = camera || null;
	this.api_tiles = api_tiles || null;
	
	//optional information
	this.bounds=options.bounds||null;
	this.layer=options.layer||"all";
	
	this.far_plane=options.far_plane||150000;
	this.maxloddelta=options.max_lod_delta||2;
	this.terrain_min_height=options.min_height||0;
	this.wireframe=options.wireframe||false;
	this.draw_minimap=options.minimap||true;
	
	
	this.use_preload=options.preload||false;
	this.preload_range=options.preload_range||[750000];

	
	this.max_tiles=options.maximum_tiles||160;
	this.screen_space_error=options.maximum_screen_space_error||1;
	this.use_constant_tilepool=false;
	
	if(options.tile_selection=="constant_performance"){
		this.use_constant_tilepool=true;
		
	}
	if(options.tile_selection=="constant_quality"){
		this.use_constant_tilepool=false;
	}
	
	this.handle_invisible=this.handle_invisible_delete;
	
	if(options.tile_management=="reuse_old_tiles"){
		this.handle_invisible=this.handle_invisible_reuse;
	}
	
	if(options.tile_management=="delete_old_tiles"){
		this.handle_invisible=this.handle_invisible_delete;
	}
	
	//statistics
	this.tileCount = 0;
	this.maxtileCount = 0;
	this.tiles_in_bbox=0;
	this.updatedtiles=0;
	this.maxupdatedtiles=0;
	this.newtiles=0;
	this.reusedtiles=0;
	this.removedtiles=0;
	this.framecount=0;
	
	
	this.lodLayers=[];
	
	//only used in distance based approach!
	this.grp_diameter=2;
	
	this.metric=[];
	
	this.tiles_being_loaded=0;
	
	//used for stitching
	this.displayed_tiles=[];
	
	//used in draw_tiles only!
	this.freetiles=new Iterator(1);
	
	//used for pre-loading
	this.cached_tiles=[];
	
	//currently disabled!
	this.max_preload_requests=20;
	
	
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
	
	var r1 = this.camera.xml3d.generateRay(this.camera.width-1, this.camera.height-1);
	var r2 = this.camera.xml3d.generateRay(                  0, this.camera.height-1);
	var r3 = this.camera.xml3d.generateRay(                  0,                    0);
	var r4 = this.camera.xml3d.generateRay(this.camera.width-1,                    0);
	
	var f1 = r1.direction;
	var f2 = r2.direction;
	var f3 = r3.direction;
	var f4 = r4.direction;

	//intersection with xz-plane at height this.terrain_min_height with maximum distance of this.far_plane
	var i1 = intersect_ray_x_z_plane(this.camera.transformInterface.position.x,this.camera.transformInterface.position.y,this.camera.transformInterface.position.z,f1.x,f1.y,f1.z,this.far_plane,this.terrain_min_height);
	var i2 = intersect_ray_x_z_plane(this.camera.transformInterface.position.x,this.camera.transformInterface.position.y,this.camera.transformInterface.position.z,f2.x,f2.y,f2.z,this.far_plane,this.terrain_min_height);
	var i3 = intersect_ray_x_z_plane(this.camera.transformInterface.position.x,this.camera.transformInterface.position.y,this.camera.transformInterface.position.z,f3.x,f3.y,f3.z,this.far_plane,this.terrain_min_height);
	var i4 = intersect_ray_x_z_plane(this.camera.transformInterface.position.x,this.camera.transformInterface.position.y,this.camera.transformInterface.position.z,f4.x,f4.y,f4.z,this.far_plane,this.terrain_min_height);
	
	//create bounds of view frustum
			
	var i1_tile=this.geo.backproject(i1.x,i1.z);
	var i1_proj=this.geo.backproject(i1.x,i1.z);
	i1_tile.x=Math.floor(i1_tile.x);
	i1_tile.y=Math.floor(i1_tile.y);
			
	var i2_tile=this.geo.backproject(i2.x,i2.z);
	var i2_proj=this.geo.backproject(i2.x,i2.z);
	i2_tile.x=Math.floor(i2_tile.x);
	i2_tile.y=Math.floor(i2_tile.y);
			
	var i3_tile=this.geo.backproject(i3.x,i3.z);
	var i3_proj=this.geo.backproject(i3.x,i3.z);
	i3_tile.x=Math.floor(i3_tile.x);
	i3_tile.y=Math.floor(i3_tile.y);
			
	var i4_tile=this.geo.backproject(i4.x,i4.z);
	var i4_proj=this.geo.backproject(i4.x,i4.z);
	i4_tile.x=Math.floor(i4_tile.x);
	i4_tile.y=Math.floor(i4_tile.y);
			
	var camera_tile=this.geo.backproject(this.camera.transformInterface.position.x,this.camera.transformInterface.position.z);
	var camera_proj=this.geo.backproject(this.camera.transformInterface.position.x,this.camera.transformInterface.position.z);
	camera_tile.x=Math.floor(camera_tile.x);
	camera_tile.y=Math.floor(camera_tile.y);
			
	
	var fov=this.camera.transformInterface.fieldOfView;
	var ratio=Math.tan(fov);
	var height=this.camera.height;
	var threshold=ratio*this.screen_space_error*2/height;
			
			
	//camera coordinates in tile space
	//adjusted y value to improve behaviour of distance estimate
	
	var camera_origin={
		"x":camera_proj.x,
		"y":Math.min((this.camera.transformInterface.position.y-this.ground.getWorldBoundingBox().max.y)/geo.tile_size,0),
		"z":camera_proj.y
	}
	
	var map_center={
		"x":Math.floor(camera_proj.x*Math.pow(2,this.maxloddelta)),
		"y":Math.floor(camera_proj.y*Math.pow(2,this.maxloddelta))
	}
	
			
	var x_z_intersections=new Array(i1_proj,i2_proj,i3_proj,i4_proj);
	var frustum=new XML3D.Frustum(camera_proj,x_z_intersections);
			
	var dynamicbbox=new XML3D.Bbox(i1_tile.x,i1_tile.y,i1_tile.x,i1_tile.y);
	dynamicbbox.extend(i2_tile.x,i2_tile.y);
	dynamicbbox.extend(i3_tile.x,i3_tile.y);
	dynamicbbox.extend(i4_tile.x,i4_tile.y);
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
	
	if(this.use_preload){
		this.preload_tiles(camera_origin);
	}
	//for all tiles in frustum: add to required tiles
	var required_tiles=[];
	

	this.generate_tiles(min.x,min.y,max.x,max.y,camera_origin,frustum,required_tiles,threshold);

	if(this.draw_minimap){
		//create image with same dimensions as canvas
		var element = document.getElementById("map");
		var c = element.getContext("2d");

		var width = element.width;
		var height = element.height;

		var imageData = c.createImageData(width, height);
		draw_map(required_tiles,imageData,map_center,this.maxloddelta,x_z_intersections);
		c.putImageData(imageData, 0, 0);
	
		this.draw_tiles(required_tiles);
	}
	
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

function intersect_ray_x_z_plane(camera_x,camera_y,camera_z,direction_x,direction_y,direction_z,far_plane,height){
	var distance=far_plane;
	var diff=camera_y-height;
	if(diff>0&&direction_y<0){
		var distance=Math.min(far_plane,-diff/direction_y);
	}
	else if(diff<=0){
		//below plane
		var ret={
			"x":camera_x,
			"y":camera_y,
			"z":camera_z
		}
		return ret;
	}
	
	var ret={
		"x":camera_x+distance*direction_x,
		"y":camera_y+distance*direction_y,
		"z":camera_z+distance*direction_z
	}
	return ret;
}


function draw_map(required_tiles,imageData,map_center,maxloddelta,x_z_intersections){
	var scale=1;
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
	for(var i=0;i<x_z_intersections.length;i++){
		var pos_x= Math.floor(x_z_intersections[i].x*Math.pow(2,maxloddelta)-map_center['x'])*scale+center_x;
		var pos_y= Math.floor(x_z_intersections[i].y*Math.pow(2,maxloddelta)-map_center['y'])*scale+center_y;
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
	if(this.load_tile(x,y,z,false)&&delta<this.preload_range.length-1&&get_squared_distance_y_adjusted((x+0.5)/scale,(y+0.5)/scale,camera_origin)<Math.pow(this.preload_range[delta+1]/this.geo.tile_size,2)){
		this.preload_tiles_recursive(x*2,y*2,delta+1,camera_origin);
		this.preload_tiles_recursive(x*2+1,y*2,delta+1,camera_origin);
		this.preload_tiles_recursive(x*2,y*2+1,delta+1,camera_origin);
		this.preload_tiles_recursive(x*2+1,y*2+1,delta+1,camera_origin);
	}
}



XML3D.DynamicTerrain.prototype.generate_tiles = function(x_min,y_min,x_max,y_max,camera_origin,frustum,tiles,threshold){
	
	var tile_list= new SortedTileList();
	
	//camera origin is the 3d camera origin transformed into tile space
	for (var x = x_min; x <= x_max; x++){
		for (var y = y_min; y <= y_max; y++){
			var distance_squared=get_squared_distance((x+0.5),(y+0.5),camera_origin);
			//distance test to avoid flickering at terrain boarder
			if(!frustum.intersectRectangle(x,y,(x+1),(y+1))||(distance_squared>Math.pow(this.far_plane/this.geo.tile_size,2))||!this.load_tile(x,y,this.geo.level,false)){
				//no need to draw this!
				continue;
			}
			//tile is in frustum and loaded!
			//calculate screen space error metric and add it to the ordered tile list!
			var tile_uri = this.api_tiles + "/" + this.geo.level + "/" + x + "/" + y + "-asset.xml";
			var error = this.metric[tile_uri]/(get_distance_y_adjusted_bbox(x,y,(x+1),(y+1),camera_origin)*this.geo.tile_size);
			tile_list.insert(x,y,this.geo.level,error);
			
		}
	}
	
	var finished_tiles=0;
	var x;
	var y;
	var z;
	
	//dummy value to not exit loop instantly.
	var metric=100;
	var max_tiles=this.max_tiles
	
	var condition;
	
	if(this.use_constant_tilepool){
		condition= function(){
			return tile_list.size()+finished_tiles<=max_tiles-3;
		};
	}
	else{
		condition= function(){
			return metric>threshold;
		}
	}
	
	while((tile_list.size()>0)&&condition()){
		var ret=tile_list.pop();
		x=ret[0];
		y=ret[1];
		z=ret[2];
		metric=ret[3];
		//can we split up the tile?
		
		//todo: if not loaded, still count towards tile count to prevent poor loading patterns!
		if(z-this.geo.level<=this.maxloddelta){
			if(this.load_tile(x*2,y*2,z+1,true)&& this.load_tile(x*2+1,y*2,z+1,true)&& this.load_tile(x*2,y*2+1,z+1,true)&& this.load_tile(x*2+1,y*2+1,z+1,true)){
				//split it
				var delta=z-this.geo.level+1;
				var tilesize=1/Math.pow(2,delta);
			
				//todo: frustum test
				if(frustum.intersectRectangle(x*2*tilesize,y*2*tilesize,(x*2+1)*tilesize,(y*2+1)*tilesize)){
					var uri1=this.api_tiles + "/" + (z+1) + "/" + (x*2) + "/" + (y*2) + "-asset.xml";
					var metric1=this.metric[uri1];
					var error1 = metric1/(get_distance_y_adjusted_bbox(2*x*tilesize,2*y*tilesize,(2*x+1)*tilesize,(2*y+1)*tilesize,camera_origin)*this.geo.tile_size);
					tile_list.insert(x*2,y*2,z+1,error1);
				}
			
				if(frustum.intersectRectangle((x*2+1)*tilesize,y*2*tilesize,(x*2+2)*tilesize,(y*2+1)*tilesize)){
					var uri2=this.api_tiles + "/" + (z+1) + "/" + (x*2+1) + "/" + (y*2) + "-asset.xml";
					var metric2=this.metric[uri2];
					var error2 = metric2/(get_distance_y_adjusted_bbox((2*x+1)*tilesize,2*y*tilesize,(2*x+2)*tilesize,(2*y+1)*tilesize,camera_origin)*this.geo.tile_size);
					tile_list.insert(x*2+1,y*2,z+1,error2);
				}
			
				if(frustum.intersectRectangle(x*2*tilesize,(y*2+1)*tilesize,(x*2+1)*tilesize,(y*2+2)*tilesize)){
					var uri3=this.api_tiles + "/" + (z+1) + "/" + (x*2) + "/" + (y*2+1) + "-asset.xml";
					var metric3=this.metric[uri3];
					var error3 = metric3/(get_distance_y_adjusted_bbox(2*x*tilesize,(2*y+1)*tilesize,(2*x+1)*tilesize,(2*y+2)*tilesize,camera_origin)*this.geo.tile_size);
					tile_list.insert(x*2,y*2+1,z+1,error3);
				}
				
				if(frustum.intersectRectangle((x*2+1)*tilesize,(y*2+1)*tilesize,(x*2+2)*tilesize,(y*2+2)*tilesize)){
					var uri4=this.api_tiles + "/" + (z+1) + "/" + (x*2+1) + "/" + (y*2+1) + "-asset.xml";
					var metric4=this.metric[uri4];
					var error4 = metric4/(get_distance_y_adjusted_bbox((2*x+1)*tilesize,2*y*tilesize,(2*x+2)*tilesize,(2*y+1)*tilesize,camera_origin)*this.geo.tile_size);
					tile_list.insert(x*2+1,y*2+1,z+1,error4);
				}
				continue;
			}
			else{
				//we want to split but can't -> increase finished tiles to prevent other tiles from being split unnecessarily
				//assume worst case(highest amounts of pre-loads) to avoid unnecessary requests.
				finished_tiles+=Math.pow(2,this.maxloddelta-(z-this.geo.level))*4;
			
			}
		
		}
		
		//do not split up tile!
		var delta=z-this.geo.level;
		var tile_uri = this.api_tiles + "/" + z + "/" + x + "/" + y + "-asset.xml";
		//add to tiles map
		if(tiles[delta]==null){
		tiles[delta]=[];
		}
		var tile=tiles[delta];
		//remember x/y/z coordinates to use them later on!
		tile[tile_uri]=[x,y,z];
		//we allready finished this tile!
		finished_tiles++;
		
	}
	
	
	while(tile_list.size()>0){
		//add remaining tiles to tiles map
		var ret=tile_list.pop();
		x=ret[0];
		y=ret[1];
		z=ret[2];
		
		var delta=z-this.geo.level;
		var tile_uri = this.api_tiles + "/" + z + "/" + x + "/" + y + "-asset.xml";
		//add to tiles map
		if(tiles[delta]==null){
		tiles[delta]=[];
		}
		var tile=tiles[delta];
		//remember x/y/z coordinates to use them later on!
		tile[tile_uri]=[x,y,z];
	}
}

XML3D.DynamicTerrain.prototype.tile_onload= function (key){
	//remember this tile has been cached and can be used without creating holes is the terrain.
	this.tiles_being_loaded--;
	this.cached_tiles[key]=true;
	if(this.tiles_being_loaded==0&&this.framecount<=2){
		//call render tiles to prevent white screen when no tiles are in groups!
		this.render_tiles();
	}
}

XML3D.DynamicTerrain.prototype.load_tile= function (x,y,z,optional){
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
		if(optional&&this.tiles_being_loaded>=this.max_preload_requests){
			return false;
		}

		//load it!
		var that = this;
		var callback = function(records, observer){
				var node = records[0].target; // The node of which the result has changed
				var result = records[0].result; // The data result of the observed node
				var val = result.getValue('errormetric');
				if(val==null){
					console.log(key);
				}
				that.metric[key]=val[0];
				that.tile_onload(key);
				observer.disconnect();
		}
		this.tiles_being_loaded++;
		var data = XML3D.createElement("data");
		data.setAttribute("src",key+"#meta-data");
		var observer = new XML3DDataObserver(callback, 'errormetric');
		observer.observe(data);
		


		
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

function get_distance_y_adjusted_bbox(x_min,y_min,x_max,y_max,camera_origin){
	var x;
	var y;
	//x
	if(x_min<=camera_origin.x&&camera_origin.x<=x_max){
		//inside tile
		x=camera_origin.x;
	}
	else if(x_min>camera_origin.x){
		x=x_min;
	}
	else{
		x=x_max;
	}
	
	//y
	if(y_min<=camera_origin.y&&camera_origin.y<=y_max){
		//inside tile
		y=camera_origin.y;
	}
	else if(y_min>camera_origin.y){
		y=y_min;
	}
	else{
		y=y_max;
	}
	return Math.max(get_distance_y_adjusted(x,y,camera_origin),0.0001);
}

function get_distance_y_adjusted(x,y,camera_origin){
	return Math.sqrt(get_squared_distance_y_adjusted(x,y,camera_origin));
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
				group_new.setAttribute("material", "#wireframe"+key%3);
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

SortedTileList = function(){
	//only error is sorted!
	this.error=[];
	this.x=[];
	this.y=[];
	this.z=[];
};

SortedTileList.prototype.insert=function(x,y,z,metric){
	//console.log(this.error);
	//console.log(metric);
	
	
	//find index using binary search
	var min=0;
	var max=this.size()-1;
	var currentIndex=0;
	var currentElement;
	
	if(metric>this.error[max]){
		this.error[max+1]=metric;
		this.x[max+1]=x;
		this.y[max+1]=y;
		this.z[max+1]=z;
	}
	
	else if(metric<this.error[min]){
		//update arrays
		this.error.splice(0, 0, metric);
		this.x.splice(0, 0, x);
		this.y.splice(0, 0, y);
		this.z.splice(0, 0, z);
	}
	else{
	while (min<=max){
		currentIndex= Math.floor((min+max)/2);
		currentElement= this.error[currentIndex];
		
		//special cases when terminating
		if(max-min==1){
			if(this.error[min]>metric){
				currentIndex=min;
				break;
			}
			else if(this.error[max]<metric){
				currentIndex=max+1;
				break;
			}
			else{
				currentIndex=max;
				break;
			}
		}
		
		if(max==min){
			if(this.error[min]>metric){
				currentIndex=min;
				break;
			}
			else{
				currentIndex=min+1;
				break;
			}
		}
		
		
		if(currentElement < metric){
			min = currentIndex + 1;
		}
		else if(currentElement > metric){
			max = currentIndex - 1;
		}
		else{
			break;
		}
	}
	
	//update arrays
	this.error.splice(currentIndex, 0, metric);
	this.x.splice(currentIndex, 0, x);
	this.y.splice(currentIndex, 0, y);
	this.z.splice(currentIndex, 0, z);
	
	}

	

	
	//console.log(this.error);
	
	
}

SortedTileList.prototype.size=function(){
	return this.error.length;
}

SortedTileList.prototype.pop=function(){
	return [this.x.pop(),this.y.pop(),this.z.pop(),this.error.pop()];
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
