## ADDED Requirements

### Requirement: Waveform analyzer is included in the main view
The Angular app SHALL include the waveform analyzer UI in its main view, comprising two waveform windows (original and processed) as defined by the frontend-waveform-analyzer capability.

#### Scenario: Waveform analyzer visible in app
- **WHEN** the built application is opened in a browser and a track is available
- **THEN** the original waveform window is visible in the main view

#### Scenario: Waveform layout with transport
- **WHEN** the user views the app
- **THEN** the waveform analyzer is presented in the same main view as the transport controls (e.g. same page or card layout)
