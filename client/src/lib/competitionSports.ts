export type SportFamily = 'dance' | 'racket' | 'sport' | 'combat' | 'mind' | 'other';

export interface ScoringCriterion {
  key: string;
  label: string;
  description: string;
  min: number;
  max: number;
  weight?: number;
}

export interface SportConfig {
  key: string;
  label: string;
  emoji: string;
  family: SportFamily;
  participantLabel: string;
  participantLabelPlural: string;
  format: 'judge_criteria' | 'score_entry' | 'winner_pick' | 'sets';
  criteria: ScoringCriterion[];
  judgePanel: 'dance' | 'score' | 'winner' | 'sets' | 'table_tennis';
  color: string;
  description: string;
  supportsDoubles?: boolean;
  pointsPerGame?: number; // e.g. 11 for TT
}

export const SPORT_CONFIGS: Record<string, SportConfig> = {
  BREAKING: {
    key: 'BREAKING',
    label: 'Breaking',
    emoji: '🕺',
    family: 'dance',
    participantLabel: 'dancer',
    participantLabelPlural: 'dancers',
    format: 'judge_criteria',
    judgePanel: 'dance',
    color: 'from-orange-500 to-red-600',
    description: '1v1 break battle with 5-criteria judge scoring',
    criteria: [
      { key: 'techniqueScore', label: 'Technique', description: 'Physical skill, control, power', min: 1, max: 10, weight: 20 },
      { key: 'vocabularyScore', label: 'Vocabulary', description: 'Range of moves & creativity', min: 1, max: 10, weight: 20 },
      { key: 'executionScore', label: 'Execution', description: 'Clean execution, flow', min: 1, max: 10, weight: 20 },
      { key: 'musicalityScore', label: 'Musicality', description: 'Rhythm, timing, music interpretation', min: 1, max: 10, weight: 20 },
      { key: 'originalityScore', label: 'Originality', description: 'Uniqueness, personal style', min: 1, max: 10, weight: 20 },
    ],
  },
  POPPING: {
    key: 'POPPING',
    label: 'Popping',
    emoji: '💥',
    family: 'dance',
    participantLabel: 'dancer',
    participantLabelPlural: 'dancers',
    format: 'judge_criteria',
    judgePanel: 'dance',
    color: 'from-purple-500 to-indigo-600',
    description: '1v1 popping battle with 5-criteria judge scoring',
    criteria: [
      { key: 'techniqueScore', label: 'Technique', description: 'Hit quality, muscle isolation', min: 1, max: 10, weight: 20 },
      { key: 'vocabularyScore', label: 'Vocabulary', description: 'Range of styles, moves', min: 1, max: 10, weight: 20 },
      { key: 'executionScore', label: 'Execution', description: 'Precision, body control', min: 1, max: 10, weight: 20 },
      { key: 'musicalityScore', label: 'Musicality', description: 'Music interpretation, grooves', min: 1, max: 10, weight: 20 },
      { key: 'originalityScore', label: 'Originality', description: 'Personal style, creativity', min: 1, max: 10, weight: 20 },
    ],
  },
  LOCKING: {
    key: 'LOCKING',
    label: 'Locking',
    emoji: '🔒',
    family: 'dance',
    participantLabel: 'dancer',
    participantLabelPlural: 'dancers',
    format: 'judge_criteria',
    judgePanel: 'dance',
    color: 'from-yellow-500 to-orange-500',
    description: '1v1 locking battle',
    criteria: [
      { key: 'techniqueScore', label: 'Technique', description: 'Lock quality, timing', min: 1, max: 10, weight: 20 },
      { key: 'vocabularyScore', label: 'Vocabulary', description: 'Locking repertoire', min: 1, max: 10, weight: 20 },
      { key: 'executionScore', label: 'Execution', description: 'Flow and precision', min: 1, max: 10, weight: 20 },
      { key: 'musicalityScore', label: 'Musicality', description: 'Funky interpretation', min: 1, max: 10, weight: 20 },
      { key: 'originalityScore', label: 'Originality', description: 'Character, originality', min: 1, max: 10, weight: 20 },
    ],
  },
  HIPHOP: {
    key: 'HIPHOP',
    label: 'Hip-Hop',
    emoji: '🎤',
    family: 'dance',
    participantLabel: 'dancer',
    participantLabelPlural: 'dancers',
    format: 'judge_criteria',
    judgePanel: 'dance',
    color: 'from-blue-500 to-cyan-600',
    description: '1v1 hip-hop battle',
    criteria: [
      { key: 'techniqueScore', label: 'Technique', description: 'Foundation, groove quality', min: 1, max: 10, weight: 20 },
      { key: 'vocabularyScore', label: 'Vocabulary', description: 'Move variety', min: 1, max: 10, weight: 20 },
      { key: 'executionScore', label: 'Execution', description: 'Sharpness, precision', min: 1, max: 10, weight: 20 },
      { key: 'musicalityScore', label: 'Musicality', description: 'Beat interpretation', min: 1, max: 10, weight: 20 },
      { key: 'originalityScore', label: 'Originality', description: 'Style & personality', min: 1, max: 10, weight: 20 },
    ],
  },
  ALL_STYLES: {
    key: 'ALL_STYLES',
    label: 'All Styles',
    emoji: '🌟',
    family: 'dance',
    participantLabel: 'dancer',
    participantLabelPlural: 'dancers',
    format: 'judge_criteria',
    judgePanel: 'dance',
    color: 'from-pink-500 to-rose-600',
    description: 'Open style battle — any dance style',
    criteria: [
      { key: 'techniqueScore', label: 'Technique', description: 'Physical skill & control', min: 1, max: 10, weight: 20 },
      { key: 'vocabularyScore', label: 'Vocabulary', description: 'Range and creativity', min: 1, max: 10, weight: 20 },
      { key: 'executionScore', label: 'Execution', description: 'Clean execution, flow', min: 1, max: 10, weight: 20 },
      { key: 'musicalityScore', label: 'Musicality', description: 'Music connection', min: 1, max: 10, weight: 20 },
      { key: 'originalityScore', label: 'Originality', description: 'Unique voice', min: 1, max: 10, weight: 20 },
    ],
  },
  WAACKING: {
    key: 'WAACKING',
    label: 'Waacking',
    emoji: '💃',
    family: 'dance',
    participantLabel: 'dancer',
    participantLabelPlural: 'dancers',
    format: 'judge_criteria',
    judgePanel: 'dance',
    color: 'from-fuchsia-500 to-pink-600',
    description: '1v1 waacking battle',
    criteria: [
      { key: 'techniqueScore', label: 'Technique', description: 'Arm lines, posing', min: 1, max: 10, weight: 20 },
      { key: 'vocabularyScore', label: 'Vocabulary', description: 'Movement vocabulary', min: 1, max: 10, weight: 20 },
      { key: 'executionScore', label: 'Execution', description: 'Precision and power', min: 1, max: 10, weight: 20 },
      { key: 'musicalityScore', label: 'Musicality', description: 'Disco music interpretation', min: 1, max: 10, weight: 20 },
      { key: 'originalityScore', label: 'Originality', description: 'Performance, character', min: 1, max: 10, weight: 20 },
    ],
  },
  VOGUING: {
    key: 'VOGUING',
    label: 'Voguing',
    emoji: '👑',
    family: 'dance',
    participantLabel: 'dancer',
    participantLabelPlural: 'dancers',
    format: 'judge_criteria',
    judgePanel: 'dance',
    color: 'from-violet-500 to-purple-700',
    description: 'Voguing ball competition',
    criteria: [
      { key: 'techniqueScore', label: 'Technique', description: 'Category execution, dips', min: 1, max: 10, weight: 20 },
      { key: 'vocabularyScore', label: 'Vocabulary', description: 'Vogue repertoire', min: 1, max: 10, weight: 20 },
      { key: 'executionScore', label: 'Execution', description: 'Runway presence', min: 1, max: 10, weight: 20 },
      { key: 'musicalityScore', label: 'Musicality', description: 'Beat control & breaks', min: 1, max: 10, weight: 20 },
      { key: 'originalityScore', label: 'Originality', description: 'Face, body, soul', min: 1, max: 10, weight: 20 },
    ],
  },
  TABLE_TENNIS: {
    key: 'TABLE_TENNIS',
    label: 'Table Tennis',
    emoji: '🏓',
    family: 'racket',
    participantLabel: 'player',
    participantLabelPlural: 'players',
    format: 'sets',
    judgePanel: 'table_tennis',
    color: 'from-green-500 to-emerald-600',
    description: 'Table tennis — singles or doubles, real-time point-by-point live scoring',
    supportsDoubles: true,
    pointsPerGame: 11,
    criteria: [],
  },
  TABLE_TENNIS_DOUBLES: {
    key: 'TABLE_TENNIS_DOUBLES',
    label: 'Table Tennis (Doubles)',
    emoji: '🏓',
    family: 'racket',
    participantLabel: 'pair',
    participantLabelPlural: 'pairs',
    format: 'sets',
    judgePanel: 'table_tennis',
    color: 'from-teal-500 to-green-600',
    description: 'Table tennis doubles — real-time point-by-point live scoring',
    supportsDoubles: true,
    pointsPerGame: 11,
    criteria: [],
  },
  BASKETBALL_3V3: {
    key: 'BASKETBALL_3V3',
    label: 'Basketball 3v3',
    emoji: '🏀',
    family: 'sport',
    participantLabel: 'team',
    participantLabelPlural: 'teams',
    format: 'score_entry',
    judgePanel: 'score',
    color: 'from-orange-400 to-amber-600',
    description: '3v3 streetball — first to 21 or highest score',
    criteria: [
      { key: 'pointsScored', label: 'Points Scored', description: 'Total points in the game', min: 0, max: 100, weight: 100 },
    ],
  },
  FREESTYLE_FOOTBALL: {
    key: 'FREESTYLE_FOOTBALL',
    label: 'Freestyle Football',
    emoji: '⚽',
    family: 'dance',
    participantLabel: 'freestyler',
    participantLabelPlural: 'freestylers',
    format: 'judge_criteria',
    judgePanel: 'dance',
    color: 'from-lime-500 to-green-600',
    description: '1v1 freestyle football battle',
    criteria: [
      { key: 'techniqueScore', label: 'Technique', description: 'Ball control precision', min: 1, max: 10, weight: 25 },
      { key: 'vocabularyScore', label: 'Difficulty', description: 'Move complexity', min: 1, max: 10, weight: 25 },
      { key: 'executionScore', label: 'Execution', description: 'Clean landing, flow', min: 1, max: 10, weight: 25 },
      { key: 'originalityScore', label: 'Creativity', description: 'Original combinations', min: 1, max: 10, weight: 25 },
    ],
  },
  PADEL: {
    key: 'PADEL',
    label: 'Padel',
    emoji: '🎾',
    family: 'racket',
    participantLabel: 'team',
    participantLabelPlural: 'teams',
    format: 'sets',
    judgePanel: 'sets',
    color: 'from-teal-500 to-cyan-600',
    description: 'Padel doubles — best of 3 sets',
    criteria: [
      { key: 'setsWon', label: 'Sets Won', description: 'Number of sets won', min: 0, max: 3, weight: 100 },
    ],
  },
  BOXING: {
    key: 'BOXING',
    label: 'Boxing',
    emoji: '🥊',
    family: 'combat',
    participantLabel: 'boxer',
    participantLabelPlural: 'boxers',
    format: 'judge_criteria',
    judgePanel: 'dance',
    color: 'from-red-500 to-rose-700',
    description: 'Amateur boxing — round-by-round judge scoring',
    criteria: [
      { key: 'techniqueScore', label: 'Clean Punching', description: 'Clean, effective punches landed', min: 1, max: 10, weight: 25 },
      { key: 'vocabularyScore', label: 'Aggression', description: 'Controlled aggression & pressure', min: 1, max: 10, weight: 25 },
      { key: 'executionScore', label: 'Defense', description: 'Guard, slipping, ring movement', min: 1, max: 10, weight: 25 },
      { key: 'originalityScore', label: 'Ring Generalship', description: 'Control of pace & ring', min: 1, max: 10, weight: 25 },
    ],
  },
  ARM_WRESTLING: {
    key: 'ARM_WRESTLING',
    label: 'Arm Wrestling',
    emoji: '💪',
    family: 'combat',
    participantLabel: 'athlete',
    participantLabelPlural: 'athletes',
    format: 'winner_pick',
    judgePanel: 'winner',
    color: 'from-slate-500 to-zinc-700',
    description: 'Arm wrestling — best of 3 rounds',
    criteria: [],
  },
  CHESS: {
    key: 'CHESS',
    label: 'Chess',
    emoji: '♟️',
    family: 'mind',
    participantLabel: 'player',
    participantLabelPlural: 'players',
    format: 'winner_pick',
    judgePanel: 'winner',
    color: 'from-stone-500 to-neutral-700',
    description: 'Speed chess or blitz tournament',
    criteria: [],
  },
  CUSTOM: {
    key: 'CUSTOM',
    label: 'Custom Sport',
    emoji: '🏅',
    family: 'other',
    participantLabel: 'competitor',
    participantLabelPlural: 'competitors',
    format: 'winner_pick',
    judgePanel: 'winner',
    color: 'from-gray-500 to-slate-600',
    description: 'Custom competition format',
    criteria: [],
  },
};

export const DANCE_SPORTS = Object.values(SPORT_CONFIGS).filter(s => s.family === 'dance').map(s => s.key);

export function getSportConfig(sport: string | null | undefined): SportConfig {
  return SPORT_CONFIGS[sport || 'BREAKING'] || SPORT_CONFIGS.BREAKING;
}

export function isDanceSport(sport: string | null | undefined): boolean {
  return DANCE_SPORTS.includes(sport || 'BREAKING');
}

export const SPORT_FAMILIES: Record<SportFamily, { label: string; emoji: string }> = {
  dance: { label: 'Dance', emoji: '💃' },
  racket: { label: 'Racket Sports', emoji: '🏓' },
  sport: { label: 'Team Sports', emoji: '⚽' },
  combat: { label: 'Combat', emoji: '🥊' },
  mind: { label: 'Mind Sports', emoji: '♟️' },
  other: { label: 'Other', emoji: '🏅' },
};
