class PressureField {
    constructor(cols, rows) {
        this.cols = cols;
        this.rows = rows;
        const gridSize = cols * rows;

        // Store two time steps of pressure (current and previous)
        this.pressureCurrent = new Float32Array(gridSize);
        this.pressurePrevious = new Float32Array(gridSize);

        // Create neighbor information arrays
        this.nonWallNeighborCount = new Uint8Array(gridSize);
        this.neighborIndices = new Int32Array(gridSize * 5);
    }

    reset() {
        this.pressureCurrent.fill(0);
        this.pressurePrevious.fill(0);
    }

    dispose() {
        // Clear all buffers
        this.pressureCurrent = null;
        this.pressurePrevious = null;
        this.nonWallNeighborCount = null;
        this.neighborIndices = null;
    }

    getPressure(x, y, cellSize) {
        // Higher-order interpolation for pressure
        const fx = x / cellSize;
        const fy = y / cellSize;
        const ix = Math.floor(fx);
        const iy = Math.floor(fy);

        if (ix >= 1 && ix < this.cols - 2 && iy >= 1 && iy < this.rows - 2) {
            const wx = fx - ix;
            const wy = fy - iy;

            // Cubic interpolation weights
            const wx2 = wx * wx;
            const wx3 = wx2 * wx;
            const wy2 = wy * wy;
            const wy3 = wy2 * wy;

            const h00 = 2 * wx3 - 3 * wx2 + 1;
            const h10 = -2 * wx3 + 3 * wx2;
            const h01 = wx3 - 2 * wx2 + wx;
            const h11 = wx3 - wx2;

            const v00 = 2 * wy3 - 3 * wy2 + 1;
            const v10 = -2 * wy3 + 3 * wy2;
            const v01 = wy3 - 2 * wy2 + wy;
            const v11 = wy3 - wy2;

            // Sample pressure values
            const p00 = this.pressureCurrent[ix + iy * this.cols];
            const p10 = this.pressureCurrent[(ix + 1) + iy * this.cols];
            const p01 = this.pressureCurrent[ix + (iy + 1) * this.cols];
            const p11 = this.pressureCurrent[(ix + 1) + (iy + 1) * this.cols];

            // Compute derivatives
            const dx = (this.pressureCurrent[(ix + 1) + iy * this.cols] - this.pressureCurrent[(ix - 1) + iy * this.cols]) * 0.5;
            const dy = (this.pressureCurrent[ix + (iy + 1) * this.cols] - this.pressureCurrent[ix + (iy - 1) * this.cols]) * 0.5;
            const dxy = (this.pressureCurrent[(ix + 1) + (iy + 1) * this.cols] - this.pressureCurrent[(ix - 1) + (iy + 1) * this.cols] -
                this.pressureCurrent[(ix + 1) + (iy - 1) * this.cols] + this.pressureCurrent[(ix - 1) + (iy - 1) * this.cols]) * 0.25;

            // Bicubic interpolation
            return h00 * v00 * p00 +
                h10 * v00 * p10 +
                h00 * v10 * p01 +
                h10 * v10 * p11 +
                h01 * v00 * dx +
                h11 * v00 * dx +
                h00 * v01 * dy +
                h10 * v01 * dy +
                h01 * v10 * dxy +
                h11 * v10 * dxy;
        }

        // Fall back to bilinear interpolation near boundaries
        if (ix >= 0 && ix < this.cols - 1 && iy >= 0 && iy < this.rows - 1) {
            const wx = fx - ix;
            const wy = fy - iy;

            const p00 = this.pressureCurrent[ix + iy * this.cols];
            const p10 = this.pressureCurrent[(ix + 1) + iy * this.cols];
            const p01 = this.pressureCurrent[ix + (iy + 1) * this.cols];
            const p11 = this.pressureCurrent[(ix + 1) + (iy + 1) * this.cols];

            return (1 - wx) * (1 - wy) * p00 +
                wx * (1 - wy) * p10 +
                (1 - wx) * wy * p01 +
                wx * wy * p11;
        }
        return 0;
    }

    // Get velocity magnitude at a point (for visualization)
    getVelocity(x, y, cellSize) {
        const fx = x / cellSize;
        const fy = y / cellSize;
        const ix = Math.floor(fx);
        const iy = Math.floor(fy);

        if (ix >= 1 && ix < this.cols - 2 && iy >= 1 && iy < this.rows - 2) {
            // Calculate velocity components using central differences of pressure
            const dx = (this.pressureCurrent[(ix + 1) + iy * this.cols] -
                this.pressureCurrent[(ix - 1) + iy * this.cols]) * 0.5;
            const dy = (this.pressureCurrent[ix + (iy + 1) * this.cols] -
                this.pressureCurrent[ix + (iy - 1) * this.cols]) * 0.5;

            // Return velocity magnitude
            return Math.sqrt(dx * dx + dy * dy);
        }
        return 0;
    }

