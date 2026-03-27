// OrbitControls for Three.js
THREE.OrbitControls = function ( object, domElement ) {
    this.object = object;
    this.domElement = ( domElement !== undefined ) ? domElement : document;
    this.enabled = true;
    this.target = new THREE.Vector3();
    this.minDistance = 0;
    this.maxDistance = Infinity;
    this.minZoom = 0;
    this.maxZoom = Infinity;
    this.minPolarAngle = 0;
    this.maxPolarAngle = Math.PI;
    this.minAzimuthAngle = - Infinity;
    this.maxAzimuthAngle = Infinity;
    this.enableDamping = false;
    this.dampingFactor = 0.25;
    this.enableZoom = true;
    this.zoomSpeed = 1.0;
    this.enableRotate = true;
    this.rotateSpeed = 1.0;
    this.enablePan = true;
    this.panSpeed = 1.0;
    this.screenSpacePanning = false;
    this.keyPanSpeed = 7.0;
    this.autoRotate = false;
    this.autoRotateSpeed = 2.0;
    this.enableKeys = true;
    this.keys = { LEFT: 37, UP: 38, RIGHT: 39, BOTTOM: 40 };
    this.mouseButtons = { LEFT: THREE.MOUSE.LEFT, MIDDLE: THREE.MOUSE.MIDDLE, RIGHT: THREE.MOUSE.RIGHT };

    var scope = this;
    var changeEvent = { type: 'change' };
    var startEvent = { type: 'start' };
    var endEvent = { type: 'end' };
    var STATE = { NONE: - 1, ROTATE: 0, DOLLY: 1, PAN: 2, TOUCH_ROTATE: 3, TOUCH_DOLLY_PAN: 4 };
    var state = STATE.NONE;
    var EPS = 0.000001;
    var spherical = new THREE.Spherical();
    var sphericalDelta = new THREE.Spherical();
    var scale = 1;
    var panOffset = new THREE.Vector3();
    var zoomChanged = false;
    var rotateStart = new THREE.Vector2();
    var rotateEnd = new THREE.Vector2();
    var rotateDelta = new THREE.Vector2();
    var panStart = new THREE.Vector2();
    var panEnd = new THREE.Vector2();
    var panDelta = new THREE.Vector2();
    var dollyStart = new THREE.Vector2();
    var dollyEnd = new THREE.Vector2();
    var dollyDelta = new THREE.Vector2();

    function getAutoRotationAngle() {
        return 2 * Math.PI / 60 / 60 * scope.autoRotateSpeed;
    }

    function getZoomScale() {
        return Math.pow( 0.95, scope.zoomSpeed );
    }

    function rotateLeft( angle ) {
        sphericalDelta.theta -= angle;
    }

    function rotateUp( angle ) {
        sphericalDelta.phi -= angle;
    }

    var panLeft = function () {
        var v = new THREE.Vector3();
        return function panLeft( distance, objectMatrix ) {
            v.setFromMatrixColumn( objectMatrix, 0 );
            v.multiplyScalar( - distance );
            panOffset.add( v );
        };
    }();

    var panUp = function () {
        var v = new THREE.Vector3();
        return function panUp( distance, objectMatrix ) {
            if ( scope.screenSpacePanning === true ) {
                v.setFromMatrixColumn( objectMatrix, 1 );
            } else {
                v.setFromMatrixColumn( objectMatrix, 0 );
                v.crossVectors( scope.object.up, v );
            }
            v.multiplyScalar( distance );
            panOffset.add( v );
        };
    }();

    var pan = function () {
        var offset = new THREE.Vector3();
        return function pan( deltaX, deltaY ) {
            var element = scope.domElement === document ? scope.domElement.body : scope.domElement;
            if ( scope.object.isPerspectiveCamera ) {
                var position = scope.object.position;
                offset.copy( position ).sub( scope.target );
                var targetDistance = offset.length();
                targetDistance *= Math.tan( ( scope.object.fov / 2 ) * Math.PI / 180.0 );
                panLeft( 2 * deltaX * targetDistance / element.clientHeight, scope.object.matrix );
                panUp( 2 * deltaY * targetDistance / element.clientHeight, scope.object.matrix );
            } else if ( scope.object.isOrthographicCamera ) {
                panLeft( deltaX * ( scope.object.right - scope.object.left ) / scope.object.zoom / element.clientWidth, scope.object.matrix );
                panUp( deltaY * ( scope.object.top - scope.object.bottom ) / scope.object.zoom / element.clientHeight, scope.object.matrix );
            } else {
                console.warn( 'WARNING: OrbitControls.js encountered an unknown camera type - pan disabled.' );
                scope.enablePan = false;
            }
        };
    }();

    function dollyIn( dollyScale ) {
        if ( scope.object.isPerspectiveCamera ) {
            scale /= dollyScale;
        } else if ( scope.object.isOrthographicCamera ) {
            scope.object.zoom = Math.max( scope.minZoom, Math.min( scope.maxZoom, scope.object.zoom * dollyScale ) );
            scope.object.updateProjectionMatrix();
            zoomChanged = true;
        } else {
            console.warn( 'WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.' );
            scope.enableZoom = false;
        }
    }

    function dollyOut( dollyScale ) {
        if ( scope.object.isPerspectiveCamera ) {
            scale *= dollyScale;
        } else if ( scope.object.isOrthographicCamera ) {
            scope.object.zoom = Math.max( scope.minZoom, Math.min( scope.maxZoom, scope.object.zoom / dollyScale ) );
            scope.object.updateProjectionMatrix();
            zoomChanged = true;
        } else {
            console.warn( 'WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.' );
            scope.enableZoom = false;
        }
    }

    function handleMouseDownRotate( event ) {
        rotateStart.set( event.clientX, event.clientY );
    }

    function handleMouseDownDolly( event ) {
        dollyStart.set( event.clientX, event.clientY );
    }

    function handleMouseDownPan( event ) {
        panStart.set( event.clientX, event.clientY );
    }

    function handleMouseMoveRotate( event ) {
        rotateEnd.set( event.clientX, event.clientY );
        rotateDelta.subVectors( rotateEnd, rotateStart ).multiplyScalar( scope.rotateSpeed );
        var element = scope.domElement === document ? scope.domElement.body : scope.domElement;
        rotateLeft( 2 * Math.PI * rotateDelta.x / element.clientHeight );
        rotateUp( 2 * Math.PI * rotateDelta.y / element.clientHeight );
        rotateStart.copy( rotateEnd );
        scope.update();
    }

    function handleMouseMoveDolly( event ) {
        dollyEnd.set( event.clientX, event.clientY );
        dollyDelta.subVectors( dollyEnd, dollyStart );
        if ( dollyDelta.y > 0 ) {
            dollyIn( getZoomScale() );
        } else if ( dollyDelta.y < 0 ) {
            dollyOut( getZoomScale() );
        }
        dollyStart.copy( dollyEnd );
        scope.update();
    }

    function handleMouseMovePan( event ) {
        panEnd.set( event.clientX, event.clientY );
        panDelta.subVectors( panEnd, panStart ).multiplyScalar( scope.panSpeed );
        pan( panDelta.x, panDelta.y );
        panStart.copy( panEnd );
        scope.update();
    }

    function handleMouseWheel( event ) {
        if ( event.deltaY < 0 ) {
            dollyOut( getZoomScale() );
        } else if ( event.deltaY > 0 ) {
            dollyIn( getZoomScale() );
        }
        scope.update();
    }

    function onMouseDown( event ) {
        if ( scope.enabled === false ) return;
        event.preventDefault();
        switch ( event.button ) {
            case scope.mouseButtons.LEFT:
                if ( event.ctrlKey || event.metaKey || event.shiftKey ) {
                    if ( scope.enablePan === false ) return;
                    handleMouseDownPan( event );
                    state = STATE.PAN;
                } else {
                    if ( scope.enableRotate === false ) return;
                    handleMouseDownRotate( event );
                    state = STATE.ROTATE;
                }
                break;
            case scope.mouseButtons.MIDDLE:
                if ( scope.enableZoom === false ) return;
                handleMouseDownDolly( event );
                state = STATE.DOLLY;
                break;
            case scope.mouseButtons.RIGHT:
                if ( scope.enablePan === false ) return;
                handleMouseDownPan( event );
                state = STATE.PAN;
                break;
        }
        if ( state !== STATE.NONE ) {
            document.addEventListener( 'mousemove', onMouseMove, false );
            document.addEventListener( 'mouseup', onMouseUp, false );
            scope.dispatchEvent( startEvent );
        }
    }

    function onMouseMove( event ) {
        if ( scope.enabled === false ) return;
        event.preventDefault();
        switch ( state ) {
            case STATE.ROTATE:
                if ( scope.enableRotate === false ) return;
                handleMouseMoveRotate( event );
                break;
            case STATE.DOLLY:
                if ( scope.enableZoom === false ) return;
                handleMouseMoveDolly( event );
                break;
            case STATE.PAN:
                if ( scope.enablePan === false ) return;
                handleMouseMovePan( event );
                break;
        }
    }

    function onMouseUp( event ) {
        if ( scope.enabled === false ) return;
        document.removeEventListener( 'mousemove', onMouseMove, false );
        document.removeEventListener( 'mouseup', onMouseUp, false );
        scope.dispatchEvent( endEvent );
        state = STATE.NONE;
    }

    function onMouseWheel( event ) {
        if ( scope.enabled === false || scope.enableZoom === false || ( state !== STATE.NONE && state !== STATE.ROTATE ) ) return;
        event.preventDefault();
        event.stopPropagation();
        scope.dispatchEvent( startEvent );
        handleMouseWheel( event );
        scope.dispatchEvent( endEvent );
    }

    this.update = function () {
        var offset = new THREE.Vector3();
        var quat = new THREE.Quaternion().setFromUnitVectors( object.up, new THREE.Vector3( 0, 1, 0 ) );
        var quatInverse = quat.clone().inverse();
        var lastPosition = new THREE.Vector3();
        var lastQuaternion = new THREE.Quaternion();
        return function update() {
            var position = scope.object.position;
            offset.copy( position ).sub( scope.target );
            offset.applyQuaternion( quat );
            spherical.setFromVector3( offset );
            if ( scope.autoRotate && state === STATE.NONE ) {
                rotateLeft( getAutoRotationAngle() );
            }
            spherical.theta += sphericalDelta.theta;
            spherical.phi += sphericalDelta.phi;
            spherical.theta = Math.max( scope.minAzimuthAngle, Math.min( scope.maxAzimuthAngle, spherical.theta ) );
            spherical.phi = Math.max( scope.minPolarAngle, Math.min( scope.maxPolarAngle, spherical.phi ) );
            spherical.makeSafe();
            spherical.radius *= scale;
            spherical.radius = Math.max( scope.minDistance, Math.min( scope.maxDistance, spherical.radius ) );
            scope.target.add( panOffset );
            offset.setFromSpherical( spherical );
            offset.applyQuaternion( quatInverse );
            position.copy( scope.target ).add( offset );
            scope.object.lookAt( scope.target );
            if ( scope.enableDamping === true ) {
                sphericalDelta.theta *= ( 1 - scope.dampingFactor );
                sphericalDelta.phi *= ( 1 - scope.dampingFactor );
                panOffset.multiplyScalar( 1 - scope.dampingFactor );
            } else {
                sphericalDelta.set( 0, 0, 0 );
                panOffset.set( 0, 0, 0 );
            }
            scale = 1;
            if ( zoomChanged ||
                 lastPosition.distanceToSquared( scope.object.position ) > EPS ||
                 8 * ( 1 - lastQuaternion.dot( scope.object.quaternion ) ) > EPS ) {
                scope.dispatchEvent( changeEvent );
                lastPosition.copy( scope.object.position );
                lastQuaternion.copy( scope.object.quaternion );
                zoomChanged = false;
                return true;
            }
            return false;
        };
    }();

    this.dispose = function () {
        scope.domElement.removeEventListener( 'contextmenu', onContextMenu, false );
        scope.domElement.removeEventListener( 'mousedown', onMouseDown, false );
        scope.domElement.removeEventListener( 'wheel', onMouseWheel, false );
        document.removeEventListener( 'mousemove', onMouseMove, false );
        document.removeEventListener( 'mouseup', onMouseUp, false );
    };

    scope.domElement.addEventListener( 'contextmenu', onContextMenu, false );
    scope.domElement.addEventListener( 'mousedown', onMouseDown, false );
    scope.domElement.addEventListener( 'wheel', onMouseWheel, false );

    function onContextMenu( event ) {
        if ( scope.enabled === false ) return;
        event.preventDefault();
    }

    this.update();
};

THREE.OrbitControls.prototype = Object.create( THREE.EventDispatcher.prototype );
THREE.OrbitControls.prototype.constructor = THREE.OrbitControls;