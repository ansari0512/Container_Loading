// 3D Visualizer using Three.js

class ContainerVisualizer {
    constructor(containerId) {
        this.containerId = containerId;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.currentStep = 0;
        this.solution = null;
        this.stepColors = ['#ff0000', '#00aa00', '#0066ff', '#ff8800', '#aa00aa', '#00aaaa'];
        this.isPlaying = false;
        this.animationSpeed = 1000; // ms

        // Geometry/material caches to reduce allocations for many bales/boxes
        this._geomCache = {
            box: new Map(),
            bale: new Map()
        };
        this._matCache = new Map();

        this.init();
    }

    init() {
        const container = document.getElementById(this.containerId);
        if (!container) {
            console.error('Canvas container not found');
            return;
        }

        console.log('THREE.OrbitControls available:', typeof THREE.OrbitControls);

        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf8f9fa);

        // Camera
        const width = container.clientWidth || 800;
        const height = container.clientHeight || 600;
        this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 10000);
        this.camera.position.set(500, 500, 500);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        container.appendChild(this.renderer.domElement);

        // Controls
        if (typeof THREE.OrbitControls !== 'undefined') {
            this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.1;
            this.controls.enableZoom = true;
            this.controls.enableRotate = true;
            this.controls.enablePan = false;
            this.controls.rotateSpeed = 0.3;
            this.controls.zoomSpeed = 0.5;
            // Limit vertical rotation
            this.controls.minPolarAngle = 0; // Top view
            this.controls.maxPolarAngle = Math.PI / 2; // Side view only
            console.log('OrbitControls initialized successfully');
        } else {
            console.error('Failed to initialize OrbitControls');
        }
        
        this.camera.lookAt(0, 0, 0);

        // Lighting
        const ambientLight = new THREE.AmbientLight(0x404040, 0.8);
        this.scene.add(ambientLight);

        const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.6);
        directionalLight1.position.set(1000, 1000, 1000);
        this.scene.add(directionalLight1);
        
        const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.6);
        directionalLight2.position.set(-1000, 1000, -1000);
        this.scene.add(directionalLight2);
        
        const directionalLight3 = new THREE.DirectionalLight(0xffffff, 0.4);
        directionalLight3.position.set(0, -1000, 0);
        this.scene.add(directionalLight3);

        // Axes
        this.addAxes();

        // Animation loop
        this.animate();

        // Handle resize
        window.addEventListener('resize', () => this.onWindowResize());
        
        // Initial resize to fit container
        setTimeout(() => this.onWindowResize(), 100);
    }

    addAxes() {
        const axesHelper = new THREE.AxesHelper(200);
        this.scene.add(axesHelper);

        // Add axis labels
        this.addAxisLabel('X', 220, 0, 0, '#ff0000');
        this.addAxisLabel('Y', 0, 220, 0, '#00ff00');
        this.addAxisLabel('Z', 0, 0, 220, '#0000ff');
    }

    addDimensionLabels(L, W, H) {
        // Length arrow and label (X-axis) - RED
        this.addDimensionArrow([0, -20, -20], [L, -20, -20], `Length: ${L}cm`, 0xff0000);
        
        // Width arrow and label (Z-axis) - BLUE  
        this.addDimensionArrow([-20, -20, 0], [-20, -20, W], `Width: ${W}cm`, 0x0000ff);
        
        // Height arrow and label (Y-axis) - GREEN
        this.addDimensionArrow([-20, 0, -20], [-20, H, -20], `Height: ${H}cm`, 0x00ff00);
    }

    addDimensionArrow(start, end, text, color) {
        const [sx, sy, sz] = start;
        const [ex, ey, ez] = end;
        
        // Create arrow line
        const points = [];
        points.push(new THREE.Vector3(sx, sy, sz));
        points.push(new THREE.Vector3(ex, ey, ez));
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color: color, linewidth: 4 });
        const line = new THREE.Line(geometry, material);
        line.userData = { type: 'container' };
        this.scene.add(line);
        
        // Add arrowhead at end
        const direction = new THREE.Vector3(ex - sx, ey - sy, ez - sz).normalize();
        const arrowLength = 15;
        const arrowGeometry = new THREE.ConeGeometry(5, arrowLength, 8);
        const arrowMaterial = new THREE.MeshBasicMaterial({ color: color });
        const arrowHead = new THREE.Mesh(arrowGeometry, arrowMaterial);
        
        // Position and orient arrowhead
        arrowHead.position.set(ex, ey, ez);
        if (direction.x !== 0) {
            arrowHead.rotation.z = -Math.PI / 2;
            arrowHead.position.x += arrowLength / 2;
        } else if (direction.y !== 0) {
            arrowHead.position.y += arrowLength / 2;
        } else if (direction.z !== 0) {
            arrowHead.rotation.x = Math.PI / 2;
            arrowHead.position.z += arrowLength / 2;
        }
        
        arrowHead.userData = { type: 'container' };
        this.scene.add(arrowHead);
        
        // Add label at midpoint
        const midX = (sx + ex) / 2;
        const midY = (sy + ey) / 2;
        const midZ = (sz + ez) / 2;
        
        this.addLabel(text, midX, midY, midZ, color, direction);
    }

    addLabel(text, x, y, z, color, direction) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 300;
        canvas.height = 50;
        context.font = 'Bold 22px Arial';
        context.fillStyle = 'rgba(0,0,0,0.9)';
        context.fillRect(0, 0, 300, 50);
        context.fillStyle = 'white';
        context.textAlign = 'center';
        context.fillText(text, 150, 32);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.position.set(x, y, z);
        sprite.scale.set(150, 25, 1);
        
        // Rotate label to match arrow direction exactly like in images
        if (direction) {
            if (Math.abs(direction.x) > 0.5) {
                // X-axis (Length) - diagonal text along arrow
                sprite.rotation.z = Math.atan2(direction.y, direction.x);
            } else if (Math.abs(direction.y) > 0.5) {
                // Y-axis (Height) - vertical text along arrow  
                sprite.rotation.z = Math.PI / 2;
            } else if (Math.abs(direction.z) > 0.5) {
                // Z-axis (Width) - diagonal text along arrow
                sprite.rotation.z = Math.atan2(direction.y, direction.z);
            }
        }
        
        sprite.userData = { type: 'container' };
        this.scene.add(sprite);
    }

    addAxisLabel(text, x, y, z, color) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        context.font = 'Bold 12px Arial';
        context.fillStyle = 'rgba(255,255,255,0.8)';
        context.fillRect(0, 0, 20, 20);
        context.fillStyle = color;
        context.textAlign = 'center';
        context.fillText(text, 10, 15);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.position.set(x, y, z);
        sprite.scale.set(20, 20, 1);
        this.scene.add(sprite);
    }

    addDimensionArrows(L, W, H) {
        // FIXED COORDINATE MAPPING
        // Length arrow (X-axis) - RED
        this.addArrowWithLabel([0, -20, -20], [L, -20, -20], `Length: ${L} cm`, 0xff0000, 'length');

        // Height arrow (Y-axis) - GREEN  
        this.addArrowWithLabel([-20, 0, -20], [-20, H, -20], `Height: ${H} cm`, 0x00ff00, 'vertical');

        // Width arrow (Z-axis) - BLUE
        this.addArrowWithLabel([-20, -20, 0], [-20, -20, W], `Width: ${W} cm`, 0x0000ff, 'width');
    }

    addArrowOnly(start, end, color) {
        const [sx, sy, sz] = start;
        const [ex, ey, ez] = end;
        
        // Create arrow line
        const points = [];
        points.push(new THREE.Vector3(sx, sy, sz));
        points.push(new THREE.Vector3(ex, ey, ez));
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color: color, linewidth: 4 });
        const line = new THREE.Line(geometry, material);
        line.userData = { type: 'container' };
        this.scene.add(line);
        
        // Add arrowhead at end
        const direction = new THREE.Vector3(ex - sx, ey - sy, ez - sz).normalize();
        const arrowLength = 15;
        const arrowGeometry = new THREE.ConeGeometry(5, arrowLength, 8);
        const arrowMaterial = new THREE.MeshBasicMaterial({ color: color });
        const arrowHead = new THREE.Mesh(arrowGeometry, arrowMaterial);
        
        // Position and orient arrowhead
        arrowHead.position.set(ex, ey, ez);
        if (direction.x !== 0) {
            arrowHead.rotation.z = -Math.PI / 2;
            arrowHead.position.x += arrowLength / 2;
        } else if (direction.y !== 0) {
            arrowHead.position.y += arrowLength / 2;
        } else if (direction.z !== 0) {
            arrowHead.rotation.x = Math.PI / 2;
            arrowHead.position.z += arrowLength / 2;
        }
        
        arrowHead.userData = { type: 'container' };
        this.scene.add(arrowHead);
    }

    addArrowWithLabel(start, end, text, color, orientation) {
        const [sx, sy, sz] = start;
        const [ex, ey, ez] = end;
        
        // Create arrow line
        const points = [];
        points.push(new THREE.Vector3(sx, sy, sz));
        points.push(new THREE.Vector3(ex, ey, ez));
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color: color, linewidth: 4 });
        const line = new THREE.Line(geometry, material);
        line.userData = { type: 'container' };
        this.scene.add(line);
        
        // Add arrowhead at end
        const direction = new THREE.Vector3(ex - sx, ey - sy, ez - sz).normalize();
        const arrowLength = 15;
        const arrowGeometry = new THREE.ConeGeometry(5, arrowLength, 8);
        const arrowMaterial = new THREE.MeshBasicMaterial({ color: color });
        const arrowHead = new THREE.Mesh(arrowGeometry, arrowMaterial);
        
        // Position and orient arrowhead
        arrowHead.position.set(ex, ey, ez);
        if (direction.x !== 0) {
            arrowHead.rotation.z = -Math.PI / 2;
            arrowHead.position.x += arrowLength / 2;
        } else if (direction.y !== 0) {
            arrowHead.position.y += arrowLength / 2;
        } else if (direction.z !== 0) {
            arrowHead.rotation.x = Math.PI / 2;
            arrowHead.position.z += arrowLength / 2;
        }
        
        arrowHead.userData = { type: 'container' };
        this.scene.add(arrowHead);
        
        // Add label based on orientation
        const midX = (sx + ex) / 2;
        const midY = (sy + ey) / 2;
        const midZ = (sz + ez) / 2;
        
        // Offset label position to be above arrow
        let labelX = midX, labelY = midY, labelZ = midZ;
        if (orientation === 'vertical') {
            labelX -= 40; // Move left for height
        } else if (orientation === 'width') {
            labelY += 30; // Move up for width
        } else if (orientation === 'length') {
            labelZ += 30; // Move forward for length
        }
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        if (orientation === 'vertical') {
            // Vertical text for height
            canvas.width = 50;
            canvas.height = 300;
            context.fillStyle = 'rgba(0,0,0,0.9)';
            context.fillRect(0, 0, 50, 300);
            context.fillStyle = 'white';
            context.font = 'Bold 22px Arial';
            context.textAlign = 'center';
            
            context.save();
            context.translate(25, 150);
            context.rotate(-Math.PI / 2);
            context.fillText(text, 0, 8);
            context.restore();
            
            const texture = new THREE.CanvasTexture(canvas);
            const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
            const sprite = new THREE.Sprite(spriteMaterial);
            sprite.position.set(labelX, labelY, labelZ);
            sprite.scale.set(25, 150, 1);
            sprite.userData = { type: 'container' };
            this.scene.add(sprite);
            
        } else if (orientation === 'width') {
            // Width text - horizontal like canvas
            canvas.width = 300;
            canvas.height = 50;
            context.fillStyle = 'rgba(0,0,0,0.9)';
            context.fillRect(0, 0, 300, 50);
            context.fillStyle = 'white';
            context.font = 'Bold 22px Arial';
            context.textAlign = 'center';
            
            // No rotation - text parallel to canvas
            context.fillText(text, 150, 32);
            
            const texture = new THREE.CanvasTexture(canvas);
            const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
            const sprite = new THREE.Sprite(spriteMaterial);
            sprite.position.set(labelX, labelY, labelZ);
            sprite.scale.set(150, 25, 1);
            sprite.userData = { type: 'container' };
            this.scene.add(sprite);
            
        } else if (orientation === 'length') {
            // Length text - horizontal like canvas (same as width)
            canvas.width = 300;
            canvas.height = 50;
            context.fillStyle = 'rgba(0,0,0,0.9)';
            context.fillRect(0, 0, 300, 50);
            context.fillStyle = 'white';
            context.font = 'Bold 22px Arial';
            context.textAlign = 'center';
            
            // No rotation - text parallel to canvas
            context.fillText(text, 150, 32);
            
            const texture = new THREE.CanvasTexture(canvas);
            const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
            const sprite = new THREE.Sprite(spriteMaterial);
            sprite.position.set(labelX, labelY, labelZ);
            sprite.scale.set(150, 25, 1);
            sprite.userData = { type: 'container' };
            this.scene.add(sprite);
            
        } else if (orientation === 'diagonal') {
            // Diagonal text for length and width - same method as height
            if (direction.x > 0) {
                // Length - diagonal canvas
                canvas.width = 300;
                canvas.height = 50;
                context.fillStyle = 'rgba(0,0,0,0.9)';
                context.fillRect(0, 0, 300, 50);
                context.fillStyle = 'white';
                context.font = 'Bold 22px Arial';
                context.textAlign = 'center';
                
                context.save();
                context.translate(150, 25);
                context.rotate(-Math.PI / 4); // -45 degrees
                context.fillText(text, 0, 8);
                context.restore();
                
                const texture = new THREE.CanvasTexture(canvas);
                const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
                const sprite = new THREE.Sprite(spriteMaterial);
                sprite.position.set(midX, midY, midZ);
                sprite.scale.set(150, 25, 1);
                sprite.userData = { type: 'container' };
                this.scene.add(sprite);
                
            } else if (direction.z > 0) {
                // Width - diagonal canvas
                canvas.width = 300;
                canvas.height = 50;
                context.fillStyle = 'rgba(0,0,0,0.9)';
                context.fillRect(0, 0, 300, 50);
                context.fillStyle = 'white';
                context.font = 'Bold 22px Arial';
                context.textAlign = 'center';
                
                context.save();
                context.translate(150, 25);
                context.rotate(-Math.PI / 6); // -30 degrees
                context.fillText(text, 0, 8);
                context.restore();
                
                const texture = new THREE.CanvasTexture(canvas);
                const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
                const sprite = new THREE.Sprite(spriteMaterial);
                sprite.position.set(midX, midY, midZ);
                sprite.scale.set(150, 25, 1);
                sprite.userData = { type: 'container' };
                this.scene.add(sprite);
            }
        }
    }

    clearScene() {
        // Remove all boxes, leftovers, and container elements
        const objectsToRemove = [];
        this.scene.children.forEach(child => {
            if (child.userData && (child.userData.type === 'box' || child.userData.type === 'leftover' || child.userData.type === 'container')) {
                objectsToRemove.push(child);
            }
        });
        objectsToRemove.forEach(obj => this.scene.remove(obj));
    }

    drawContainer(dimensions) {
        const [L, W, H] = dimensions;

        // Container walls with transparency - FIXED COORDINATE MAPPING
        const geometry = new THREE.BoxGeometry(L, H, W);  // X=Length, Y=Height, Z=Width
        const material = new THREE.MeshLambertMaterial({
            color: 0xcccccc,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide
        });
        const container = new THREE.Mesh(geometry, material);
        container.position.set(L/2, H/2, W/2);  // FIXED: Y=Height, Z=Width
        container.userData = { type: 'container' };
        this.scene.add(container);

        // Container wireframe
        const edges = new THREE.EdgesGeometry(geometry);
        const lineMaterial = new THREE.LineBasicMaterial({ color: 0x999999, linewidth: 2 });
        const wireframe = new THREE.LineSegments(edges, lineMaterial);
        wireframe.position.set(L/2, H/2, W/2);  // FIXED: Y=Height, Z=Width
        wireframe.userData = { type: 'container' };
        this.scene.add(wireframe);

        // Add dimension arrows only
        this.addDimensionArrows(L, W, H);
    }

    drawBox(x, y, z, L, W, H, color, packingMethod = 'carton') {
        if (packingMethod === 'bale') {
            this.drawBale(x, y, z, L, W, H, color);
        } else {
            this.drawCarton(x, y, z, L, W, H, color);
        }
    }

    drawCarton(x, y, z, L, W, H, color) {
        // FIXED COORDINATE MAPPING: X=Length, Y=Height, Z=Width
        const geometry = new THREE.BoxGeometry(L, H, W);  // X=Length, Y=Height, Z=Width
        const material = new THREE.MeshLambertMaterial({ color: color });
        const cube = new THREE.Mesh(geometry, material);
        cube.position.set(x + L/2, z + H/2, y + W/2);  // FIXED: solver Y->visual Z, solver Z->visual Y
        cube.userData = { type: 'box' };
        this.scene.add(cube);

        // Add wireframe for individual boxes
        const edges = new THREE.EdgesGeometry(geometry);
        const lineMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1 });
        const wireframe = new THREE.LineSegments(edges, lineMaterial);
        wireframe.position.set(x + L/2, z + H/2, y + W/2);  // FIXED: solver Y->visual Z, solver Z->visual Y
        wireframe.userData = { type: 'box' };
        this.scene.add(wireframe);
    }

    drawBale(x, y, z, L, W, H, color) {
        // CONSISTENT BALE APPEARANCE - reuse geometries/materials for performance
        let cylinderLength, radius, rotationX = 0, rotationY = 0, rotationZ = 0;
        let posX, posY, posZ;

        // Always horizontal - longest dimension becomes cylinder length
        if (L >= W && L >= H) {
            cylinderLength = L;
            radius = Math.max(W, H) / 2.1;  // Slightly smaller for gap
            rotationZ = Math.PI / 2;
        } else if (W >= L && W >= H) {
            cylinderLength = W;
            radius = Math.max(L, H) / 2.1;  // Slightly smaller for gap
            rotationX = Math.PI / 2;
        } else {
            cylinderLength = H;
            radius = Math.max(L, W) / 2.1;  // Slightly smaller for gap
            rotationZ = Math.PI / 2;
        }

        posX = x + L/2;
        posY = z + H/2;
        posZ = y + W/2;

        // Use rounded keys to avoid excessive cache entries
        const geomKey = `r${Math.round(radius)}_l${Math.round(cylinderLength)}`;
        let geometry = this._geomCache.bale.get(geomKey);
        if (!geometry) {
            geometry = new THREE.CylinderGeometry(radius, radius, cylinderLength, 8, 1);
            this._geomCache.bale.set(geomKey, geometry);
        }

        let material = this._matCache.get(color);
        if (!material) {
            material = new THREE.MeshPhongMaterial({ color: color, shininess: 30, specular: 0x222222 });
            this._matCache.set(color, material);
        }

        const bale = new THREE.Mesh(geometry, material);
        bale.position.set(posX, posY, posZ);
        bale.rotation.x = rotationX;
        bale.rotation.y = rotationY;
        bale.rotation.z = rotationZ;
        bale.userData = { type: 'box' };
        this.scene.add(bale);

        // Simple wireframe using EdgesGeometry but reuse geometry
        const edges = new THREE.EdgesGeometry(geometry);
        const lineMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
        const wireframe = new THREE.LineSegments(edges, lineMaterial);
        wireframe.position.set(posX, posY, posZ);
        wireframe.rotation.x = rotationX;
        wireframe.rotation.y = rotationY;
        wireframe.rotation.z = rotationZ;
        wireframe.userData = { type: 'box' };
        this.scene.add(wireframe);

        // Add spiral pattern for more realistic bale appearance
        this.addBaleEndSpiral(posX, posY, posZ, cylinderLength, radius, rotationX, rotationY, rotationZ, color);
    }

    addBaleEndSpiral(posX, posY, posZ, cylinderLength, radius, rotationX, rotationY, rotationZ, baleColor) {
        // Create spiral pattern on bale ends like reference image
        const spiralColor = new THREE.Color(baleColor).multiplyScalar(0.9); // Lighter shade
        
        // Create spiral rings
        for (let i = 0; i < 6; i++) {
            const ringRadius = radius * (0.8 - i * 0.15);
            const ringGeometry = new THREE.TorusGeometry(ringRadius, 1, 8, 16);
            const ringMaterial = new THREE.MeshLambertMaterial({ color: spiralColor });
            
            // Left end spiral
            const leftRing = new THREE.Mesh(ringGeometry, ringMaterial);
            leftRing.position.set(posX, posY, posZ);
            leftRing.rotation.x = rotationX;
            leftRing.rotation.y = rotationY;
            leftRing.rotation.z = rotationZ;
            
            // Position at left end
            if (rotationZ === Math.PI / 2) {
                leftRing.position.x -= cylinderLength/2 - 2;
            } else if (rotationX === Math.PI / 2) {
                leftRing.position.z -= cylinderLength/2 - 2;
            }
            
            leftRing.userData = { type: 'box' };
            this.scene.add(leftRing);
            
            // Right end spiral
            const rightRing = new THREE.Mesh(ringGeometry, ringMaterial);
            rightRing.position.set(posX, posY, posZ);
            rightRing.rotation.x = rotationX;
            rightRing.rotation.y = rotationY;
            rightRing.rotation.z = rotationZ;
            
            // Position at right end
            if (rotationZ === Math.PI / 2) {
                rightRing.position.x += cylinderLength/2 - 2;
            } else if (rotationX === Math.PI / 2) {
                rightRing.position.z += cylinderLength/2 - 2;
            }
            
            rightRing.userData = { type: 'box' };
            this.scene.add(rightRing);
        }
    }

    addBaleEndCaps(posX, posY, posZ, cylinderLength, radius, rotationX, rotationY, rotationZ, color) {
        const capGeometry = new THREE.CircleGeometry(radius, 16);
        const capMaterial = new THREE.MeshPhongMaterial({
            color: new THREE.Color(color).multiplyScalar(0.8),
            side: THREE.DoubleSide
        });

        // Left end cap
        const cap1 = new THREE.Mesh(capGeometry, capMaterial);
        cap1.position.set(posX, posY, posZ);
        cap1.rotation.x = rotationX;
        cap1.rotation.y = rotationY;
        cap1.rotation.z = rotationZ;
        
        // Right end cap
        const cap2 = new THREE.Mesh(capGeometry, capMaterial);
        cap2.position.set(posX, posY, posZ);
        cap2.rotation.x = rotationX;
        cap2.rotation.y = rotationY;
        cap2.rotation.z = rotationZ;
        
        // Position caps at cylinder ends
        if (rotationZ === Math.PI / 2) {
            // Horizontal along X-axis
            cap1.position.x -= cylinderLength/2;
            cap2.position.x += cylinderLength/2;
            cap1.rotation.y += Math.PI / 2;
            cap2.rotation.y += Math.PI / 2;
        } else if (rotationX === Math.PI / 2) {
            // Horizontal along Z-axis
            cap1.position.z -= cylinderLength/2;
            cap2.position.z += cylinderLength/2;
            cap1.rotation.x += Math.PI / 2;
            cap2.rotation.x += Math.PI / 2;
        }
        
        cap1.userData = { type: 'box' };
        cap2.userData = { type: 'box' };
        this.scene.add(cap1);
        this.scene.add(cap2);
    }

    drawLeftover(x, y, z, L, W, H) {
        // Keep leftover space empty - no visualization
    }

    visualizeSolution(solution, containerDims, packingMethod = 'carton') {
        this.solution = solution;
        this.containerDims = containerDims;
        this.packingMethod = packingMethod;
        this.clearScene();
        this.drawContainer(containerDims);

        // Adjust camera for container size
        const [L, W, H] = containerDims;
        const maxDim = Math.max(L, W, H);
        this.camera.position.set(maxDim * 1.5, maxDim * 1.5, maxDim * 1.5);

        if (this.controls) {
            this.controls.target.set(L / 2, H / 2, W / 2);
            this.controls.update();
        }

        this.currentStep = 0;
        if (solution) {
            this.updateVisualization();
        }
    }

    updateVisualization() {
        if (!this.solution || !this.solution.steps || this.solution.steps.length === 0) {
            console.log('No solution or steps to visualize');
            return;
        }

        this.clearScene();
        this.drawContainer(this.containerDims);

        // Collect boxes up to current step
        const boxesToDraw = [];
        let boxIndex = 0;
        for (let step = 0; step <= this.currentStep && step < this.solution.steps.length; step++) {
            const stepData = this.solution.steps[step];
            const color = this.stepColors[step % this.stepColors.length];
            const boxesInStep = stepData.placed[0] * stepData.placed[1] * stepData.placed[2];

            for (let i = 0; i < boxesInStep && boxIndex < this.solution.placements.length; i++) {
                const [x, y, z, L, W, H] = this.solution.placements[boxIndex];
                boxesToDraw.push({ x, y, z, L, W, H, color });
                boxIndex++;
            }
        }

        // If many boxes and cartons, use InstancedMesh grouped by size for performance
        if (this.packingMethod === 'carton' && boxesToDraw.length > 300 && typeof THREE.InstancedMesh !== 'undefined') {
            const groups = new Map();
            for (const b of boxesToDraw) {
                const key = `${b.L}|${b.W}|${b.H}|${b.color}`;
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key).push(b);
            }

            for (const [key, items] of groups.entries()) {
                const parts = key.split('|');
                const L = Number(parts[0]);
                const W = Number(parts[1]);
                const H = Number(parts[2]);
                const color = parts[3];
                const geometry = new THREE.BoxGeometry(L, H, W);
                const material = new THREE.MeshLambertMaterial({ color: color });
                const inst = new THREE.InstancedMesh(geometry, material, items.length);
                inst.userData = { type: 'box' };

                const dummy = new THREE.Object3D();
                for (let i = 0; i < items.length; i++) {
                    const it = items[i];
                    // Map solver coords to visual coords as drawCarton does
                    const posX = it.x + it.L / 2;
                    const posY = it.z + it.H / 2;
                    const posZ = it.y + it.W / 2;
                    dummy.position.set(posX, posY, posZ);
                    dummy.updateMatrix();
                    inst.setMatrixAt(i, dummy.matrix);
                }

                this.scene.add(inst);
                // Also add an instanced wireframe overlay so box boundaries remain visible
                // Create a merged LineSegments overlay using EdgesGeometry so we get clean rectangular edges
                try {
                    const edgesBase = new THREE.EdgesGeometry(geometry);
                    const basePos = edgesBase.attributes.position.array;
                    const vertsPerInstance = basePos.length / 3;
                    const totalVerts = vertsPerInstance * items.length;
                    const merged = new Float32Array(totalVerts * 3);

                    let offset = 0;
                    for (let i = 0; i < items.length; i++) {
                        const it = items[i];
                        const posX = it.x + it.L / 2;
                        const posY = it.z + it.H / 2;
                        const posZ = it.y + it.W / 2;

                        for (let v = 0; v < vertsPerInstance; v++) {
                            const bx = basePos[v * 3];
                            const by = basePos[v * 3 + 1];
                            const bz = basePos[v * 3 + 2];
                            merged[offset++] = bx + posX;
                            merged[offset++] = by + posY;
                            merged[offset++] = bz + posZ;
                        }
                    }

                    const mergedGeom = new THREE.BufferGeometry();
                    mergedGeom.setAttribute('position', new THREE.BufferAttribute(merged, 3));
                    const lineMat = new THREE.LineBasicMaterial({ color: 0x000000 });
                    const lines = new THREE.LineSegments(mergedGeom, lineMat);
                    lines.userData = { type: 'box' };
                    lines.renderOrder = 999;
                    this.scene.add(lines);
                } catch (err) {
                    console.warn('Could not add merged edge overlay', err);
                }
            }
        } else {
            // Fallback: draw individually (safe path)
            for (const b of boxesToDraw) {
                this.drawBox(b.x, b.y, b.z, b.L, b.W, b.H, b.color, this.packingMethod);
            }
        }

        // Draw leftovers if showing all steps
        if (this.currentStep >= this.solution.steps.length - 1 && this.solution.leftovers) {
            for (const [x, y, z, L, W, H] of this.solution.leftovers) {
                this.drawLeftover(x, y, z, L, W, H);
            }
        }
    }

    nextStep() {
        if (!this.solution || !this.solution.steps) {
            console.log('No solution available for next step');
            return;
        }
        
        if (this.currentStep < this.solution.steps.length - 1) {
            this.currentStep++;
            console.log(`Moving to step ${this.currentStep + 1}`);
            this.updateVisualization();
        } else {
            console.log('Already at last step');
        }
    }

    prevStep() {
        if (!this.solution || !this.solution.steps) {
            console.log('No solution available for previous step');
            return;
        }
        
        if (this.currentStep >= 0) {
            this.currentStep--;
            console.log(`Moving to step ${this.currentStep + 1}`);
            this.updateVisualization();
        } else {
            console.log('Already at empty state');
        }
    }

    showAllSteps() {
        if (!this.solution || !this.solution.steps) return;
        
        this.currentStep = this.solution.steps.length - 1;
        this.updateVisualization();
    }

    reset() {
        console.log('Resetting visualization');
        this.currentStep = -1; // Reset to before first step
        this.isPlaying = false;
        if (this.solution) {
            this.updateVisualization();
        }
    }

    play() {
        if (!this.solution || !this.solution.steps) {
            console.log('No solution available for play');
            return;
        }
        
        if (this.isPlaying) {
            console.log('Already playing');
            return;
        }
        
        console.log('Starting animation');
        this.isPlaying = true;
        this.playAnimation();
    }

    playAnimation() {
        if (!this.isPlaying || !this.solution || !this.solution.steps) {
            console.log('Stopping animation - no solution or not playing');
            this.isPlaying = false;
            return;
        }

        if (this.currentStep >= this.solution.steps.length - 1) {
            console.log('Animation complete');
            this.isPlaying = false;
            return;
        }

        this.nextStep();
        setTimeout(() => this.playAnimation(), this.animationSpeed);
    }

    stop() {
        this.isPlaying = false;
    }

    setView(viewType) {
        if (!this.containerDims || !this.controls) return;

        const [L, W, H] = this.containerDims;
        const distance = Math.max(L, W, H) * 1.5;

        switch(viewType) {
            case 'top':
                this.camera.position.set(L/2, distance, H/2);
                break;
            case 'back':
                this.camera.position.set(distance, W/2, H/2);
                break;
            case 'left':
                this.camera.position.set(L/2, W/2, distance);
                break;
            case 'right':
                this.camera.position.set(L/2, W/2, -distance/2);
                break;
        }

        this.controls.target.set(L/2, W/2, H/2);
        this.controls.update();
    }

    addBoxDimensionLabels(x, y, z, L, W, H, stepNumber) {
        // Step label on top of box
        this.addBoxLabel(`Step ${stepNumber}`, x + L/2, y + W/2, z + H + 20, 0x000000);
        
        // Length label on box face
        this.addBoxLabel(`L: ${L}cm`, x + L/2, y - 15, z + H/2, 0xff0000);
        
        // Width label on box face
        this.addBoxLabel(`W: ${W}cm`, x - 15, y + W/2, z + H/2, 0x0000ff);
        
        // Height label on box face
        this.addBoxLabel(`H: ${H}cm`, x + L/2, y + W/2, z + H + 40, 0x00ff00);
    }

    addBoxArrow(start, end, text, color) {
        const [sx, sy, sz] = start;
        const [ex, ey, ez] = end;
        
        // Create arrow line
        const points = [];
        points.push(new THREE.Vector3(sx, sy, sz));
        points.push(new THREE.Vector3(ex, ey, ez));
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color: color, linewidth: 2 });
        const line = new THREE.Line(geometry, material);
        line.userData = { type: 'box' };
        this.scene.add(line);
        
        // Add arrowhead
        const direction = new THREE.Vector3(ex - sx, ey - sy, ez - sz).normalize();
        const arrowLength = 8;
        const arrowGeometry = new THREE.ConeGeometry(3, arrowLength, 6);
        const arrowMaterial = new THREE.MeshBasicMaterial({ color: color });
        const arrowHead = new THREE.Mesh(arrowGeometry, arrowMaterial);
        
        arrowHead.position.set(ex, ey, ez);
        if (direction.x !== 0) {
            arrowHead.rotation.z = -Math.PI / 2;
            arrowHead.position.x += arrowLength / 2;
        } else if (direction.y !== 0) {
            arrowHead.position.y += arrowLength / 2;
        } else if (direction.z !== 0) {
            arrowHead.rotation.x = Math.PI / 2;
            arrowHead.position.z += arrowLength / 2;
        }
        
        arrowHead.userData = { type: 'box' };
        this.scene.add(arrowHead);
        
        // Add label
        const midX = (sx + ex) / 2;
        const midY = (sy + ey) / 2;
        const midZ = (sz + ez) / 2;
        this.addBoxLabel(text, midX + 15, midY + 15, midZ + 15, color);
    }



    animate() {
        requestAnimationFrame(() => this.animate());
        if (this.controls) {
            this.controls.update();
        }
        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        const container = document.getElementById(this.containerId);
        if (!container) return;
        
        const width = container.clientWidth;
        const height = container.clientHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }
}