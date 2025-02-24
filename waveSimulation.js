class WaveSimulation {
    constructor(width, height, cellSize = 2) {
        this.width = width;
        this.height = height;
        this.cellSize = cellSize;

        // Calculate grid dimensions
        this.cols = Math.floor(width / cellSize);
        this.rows = Math.floor(height / cellSize);

        // Create pressure grids (we need current and previous state)
        const gridSize = this.cols * this.rows;
        this.pressure = new Float32Array(gridSize);
        this.previousPressure = new Float32Array(gridSize);
        this.newPressure = new Float32Array(gridSize);

        // Simulation parameters
        this.c = 343; // Speed of sound in m/s
        this.dx = 0.1; // Grid spacing in meters
        this.dt = (this.dx / (this.c * Math.sqrt(2))) * 0.5; // Time step (CFL condition)

        // Decay parameters
        this.wallAbsorption = 0.1; // How much energy is lost at walls (0 = full reflection, 1 = full absorption)
        this.globalDecay = 0.99; // Base global decay
        this.boundaryWidth = 4; // Width of boundary absorption region

        // Source parameters
        this.sourceX = Math.floor(this.cols / 2);
        this.sourceY = Math.floor(this.rows / 2);
        this.frequency = 440; // Hz
        this.amplitude = 0.5;
        this.isSourceActive = false;
        this.time = 0;

        // Debug flag to verify absorption
        console.log("Initial absorption:", this.wallAbsorption);

        // Precalculate constants
        this.c2dt2_dx2 = (this.c * this.c * this.dt * this.dt) / (this.dx * this.dx);

        // Precalculate neighbor indices for better performance
        this.neighborIndices = new Int32Array(gridSize * 5);
        for (let i = 1; i < this.cols - 1; i++) {
            for (let j = 1; j < this.rows - 1; j++) {
                const baseIdx = (i + j * this.cols) * 5;
                const idx = i + j * this.cols;
                this.neighborIndices[baseIdx] = idx;  // Center
                this.neighborIndices[baseIdx + 1] = idx - 1;  // Left
                this.neighborIndices[baseIdx + 2] = idx + 1;  // Right
                this.neighborIndices[baseIdx + 3] = idx - this.cols;  // Up
                this.neighborIndices[baseIdx + 4] = idx + this.cols;  // Down
            }
        }
    }

    setSource(x, y) {
        this.sourceX = Math.floor(x / this.cellSize);
        this.sourceY = Math.floor(y / this.cellSize);
    }

    setDecayRate(value) {
        // Scale to make the control more intuitive
        this.wallAbsorption = Math.max(0, Math.min(1, value));
        // Adjust global decay based on absorption
        this.globalDecay = 0.99 - (this.wallAbsorption * 0.01);
        console.log("Decay rate set to:", this.wallAbsorption, "Global decay:", this.globalDecay);
    }

    setFrequency(freq) {
        this.frequency = freq;
    }

    triggerImpulse() {
        this.isSourceActive = true;
        this.time = 0;
        this.pressure.fill(0);
        this.previousPressure.fill(0);
        this.newPressure.fill(0);
    }

    // Calculate absorption factor based on distance from walls
    getAbsorptionFactor(i, j) {
        const distFromLeft = i;
        const distFromRight = this.cols - 1 - i;
        const distFromTop = j;
        const distFromBottom = this.rows - 1 - j;
        const minDist = Math.min(distFromLeft, distFromRight, distFromTop, distFromBottom);

        if (minDist < this.boundaryWidth) {
            // Calculate normalized distance from wall (0 at wall, 1 at boundaryWidth)
            const normalizedDist = minDist / this.boundaryWidth;
            // Use exponential falloff for smoother absorption
            const absorptionStrength = Math.exp(-3 * normalizedDist);
            // Calculate reflection coefficient (1 = full reflection, 0 = full absorption)
            return Math.max(0, 1 - (this.wallAbsorption * absorptionStrength));
        }
        return 1;
    }

    update() {
        // Update pressure values
        for (let i = 1; i < this.cols - 1; i++) {
            for (let j = 1; j < this.rows - 1; j++) {
                const baseIdx = (i + j * this.cols) * 5;
                const idx = this.neighborIndices[baseIdx];
                const idxLeft = this.neighborIndices[baseIdx + 1];
                const idxRight = this.neighborIndices[baseIdx + 2];
                const idxUp = this.neighborIndices[baseIdx + 3];
                const idxDown = this.neighborIndices[baseIdx + 4];

                // Standard FDTD update
                this.newPressure[idx] = (
                    2 * this.pressure[idx] -
                    this.previousPressure[idx] +
                    this.c2dt2_dx2 * (
                        this.pressure[idxRight] +
                        this.pressure[idxLeft] +
                        this.pressure[idxDown] +
                        this.pressure[idxUp] -
                        4 * this.pressure[idx]
                    )
                );

                // Apply absorption first
                const absorptionFactor = this.getAbsorptionFactor(i, j);
                this.newPressure[idx] *= absorptionFactor;

                // Then apply global decay
                this.newPressure[idx] *= this.globalDecay;

                // More aggressive small value damping
                if (Math.abs(this.newPressure[idx]) < 0.01) {
                    this.newPressure[idx] *= 0.7;
                }
            }
        }

        // Add source if active
        if (this.isSourceActive) {
            const gaussianWidth = 0.0001;
            const gaussianAmplitude = Math.exp(-this.time * this.time / gaussianWidth);
            const sourceIdx = this.sourceX + this.sourceY * this.cols;

            if (gaussianAmplitude >= 0.01) {
                const sourceValue = this.amplitude * gaussianAmplitude *
                    Math.sin(2 * Math.PI * this.frequency * this.time);

                // Add the pulse to source point and immediate neighbors for smoother emission
                this.newPressure[sourceIdx] += sourceValue;
                if (this.sourceX > 0) this.newPressure[sourceIdx - 1] += sourceValue * 0.5;
                if (this.sourceX < this.cols - 1) this.newPressure[sourceIdx + 1] += sourceValue * 0.5;
                if (this.sourceY > 0) this.newPressure[sourceIdx - this.cols] += sourceValue * 0.5;
                if (this.sourceY < this.rows - 1) this.newPressure[sourceIdx + this.cols] += sourceValue * 0.5;

                this.time += this.dt;
            } else {
                this.isSourceActive = false;
            }
        }

        // Swap buffers
        const temp = this.previousPressure;
        this.previousPressure = this.pressure;
        this.pressure = this.newPressure;
        this.newPressure = temp;
    }

    getPressure(x, y) {
        const i = Math.floor(x / this.cellSize);
        const j = Math.floor(y / this.cellSize);
        if (i >= 0 && i < this.cols && j >= 0 && j < this.rows) {
            return this.pressure[i + j * this.cols];
        }
        return 0;
    }
} 