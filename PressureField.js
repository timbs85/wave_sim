class PressureField {
    constructor(cols, rows) {
        this.cols = cols;
        this.rows = rows;
        const gridSize = cols * rows;

        // Create pressure grid (cell centers)
        this.pressure = new Float32Array(gridSize);

        // Create velocity components (staggered grid)
        // vx is stored at (i+1/2, j) - need one extra column
        // vy is stored at (i, j+1/2) - need one extra row
        this.vx = new Float32Array((cols + 1) * rows);
        this.vy = new Float32Array(cols * (rows + 1));

        // Create neighbor information arrays
        this.nonWallNeighborCount = new Uint8Array(gridSize);
        this.neighborIndices = new Int32Array(gridSize * 5);
    }

    reset() {
        this.pressure.fill(0);
        this.vx.fill(0);
        this.vy.fill(0);
    }

    dispose() {
        // Clear all buffers
        this.pressure = null;
        this.vx = null;
        this.vy = null;
        this.nonWallNeighborCount = null;
        this.neighborIndices = null;
    }

    getPressure(x, y, cellSize) {
        // Bilinear interpolation for pressure
        const fx = x / cellSize;
        const fy = y / cellSize;
        const ix = Math.floor(fx);
        const iy = Math.floor(fy);

        if (ix >= 0 && ix < this.cols - 1 && iy >= 0 && iy < this.rows - 1) {
            const wx = fx - ix;
            const wy = fy - iy;

            const p00 = this.pressure[ix + iy * this.cols];
            const p10 = this.pressure[(ix + 1) + iy * this.cols];
            const p01 = this.pressure[ix + (iy + 1) * this.cols];
            const p11 = this.pressure[(ix + 1) + (iy + 1) * this.cols];

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

        if (ix >= 0 && ix < this.cols - 1 && iy >= 0 && iy < this.rows - 1) {
            const wx = fx - ix;
            const wy = fy - iy;

            // Interpolate x-velocity components
            const vx1 = this.vx[ix + iy * (this.cols + 1)];
            const vx2 = this.vx[(ix + 1) + iy * (this.cols + 1)];
            const vx = (1 - wx) * vx1 + wx * vx2;

            // Interpolate y-velocity components
            const vy1 = this.vy[ix + iy * this.cols];
            const vy2 = this.vy[ix + (iy + 1) * this.cols];
            const vy = (1 - wy) * vy1 + wy * vy2;

            return Math.sqrt(vx * vx + vy * vy);
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
        // First update velocities
        this._updateVelocities(walls, dt, dx, rho);

        // Then update pressures
        this._updatePressures(walls, dt, dx, c, rho, wallAbsorption, airAbsorption);
    }

    _updateVelocities(walls, dt, dx, rho) {
        const k_rho_h = dt / (rho * dx);

        // Update x-velocities
        for (let i = 0; i < this.cols; i++) {
            for (let j = 0; j < this.rows; j++) {
                const idx = i + j * (this.cols + 1);
                const pressureIdx = i + j * this.cols;

                // Skip if either adjacent cell is a wall
                if (i < this.cols - 1 && !walls[pressureIdx] && !walls[pressureIdx + 1]) {
                    // Velocity update at i+1/2
                    this.vx[idx] -= k_rho_h * (this.pressure[pressureIdx + 1] - this.pressure[pressureIdx]);
                }
            }
        }

        // Update y-velocities
        for (let i = 0; i < this.cols; i++) {
            for (let j = 0; j < this.rows; j++) {
                const idx = i + j * this.cols;

                // Skip if either adjacent cell is a wall
                if (j < this.rows - 1 && !walls[idx] && !walls[idx + this.cols]) {
                    // Velocity update at j+1/2
                    this.vy[idx] -= k_rho_h * (this.pressure[idx + this.cols] - this.pressure[idx]);
                }
            }
        }
    }

    _updatePressures(walls, dt, dx, c, rho, wallAbsorption, airAbsorption) {
        const k_rho_c2_h = (rho * c * c * dt) / dx;
        let maxPressure = 0;
        let maxPressurePos = { x: 0, y: 0 };

        for (let i = 1; i < this.cols - 1; i++) {
            for (let j = 1; j < this.rows - 1; j++) {
                const idx = i + j * this.cols;
                if (walls[idx]) continue;

                // Calculate divergence using staggered velocities
                const vx_diff = this.vx[(i + 1) + j * (this.cols + 1)] - this.vx[i + j * (this.cols + 1)];
                const vy_diff = this.vy[i + (j + 1) * this.cols] - this.vy[i + j * this.cols];

                this.pressure[idx] -= k_rho_c2_h * (vx_diff + vy_diff);

                // Apply absorptions
                if (this.nonWallNeighborCount[idx] < 4) {
                    this.pressure[idx] *= (1 - wallAbsorption);
                }
                this.pressure[idx] *= (1 - airAbsorption);

                // Track maximum pressure
                if (Math.abs(this.pressure[idx]) > maxPressure) {
                    maxPressure = Math.abs(this.pressure[idx]);
                    maxPressurePos = { x: i, y: j };
                }

                // Clean up small values
                if (Math.abs(this.pressure[idx]) < SimConfig.physics.minPressureThreshold) {
                    this.pressure[idx] = 0;
                }
            }
        }

        // Log maximum pressure if it's significant
        if (maxPressure > 0.01) {
            console.log('Max pressure:', maxPressure, 'at position:', maxPressurePos);
        }
    }
} 