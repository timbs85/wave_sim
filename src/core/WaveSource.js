class WaveSource {
    constructor(params) {
        this.cols = params.cols;
        this.rows = params.rows;
        this.dx = params.dx;

        // Source parameters
        this.x = params.x;
        this.y = params.y;

        // Create default signal
        this.signal = new Signal('sine', {
            frequency: params.frequency,
            amplitude: params.amplitude
        });

        // State
        this.isActive = false;

        // Amplitude scaling factor is always 1.0 now
        this.amplitudeScale = 1.0;
    }

    setPosition(x, y) {
        // Ensure coordinates are within grid bounds
        if (x >= 0 && x < this.cols && y >= 0 && y < this.rows) {
            this.x = Math.floor(x);
            this.y = Math.floor(y);
            return true;
        }
        return false;
    }

    setFrequency(freq) {
        this.signal.setFrequency(freq);
    }

    setSignal(type, params = {}) {
        this.signal = new Signal(type, params);
    }

    // Set amplitude scaling factor - kept for backward compatibility
    setAmplitudeScale(scale) {
        // Do nothing - amplitude scaling is no longer applied
        this.amplitudeScale = 1.0;
    }

    trigger() {
        this.isActive = true;
        this.signal.reset();
    }

    updateSource(pressureField, dt) {
        if (!this.isActive) return;

        // Get the base source value from the signal
        const baseSourceValue = this.signal.getValue(dt);

        if (baseSourceValue !== 0) {
            // Use the source value directly without scaling
            const sourceValue = baseSourceValue;
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