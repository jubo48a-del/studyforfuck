
export enum Language {
  EN = 'en',
  BN = 'bn'
}

export enum TimerMode {
  NORMAL = 'NORMAL',
  POMODORO = 'POMODORO',
  DEEP_STUDY = 'DEEP_STUDY'
}

export interface Subject {
  id: string;
  nameEn: string;
  nameBn: string;
  papers: number[]; // e.g. [1, 2]
}

export interface StudySession {
  id: string;
  subjectId: string;
  paper: number;
  topic: string;
  durationMinutes: number;
  timestamp: number;
  difficulty: 'easy' | 'medium' | 'hard';
  points: number;
}

export interface UserProfile {
  name: string;
  nickname: string;
  language: Language;
  dailyGoalMinutes: number;
  onboardingComplete: boolean;
  points: number;
  streak: number;
  lastStudyDate: string | null;
}

export interface Badge {
  id: string;
  labelEn: string;
  labelBn: string;
  symbol: string;
  color: string;
}
