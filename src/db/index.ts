import { openDB } from 'idb'
import type { Routine, Workout, BodyweightEntry, DiscardedWorkout } from '../types'
import type { ExerciseContent, ExternalExercise } from '../exerciseLibrary'

const DB='gym-tracker', VER=3
function dbp(){ return openDB(DB,VER,{upgrade(db){
  if(!db.objectStoreNames.contains('routines')) db.createObjectStore('routines',{keyPath:'id'})
  if(!db.objectStoreNames.contains('workouts')) db.createObjectStore('workouts',{keyPath:'id'})
  if(!db.objectStoreNames.contains('bodyweights')) db.createObjectStore('bodyweights',{keyPath:'id'})
  if(!db.objectStoreNames.contains('discardedWorkouts')) db.createObjectStore('discardedWorkouts',{keyPath:'workout.id'})
  if(!db.objectStoreNames.contains('kv')) db.createObjectStore('kv',{keyPath:'key'})
  if(!db.objectStoreNames.contains('exerciseCatalog')) db.createObjectStore('exerciseCatalog',{keyPath:'id'})
  if(!db.objectStoreNames.contains('exerciseContent')) db.createObjectStore('exerciseContent',{keyPath:'localExerciseId'})
  if(!db.objectStoreNames.contains('exerciseResources')) db.createObjectStore('exerciseResources',{keyPath:'key'})
}})}
export async function getRoutines():Promise<Routine[]>{ const d=await dbp(); return d.getAll('routines')}
export async function saveRoutine(r:Routine){ const d=await dbp(); await d.put('routines',r)}
export async function delRoutine(id:string){ const d=await dbp(); await d.delete('routines',id)}
export async function getWorkouts():Promise<Workout[]>{ const d=await dbp(); return d.getAll('workouts')}
export async function saveWorkout(w:Workout){ const d=await dbp(); await d.put('workouts',w)}
export async function delWorkout(id:string){const d=await dbp();await d.delete('workouts',id)}
export async function getDiscardedWorkouts():Promise<DiscardedWorkout[]>{const d=await dbp();return d.getAll('discardedWorkouts')}
export async function saveDiscardedWorkout(w:DiscardedWorkout){const d=await dbp();await d.put('discardedWorkouts',w)}
export async function delDiscardedWorkout(id:string){const d=await dbp();await d.delete('discardedWorkouts',id)}
export async function getBodyweights():Promise<BodyweightEntry[]>{const d=await dbp();return d.getAll('bodyweights')}
export async function saveBodyweight(b:BodyweightEntry){const d=await dbp();await d.put('bodyweights',b)}
export async function delBodyweight(id:string){const d=await dbp();await d.delete('bodyweights',id)}
export async function getKV(key:string){const d=await dbp();const v=await d.get('kv',key);return v?.value??null}
export async function setKV(key:string,value:any){const d=await dbp();await d.put('kv',{key,value})}
export async function getExerciseCatalog():Promise<ExternalExercise[]>{const d=await dbp();return d.getAll('exerciseCatalog')}
export async function saveExerciseCatalog(items:ExternalExercise[]){const d=await dbp();const tx=d.transaction('exerciseCatalog','readwrite');for(const item of items) await tx.store.put(item);await tx.done}
export async function getExerciseContent(localExerciseId:string):Promise<ExerciseContent|undefined>{const d=await dbp();return d.get('exerciseContent',localExerciseId)}
export async function saveExerciseContent(content:ExerciseContent){const d=await dbp();await d.put('exerciseContent',content)}
export async function getExerciseResource(key:string):Promise<{key:string,blob:Blob,externalId:string}|undefined>{const d=await dbp();return d.get('exerciseResources',key)}
export async function saveExerciseResource(resource:{key:string,blob:Blob,externalId:string}){const d=await dbp();await d.put('exerciseResources',resource)}
export async function deleteExerciseResource(key:string){const d=await dbp();await d.delete('exerciseResources',key)}
export async function getAllExerciseContent():Promise<ExerciseContent[]>{const d=await dbp();return d.getAll('exerciseContent')}
export async function clearAll(){const d=await dbp();await d.clear('routines');await d.clear('workouts');await d.clear('discardedWorkouts');await d.clear('bodyweights');await d.clear('kv');await d.clear('exerciseCatalog');await d.clear('exerciseContent');await d.clear('exerciseResources')}
