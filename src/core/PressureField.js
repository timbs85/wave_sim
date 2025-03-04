class PressureField {
    constructor(cols, rows, minPressureThreshold) {
        this.cols = cols;
        this.rows = rows;
        this.minPressureThreshold = minPressureThreshold;
        const gridSize = cols * rows;

        // Basic two-step method storage
        this.pressureCurrent = new Float32Array(gridSize);
        this.pressurePrevious = new Float32Array(gridSize);

        // Energy tracking as per slides
        this.energyAcoustic = 0;  // Ei: stored energy in acoustic field
        this.energyWall = 0;      // Eb: stored energy at wall
        this.powerLossWall = 0;   // Qb: power loss at wall
        this.powerLossField = 0;  // Qi: power loss in acoustic field
        this.inputPower = 0;      // P: input power

        // Current frequency for viscothermal effects
        this.frequency = 440;
    }

    setFrequency(freq) {
        this.frequency = freq;
    }

    gridToIndex(x, y) {
        return x + y * this.cols;
    }

    reset() {
        this.pressureCurrent.fill(0);
        this.pressurePrevious.fill(0);
    }

    dispose() {
        this.pressureCurrent = null;
        this.pressurePrevious = null;
    }

    getPressure(x, y) {
        if (x >= 0 && x < this.cols && y >= 0 && y < this.rows) {
            return this.pressureCurrent[this.gridToIndex(x, y)];
        }
        return 0;
    }

    getVelocity(x, y) {
        // Simple central difference for velocity
        if (x > 0 && x < this.cols - 1 && y > 0 && y < this.rows - 1) {
            const dx = (this.pressureCurrent[this.gridToIndex(x + 1, y)] -
                       this.pressureCurrent[this.gridToIndex(x - 1, y)]) / 2;
            const dy = (this.pressureCurrent[this.gridToIndex(x, y + 1)] -
                       this.pressureCurrent[this.gridToIndex(x, y - 1)]) / 2;
            return Math.sqrt(dx * dx + dy * dy);
        }
        return 0;
    }

    calculateEnergy(walls) {
        this.energyAcoustic = 0;
        this.energyWall = 0;

        for (let i = 1; i < this.cols - 1; i++) {
            for (let j = 1; j < this.rows - 1; j++) {
                const idx = this.gridToIndex(i, j);

                if (walls[idx] === 1) continue;

                // Acoustic field energy
                const p = this.pressureCurrent[idx];
                const v = this.getVelocity(i, j);
                this.energyAcoustic += 0.5 * (p * p + v * v);

                // Wall energy (if adjacent to wall)
                if (this.isAdjacentToWall(i, j, walls)) {
                    this.energyWall += 0.5 * p * p;
                }
            }
        }
    }

    isAdjacentToWall(i, j, walls) {
        if (i < 1 || i >= this.cols - 1 || j < 1 || j >= this.rows - 1) return false;

        const leftIdx = this.gridToIndex(i - 1, j);
        const rightIdx = this.gridToIndex(i + 1, j);
        const upIdx = this.gridToIndex(i, j - 1);
        const downIdx = this.gridToIndex(i, j + 1);

        return walls[leftIdx] === 1 || walls[rightIdx] === 1 ||
               walls[upIdx] === 1 || walls[downIdx] === 1;
    }

    updatePressure(walls, dt, dx, c, rho, wallAbsorption, airAbsorption) {
        // Basic FDTD coefficients
        const courant = (c * dt / dx);
        const courantSquared = courant * courant;

        // Viscothermal coefficient from Stokes equation
        const alpha = 1.84e-5;  // Air viscosity at 20°C
        const viscothermalCoeff = (alpha * dt) / c;

        // Create buffer for next time step
        const pressureNext = new Float32Array(this.pressureCurrent.length);

        // Reset power tracking
        this.powerLossWall = 0;
        this.powerLossField = 0;

        // Update interior points using basic two-step method
        for (let i = 0; i < this.cols; i++) {
            for (let j = 0; j < this.rows; j++) {
                const idx = this.gridToIndex(i, j);

                // Skip wall cells
                if (walls[idx] === 1) {
                    pressureNext[idx] = 0;
                    continue;
                }

                // Handle absorbing boundaries at simulation edges
                if (i === 0 || i === this.cols - 1 || j === 0 || j === this.rows - 1) {
                    // Use Mur's absorbing boundary condition
                    const absorbingCoeff = 1.0; // No absorption
                    if (i === 0) {
                        pressureNext[idx] = this.pressureCurrent[idx + 1] * absorbingCoeff;
                    } else if (i === this.cols - 1) {
                        pressureNext[idx] = this.pressureCurrent[idx - 1] * absorbingCoeff;
                    } else if (j === 0) {
                        pressureNext[idx] = this.pressureCurrent[idx + this.cols] * absorbingCoeff;
                    } else if (j === this.rows - 1) {
                        pressureNext[idx] = this.pressureCurrent[idx - this.cols] * absorbingCoeff;
                    }
                    continue;
                }

                // Five-point stencil Laplacian (exactly as shown in slides)
                const leftIdx = this.gridToIndex(i - 1, j);
                const rightIdx = this.gridToIndex(i + 1, j);
                const upIdx = this.gridToIndex(i, j - 1);
                const downIdx = this.gridToIndex(i, j + 1);

                const laplacian = (
                    this.pressureCurrent[rightIdx] +
                    this.pressureCurrent[leftIdx] +
                    this.pressureCurrent[upIdx] +
                    this.pressureCurrent[downIdx] -
                    4 * this.pressureCurrent[idx]
                );

                // Basic wave equation update
                pressureNext[idx] =
                    2 * this.pressureCurrent[idx] -
                    this.pressurePrevious[idx] +
                    courantSquared * laplacian;

                // Add viscothermal effects (Stokes equation term)
                if (this.pressurePrevious[idx] !== 0) {
                    const dtLaplacian = (laplacian - (
                        this.pressurePrevious[rightIdx] +
                        this.pressurePrevious[leftIdx] +
                        this.pressurePrevious[upIdx] +
                        this.pressurePrevious[downIdx] -
                        4 * this.pressurePrevious[idx]
                    )) / dt;

                    pressureNext[idx] -= viscothermalCoeff * dtLaplacian;
                }

                // Handle wall losses (Qb)
                if (this.isAdjacentToWall(i, j, walls)) {
                    const pressureDiff = pressureNext[idx] - this.pressureCurrent[idx];
                    pressureNext[idx] *= (1 - wallAbsorption);
                    this.powerLossWall += wallAbsorption * pressureDiff * pressureDiff;
                }

                // Handle air losses (Qi)
                const pressureDiff = pressureNext[idx] - this.pressureCurrent[idx];
                pressureNext[idx] *= (1 - airAbsorption * 0.1); // Scale down the effect
                this.powerLossField += airAbsorption * pressureDiff * pressureDiff;

                // Clean up small values
                if (Math.abs(pressureNext[idx]) < this.minPressureThreshold) {
                    pressureNext[idx] = 0;
                }
            }
        }

        // Update time steps (recursion as shown in slides)
        this.pressurePrevious.set(this.pressureCurrent);
        this.pressureCurrent.set(pressureNext);
    }

    applyDamping(factor) {
        for (let i = 0; i < this.pressureCurrent.length; i++) {
            this.pressureCurrent[i] *= factor;
            this.pressurePrevious[i] *= factor;
        }
    }
}