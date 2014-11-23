var XML3D = XML3D || {};
	
(function() {

XML3D.BusyIndicator = function ( xml3d, indicator )
{
	this.xml3d = xml3d;
	this.indicator = indicator;
	
	this.busy = false;
	
	this.xml3d.addEventListener('framedrawn', this.onframedrawn(), false);
}

XML3D.BusyIndicator.prototype.onframedrawn = function() {
	// console.log(this);
	var busy = this;
	return function( evt ) {
		// console.log(this.complete);
		busy.show(!this.complete);
	};
};

XML3D.BusyIndicator.prototype.showBusy = function () {
	this.show(true);
};

XML3D.BusyIndicator.prototype.showIdle = function () {
	this.show(false);
};

XML3D.BusyIndicator.prototype.show = function ( busy ) {
	this.busy = busy;
	this.updateIndicator();
};

XML3D.BusyIndicator.prototype.updateIndicator = function () {
	this.indicator.style.display = this.busy ? "block" : "none";
};


})();