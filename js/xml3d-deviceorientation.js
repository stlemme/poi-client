
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


		var deviceQuat = new THREE.Quaternion();

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

			var finalQuaternion = new THREE.Quaternion();
			var deviceEuler = new THREE.Euler();
			var screenTransform = new THREE.Quaternion();
			var worldTransform = new THREE.Quaternion( - Math.sqrt(0.5), 0, 0, Math.sqrt(0.5) ); // - PI/2 around the x-axis
			var minusHalfAngle = 0;

			return function ( alpha, beta, gamma, screenOrientation ) {
				deviceEuler.set( beta, alpha, - gamma, 'YXZ' );
				finalQuaternion.setFromEuler( deviceEuler );
				minusHalfAngle = - screenOrientation / 2;
				screenTransform.set( 0, Math.sin( minusHalfAngle ), 0, Math.cos( minusHalfAngle ) );
				finalQuaternion.multiply( screenTransform );
				finalQuaternion.multiply( worldTransform );
				return finalQuaternion;
			}

		}();

		this.updateDeviceMove = function () {

			var alpha, beta, gamma, orient;

			return function () {
				alpha  = THREE.Math.degToRad( this.deviceOrientation.alpha || 0 ); // Z
				beta   = THREE.Math.degToRad( this.deviceOrientation.beta  || 0 ); // X'
				gamma  = THREE.Math.degToRad( this.deviceOrientation.gamma || 0 ); // Y''
				orient = THREE.Math.degToRad( this.screenOrientation       || 0 ); // O

				// only process non-zero 3-axis data
				if ( alpha === 0 || beta === 0 || gamma === 0)
					return;

				deviceQuat = createQuaternion( alpha, beta, gamma, orient );
				console.log(deviceQuat);
				this.view.orientation.setQuaternion(new XML3DVec3(deviceQuat.x, deviceQuat.y, deviceQuat.z), deviceQuat.w);
				//console.log(this.view.orientation);
			};

		}();

		this.connect = function () {
			window.addEventListener( 'orientationchange', this.onScreenOrientationChange, false );
			window.addEventListener( 'deviceorientation', this.onDeviceOrientationChange, false );

			//window.addEventListener( 'compassneedscalibration', this.onCompassNeedsCalibration, false );
		};

	};
		
})();
