export interface Trial {
  position: number; // 0-8
  letter: string;   // A-Z
}

export interface UserResponse {
  positionMatch: boolean;
  letterMatch: boolean;
}

export interface SessionStats {
  nLevel: number;
  accuracy: number;
  position: {
    correct: number;
    falseAlarm: number;
    missed: number;
  };
  audio: {
    correct: number;
    falseAlarm: number;
    missed: number;
  };
  timestamp: number;
}
