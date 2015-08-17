
var XML3D = XML3D || {};
	
(function() {

XML3D.Frustum = function(origin,points) {
	//points contains the 2d-coordinates of the frustum xz-plane intersections or projections.
	this.triangles=new Array(4);
	for(var i=0;i<points.length;i++){
		var j= (i+1)%points.length;
		this.triangles[i]= new XML3D.Triangle(origin,points[i],points[j]);
	}
};


XML3D.Frustum.prototype.isInside = function(x,y) {
	for(var i=0;i<this.triangles.length;i++){
		if(this.triangles[i].isInside(x,y)){
			return true;
		}
	}
	return false;
}

XML3D.Frustum.prototype.intersectBbox = function(bbox) {
	//test all bbox corner points with frustum
	if(this.isInside(bbox.min.x,bbox.min.y)||this.isInside(bbox.max.x,bbox.min.y)||this.isInside(bbox.min.x,bbox.max.y)||this.isInside(bbox.max.x,bbox.max.y)){
		return true;	
	}
	//test if a triangle point is in the bbox

	for(var i=0;i<this.triangles.length;i++){
		if(bbox.isInside(this.triangles[i].points[0].x,this.triangles[i].points[0].y)||bbox.isInside(this.triangles[i].points[1].x,this.triangles[i].points[1].y)||bbox.isInside(this.triangles[i].points[2].x,this.triangles[i].points[2].y)){
			return true;
			
			
		}
	}
	return false;
}

XML3D.Triangle = function(a,b,c) {
	this.points=[a,b,c];
	this.lines=[];
	this.signs=[];
	for(var i=0;i<3;i++){
		var j= (i+1)%3;
		var k= (i+2)%3;
		var line= new XML3D.ImplicitLine(this.points[i],this.points[j]);
		this.lines[i]=line;
		this.signs[i]=line.getSign(this.points[k].x,this.points[k].y);
	}
};


XML3D.Triangle.prototype.isInside = function(x,y) {
	if(this.points[1].x==this.points[2].x&&this.points[1].y==this.points[2].y){
		return false;
	}
	for(var i=0;i<3;i++){
		var sign=this.lines[i].getSign(x,y);
		if(sign!=this.signs[i]&&sign!=0){ //sign=0-> is on the line -> considered inside
			return false;
		}
	}
	return true;
}

XML3D.ImplicitLine = function(a,b) {
	if(a.x<=b.x){
		this.start=a;
		this.end=b;
	}
	else{
		this.start=b;
		this.end=a;
	}
	if(a.x==b.x){
		//can't calculate derivative if x coordinates match (divide by 0)!
		this.m=0;
	}
	else{
		this.m=(this.end.y-this.start.y)/(this.end.x-this.start.x);
	}
};

XML3D.ImplicitLine.prototype.getSign = function(x,y) {
	var px=x-this.start.x;
	var py=y-this.start.y;
	/*
	if(this.start.x==this.end.x){
		return Math.sign(px);
	}
	*/
	return Math.sign(this.m*px-py);
}

})();
