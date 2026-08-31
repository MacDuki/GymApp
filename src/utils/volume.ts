export const vol = (w:number,r:number)=>w*r
export const workoutVolume = (exs:{sets:{weight:number,reps:number,completed:boolean}[]}[]) => exs.reduce((t,e)=>t+e.sets.filter(s=>s.completed).reduce((s,x)=>s+x.weight*x.reps,0),0)
