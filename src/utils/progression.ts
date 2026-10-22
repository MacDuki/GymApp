import type { Workout } from '../types'

export function suggestion(exName: string, targetSets: number, targetRepsStr: string, workouts: Workout[]) {
  const targetReps = parseInt(targetRepsStr) || 8
  const history = workouts.filter(w=>w.exercises.some(e=>e.exerciseName===exName)).sort((a,b)=>b.completedAt! - a.completedAt!)
  if (!history.length) return null
  const last = history[0].exercises.find(e=>e.exerciseName===exName)!
  const sets = last.sets.filter(s=>s.completed)
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
    .filter(w=>w.completedAt && w.exercises.some(e=>e.exerciseName===exName))
    .sort((a,b)=>(b.completedAt||0)-(a.completedAt||0))
    .map(w=>({ workout:w, sets:w.exercises.find(e=>e.exerciseName===exName)!.sets }))
}

export function bestPreviousSets(exName:string, workouts:Workout[]) {
  const history=exerciseHistory(exName,workouts)
  if(!history.length) return null
  return history.slice().sort((a,b)=>{
    const aMax=Math.max(...a.sets.filter(s=>s.completed).map(s=>s.weight),0)
    const bMax=Math.max(...b.sets.filter(s=>s.completed).map(s=>s.weight),0)
    return bMax-aMax
  })[0].sets
}
