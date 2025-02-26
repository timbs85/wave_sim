class PressureField {
    constructor(cols, rows) {
        this.cols = cols;
        this.rows = rows;
        const gridSize = cols * rows;

        // Store two time steps of pressure (current and previous)
        this.pressureCurrent = new Float32Array(gridSize);
        this.pressurePrevious = new Float32Array(gridSize);

        // Create neighbor indices array (5 indices per cell: center + 4 cardinal neighbors)
        this.neighborIndices = new Int32Array(gridSize * 5);
    }

    reset() {
        // Ensure both pressure arrays are completely zeroed
        this.pressureCurrent.fill(0);
        this.pressurePrevious.fill(0);
    }

    dispose() {
        // Clear all buffers
        this.pressureCurrent = null;
        this.pressurePrevious = null;
        this.neighborIndices = null;
    }

    getPressure(x, y, cellSize) {
        // Convert screen coordinates to grid coordinates, sampling at cell centers
        const gridX = Math.floor(x / cellSize);
        const gridY = Math.floor(y / cellSize);

        // Return pressure at grid center if within bounds
        if (gridX >= 0 && gridX < this.cols && gridY >= 0 && gridY < this.rows) {
            return this.pressureCurrent[gridToIndex(gridX, gridY, this.cols)];
        }
        return 0;
    }

    getVelocity(x, y, cellSize) {
        // Convert screen coordinates to grid coordinates, sampling at cell centers
        const gridX = Math.floor(x / cellSize);
        const gridY = Math.floor(y / cellSize);

        // Calculate velocity using central differences at grid centers
        if (gridX >= 1 && gridX < this.cols - 1 && gridY >= 1 && gridY < this.rows - 1) {
            const dx = (this.pressureCurrent[gridToIndex(gridX + 1, gridY, this.cols)] -
                this.pressureCurrent[gridToIndex(gridX - 1, gridY, this.cols)]) * 0.5;
            const dy = (this.pressureCurrent[gridToIndex(gridX, gridY + 1, this.cols)] -
                this.pressureCurrent[gridToIndex(gridX, gridY - 1, this.cols)]) * 0.5;

            return Math.sqrt(dx * dx + dy * dy);
        }
        return 0;
    }

    precalculateNeighborInfo(walls) {
        for (let i = 1; i < this.cols - 1; i++) {
            for (let j = 1; j < this.rows - 1; j++) {
                const idx = gridToIndex(i, j, this.cols);
                const baseIdx = idx * 5;

                // Store center and neighbor indices
                this.neighborIndices[baseIdx] = idx;
                this.neighborIndices[baseIdx + 1] = gridToIndex(i - 1, j, this.cols);      // Left
                this.neighborIndices[baseIdx + 2] = gridToIndex(i + 1, j, this.cols);      // Right
                this.neighborIndices[baseIdx + 3] = gridToIndex(i, j - 1, this.cols);      // Up
                this.neighborIndices[baseIdx + 4] = gridToIndex(i, j + 1, this.cols);      // Down
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
                const idx = gridToIndex(i, j, this.cols);

                // Skip only regular walls (type 1), let anechoic walls (type 2) participate
                if (walls[idx] === 1) {
                    pressureNext[idx] = 0;
                    continue;
                }

                // Get neighbor indices
                const leftIdx = gridToIndex(i - 1, j, this.cols);
                const rightIdx = gridToIndex(i + 1, j, this.cols);
                const upIdx = gridToIndex(i, j - 1, this.cols);
                const downIdx = gridToIndex(i, j + 1, this.cols);

                // Normal wave equation
                const laplacian = (
                    this.pressureCurrent[rightIdx] +      // right
                    this.pressureCurrent[leftIdx] +       // left
                    this.pressureCurrent[downIdx] +       // down
                    this.pressureCurrent[upIdx] -         // up
                    4 * this.pressureCurrent[idx]         // center
                );

                pressureNext[idx] =
                    2 * this.pressureCurrent[idx] -
                    this.pressurePrevious[idx] +
                    courantSquared * laplacian;

                // Apply regular wall absorption only for points next to regular walls
                let nearRegularWall = false;
                if (walls[leftIdx] === 1 || walls[rightIdx] === 1 ||
                    walls[upIdx] === 1 || walls[downIdx] === 1) {
                    nearRegularWall = true;
                }

                if (nearRegularWall) {
                    const beta = 1 - wallAbsorption;
                    pressureNext[idx] *= beta;
                }

                // Apply air absorption
                pressureNext[idx] *= (1 - airAbsorption);

                // Clean up small values
                if (Math.abs(pressureNext[idx]) < window.params.physics.minPressureThreshold) {
                    pressureNext[idx] = 0;
                }
            }
        }

        // Apply absorbing boundary conditions at grid edges where there are no regular walls
        const absorbCoeff = (courant - 1) / (courant + 1);  // First-order absorbing coefficient

        // Right boundary
        for (let j = 1; j < this.rows - 1; j++) {
            const i = this.cols - 1;
            const idx = gridToIndex(i, j, this.cols);
            if (walls[idx] !== 1) {
                const prevIdx = gridToIndex(i - 1, j, this.cols);
                pressureNext[idx] = this.pressureCurrent[prevIdx] +
                    absorbCoeff * (pressureNext[prevIdx] - this.pressureCurrent[idx]);
            }
        }

        // Left boundary
        for (let j = 1; j < this.rows - 1; j++) {
            const i = 0;
            const idx = gridToIndex(i, j, this.cols);
            if (walls[idx] !== 1) {
                const nextIdx = gridToIndex(i + 1, j, this.cols);
                pressureNext[idx] = this.pressureCurrent[nextIdx] +
                    absorbCoeff * (pressureNext[nextIdx] - this.pressureCurrent[idx]);
            }
        }

        // Bottom boundary
        for (let i = 1; i < this.cols - 1; i++) {
            const j = this.rows - 1;
            const idx = gridToIndex(i, j, this.cols);
            if (walls[idx] !== 1) {
                const prevIdx = gridToIndex(i, j - 1, this.cols);
                pressureNext[idx] = this.pressureCurrent[prevIdx] +
                    absorbCoeff * (pressureNext[prevIdx] - this.pressureCurrent[idx]);
            }
        }

        // Top boundary
        for (let i = 1; i < this.cols - 1; i++) {
            const j = 0;
            const idx = gridToIndex(i, j, this.cols);
            if (walls[idx] !== 1) {
                const nextIdx = gridToIndex(i, j + 1, this.cols);
                pressureNext[idx] = this.pressureCurrent[nextIdx] +
                    absorbCoeff * (pressureNext[nextIdx] - this.pressureCurrent[idx]);
            }
        }

        // Update time steps
        this.pressurePrevious.set(this.pressureCurrent);
        this.pressureCurrent.set(pressureNext);
    }
} 