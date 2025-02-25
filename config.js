const SimConfig = {
    physics: {
        speedOfSound: 343,    // Speed of sound in m/s
        minPressureThreshold: 0.001,
        gaussianWidth: 0.0001
    },
    room: {
        physicalWidth: 12.0,  // meters
        physicalHeight: 8.0,  // meters
        leftRoomRatio: 0.40,  // percentage of total width
        roomHeightRatio: 0.70,  // percentage of total height
        corridorRatio: 0.15,  // percentage of total height
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