    precalculateNeighborInfo(walls) {
        for (let i = 1; i < this.cols - 1; i++) {
            for (let j = 1; j < this.rows - 1; j++) {
                const baseIdx = (i + j * this.cols) * 5;
                const idx = i + j * this.cols;

                // Store center and neighbor indices
                this.neighborIndices[baseIdx] = idx;
                this.neighborIndices[baseIdx + 1] = idx - 1;      // Left
                this.neighborIndices[baseIdx + 2] = idx + 1;      // Right
                this.neighborIndices[baseIdx + 3] = idx - this.cols; // Up
                this.neighborIndices[baseIdx + 4] = idx + this.cols; // Down

                // Count non-wall neighbors
                if (!walls[idx]) {
                    let count = 0;
                    if (!walls[idx - 1]) count++;         // Left
                    if (!walls[idx + 1]) count++;         // Right
                    if (!walls[idx - this.cols]) count++; // Up
                    if (!walls[idx + this.cols]) count++; // Down
                    this.nonWallNeighborCount[idx] = count;
                }
            }
        }
    }

    updatePressure(walls, dt, dx, c, rho, wallAbsorption, airAbsorption) {
        // Calculate coefficient for the FDTD update
        const courant = (c * dt / dx);
        const courantSquared = courant * courant;

        // Create buffer for next time step
        const pressureNext = new Float32Array(this.pressureCurrent.length);

        // Update interior points using normal wave equation
        for (let j = 1; j < this.rows - 1; j++) {
            for (let i = 1; i < this.cols - 1; i++) {
                const idx = i + j * this.cols;

                // Skip only regular walls (type 1), let anechoic walls (type 2) participate
                if (walls[idx] === 1) {
                    pressureNext[idx] = 0;
                    continue;
                }

                // Normal wave equation
                const laplacian = (
                    this.pressureCurrent[idx + 1] +      // right
                    this.pressureCurrent[idx - 1] +      // left
                    this.pressureCurrent[idx + this.cols] + // down
                    this.pressureCurrent[idx - this.cols] - // up
                    4 * this.pressureCurrent[idx]        // center
                );

                pressureNext[idx] =
                    2 * this.pressureCurrent[idx] -
                    this.pressurePrevious[idx] +
                    courantSquared * laplacian;

                // Apply regular wall absorption only for points next to regular walls
                let nearRegularWall = false;
                if (walls[idx - 1] === 1 || walls[idx + 1] === 1 ||
                    walls[idx - this.cols] === 1 || walls[idx + this.cols] === 1) {
                    nearRegularWall = true;
                }

                if (nearRegularWall) {
                    const beta = 1 - wallAbsorption;
                    pressureNext[idx] *= beta;
                }

                // Apply air absorption
                pressureNext[idx] *= (1 - airAbsorption);

                // Clean up small values
                if (Math.abs(pressureNext[idx]) < SimConfig.physics.minPressureThreshold) {
                    pressureNext[idx] = 0;
                }
            }
        }

        // Apply absorbing boundary conditions at grid edges where there are no regular walls
        const absorbCoeff = (courant - 1) / (courant + 1);  // First-order absorbing coefficient

        // Right boundary
        for (let j = 1; j < this.rows - 1; j++) {
            const i = this.cols - 1;
            const idx = i + j * this.cols;
            if (walls[idx] !== 1) {  // Only apply to non-wall points
                const prevIdx = (i - 1) + j * this.cols;
                pressureNext[idx] = this.pressureCurrent[prevIdx] +
                    absorbCoeff * (pressureNext[prevIdx] - this.pressureCurrent[idx]);
            }
        }

        // Left boundary
        for (let j = 1; j < this.rows - 1; j++) {
            const i = 0;
            const idx = i + j * this.cols;
            if (walls[idx] !== 1) {
                const nextIdx = (i + 1) + j * this.cols;
                pressureNext[idx] = this.pressureCurrent[nextIdx] +
                    absorbCoeff * (pressureNext[nextIdx] - this.pressureCurrent[idx]);
            }
        }

        // Bottom boundary
        for (let i = 1; i < this.cols - 1; i++) {
            const j = this.rows - 1;
            const idx = i + j * this.cols;
            if (walls[idx] !== 1) {
                const prevIdx = i + (j - 1) * this.cols;
                pressureNext[idx] = this.pressureCurrent[prevIdx] +
                    absorbCoeff * (pressureNext[prevIdx] - this.pressureCurrent[idx]);
            }
        }

        // Top boundary
        for (let i = 1; i < this.cols - 1; i++) {
            const j = 0;
            const idx = i + j * this.cols;
            if (walls[idx] !== 1) {
                const nextIdx = i + (j + 1) * this.cols;
                pressureNext[idx] = this.pressureCurrent[nextIdx] +
                    absorbCoeff * (pressureNext[nextIdx] - this.pressureCurrent[idx]);
            }
        }

        // Update time steps
        this.pressurePrevious.set(this.pressureCurrent);
        this.pressureCurrent.set(pressureNext);
    }
} 