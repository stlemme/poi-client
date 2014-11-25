
var XML3D = XML3D || {};
	
(function() {

XML3D.animators = Array();

XML3D.Animator = function() {
	this.anims = Array();
	
	XML3D.animators.push(this);
};

XML3D.Animator.prototype.animloop = function (delta) {
	this.anims.forEach (function (anim) {
		anim.animate(delta);
	});
};

XML3D.Animator.prototype.registerAnimation = function (anim) {
	this.anims.push(anim);
};


var lastTime = new Date().getTime();

(XML3D.animloop = function () {
	var t = new Date().getTime();
	var delta = (t - lastTime) / 1000;
	lastTime = t;
	window.requestAnimationFrame(XML3D.animloop);
	// console.log(delta);
	XML3D.animators.forEach (function (anim) {
		anim.animloop(delta);
	});
})();


})();