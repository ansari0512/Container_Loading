// 3D Bin Packing Solver - JavaScript Port

class Block {
    constructor(L, W, H) {
        this.L = L;
        this.W = W;
        this.H = H;
    }
}

class CutStep {
    constructor(block, orientation, placed) {
        this.block = block;
        this.orientation = orientation;
        this.placed = placed;
    }
}

class Solution {
    constructor(boxes, steps, placements, leftovers, loadedCounts = []) {
        this.boxes = boxes;
        this.steps = steps;
        this.placements = placements;
        this.leftovers = leftovers;
        this.loadedCounts = loadedCounts;
        this.totalLoaded = boxes; // Total loaded items
    }
}

function orientations(box, packingMethod = 'carton') {
    const [a, b, c] = box;
    
    if (packingMethod === 'bale') {
        // Bale: All 6 orientations allowed - FIXED ORDER
        const perms = [];
        perms.push([a, c, b]);     // Priority orientation
        perms.push([a, b, c]);
        perms.push([b, a, c]);
        perms.push([b, c, a]);
        perms.push([c, a, b]);
        perms.push([c, b, a]);
        return [...new Set(perms.map(p => p.join(',')))].map(p => p.split(',').map(Number));
    } else {
        // Carton: All 6 orientations allowed - FIXED ORDER
        const perms = [];
        perms.push([a, c, b]);     // Priority orientation
        perms.push([a, b, c]);
        perms.push([b, a, c]);
        perms.push([b, c, a]);
        perms.push([c, a, b]);
        perms.push([c, b, a]);
        return [...new Set(perms.map(p => p.join(',')))].map(p => p.split(',').map(Number));
    }
}

function solve(bigBlock, box, packingMethod = 'carton', depth = 0, maxDepth = 5) {
    if (depth > maxDepth) {
        return new Solution(0, [], [], [[0, 0, 0, bigBlock[0], bigBlock[1], bigBlock[2]]]);
    }

    const [BL, BW, BH] = bigBlock;
    let bestSolution = new Solution(0, [], [], []);

    if (packingMethod === 'bale') {
        return solveBale(bigBlock, box, depth, maxDepth);
    }

    // Original carton logic remains unchanged
    for (const [a, b, c] of orientations(box, packingMethod)) {
        const nx = Math.floor(BL / a);
        const ny = Math.floor(BW / b);
        const nz = Math.floor(BH / c);

        const mainBoxes = nx * ny * nz;
        if (mainBoxes === 0) continue;

        const usedL = nx * a;
        const usedW = ny * b;
        const usedH = nz * c;

        const steps = [
            new CutStep(new Block(BL, BW, BH), [a, b, c], [nx, ny, nz])
        ];

        const placements = [];
        for (let i = 0; i < nx; i++) {
            for (let j = 0; j < ny; j++) {
                for (let k = 0; k < nz; k++) {
                    placements.push([
                        i * a, j * b, k * c,
                        a, b, c
                    ]);
                }
            }
        }

        // Memory optimization
        const MAX_PLACEMENTS = 50000;
        if (placements.length > MAX_PLACEMENTS) {
            const step = Math.floor(placements.length / MAX_PLACEMENTS) + 1;
            placements.splice(0, placements.length, ...placements.filter((_, idx) => idx % step === 0).slice(0, MAX_PLACEMENTS));
        }

        const mainLeftovers = [];
        if (BH > usedH) mainLeftovers.push([0, 0, usedH, BL, BW, BH - usedH]);
        if (BW > usedW) mainLeftovers.push([0, usedW, 0, BL, BW - usedW, usedH]);
        if (BL > usedL) mainLeftovers.push([usedL, 0, 0, BL - usedL, usedW, usedH]);

        let recursiveBoxes = 0;
        const recursiveSteps = [];
        const recursivePlacements = [];
        const recursiveLeftovers = [];

        for (const [lx, ly, lz, lL, lW, lH] of mainLeftovers) {
            const sub = solve([lL, lW, lH], box, packingMethod, depth + 1, maxDepth);
            recursiveBoxes += sub.boxes;
            recursiveSteps.push(...sub.steps);
            recursivePlacements.push(...sub.placements.map(p => [lx + p[0], ly + p[1], lz + p[2], p[3], p[4], p[5]]));
            if (sub.boxes > 0) {
                recursiveLeftovers.push(...sub.leftovers.map(l => [lx + l[0], ly + l[1], lz + l[2], l[3], l[4], l[5]]));
            } else {
                recursiveLeftovers.push([lx, ly, lz, lL, lW, lH]);
            }
        }

        const totalBoxes = mainBoxes + recursiveBoxes;

        if (totalBoxes > bestSolution.boxes) {
            bestSolution = new Solution(
                totalBoxes,
                [...steps, ...recursiveSteps],
                [...placements, ...recursivePlacements],
                recursiveLeftovers
            );
        }
    }

    if (bestSolution.boxes === 0) {
        bestSolution = new Solution(0, [], [], [[0, 0, 0, BL, BW, BH]]);
    }

    return bestSolution;
}

