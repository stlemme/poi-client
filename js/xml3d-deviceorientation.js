
var XML3D = XML3D || {};
	
(function() {

	XML3D.DeviceOrientationController = function ( view ) {

		this.view = view || null;

		this.deviceOrientation = {};
		this.screenOrientation = window.orientation || 0;

		var CONTROLLER_EVENT = {
			CALIBRATE_COMPASS:  'compassneedscalibration',
			SCREEN_ORIENTATION: 'orientationchange'
		};

		// TODO: figure out device dependent issues
		var deviceQuat; // = XML3D.math.quat.create();

		var fireEvent = function () {
			var eventData;

			return function ( name ) {
				eventData = arguments || {};

				eventData.type = name;
				eventData.target = this;

				this.dispatchEvent( eventData );
			}.bind( this );
		}.bind( this )();

		this.onDeviceOrientationChange = function ( event ) {
			this.deviceOrientation = event;
			this.updateDeviceMove();
		}.bind( this );

		this.onScreenOrientationChange = function () {
			this.screenOrientation = window.orientation || 0;
			fireEvent( CONTROLLER_EVENT.SCREEN_ORIENTATION );
		}.bind( this );

		this.onCompassNeedsCalibration = function ( event ) {
			event.preventDefault();
			fireEvent( CONTROLLER_EVENT.CALIBRATE_COMPASS );
		}.bind( this );

		var createQuaternion = function () {

			var finalQuaternion = XML3D.math.quat.create();
			var screenTransform = XML3D.math.quat.create();
			var worldTransform = XML3D.math.quat.fromValues( - Math.sqrt(0.5), 0, 0, Math.sqrt(0.5) ); // - PI/2 around the x-axis
			var minusHalfAngle = 0;

			return function ( alpha, beta, gamma, screenOrientation ) {
				XML3D.math.quat.identity(finalQuaternion);
				XML3D.math.quat.rotateY(finalQuaternion, finalQuaternion, alpha);
				XML3D.math.quat.rotateX(finalQuaternion, finalQuaternion, beta);
				XML3D.math.quat.rotateZ(finalQuaternion, finalQuaternion, -gamma);
				minusHalfAngle = - screenOrientation / 2;
				XML3D.math.quat.set(screenTransform, 0, Math.sin( minusHalfAngle ), 0, Math.cos( minusHalfAngle ) );
				XML3D.math.quat.multiply(finalQuaternion, finalQuaternion, screenTransform);
				XML3D.math.quat.multiply(finalQuaternion, finalQuaternion, worldTransform);
				return finalQuaternion;
			}

		}();
		
		var deg2rad = function () {
			var a = Math.PI/180;
			return function(b) {
				return b*a
			}
		}();

		this.updateDeviceMove = function () {

			var alpha, beta, gamma, orient;

			return function () {
				alpha  = deg2rad( this.deviceOrientation.alpha || 0 ); // Z
				beta   = deg2rad( this.deviceOrientation.beta  || 0 ); // X'
				gamma  = deg2rad( this.deviceOrientation.gamma || 0 ); // Y''
				orient = deg2rad( this.screenOrientation       || 0 ); // O

				// only process non-zero 3-axis data
				if ( alpha === 0 || beta === 0 || gamma === 0)
					return;

				deviceQuat = createQuaternion( alpha, beta, gamma, orient );
				// console.log(deviceQuat);
				this.view.orientation.set(deviceQuat);
			};

		}();

		this.connect = function () {
			window.addEventListener( 'orientationchange', this.onScreenOrientationChange, false );
			window.addEventListener( 'deviceorientation', this.onDeviceOrientationChange, false );

			//window.addEventListener( 'compassneedscalibration', this.onCompassNeedsCalibration, false );
		};

	};
		
})();
