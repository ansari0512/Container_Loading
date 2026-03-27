// 3D Visual Application Logic

class ContainerLoadingApp3D {
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
    }

    initSolverWorker() {
        try {
            if (window.Worker) {
                this.worker = new Worker('solver.worker.js');
                this.workerAvailable = true;
                this.worker.onmessage = (e) => {
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
            setTimeout(() => {
                this.worker.removeEventListener('message', onMessage);
                reject(new Error('Worker timeout'));
            }, 30000);
        });
    }

    setupVisualizer() {
        console.log('Setting up visualizer');
        this.visualizer = new ContainerVisualizer('canvas-container');
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
            fillBtn.disabled = true;
        }

        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.prevStep());
            prevBtn.disabled = true;
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.nextStep());
            nextBtn.disabled = true;
        }

        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetView());
        }

        // Save button
        const saveBtn = document.getElementById('saveBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveResults());
        }

        document.getElementById('view-top')?.addEventListener('click', () => this.setView('top'));
        document.getElementById('view-back')?.addEventListener('click', () => this.setView('back'));
        document.getElementById('view-left')?.addEventListener('click', () => this.setView('left'));
        document.getElementById('view-right')?.addEventListener('click', () => this.setView('right'));

        containerBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                containerBtns.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-checked', 'false'); });
                btn.classList.add('active');
                btn.setAttribute('aria-checked', 'true');

                const container = btn.dataset.container;
                const dims = this.containerDimensions[container];
                document.getElementById('container-l').value = dims[0];
                document.getElementById('container-w').value = dims[1];
                document.getElementById('container-h').value = dims[2];

                // Clear any previous solution when container changes to avoid stale placements
                this.solution = null;
                const fillBtn = document.getElementById('fill-btn');
                const prevBtn = document.getElementById('prev-btn');
                const nextBtn = document.getElementById('next-btn');
                if (fillBtn) fillBtn.disabled = true;
                if (prevBtn) prevBtn.disabled = true;
                if (nextBtn) nextBtn.disabled = true;

                if (this.visualizer) {
                    // Clear scene and redraw empty container with new dimensions
                    this.visualizer.clearScene();
                    this.visualizer.visualizeSolution(null, dims, this.getInputs().packingMethod);
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

        // If page opened with ?container=name, activate that container button
        try {
            const params = new URLSearchParams(window.location.search);
            const reqContainer = params.get('container');
            if (reqContainer && containerBtns && containerBtns.length) {
                const match = Array.from(containerBtns).find(b => b.dataset.container && b.dataset.container.toLowerCase() === reqContainer.toLowerCase());
                if (match) {
                    // simulate user selecting the container
                    match.click();
                }
            }
        } catch (e) {
            // ignore if URLSearchParams unsupported or any error
            console.warn('Could not parse container query param', e);
        }
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

        this.showProgress(true);

        try {
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

            this.updateResults(inputs);

            // Enable Fill Container button after calculation
            const fillBtn = document.getElementById('fill-btn');
            if (fillBtn) {
                fillBtn.disabled = false;
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

        const containerCBM = (inputs.containerDims[0] * inputs.containerDims[1] * inputs.containerDims[2] / 1000000).toFixed(2);
        const methodName = inputs.packingMethod === 'carton' ? 'Carton' : 'Bale';
        const methodNamePlural = inputs.packingMethod === 'carton' ? 'Cartons' : 'Bales';

        const boxVolume = inputs.box[0] * inputs.box[1] * inputs.box[2] / 1000000;
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

    async fillContainer() {
        const inputs = this.getInputs();

        if (!this.validateInputs(inputs)) return;

        console.log('Starting container filling with inputs:', inputs);

        // Show progress
        this.showProgress(true);

        try {
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
            if (this.visualizer) {
                this.visualizer.visualizeSolution(this.solution, inputs.containerDims, inputs.packingMethod);
                this.visualizer.showAllSteps();
            }

            // Enable animation navigation buttons if steps exist
            if (this.solution && this.solution.steps && this.solution.steps.length > 0) {
                const prevBtn = document.getElementById('prev-btn');
                const nextBtn = document.getElementById('next-btn');
                if (prevBtn) prevBtn.disabled = false;
                if (nextBtn) nextBtn.disabled = false;
            }

        } catch (error) {
            console.error('Calculation error:', error);
            alert('Error during calculation. Please check inputs.');
        } finally {
            this.showProgress(false);
        }
    }

    setView(viewType) {
        if (this.visualizer) {
            this.visualizer.setView(viewType);
        }
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

        // Disable Fill Container and nav buttons
        const fillBtn = document.getElementById('fill-btn');
        if (fillBtn) {
            fillBtn.disabled = true;
        }
        const prevBtn = document.getElementById('prev-btn');
        const nextBtn = document.getElementById('next-btn');
        if (prevBtn) prevBtn.disabled = true;
        if (nextBtn) nextBtn.disabled = true;

        // Reset visualizer
        if (this.visualizer) {
            this.visualizer.reset();
            this.visualizer.clearScene();
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

    async saveResults() {
        if (!this.solution) {
            alert('No results to save. Please run calculation first.');
            return;
        }

        const resultsDiv = document.getElementById('results-content');
        if (!resultsDiv) return;

        const resultsText = resultsDiv.textContent;

        if ('showSaveFilePicker' in window) {
            try {
                const options = {
                    suggestedName: 'container_loading_results.txt',
                    types: [{
                        description: 'Text Files',
                        accept: { 'text/plain': ['.txt'] }
                    }]
                };
                const handle = await window.showSaveFilePicker(options);
                const writable = await handle.createWritable();
                await writable.write(new Blob([resultsText], { type: 'text/plain' }));
                await writable.close();
            } catch (error) {
                console.error('Save failed:', error);
                this.fallbackSave(resultsText);
            }
        } else {
            this.fallbackSave(resultsText);
        }
    }

    fallbackSave(content) {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'container_loading_results.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ContainerLoadingApp3D();
});