function solveBale(bigBlock, box, depth = 0, maxDepth = 5) {
    if (depth > maxDepth) {
        return new Solution(0, [], [], [[0, 0, 0, bigBlock[0], bigBlock[1], bigBlock[2]]]);
    }

    const [BL, BW, BH] = bigBlock;
    const [baleL, baleW, baleH] = box;
    
    // Step 1: Main packing - use actual bale dimensions from input
    const nx = Math.floor(BL / baleL);  
    const ny = Math.floor(BW / baleW);   
    const nz = Math.floor(BH / baleH);
    
    const mainBoxes = nx * ny * nz;  // 4 x 16 x 34 = 2176
    
    const steps = [new CutStep(new Block(BL, BW, BH), [baleL, baleW, baleH], [nx, ny, nz])];
    
    const placements = [];
    for (let i = 0; i < nx; i++) {
        for (let j = 0; j < ny; j++) {
            for (let k = 0; k < nz; k++) {
                placements.push([i * baleL, j * baleW, k * baleH, baleL, baleW, baleH]);
            }
        }
    }
    
    let recursiveBoxes = 0;
    const recursiveSteps = [];
    const recursivePlacements = [];
    
    // Step 2: Width leftover
    const widthLeftover = BW - (ny * baleW);
    let nx2 = 0, ny2 = 0, nz2 = 0;
    if (widthLeftover >= baleH) {
        nx2 = Math.floor(BL / baleL);
        ny2 = Math.floor(widthLeftover / baleH);
        nz2 = Math.floor(BH / baleW);
        
        const step2Boxes = nx2 * ny2 * nz2;  
        recursiveBoxes += step2Boxes;
        
        recursiveSteps.push(new CutStep(new Block(BL, widthLeftover, BH), [baleL, baleH, baleW], [nx2, ny2, nz2]));
        
        for (let i = 0; i < nx2; i++) {
            for (let j = 0; j < ny2; j++) {
                for (let k = 0; k < nz2; k++) {
                    recursivePlacements.push([i * baleL, (ny * baleW) + j * baleH, k * baleW, baleL, baleH, baleW]);
                }
            }
        }
    }
    
    // Step 3: Length leftover
    const lengthLeftover = BL - (nx * baleL);
    let nx3 = 0, ny3 = 0, nz3 = 0;
    if (lengthLeftover >= baleW) {
        nx3 = Math.floor(lengthLeftover / baleW);
        ny3 = Math.floor(BW / baleL);
        nz3 = Math.floor(BH / baleH);
        
        const step3Boxes = nx3 * ny3 * nz3;  
        recursiveBoxes += step3Boxes;
        
        recursiveSteps.push(new CutStep(new Block(lengthLeftover, BW, BH), [baleW, baleL, baleH], [nx3, ny3, nz3]));
        
        for (let i = 0; i < nx3; i++) {
            for (let j = 0; j < ny3; j++) {
                for (let k = 0; k < nz3; k++) {
                    recursivePlacements.push([(nx * baleL) + i * baleW, j * baleL, k * baleH, baleW, baleL, baleH]);
                }
            }
        }
    }
    
    const totalBoxes = mainBoxes + recursiveBoxes;  // 2176 + 68 + 238 = 2482
    
    // Calculate final leftovers
    const finalLeftovers = [];
    // Main leftovers
    if (BL > nx * baleL) finalLeftovers.push([nx * baleL, 0, 0, BL - nx * baleL, ny * baleW, nz * baleH]);
    if (BW > ny * baleW) finalLeftovers.push([0, ny * baleW, 0, nx * baleL, BW - ny * baleW, nz * baleH]);
    if (BH > nz * baleH) finalLeftovers.push([0, 0, nz * baleH, nx * baleL, ny * baleW, BH - nz * baleH]);
    // Width leftover remaining
    if (widthLeftover >= baleH) {
        const remL2 = BL - nx2 * baleL;
        const remW2 = widthLeftover - ny2 * baleH;
        const remH2 = BH - nz2 * baleW;
        if (remL2 > 0 || remW2 > 0 || remH2 > 0) {
            finalLeftovers.push([nx2 * baleL, ny * baleW + ny2 * baleH, nz2 * baleW, remL2, remW2, remH2]);
        }
    }
    // Length leftover remaining
    if (lengthLeftover >= baleW) {
        const remL3 = lengthLeftover - nx3 * baleW;
        const remW3 = BW - ny3 * baleL;
        const remH3 = BH - nz3 * baleH;
        if (remL3 > 0 || remW3 > 0 || remH3 > 0) {
            finalLeftovers.push([nx * baleL + nx3 * baleW, ny3 * baleL, nz3 * baleH, remL3, remW3, remH3]);
        }
    }
    
    return new Solution(
        totalBoxes,
        [...steps, ...recursiveSteps],
        [...placements, ...recursivePlacements],
        finalLeftovers
    );
}

