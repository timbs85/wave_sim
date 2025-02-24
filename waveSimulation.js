class WaveSimulation {
    constructor(width, height, cellSize = 2) {
        this.width = width;
        this.height = height;
        this.cellSize = cellSize;

        // Calculate grid dimensions
        this.cols = Math.floor(width / cellSize);
        this.rows = Math.floor(height / cellSize);

        // Create pressure grids (we need current and previous state)
        // Using typed arrays for better performance
        const gridSize = this.cols * this.rows;
        this.pressure = new Float32Array(gridSize);
        this.previousPressure = new Float32Array(gridSize);
        this.newPressure = new Float32Array(gridSize);

        // Simulation parameters
        this.c = 343; // Speed of sound in m/s
        this.dx = 0.1; // Grid spacing in meters (increased for stability)
        // Calculate dt based on CFL condition for stability
        this.dt = (this.dx / (this.c * Math.sqrt(2))) * 0.5; // Time step (CFL condition)
        this.absorption = 0.1; // Wall absorption coefficient (0 = full reflection, 1 = full absorption)

        // Source parameters
        this.sourceX = Math.floor(this.cols / 2);
        this.sourceY = Math.floor(this.rows / 2);
        this.frequency = 440; // Hz
        this.amplitude = 0.5; // Reduced amplitude for better visualization
        this.isSourceActive = false;
        this.time = 0; // Keep track of simulation time

        // Precalculate constants and indices for better performance
        this.c2dt2_dx2 = (this.c * this.c * this.dt * this.dt) / (this.dx * this.dx);
        this.dampingFactor = (1 - this.absorption * 0.01);

        // Precalculate neighbor indices for the entire grid
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

    // Get array index from 2D coordinates
    getIndex(i, j) {
        return i + j * this.cols;
    }

    // Set source position in grid coordinates
    setSource(x, y) {
        this.sourceX = Math.floor(x / this.cellSize);
        this.sourceY = Math.floor(y / this.cellSize);
    }

    // Set wall absorption coefficient
    setAbsorption(value) {
        this.absorption = Math.max(0, Math.min(1, value));
        this.dampingFactor = (1 - this.absorption * 0.01);
    }

    // Set source frequency
    setFrequency(freq) {
        this.frequency = freq;
    }

    // Trigger a single impulse
    triggerImpulse() {
        this.isSourceActive = true;
        this.time = 0; // Reset time
        // Clear the pressure fields
        this.pressure.fill(0);
        this.previousPressure.fill(0);
        this.newPressure.fill(0);
    }

    // Update simulation state
    update() {
        // Update pressure values using precalculated indices
        for (let i = 1; i < this.cols - 1; i++) {
            for (let j = 1; j < this.rows - 1; j++) {
                const baseIdx = (i + j * this.cols) * 5;
                const idx = this.neighborIndices[baseIdx];
                const idxLeft = this.neighborIndices[baseIdx + 1];
                const idxRight = this.neighborIndices[baseIdx + 2];
                const idxUp = this.neighborIndices[baseIdx + 3];
                const idxDown = this.neighborIndices[baseIdx + 4];

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
                ) * this.dampingFactor;
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

                // Add the pulse to source point and immediate neighbors
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

        // Swap buffers using temporary reference
        const temp = this.previousPressure;
        this.previousPressure = this.pressure;
        this.pressure = this.newPressure;
        this.newPressure = temp;
    }

    // Get pressure value at specific position
    getPressure(x, y) {
        const i = Math.floor(x / this.cellSize);
        const j = Math.floor(y / this.cellSize);
        if (i >= 0 && i < this.cols && j >= 0 && j < this.rows) {
            return this.pressure[i + j * this.cols];
        }
        return 0;
    }
} 