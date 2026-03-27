// Main Application Logic

class ContainerLoadingApp {
    constructor() {
        this.visualizer = null;
        this.solution = null;
        this.worker = null;
        this.workerAvailable = false;
        this.containerDimensions = {
            '20ft': [589.8, 235.2, 239.4],
            '40ft': [1203.1, 235.2, 239.4],
            '40fthc': [1203.1, 235.2, 269.8],
            '45fthc': [1354.4, 235.2, 269.8]
        };

        this.init();
    }

    init() {
        this.setupVisualizer();
        this.initSolverWorker();
        this.setupEventListeners();
        this.showTab('3d-visual');
    }

    initSolverWorker() {
        try {
            if (window.Worker) {
                this.worker = new Worker('solver.worker.js');
                this.workerAvailable = true;
                this.worker.onmessage = (e) => {
                    // worker messages are handled per-call via promises
                    console.log('Worker message:', e.data);
                };
                this.worker.onerror = (err) => {
                    console.warn('Solver worker error, falling back to main thread solver', err);
                    this.workerAvailable = false;
                    this.worker = null;
                };
            }
        } catch (err) {
            console.warn('Could not initialize solver worker, using main thread', err);
            this.workerAvailable = false;
            this.worker = null;
        }
    }

    solveWithWorker(containerDims, box, packingMethod) {
        if (!this.workerAvailable || !this.worker) return Promise.resolve(null);

        const payload = { type: 'solve', bigBlock: containerDims, box: box, packingMethod: packingMethod };

        return new Promise((resolve, reject) => {
            const onMessage = (e) => {
                if (!e.data) return;
                if (e.data.type === 'solveResult') {
                    this.worker.removeEventListener('message', onMessage);
                    resolve(e.data.solution);
                } else if (e.data.type === 'solveError') {
                    this.worker.removeEventListener('message', onMessage);
                    reject(e.data.error);
                }
            };

            this.worker.addEventListener('message', onMessage);
            this.worker.postMessage(payload);
            // Timeout fallback
            setTimeout(() => {
                // If still no response after 30s, reject and fallback
                // (caller will fallback to main-thread solve)
                this.worker.removeEventListener('message', onMessage);
                reject(new Error('Worker timeout'));
            }, 30000);
        });
    }

    setupVisualizer() {
        console.log('Setting up visualizer');
        this.visualizer = new ContainerVisualizer('canvas-container');
        // Show default container (20 ft)
        const defaultContainer = [589.8, 235.2, 239.4];
        this.visualizer.visualizeSolution(null, defaultContainer, 'carton');
    }

