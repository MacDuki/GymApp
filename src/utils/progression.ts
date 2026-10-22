import type { Workout } from '../types'
import { resolveUnit } from './units'

function hasMeaningfulPerformance(ex:Workout['exercises'][number], set:Workout['exercises'][number]['sets'][number]){
  const unit=resolveUnit(ex)
  return unit==='time' ? set.weight>0 : unit==='reps' ? set.reps>0 : set.weight>0 && set.reps>0
}

export function suggestion(exName: string, targetSets: number, targetRepsStr: string, workouts: Workout[]) {
  const targetReps = parseInt(targetRepsStr) || 8
  const history = exerciseHistory(exName, workouts)
  if (!history.length) return null
  const last = history[0]
  const sets = last.sets
  if (!sets.length) return null
  const allHit = sets.length>=targetSets && sets.every(s=>s.reps>=targetReps)
  const avgW = sets.reduce((a,s)=>a+s.weight,0)/sets.length
  if (allHit) {
    const inc = avgW>=80?2.5: avgW>=40?2.5:1.25
    return { text: `${(avgW+inc).toFixed(avgW+inc>=10?1:2).replace(/\.0+$/,'')} kg`, reason: `All ${targetSets}×${targetReps} hit last time` }
  }
  const maxW = Math.max(...sets.map(s=>s.weight))
  return { text: `${maxW} kg`, reason: `Repeat last weight, target ${targetSets}×${targetReps}` }
}

export function previousSets(exName:string, workouts:Workout[]){
  const h=workouts.filter(w=>w.exercises.some(e=>e.exerciseName===exName)).sort((a,b)=>b.completedAt!-a.completedAt!)
  if(!h.length) return null
  return h[0].exercises.find(e=>e.exerciseName===exName)!.sets
}

export function exerciseHistory(exName:string, workouts:Workout[]) {
  return workouts
    .filter(w=>w.completedAt && w.exercises.some(e=>e.exerciseName===exName && !e.skipped && e.sets.some(s=>s.completed && hasMeaningfulPerformance(e,s))))
    .sort((a,b)=>(b.completedAt||0)-(a.completedAt||0))
    .map(w=>{
      const exercise=w.exercises.find(e=>e.exerciseName===exName)!
      return { workout:w, sets:exercise.sets.filter(s=>s.completed && hasMeaningfulPerformance(exercise,s)) }
    })
}

export function bestPreviousSets(exName:string, workouts:Workout[]) {
  const history=exerciseHistory(exName,workouts)
  if(!history.length) return null
  return history.slice().sort((a,b)=>{
    const aExercise=a.workout.exercises.find(e=>e.exerciseName===exName)!
    const bExercise=b.workout.exercises.find(e=>e.exerciseName===exName)!
    const aUnit=resolveUnit(aExercise)
    const bUnit=resolveUnit(bExercise)
    const aBest=Math.max(...a.sets.map(s=>aUnit==='reps'?s.reps:s.weight),0)
    const bBest=Math.max(...b.sets.map(s=>bUnit==='reps'?s.reps:s.weight),0)
    return bBest-aBest
  })[0].sets
}
