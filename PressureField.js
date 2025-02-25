class PressureField {
    constructor(cols, rows) {
        this.cols = cols;
        this.rows = rows;
        const gridSize = cols * rows;

        // Create pressure grids
        this.current = new Float32Array(gridSize);
        this.previous = new Float32Array(gridSize);
        this.next = new Float32Array(gridSize);

        // Create neighbor information arrays
        this.nonWallNeighborCount = new Uint8Array(gridSize);
        this.neighborIndices = new Int32Array(gridSize * 5);
    }

    reset() {
        this.current.fill(0);
        this.previous.fill(0);
        this.next.fill(0);
    }

    swapBuffers() {
        // Debug: Check buffer values before swap
        let maxCurrent = 0;
        let maxNext = 0;

        // Find max values using loops instead of spread
        for (let i = 0; i < this.current.length; i++) {
            maxCurrent = Math.max(maxCurrent, Math.abs(this.current[i]));
            maxNext = Math.max(maxNext, Math.abs(this.next[i]));
        }

        if (maxCurrent > 0.001 || maxNext > 0.001) {
            console.log('Before swap - Max values:', {
                current: maxCurrent,
                next: maxNext
            });
        }

        const temp = this.previous;
        this.previous = this.current;
        this.current = this.next;
        this.next = temp;

        // Clear next buffer
        this.next.fill(0);
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

    getPressure(x, y, cellSize) {
        const i = Math.floor(x / cellSize);
        const j = Math.floor(y / cellSize);
        if (i >= 0 && i < this.cols && j >= 0 && j < this.rows) {
            return this.current[i + j * this.cols];
        }
        return 0;
    }

    updatePressure(walls, c2dt2_dx2, wallAbsorption, airAbsorption) {
        let maxPressure = 0;
        let maxPressurePos = { x: 0, y: 0 };

        for (let i = 1; i < this.cols - 1; i++) {
            for (let j = 1; j < this.rows - 1; j++) {
                const idx = i + j * this.cols;
                if (walls[idx] === 1) continue;

                const baseIdx = idx * 5;
                let neighborSum = 0;

                // Sum up non-wall neighbors
                for (let n = 1; n <= 4; n++) {
                    const neighborIdx = this.neighborIndices[baseIdx + n];
                    if (!walls[neighborIdx]) {
                        neighborSum += this.current[neighborIdx];
                    }
                }

                // FDTD update
                this.next[idx] = (
                    2 * this.current[idx] -
                    this.previous[idx] +
                    c2dt2_dx2 * (
                        neighborSum -
                        this.nonWallNeighborCount[idx] * this.current[idx]
                    )
                );

                // Apply absorptions
                if (this.nonWallNeighborCount[idx] < 4) {
                    this.next[idx] *= (1 - wallAbsorption);
                }
                this.next[idx] *= (1 - airAbsorption);

                // Track maximum pressure
                if (Math.abs(this.next[idx]) > maxPressure) {
                    maxPressure = Math.abs(this.next[idx]);
                    maxPressurePos = { x: i, y: j };
                }

                // Clean up small values
                if (Math.abs(this.next[idx]) < SimConfig.physics.minPressureThreshold) {
                    this.next[idx] = 0;
                }
            }
        }

        // Log maximum pressure if it's significant
        if (maxPressure > 0.01) {
            console.log('Max pressure:', maxPressure, 'at position:', maxPressurePos);
        }
    }

    dispose() {
        this.current = null;
        this.previous = null;
        this.next = null;
        this.nonWallNeighborCount = null;
        this.neighborIndices = null;
    }
} 