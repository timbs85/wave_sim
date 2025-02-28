// Simulation parameters and configuration
const params = {
    // Core physics parameters
    physics: {
        speedOfSound: 343,    // Speed of sound in m/s
        density: 1.225,       // Air density in kg/m³
        minPressureThreshold: 1e-12,  // Much lower threshold to preserve subtle waves
    },

    // Room configuration
    room: {
        width: 800,           // Fixed simulation width in pixels
        height: 600,          // Fixed simulation height in pixels
        physicalWidth: 12.0,  // meters
        physicalHeight: 8.0,  // meters
        // Room geometry parameters
        leftRoomRatio: 0.35,  // percentage of total width (size of the room)
        roomHeightRatio: 0.70,// percentage of total height
        corridorRatio: 0.15,  // percentage of total height (door height)
        marginRatio: 0.05     // margin from edges
    },

    // Source configuration
    source: {
        defaultFrequency: 440,    // Hz
        defaultAmplitude: 0.5,
        defaultX: 0.25,           // percentage from left
        defaultY: 0.60            // percentage from top
    },

    // Medium properties
    medium: {
        maxAirAbsorption: 0.015   // maximum air absorption coefficient
    },

    // GUI-controlled parameters (with defaults)
    controls: {
        airAbsorption: 80,        // % (scaled by maxAirAbsorption)
        wallAbsorption: 90,       // %
        frequency: 440,           // Hz (concert A)
        contrast: 50,             // %
        lowClip: 0,              // %
        resolution: 8,            // pixels per cell
        visualizationMode: 'pressure', // 'pressure' or 'intensity'
        paused: false            // simulation running state
    },

    // Visualization
    visualization: {
        pressureSteps: 1024,     // Number of pre-calculated color values
    }
};

// Export for browser use
window.params = params;