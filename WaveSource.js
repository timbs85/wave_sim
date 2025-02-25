class WaveSource {
    constructor(cols, rows, dx) {
        this.cols = cols;
        this.rows = rows;
        this.dx = dx;

        // Source parameters
        this.x = Math.floor(cols * SimConfig.source.defaultX);
        this.y = Math.floor(rows * SimConfig.source.defaultY);

        // Create default signal
        this.signal = new Signal('sine', {
            frequency: SimConfig.source.defaultFrequency,
            amplitude: SimConfig.source.defaultAmplitude
        });

        // State
        this.isActive = false;
    }

    setPosition(gridX, gridY, walls) {
        // Check if position is valid (not in a wall and within bounds)
        if (gridX >= 0 && gridX < this.cols && gridY >= 0 && gridY < this.rows) {
            const idx = gridX + gridY * this.cols;
            if (!walls[idx]) {
                this.x = gridX;
                this.y = gridY;
                return true;
            }
        }
        return false;
    }

    setFrequency(freq) {
        this.signal.setFrequency(freq);
        console.log('Source frequency set to:', freq, 'Hz');
    }

    setSignal(type, params = {}) {
        this.signal = new Signal(type, params);
    }

    trigger() {
        this.isActive = true;
        this.signal.reset();
        console.log('Source triggered');
    }

    updateSource(pressureField, dt) {
        if (!this.isActive) return;

        const sourceValue = this.signal.getValue(dt);
        if (sourceValue !== 0) {
            const sourceIdx = this.x + this.y * this.cols;
            this._applySourcePressure(pressureField, sourceIdx, sourceValue);
        } else {
            this.isActive = false;
        }
    }

    _applySourcePressure(pressureField, sourceIdx, sourceValue) {
        // For the two-step method, we need to inject the source term into both current and previous time steps
        // This ensures proper wave generation in the FDTD scheme

        // Apply to current time step with full amplitude
        pressureField.pressureCurrent[sourceIdx] += sourceValue;

        // Apply to previous time step with slightly reduced amplitude to create forward-propagating waves
        pressureField.pressurePrevious[sourceIdx] += sourceValue * 0.9;

        // Apply smooth spatial distribution using a compact 5-point stencil
        const diagonalWeight = 0.35;  // Weight for diagonal neighbors
        const cardinalWeight = 0.5;   // Weight for cardinal neighbors

        // Cardinal directions - current time step
        if (this.x > 0)
            pressureField.pressureCurrent[sourceIdx - 1] += sourceValue * cardinalWeight;
        if (this.x < this.cols - 1)
            pressureField.pressureCurrent[sourceIdx + 1] += sourceValue * cardinalWeight;
        if (this.y > 0)
            pressureField.pressureCurrent[sourceIdx - this.cols] += sourceValue * cardinalWeight;
        if (this.y < this.rows - 1)
            pressureField.pressureCurrent[sourceIdx + this.cols] += sourceValue * cardinalWeight;

        // Cardinal directions - previous time step (with reduced amplitude)
        if (this.x > 0)
            pressureField.pressurePrevious[sourceIdx - 1] += sourceValue * cardinalWeight * 0.9;
        if (this.x < this.cols - 1)
            pressureField.pressurePrevious[sourceIdx + 1] += sourceValue * cardinalWeight * 0.9;
        if (this.y > 0)
            pressureField.pressurePrevious[sourceIdx - this.cols] += sourceValue * cardinalWeight * 0.9;
        if (this.y < this.rows - 1)
            pressureField.pressurePrevious[sourceIdx + this.cols] += sourceValue * cardinalWeight * 0.9;

        // Diagonal neighbors - current time step
        if (this.x > 0 && this.y > 0)
            pressureField.pressureCurrent[sourceIdx - 1 - this.cols] += sourceValue * diagonalWeight;
        if (this.x < this.cols - 1 && this.y > 0)
            pressureField.pressureCurrent[sourceIdx + 1 - this.cols] += sourceValue * diagonalWeight;
        if (this.x > 0 && this.y < this.rows - 1)
            pressureField.pressureCurrent[sourceIdx - 1 + this.cols] += sourceValue * diagonalWeight;
        if (this.x < this.cols - 1 && this.y < this.rows - 1)
            pressureField.pressureCurrent[sourceIdx + 1 + this.cols] += sourceValue * diagonalWeight;

        // Diagonal neighbors - previous time step (with reduced amplitude)
        if (this.x > 0 && this.y > 0)
            pressureField.pressurePrevious[sourceIdx - 1 - this.cols] += sourceValue * diagonalWeight * 0.9;
        if (this.x < this.cols - 1 && this.y > 0)
            pressureField.pressurePrevious[sourceIdx + 1 - this.cols] += sourceValue * diagonalWeight * 0.9;
        if (this.x > 0 && this.y < this.rows - 1)
            pressureField.pressurePrevious[sourceIdx - 1 + this.cols] += sourceValue * diagonalWeight * 0.9;
        if (this.x < this.cols - 1 && this.y < this.rows - 1)
            pressureField.pressurePrevious[sourceIdx + 1 + this.cols] += sourceValue * diagonalWeight * 0.9;
    }
} 