function mixedSolve(containerDims, items) {
    // NEW APPROACH: Sequential packing - cartons first, then bales
    // Each pack operation updates the remaining space for next items
    
    const allPlacements = [];
    const allSteps = [];
    const loadedCounts = [];
    let totalLoaded = 0;
    
    // Start with full container as available space
    let availableSpace = [[0, 0, 0, containerDims[0], containerDims[1], containerDims[2]]];
    
    // Separate cartons and bales
    const cartons = items.filter(i => i.type === 'carton');
    const bales = items.filter(i => i.type === 'bale');
    
    // PHASE 1: Pack all cartons sequentially
    for (const item of cartons) {
        const result = packItemsInSpace(availableSpace, item.dims, item.qty);
        
        // Store loaded count
        loadedCounts.push({ loaded: result.placed, type: 'carton', dims: item.dims, requested: item.qty });
        totalLoaded += result.placed;
        
        // Add placements with offset for each space
        for (const placement of result.placements) {
            allPlacements.push(placement);
        }
        
        // Add steps
        if (result.placed > 0) {
            allSteps.push(new CutStep(
                new Block(containerDims[0], containerDims[1], containerDims[2]), 
                item.dims, 
                [1, 1, result.placed]
            ));
        }
        
        // Update available space - remove used space and add new leftovers
        availableSpace = result.leftovers;
    }
    
    // PHASE 2: Pack all bales in remaining space
    for (const item of bales) {
        const result = packItemsInSpace(availableSpace, item.dims, item.qty);
        
        // Store loaded count
        loadedCounts.push({ loaded: result.placed, type: 'bale', dims: item.dims, requested: item.qty });
        totalLoaded += result.placed;
        
        // Add placements
        for (const placement of result.placements) {
            allPlacements.push(placement);
        }
        
        // Add steps
        if (result.placed > 0) {
            allSteps.push(new CutStep(
                new Block(containerDims[0], containerDims[1], containerDims[2]), 
                item.dims, 
                [1, 1, result.placed]
            ));
        }
        
        // Update available space
        availableSpace = result.leftovers;
    }

    return new Solution(
        allPlacements.length,
        allSteps,
        allPlacements,
        availableSpace,
        loadedCounts,
        totalLoaded
    );
}

// Helper function to pack items into available space using 3D bin packing
function packItemsInSpace(availableSpace, itemDims, requestedQty) {
    const placements = [];
    let leftovers = [];
    let remaining = requestedQty;
    
    // Try to pack in each available space
    for (const space of availableSpace) {
        if (remaining <= 0) break;
        
        const [sx, sy, sz, sL, sW, sH] = space;
        const [boxL, boxW, boxH] = itemDims;
        
        // Calculate how many fit in this space
        const nx = Math.floor(sL / boxL);
        const ny = Math.floor(sW / boxW);
        const nz = Math.floor(sH / boxH);
        const canFit = nx * ny * nz;
        
        if (canFit === 0) {
            leftovers.push(space);
            continue;
        }
        
        const toPlace = Math.min(canFit, remaining);
        
        // Place items in this space
        for (let i = 0; i < nx && remaining > 0; i++) {
            for (let j = 0; j < ny && remaining > 0; j++) {
                for (let k = 0; k < nz && remaining > 0; k++) {
                    placements.push([sx + i * boxL, sy + j * boxW, sz + k * boxH, boxL, boxW, boxH]);
                    remaining--;
                }
            }
        }
        
        // Calculate leftover spaces after packing
        const usedL = nx * boxL;
        const usedW = ny * boxW;
        const usedH = nz * boxH;
        
        // Right leftover
        if (sL > usedL) {
            leftovers.push([sx + usedL, sy, sz, sL - usedL, sW, sH]);
        }
        // Front leftover  
        if (sW > usedW) {
            leftovers.push([sx, sy + usedW, sz, usedL, sW - usedW, sH]);
        }
        // Top leftover
        if (sH > usedH) {
            leftovers.push([sx, sy, sz + usedH, usedL, usedW, sH - usedH]);
        }
    }
    
    return {
        placed: requestedQty - remaining,
        placements: placements,
        leftovers: leftovers
    };
}