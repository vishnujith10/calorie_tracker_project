import { useState } from 'react';

const useTodaySteps = () => {
  return { 
    stepsToday: 0, 
    isPedometerAvailable: false, 
    distanceKm: 0, 
    calories: 0, 
    error: null,
    debugInfo: "Disabled",
    diagnostics: {
      pedometerSupported: false,
      permissionsGranted: false,
      sensorActive: false,
      lastEventTime: null,
      totalEvents: 0
    },
    addTestSteps: () => {},
    resetSteps: () => {},
    reloadStepsFromDatabase: () => {},
    runFullDiagnostic: () => {},
    saveGoalToDatabase: () => {},
    loadGoalFromDatabase: () => {}
  };
};

export default useTodaySteps;