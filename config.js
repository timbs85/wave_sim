const SimConfig = {
    physics: {
        speedOfSound: 343,    // Speed of sound in m/s
        density: 1.225,       // Air density in kg/m³
        minPressureThreshold: 1e-12,  // Much lower threshold to preserve subtle waves
    },
    room: {
        physicalWidth: 12.0,  // meters
        physicalHeight: 8.0,  // meters
        leftRoomRatio: 0.35,  // percentage of total width (size of the room)
        roomHeightRatio: 0.70,  // percentage of total height
        corridorRatio: 0.15,  // percentage of total height (door height)
        marginRatio: 0.05     // margin from edges
    },
    source: {
        defaultFrequency: 440,       // Hz
        defaultAmplitude: 0.5,
        defaultX: 0.25,              // percentage from left
        defaultY: 0.60               // percentage from top
    },
    medium: {
        defaultWallAbsorption: 0.1,
        defaultAirAbsorption: 0.001,
        maxAirAbsorption: 0.015      // maximum air absorption coefficient
    }
}; 