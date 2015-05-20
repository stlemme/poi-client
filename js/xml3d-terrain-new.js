var XML3D = XML3D || {};
	
(function() {

XML3D.Terrain = function(geo, group, tf_scale) {
	this.geo = geo || null;
	this.ground = ground || null;
	this.tf_scale = tf_scale || null;
	this.tileCount = 0;
	this.maxtileCount = 0;
	this.alltiles = [];
	this.updatecount=0;
	this.tiles_in_frustum=0;
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

XML3D.Terrain.prototype.dynamicLoad = function( api_tiles, layers, bbox, dynamicbbox, frustum) {
	this.updatecount++;
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
	this.tiles_in_frustum=0;
	var neededTiles=[];
	//var new_bounds=new XML3D.Bbox(min.x,min.y,max.x,max.y);
	
	for (var x = min.x; x <= max.x; x++){
		for (var y = min.y; y <= max.y; y++){
			var curr=new XML3D.Bbox(x,y,x+1,y+1);
			if(frustum.intersectBbox(curr)){
				this.tiles_in_frustum++;
				var key="tile_" + z + "_" + x + "_" + y + '_';
				if(this.alltiles[key]==null){
					//tile doesn't exist
					var tile_uri = api_tiles + "/" + z + "/" + x + "/" + y + "-asset.xml";
					var value={
						"tile_uri":tile_uri,
						"tile_id":key
					}
					neededTiles[neededTiles.length]=value;
				}
				else{
					//save that tile needs to be drawn during the current frame!
					this.alltiles[key].updatecount=this.updatecount;
				}
			}
		}
	}

	
	if(neededTiles.length>0){
		//i=index of tile to be created in neededTiles!
		var i=0;
		for (key in this.alltiles) {
			if(this.alltiles[key].updatecount<this.updatecount){
				//tile can be overwritten
				var index=this.alltiles[key].index;
			
				for(var j=0;j<layers.length;j++){
					//reuse old tile
					this.ground.children[index*layers.length+j].setAttribute("id", neededTiles[i].tile_id + layers[j]);
					this.ground.children[index*layers.length+j].setAttribute("src", neededTiles[i].tile_uri + "#" + layers[j]);
					this.ground.children[index*layers.length+j].setAttribute("transform", neededTiles[i].tile_uri + "#tf");
				}
			
			
				//delete old tile from alltiles
				delete this.alltiles[key];
				//save new tile in alltiles
				var value={
					"updatecount":this.updatecount,
					"index":index
				};
				this.alltiles[neededTiles[i].tile_id]=value;
			
				i++;
				if(i==neededTiles.length){
					//all tiles processed
					break;
				}
			
			}
		}
		
		//new tiles have to be created!
		while(i<neededTiles.length){
			var index=this.ground.children.length/layers.length;
			//save new tile in alltiles
			var value={
				"updatecount":this.updatecount,
				"index":index
			};
			this.alltiles[neededTiles[i].tile_id]=value;
			
			for(var j=0;j<layers.length;j++){
				//create new tile
				var tile = XML3D.createElement("model");
				tile.setAttribute("id", neededTiles[i].tile_id + layers[j]);
				tile.setAttribute("src", neededTiles[i].tile_uri + "#" + layers[j]);
				tile.setAttribute("transform", neededTiles[i].tile_uri + "#tf");
				this.ground.appendChild(tile);
			}
			i++;
		}	
	}
	
	
	
	
	
	
	

	this.tileCount=this.ground.children.length;
	this.maxtileCount=Math.max(this.tileCount,this.maxtileCount);
	//console.log(this.maxtileCount);
	
	this.tf_scale.setAttribute("scale", this.geo.tile_size + " 1 " + this.geo.tile_size);
}

function contains(a, obj) {
    var i = a.length;
    while (i--) {
       if (a[i].min.x == obj.min.x && a[i].min.y == obj.min.y&&a[i].max.x == obj.max.x && a[i].max.y == obj.max.y) {
           return true;
       }
    }
    return false;
}

function redraw(element){
	
	//worth a try, but doesn't work
	while (element.firstChild) {
		element.removeChild(element.firstChild);
	}

	//nope does not work either
/*
	var disp = element.style.display;
	element.style.display = 'none';
	var trick = element.offsetHeight;
	element.style.display = disp;
*/

}

})();
