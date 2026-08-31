export type Routine = { id: string; name: string; createdAt: number; blocks: Block[] }
export type Block = { id: string; routineId: string; name: string; order: number; exercises: Exercise[] }
export type Exercise = { id: string; blockId: string; name: string; order: number; sets: number; targetReps: string; restSeconds: number; notes?: string }
export type WorkoutSet = { weight: number; reps: number; completed: boolean }
export type WorkoutExercise = { exerciseId: string; exerciseName: string; blockName: string; targetSets: number; targetReps: string; restSeconds: number; sets: WorkoutSet[] }
export type Workout = { id: string; routineId: string; routineName: string; snapshot: Routine; startedAt: number; completedAt?: number; exercises: WorkoutExercise[] }
export type BodyweightEntry = { id: string; date: string; weight: number }
export type ExportData = { routines: Routine[]; workouts: Workout[]; bodyweights: BodyweightEntry[]; activeWorkout: Workout|null; exportedAt: number }
