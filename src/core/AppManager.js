/**
 * Application Manager
 *
 * Handles the initialization and coordination of all application components.
 * Provides methods for reinitializing the simulation with new parameters.
 */
class AppManager {
    constructor() {
        this.simManager = null;
        this.gui = null;
        this.initialized = false;
    }

    /**
     * Expose components to global scope for debugging/compatibility
     */
    exposeGlobals(components = {}) {
        // Set default components from instance
        const globalsToExpose = {
            gui: this.gui,
            simManager: this.simManager,
            simulation: this.simManager?.simulation,
            ...components
        };

        // Expose each component to window
        Object.entries(globalsToExpose).forEach(([key, value]) => {
            if (value !== undefined) {
                window[key] = value;
            }
        });
    }

    /**
     * Clear global references
     */
    clearGlobals(keys = ['gui', 'simManager', 'simulation']) {
        keys.forEach(key => {
            window[key] = null;
        });
    }

    /**
     * Initialize the entire application
     */
    async initialize() {
        try {
            // First initialize the simulation
            await this.initializeSimulation();

            // Then initialize the GUI with the simulation already available
            this.gui = new GUI();
            await this.gui.init();

            // Make components globally accessible
            this.exposeGlobals();

            this.initialized = true;
            return true;
        } catch (error) {
            console.error('Failed to initialize application:', error);
            return false;
        }
    }

    /**
     * Initialize the simulation with the given parameters
     */
    async initializeSimulation(customParams = null) {
        const SIMULATION_WIDTH = 800;
        const SIMULATION_HEIGHT = 600;

        // Initialize simulation with dimensions
        const simParams = customParams || {
            room: {
                width: SIMULATION_WIDTH,
                height: SIMULATION_HEIGHT,
                physicalWidth: window.params.room.physicalWidth,
                physicalHeight: window.params.room.physicalHeight,
                leftRoomRatio: window.params.room.leftRoomRatio,
                roomHeightRatio: window.params.room.roomHeightRatio,
                corridorRatio: window.params.room.corridorRatio,
                marginRatio: window.params.room.marginRatio
            },
            physics: window.params.physics,
            source: window.params.source,
            medium: window.params.medium,
            controls: {
                ...window.params.controls,
                resolution: 2 // Fixed at medium quality
            }
        };

        // Dispose of existing simulation if any
        if (this.simManager) {
            this.simManager.dispose();
        }

        // Create and initialize simulation manager
        this.simManager = new SimulationManager(simParams);
        await this.simManager.initialize(simParams);  // Wait for initialization to complete

        // Make simulation globally accessible
        this.exposeGlobals();

        return this.simManager;
    }

    /**
     * Change the simulation resolution - now resolution is fixed
     */
    async changeResolution(resolution) {
        // Resolution is fixed at medium quality
        return this.simManager?.simulation;
    }

    /**
     * Reinitialize the simulation with new parameters
     */
    async reinitializeSimulation(newParams) {
        // Temporarily set simulation to null to indicate it's being reinitialized
        this.clearGlobals(['simulation']);

        try {
            await this.initializeSimulation(newParams);
            return this.simManager.simulation;
        } catch (error) {
            console.error('Failed to reinitialize simulation:', error);
            return null;
        }
    }

    /**
     * Clean up resources when the application is closed
     */
    dispose() {
        if (this.simManager) {
            this.simManager.dispose();
            this.simManager = null;
        }

        // Remove global references
        this.clearGlobals();
    }
}

// Export for browser use
window.AppManager = AppManager;