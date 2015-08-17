
var XML3D = XML3D || {};
	
(function() {

XML3D.Bbox = function(min_x, min_y, max_x, max_y) {
	this.min={
		"x": min_x,
		"y": min_y
	};
		this.max={
		"x": max_x,
		"y": max_y
	};
};


XML3D.Bbox.prototype.extend = function(x,y) {
	this.min.x=Math.min(this.min.x,x);
	this.min.y=Math.min(this.min.y,y);
	this.max.x=Math.max(this.max.x,x);
	this.max.y=Math.max(this.max.y,y);
}

XML3D.Bbox.prototype.isInside = function(x,y) {
	return(this.min.x<=x&&this.max.x>=x&&this.min.y<=y&&this.max.y>=y);
}

})();