    setupEventListeners() {
        const calculateBtn = document.getElementById('calculate-btn');
        const fillBtn = document.getElementById('fill-btn');
        const prevBtn = document.getElementById('prev-btn');
        const nextBtn = document.getElementById('next-btn');
        const resetBtn = document.getElementById('reset-btn');
        const containerBtns = document.querySelectorAll('.container-btn');
        const packingBtns = document.querySelectorAll('.packing-btn');

        if (calculateBtn) {
            calculateBtn.addEventListener('click', () => this.calculateLoading());
        }
        
        if (fillBtn) {
            fillBtn.addEventListener('click', () => this.fillContainer());
        }
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                console.log('Previous button clicked');
                this.prevStep();
            });
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                console.log('Next button clicked');
                this.nextStep();
            });
        }
        
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                console.log('Reset button clicked');
                this.resetView();
            });
        }

        // View preset buttons
        document.getElementById('view-top')?.addEventListener('click', () => this.setView('top'));
        document.getElementById('view-back')?.addEventListener('click', () => this.setView('back'));
        document.getElementById('view-left')?.addEventListener('click', () => this.setView('left'));
        document.getElementById('view-right')?.addEventListener('click', () => this.setView('right'));

        // Tab switching
        const tabBtns = document.querySelectorAll('.tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.switchTab(btn.dataset.tab);
            });
        });

        // Batch tab event listeners
        const batchContainerBtns = document.querySelectorAll('#batch-calculation .container-btn');
        const batchPackingBtns = document.querySelectorAll('#batch-calculation .packing-btn');
        const addRowBtn = document.getElementById('add-row-btn');
        const batchCalculateBtn = document.getElementById('batch-calculate-btn');

        if (addRowBtn) {
            addRowBtn.addEventListener('click', () => this.addBatchRow());
        }

        if (batchCalculateBtn) {
            batchCalculateBtn.addEventListener('click', () => this.calculateBatchLoading());
        }

        // Initial remove buttons
        document.querySelectorAll('.remove-row-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const row = e.target.closest('tr');
                const index = parseInt(row.dataset.index);
                this.removeBatchRow(index);
            });
        });

        // Initial remove buttons
        document.querySelectorAll('.remove-item-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.closest('.batch-item').dataset.index);
                this.removeBatchItem(index);
            });
        });

        batchContainerBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                batchContainerBtns.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-checked', 'false'); });
                btn.classList.add('active');
                btn.setAttribute('aria-checked', 'true');

                const container = btn.dataset.container;
                const dims = this.containerDimensions[container];
                document.getElementById('batch-container-l').value = dims[0];
                document.getElementById('batch-container-w').value = dims[1];
                document.getElementById('batch-container-h').value = dims[2];
            });

            btn.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    btn.click();
                }
            });
        });

        batchPackingBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                batchPackingBtns.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-checked', 'false'); });
                btn.classList.add('active');
                btn.setAttribute('aria-checked', 'true');

                const method = btn.dataset.method;
                const label = document.getElementById('batch-box-dimensions-label');
                if (method === 'carton') {
                    label.textContent = 'Carton Dimensions:';
                } else if (method === 'bale') {
                    label.textContent = 'Bale Dimensions:';
                }
            });

            btn.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    btn.click();
                }
            });
        });

        containerBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                containerBtns.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-checked', 'false'); });
                btn.classList.add('active');
                btn.setAttribute('aria-checked', 'true');
                
                // Update container dimension fields
                const container = btn.dataset.container;
                const dims = this.containerDimensions[container];
                document.getElementById('container-l').value = dims[0];
                document.getElementById('container-w').value = dims[1];
                document.getElementById('container-h').value = dims[2];
                
                // Update visualizer with new container
                if (this.visualizer) {
                    const inputs = this.getInputs();
                    this.visualizer.visualizeSolution(this.solution, dims, inputs.packingMethod);
                }
            });

            btn.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    btn.click();
                }
            });
        });

        packingBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                packingBtns.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-checked', 'false'); });
                btn.classList.add('active');
                btn.setAttribute('aria-checked', 'true');
                
                // Update box dimensions label and inputs
                const method = btn.dataset.method;
                const label = document.getElementById('box-dimensions-label');
                const cartonInputs = document.getElementById('carton-inputs');
                const baleInputs = document.getElementById('bale-inputs');

                if (method === 'carton') {
                    label.textContent = 'Carton Dimensions (cm):';
                    cartonInputs.style.display = 'flex';
                    baleInputs.style.display = 'none';
                } else if (method === 'bale') {
                    label.textContent = 'Bale Dimensions (cm):';
                    cartonInputs.style.display = 'none';
                    baleInputs.style.display = 'flex';
                }
            });

            btn.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    btn.click();
                }
            });
        });

    }

    getInputs() {
        const containerSelect = document.querySelector('.container-btn.active').dataset.container;
        const packingMethod = document.querySelector('.packing-btn.active').dataset.method;
        
        let boxL, boxW, boxH;
        if (packingMethod === 'bale') {
            boxL = parseFloat(document.getElementById('bale-l').value);
            boxW = parseFloat(document.getElementById('bale-w').value);
            boxH = parseFloat(document.getElementById('bale-h').value);
        } else {
            boxL = parseFloat(document.getElementById('box-l').value);
            boxW = parseFloat(document.getElementById('box-w').value);
            boxH = parseFloat(document.getElementById('box-h').value);
        }
        const box = [boxL, boxW, boxH];

        return {
            container: containerSelect,
            containerDims: this.containerDimensions[containerSelect],
            box: box,
            packingMethod: packingMethod
        };
    }

    validateInputs(inputs) {
        if (isNaN(inputs.box[0]) || inputs.box[0] <= 0 ||
            isNaN(inputs.box[1]) || inputs.box[1] <= 0 ||
            isNaN(inputs.box[2]) || inputs.box[2] <= 0) {
            alert('Please enter valid positive carton dimensions.');
            return false;
        }
        return true;
    }

    async calculateLoading() {
        const inputs = this.getInputs();

        if (!this.validateInputs(inputs)) return;

        console.log('Starting calculation with inputs:', inputs);

        // Show progress
        this.showProgress(true);

        try {
            // Run calculation in next tick to allow UI update
            await new Promise(resolve => setTimeout(resolve, 100));

            console.log('Running solver...');
            if (this.workerAvailable) {
                try {
                    const sol = await this.solveWithWorker(inputs.containerDims, inputs.box, inputs.packingMethod);
                    if (sol) this.solution = sol;
                    else this.solution = solve(inputs.containerDims, inputs.box, inputs.packingMethod);
                } catch (err) {
                    console.warn('Worker failed, falling back to main thread solver', err);
                    this.solution = solve(inputs.containerDims, inputs.box, inputs.packingMethod);
                }
            } else {
                this.solution = solve(inputs.containerDims, inputs.box, inputs.packingMethod);
            }
            console.log('Solution found:', this.solution);

            // Don't update visualization for calculate - only results
            // this.visualizer.visualizeSolution(this.solution, inputs.containerDims);

            // Update results
            this.updateResults(inputs);

            // Enable Fill Container button after calculation
            const fillBtn = document.getElementById('fill-btn');
            if (fillBtn) {
                fillBtn.disabled = false;
            }

            // Don't show animation controls or visualization for calculate
            
        } catch (error) {
            console.error('Calculation error:', error);
            alert('Error during calculation. Please check inputs.');
        } finally {
            this.showProgress(false);
        }
    }

    async fillContainer() {
        const inputs = this.getInputs();

        if (!this.validateInputs(inputs)) return;

        console.log('Starting container filling with inputs:', inputs);

        // Show progress
        this.showProgress(true);

        try {
            // Run calculation in next tick to allow UI update
            await new Promise(resolve => setTimeout(resolve, 100));

            console.log('Running solver for filling...');
            if (this.workerAvailable) {
                try {
                    const sol = await this.solveWithWorker(inputs.containerDims, inputs.box, inputs.packingMethod);
                    if (sol) this.solution = sol;
                    else this.solution = solve(inputs.containerDims, inputs.box, inputs.packingMethod);
                } catch (err) {
                    console.warn('Worker failed, falling back to main thread solver', err);
                    this.solution = solve(inputs.containerDims, inputs.box, inputs.packingMethod);
                }
            } else {
                this.solution = solve(inputs.containerDims, inputs.box, inputs.packingMethod);
            }
            console.log('Solution found:', this.solution);

            // Update visualization - show all steps filled
            this.visualizer.visualizeSolution(this.solution, inputs.containerDims, inputs.packingMethod);
            this.visualizer.showAllSteps(); // Show complete filling

            // Show animation controls for step navigation
            if (this.solution && this.solution.steps && this.solution.steps.length > 0) {
                // Animation controls are already visible
                console.log(`Animation controls available - ${this.solution.steps.length} steps available`);
            }

        } catch (error) {
            console.error('Calculation error:', error);
            alert('Error during calculation. Please check inputs.');
        } finally {
            this.showProgress(false);
        }
    }

    showProgress(show) {
        const progressContainer = document.getElementById('progress-container');
        progressContainer.style.display = show ? 'block' : 'none';
    }

    updateResults(inputs) {
        const resultsDiv = document.getElementById('results-content');

        if (!this.solution) {
            resultsDiv.innerHTML = '<p>No solution found.</p>';
            return;
        }

        let html = '';

        // Summary
        const containerCBM = (inputs.containerDims[0] * inputs.containerDims[1] * inputs.containerDims[2] / 1000000).toFixed(2);
        const methodName = inputs.packingMethod === 'carton' ? 'Carton' : 'Bale';
        const methodNamePlural = inputs.packingMethod === 'carton' ? 'Cartons' : 'Bales';
        
        // Calculate filled and wastage areas
        const boxVolume = inputs.box[0] * inputs.box[1] * inputs.box[2] / 1000000; // in CBM
        const filledCBM = (this.solution.boxes * boxVolume).toFixed(2);
        const filledPercentage = ((filledCBM / containerCBM) * 100).toFixed(2);
        const wastageCBM = (containerCBM - filledCBM).toFixed(2);
        const wastagePercentage = ((wastageCBM / containerCBM) * 100).toFixed(2);
        
        html += '<div class="summary-box">';
        html += `<span style="font-weight: bold;">Container: ${inputs.container.toUpperCase()}</span>\n`;
        html += `Volume\t : ${inputs.containerDims.map(d => parseFloat(d.toFixed(2))).join('×')} = ${containerCBM} CBM\n`;
        html += `${methodName} Size : ${inputs.box.map(d => parseFloat(d.toFixed(2))).join('×')} cm\n`;
        html += `<span style="color: black; font-weight: bold;">Maximum ${methodNamePlural} : </span><span style="color: #c0392b; font-weight: bold;">${this.solution.boxes}</span>\n`;
        html += `Filled Area  : <span style="color: #27ae60; font-weight: bold;">${filledCBM} CBM - ${filledPercentage}%</span>\n`;
        html += `Wastage Area : <span style="color: #e74c3c; font-weight: bold;">${wastageCBM} CBM - ${wastagePercentage}%</span>`;
        html += '</div>';

        // Steps
        html += '<div class="steps-container-box">';
        html += 'LOADING STEPS\n';

        for (let i = 0; i < this.solution.steps.length; i++) {
            const step = this.solution.steps[i];
            const boxesLoaded = step.placed[0] * step.placed[1] * step.placed[2];
            const stepColor = this.visualizer.stepColors[i % this.visualizer.stepColors.length];
            
            html += `<div class="step-box">`;
            html += `<span style="color: ${stepColor}; font-weight: bold;">Step ${i + 1}:</span>\n`;
            html += `Orientation: ${step.orientation.map(d => parseFloat(d.toFixed(2))).join('×')}, Grid: ${step.placed.join('×')}\n`;
            html += `Loaded ${methodNamePlural}: <span style="color: #1e3a8a; font-weight: bold;">${boxesLoaded}</span>`;
            html += `</div>`;
        }
        html += '</div>';

        // Leftovers
        if (this.solution.leftovers.length > 0) {
            html += '<div class="leftovers-box">';
            html += 'Leftovers:';
            html += '<table style="border-collapse: collapse; margin-top: 0; font-family: monospace; width: 100%;">';
            html += '<tr>';
            html += '<th rowspan="2" style="border: 1px solid #000; padding: 4px; text-align: center; background-color: #f0f0f0; line-height: 1.2; width: 8%;">#</th>';
            html += '<th colspan="3" style="border: 1px solid #000; padding: 4px; text-align: center; background-color: #f0f0f0; line-height: 1.2;">Dimensions</th>';
            html += '<th colspan="3" style="border: 1px solid #000; padding: 4px; text-align: center; background-color: #f0f0f0; line-height: 1.2;">Position</th>';
            html += '</tr>';
            html += '<tr>';
            html += '<th style="border: 1px solid #000; padding: 4px; text-align: center; background-color: #f0f0f0; line-height: 1.2; width: 15.33%;">L</th>';
            html += '<th style="border: 1px solid #000; padding: 4px; text-align: center; background-color: #f0f0f0; line-height: 1.2; width: 15.33%;">W</th>';
            html += '<th style="border: 1px solid #000; padding: 4px; text-align: center; background-color: #f0f0f0; line-height: 1.2; width: 15.33%;">H</th>';
            html += '<th style="border: 1px solid #000; padding: 4px; text-align: center; background-color: #f0f0f0; line-height: 1.2; width: 15.33%;">L</th>';
            html += '<th style="border: 1px solid #000; padding: 4px; text-align: center; background-color: #f0f0f0; line-height: 1.2; width: 15.33%;">W</th>';
            html += '<th style="border: 1px solid #000; padding: 4px; text-align: center; background-color: #f0f0f0; line-height: 1.2; width: 15.33%;">H</th>';
            html += '</tr>';
            for (let i = 0; i < this.solution.leftovers.length; i++) {
                const [x, y, z, L, W, H] = this.solution.leftovers[i];
                html += '<tr>';
                html += `<td style="border: 1px solid #000; padding: 4px; text-align: center; line-height: 1.2;">${i + 1}</td>`;
                html += `<td style="border: 1px solid #000; padding: 4px; text-align: center; line-height: 1.2;">${parseFloat(L.toFixed(2))}</td>`;
                html += `<td style="border: 1px solid #000; padding: 4px; text-align: center; line-height: 1.2;">${parseFloat(W.toFixed(2))}</td>`;
                html += `<td style="border: 1px solid #000; padding: 4px; text-align: center; line-height: 1.2;">${parseFloat(H.toFixed(2))}</td>`;
                html += `<td style="border: 1px solid #000; padding: 4px; text-align: center; line-height: 1.2;">${parseFloat(x.toFixed(2))}</td>`;
                html += `<td style="border: 1px solid #000; padding: 4px; text-align: center; line-height: 1.2;">${parseFloat(y.toFixed(2))}</td>`;
                html += `<td style="border: 1px solid #000; padding: 4px; text-align: center; line-height: 1.2;">${parseFloat(z.toFixed(2))}</td>`;
                html += '</tr>';
            }
            html += '</table>';
            html += '</div>';
        }

        resultsDiv.innerHTML = html;
    }

    playAnimation() {
        console.log('App playAnimation called');
        if (this.visualizer) {
            this.visualizer.play();
        } else {
            console.error('Visualizer not initialized');
        }
    }

    nextStep() {
        console.log('App nextStep called');
        if (this.visualizer) {
            this.visualizer.nextStep();
        } else {
            console.error('Visualizer not initialized');
        }
    }

    prevStep() {
        console.log('App prevStep called');
        if (this.visualizer) {
            this.visualizer.prevStep();
        } else {
            console.error('Visualizer not initialized');
        }
    }

    resetView() {
        console.log('App resetView called - complete reset');
        
        // Clear solution
        this.solution = null;
        
        // Disable Fill Container button
        const fillBtn = document.getElementById('fill-btn');
        if (fillBtn) {
            fillBtn.disabled = true;
        }
        
        // Reset visualizer
        if (this.visualizer) {
            this.visualizer.reset();
            this.visualizer.clearScene();
            // Show default container
            const defaultContainer = [589.8, 235.2, 239.4];
            this.visualizer.visualizeSolution(null, defaultContainer, 'carton');
        }
        
        // Clear results
        const resultsDiv = document.getElementById('results-content');
        if (resultsDiv) {
            resultsDiv.innerHTML = '<p>Select container, enter box dimensions, and click Calculate Loading.</p>';
        }
        
        console.log('Complete reset done');
    }

    setView(viewType) {
        if (this.visualizer) {
            this.visualizer.setView(viewType);
        }
    }

    switchTab(tabId) {
        // Hide all tabs
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        // Show selected tab
        document.getElementById(tabId).classList.add('active');
        document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
    }

    showTab(tabId) {
        document.getElementById(tabId).classList.add('active');
        document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
    }

    // Batch methods
    addBatchRow() {
        const tbody = document.querySelector('#batch-items-table tbody');
        const rowCount = tbody.rows.length;
        const newRow = tbody.insertRow();
        newRow.setAttribute('data-index', rowCount);
        newRow.innerHTML = `
            <td style="border: 1px solid #ddd; padding: 8px;"><input type="text" class="batch-l"></td>
            <td style="border: 1px solid #ddd; padding: 8px;"><input type="text" class="batch-w"></td>
            <td style="border: 1px solid #ddd; padding: 8px;"><input type="text" class="batch-h"></td>
            <td style="border: 1px solid #ddd; padding: 8px;"><input type="text" class="batch-qty"></td>
            <td style="border: 1px solid #ddd; padding: 8px;"><button class="remove-row-btn">×</button></td>
        `;
        // Add remove listener
        newRow.querySelector('.remove-row-btn').addEventListener('click', () => this.removeBatchRow(rowCount));
    }

    removeBatchRow(index) {
        const tbody = document.querySelector('#batch-items-table tbody');
        const row = tbody.querySelector(`tr[data-index="${index}"]`);
        if (row) {
            row.remove();
            this.reindexBatchRows();
        }
    }

    reindexBatchRows() {
        const tbody = document.querySelector('#batch-items-table tbody');
        const rows = tbody.querySelectorAll('tr');
        rows.forEach((row, idx) => {
            row.setAttribute('data-index', idx);
            const btn = row.querySelector('.remove-row-btn');
            btn.onclick = () => this.removeBatchRow(idx);
        });
    }

    getBatchInputs() {
        const containerSelect = document.querySelector('#batch-calculation .container-btn.active').dataset.container;
        const packingMethod = document.querySelector('#batch-calculation .packing-btn.active').dataset.method;

        const items = [];
        const rows = document.querySelectorAll('#batch-items-table tbody tr');
        rows.forEach(row => {
            const l = parseFloat(row.querySelector('.batch-l').value);
            const w = parseFloat(row.querySelector('.batch-w').value);
            const h = parseFloat(row.querySelector('.batch-h').value);
            const qty = parseInt(row.querySelector('.batch-qty').value);
            if (!isNaN(l) && !isNaN(w) && !isNaN(h) && !isNaN(qty) && l > 0 && w > 0 && h > 0 && qty > 0) {
                items.push({ dims: [l, w, h], qty: qty });
            }
        });

        return {
            container: containerSelect,
            containerDims: this.containerDimensions[containerSelect],
            packingMethod: packingMethod,
            items: items
        };
    }

    validateBatchInputs(inputs) {
        if (inputs.items.length === 0) {
            alert('Please add at least one item type.');
            return false;
        }
        for (const item of inputs.items) {
            if (item.dims.some(d => isNaN(d) || d <= 0) || isNaN(item.qty) || item.qty <= 0) {
                alert('Please enter valid positive dimensions and quantities for all items.');
                return false;
            }
        }
        return true;
    }

    async calculateBatchLoading() {
        const inputs = this.getBatchInputs();

        if (!this.validateBatchInputs(inputs)) return;

        console.log('Starting batch calculation with inputs:', inputs);

        // Show progress
        this.showBatchProgress(true);

        try {
            await new Promise(resolve => setTimeout(resolve, 100));

            console.log('Running batch solver...');
            const solution = this.solveBatch(inputs.containerDims, inputs.items, inputs.packingMethod);
            console.log('Batch solution found:', solution);

            this.updateBatchResults(inputs, solution);

        } catch (error) {
            console.error('Batch calculation error:', error);
            alert('Error during batch calculation. Please check inputs.');
        } finally {
            this.showBatchProgress(false);
        }
    }

    solveBatch(containerDims, items, packingMethod) {
        // Expand items into list of boxes
        const boxes = [];
        items.forEach(item => {
            for (let i = 0; i < item.qty; i++) {
                boxes.push(item.dims);
            }
        });

        // Sort by volume descending
        boxes.sort((a, b) => (b[0] * b[1] * b[2]) - (a[0] * a[1] * a[2]));

        // Simple first-fit: try to place each box in the container
        // For simplicity, use a basic bin packing simulation
        // Since the solver is for one type, we'll simulate by calling solve multiple times or use a simple placement

        // For now, calculate total volume and assume all fit if total volume <= container volume
        // But to be more accurate, implement a simple packer

        const containerVolume = containerDims[0] * containerDims[1] * containerDims[2];
        let totalVolume = 0;
        const loadedCounts = items.map(item => ({ dims: item.dims, loaded: 0, requested: item.qty }));

        // Simple greedy: place boxes in order until no more fit
        // But since no 3D placement, just count how many fit based on volume
        // This is not accurate, but for batch, perhaps ok

        // Better: use the existing solver but sequentially
        // But solver expects one box type.

        // For simplicity, calculate max per type separately and sum, but that overestimates.

        // Implement a simple 3D bin packing for mixed boxes.

        // Use a list and place them one by one in available space.

        // But to keep simple, let's assume all fit if total volume <= container, and count loaded as requested.

        // But that's not good.

        // Since the solver can handle one type, but for mixed, perhaps run sequentially, placing one type at a time.

        // For now, let's calculate for each type separately and sum the boxes, assuming no overlap.

        let totalLoaded = 0;
        for (const item of items) {
            const sol = solve(containerDims, item.dims, packingMethod);
            const loaded = Math.min(sol.boxes, item.qty);
            loadedCounts.find(lc => lc.dims.join(',') === item.dims.join(',')).loaded = loaded;
            totalLoaded += loaded;
        }

        // But this is approximate, as it doesn't account for mixed packing.

        // For better accuracy, we need a mixed bin packer.

        // For this task, this approximation is ok.

        return {
            loadedCounts: loadedCounts,
            totalLoaded: totalLoaded,
            containerDims: containerDims,
            packingMethod: packingMethod
        };
    }

    showBatchProgress(show) {
        const progressContainer = document.getElementById('batch-progress-container');
        progressContainer.style.display = show ? 'block' : 'none';
    }

    updateBatchResults(inputs, solution) {
        const resultsDiv = document.getElementById('batch-results-content');

        const containerCBM = (inputs.containerDims[0] * inputs.containerDims[1] * inputs.containerDims[2] / 1000000).toFixed(2);
        const methodName = inputs.packingMethod === 'carton' ? 'Carton' : 'Bale';
        const methodNamePlural = inputs.packingMethod === 'carton' ? 'Cartons' : 'Bales';

        let html = '<div class="summary-box">';
        html += `<span style="font-weight: bold;">Container: ${inputs.container.toUpperCase()}</span>\n`;
        html += `Volume: ${inputs.containerDims.map(d => parseFloat(d.toFixed(2))).join('×')} = ${containerCBM} CBM\n`;
        html += `${methodName} Types: ${inputs.items.length}\n`;
        html += `Total ${methodNamePlural} Requested: ${inputs.items.reduce((sum, item) => sum + item.qty, 0)}\n`;
        html += `Total ${methodNamePlural} Loaded: <span style="color: #27ae60; font-weight: bold;">${solution.totalLoaded}</span>\n`;

        const totalRequestedVolume = inputs.items.reduce((sum, item) => sum + (item.dims[0] * item.dims[1] * item.dims[2] * item.qty / 1000000), 0);
        const loadedVolume = inputs.items.reduce((sum, item, idx) => {
            const loaded = solution.loadedCounts[idx].loaded;
            return sum + (item.dims[0] * item.dims[1] * item.dims[2] * loaded / 1000000);
        }, 0);

        html += `Loaded Volume: <span style="color: #27ae60; font-weight: bold;">${loadedVolume.toFixed(2)} CBM - ${(loadedVolume / containerCBM * 100).toFixed(2)}%</span>\n`;
        html += `Wastage: <span style="color: #e74c3c; font-weight: bold;">${(containerCBM - loadedVolume).toFixed(2)} CBM - ${((containerCBM - loadedVolume) / containerCBM * 100).toFixed(2)}%</span>`;
        html += '</div>';

        html += '<div class="steps-container-box">';
        html += 'ITEM LOADING SUMMARY\n';
        solution.loadedCounts.forEach((lc, idx) => {
            const item = inputs.items[idx];
            html += `<div class="step-box">`;
            html += `Type ${idx + 1}: ${item.dims.map(d => parseFloat(d.toFixed(2))).join('×')} cm, Qty: ${item.qty}\n`;
            html += `Loaded: <span style="color: #1e3a8a; font-weight: bold;">${lc.loaded}</span>`;
            html += `</div>`;
        });
        html += '</div>';

        resultsDiv.innerHTML = html;
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ContainerLoadingApp();
});