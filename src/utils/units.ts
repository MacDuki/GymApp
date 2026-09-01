import type { Unit } from '../types'

export const UNIT_LABEL: Record<Unit,string> = {
  weight: 'kg',
  reps: 'reps',
  time: 's',
}

export const UNIT_NAME: Record<Unit,string> = {
  weight: 'Peso (kg)',
  reps: 'Repeticiones',
  time: 'Tiempo (segundos)',
}

// Unilateral movements that still carry a load (weight-based despite "/lado").
const WEIGHTED_UNILATERAL = /\b(press|remo|curl|crunch|squat|extension|fly|hack|thrust|polea|máquina|maquina|smith|jalón|jalon|militar|predicador|inclinado|elevaci|gemelo|rompe|tríceps|triceps)\b/i

// Auto-detect the measurement unit from the seed's targetReps string + exercise name.
export function detectUnit(reps: string, name = ''): Unit {
  const r = reps.trim().toLowerCase()
  // Time-based exercises carry an "s" / "seg" marker: "90 s", "45 s/lado", "30 seg"
  if (/\d\s*s\b|seg/.test(r)) return 'time'
  // Unilateral reps pattern like "10/lado", "15/lado", "12/lado" => reps only,
  // unless the movement still uses an external load.
  if (/\/\s*lado\b|\/\s*l\b/.test(r)) {
    return WEIGHTED_UNILATERAL.test(name) ? 'weight' : 'reps'
  }
  return 'weight'
}

export function resolveUnit(e: { unit?: Unit; targetReps: string; name?: string; exerciseName?: string }): Unit {
  return e.unit || detectUnit(e.targetReps, e.name || e.exerciseName || '')
}
