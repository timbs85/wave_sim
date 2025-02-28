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
     * Initialize the entire application
     */
    async initialize() {
        try {
            console.log('Initializing application...');

            // First initialize the simulation
            await this.initializeSimulation();
            console.log('Simulation initialization complete');

            // Then initialize the GUI with the simulation already available
            this.gui = new GUI();
            await this.gui.init();
            console.log('GUI initialization complete');

            // Make components globally accessible
            window.gui = this.gui;

            this.initialized = true;
            console.log('Application initialization complete');

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
                resolution: window.simResolution || 8
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
        window.simManager = this.simManager;
        window.simulation = this.simManager.simulation;

        return this.simManager;
    }

    /**
     * Change the simulation resolution
     */
    async changeResolution(resolution) {
        if (!this.simManager) return null;

        // Temporarily set simulation to null to indicate it's being reinitialized
        const oldSimulation = window.simulation;
        window.simulation = null;

        try {
            // Use the simulation manager's resolution change method
            const newSimulation = await this.simManager.changeResolution(resolution);
            window.simulation = newSimulation;
            window.simResolution = resolution;

            return newSimulation;
        } catch (error) {
            console.error('Failed to change resolution:', error);
            window.simulation = oldSimulation; // Restore old simulation on error
            return oldSimulation;
        }
    }

    /**
     * Reinitialize the simulation with new parameters
     */
    async reinitializeSimulation(newParams) {
        // Temporarily set simulation to null to indicate it's being reinitialized
        window.simulation = null;

        try {
            await this.initializeSimulation(newParams);
            return window.simulation;
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

        window.simManager = null;
        window.simulation = null;
    }
}

// Export for browser use
window.AppManager = AppManager;