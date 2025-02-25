class Signal {
    constructor(type = 'sine', params = {}) {
        this.type = type;
        this.frequency = params.frequency || 440;
        this.amplitude = params.amplitude || 0.5;
        this.phase = params.phase || 0;
        this.time = 0;

        // Optional parameters for specific waveforms
        this.pulseWidth = params.pulseWidth || 0.5;  // For square/pulse waves (0-1)
        this.harmonics = params.harmonics || 1;      // For sawtooth/triangle
        this.attack = params.attack || 0;            // Envelope parameters
        this.decay = params.decay || 0;
        this.sustain = params.sustain || 1;
        this.release = params.release || 0;
    }

    getValue(dt) {
        this.time += dt;
        const t = this.time;
        const w = 2 * Math.PI * this.frequency;
        let value = 0;

        switch (this.type) {
            case 'sine':
                value = Math.sin(w * t + this.phase);
                break;

            case 'square':
                value = Math.sign(Math.sin(w * t + this.phase));
                break;

            case 'pulse':
                const cyclePosition = ((w * t + this.phase) % (2 * Math.PI)) / (2 * Math.PI);
                value = cyclePosition < this.pulseWidth ? 1 : -1;
                break;

            case 'sawtooth':
                value = 0;
                for (let i = 1; i <= this.harmonics; i++) {
                    value += Math.sin(i * w * t) / i;
                }
                value = (2 / Math.PI) * value;
                break;

            case 'triangle':
                value = (2 / Math.PI) * Math.asin(Math.sin(w * t + this.phase));
                break;

            case 'noise':
                value = 2 * (Math.random() - 0.5);
                break;

            case 'impulse':
                value = this.time < dt ? 1 : 0;
                break;

            default:
                value = 0;
        }

        // Apply envelope if any ADSR parameters are non-zero
        if (this.attack || this.decay || this.release) {
            const envelope = this.getEnvelope(t);
            value *= envelope;
        }

        return this.amplitude * value;
    }

    getEnvelope(t) {
        const totalTime = this.attack + this.decay + this.release;

        if (t < this.attack) {
            return t / this.attack;
        } else if (t < this.attack + this.decay) {
            const decayPhase = (t - this.attack) / this.decay;
            return 1 - (1 - this.sustain) * decayPhase;
        } else if (t < totalTime - this.release) {
            return this.sustain;
        } else if (t < totalTime) {
            const releasePhase = (t - (totalTime - this.release)) / this.release;
            return this.sustain * (1 - releasePhase);
        }
        return 0;
    }

    reset() {
        this.time = 0;
    }

    setFrequency(freq) {
        this.frequency = freq;
    }

    setAmplitude(amp) {
        this.amplitude = amp;
    }

    setType(type) {
        this.type = type;
    }
} 