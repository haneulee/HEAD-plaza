interface MediaTrackConstraintSet {
  zoom?: number;
}

interface MediaTrackCapabilities {
  zoom?: {
    min: number;
    max: number;
    step: number;
  };
}
