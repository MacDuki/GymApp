import { openDB } from 'idb'
import type { Routine, Workout, BodyweightEntry } from '../types'

const DB='gym-tracker', VER=1
function dbp(){ return openDB(DB,VER,{upgrade(db){
  if(!db.objectStoreNames.contains('routines')) db.createObjectStore('routines',{keyPath:'id'})
  if(!db.objectStoreNames.contains('workouts')) db.createObjectStore('workouts',{keyPath:'id'})
  if(!db.objectStoreNames.contains('bodyweights')) db.createObjectStore('bodyweights',{keyPath:'id'})
  if(!db.objectStoreNames.contains('kv')) db.createObjectStore('kv',{keyPath:'key'})
}})}
export async function getRoutines():Promise<Routine[]>{ const d=await dbp(); return d.getAll('routines')}
export async function saveRoutine(r:Routine){ const d=await dbp(); await d.put('routines',r)}
export async function delRoutine(id:string){ const d=await dbp(); await d.delete('routines',id)}
export async function getWorkouts():Promise<Workout[]>{ const d=await dbp(); return d.getAll('workouts')}
export async function saveWorkout(w:Workout){ const d=await dbp(); await d.put('workouts',w)}
export async function delWorkout(id:string){const d=await dbp();await d.delete('workouts',id)}
export async function getBodyweights():Promise<BodyweightEntry[]>{const d=await dbp();return d.getAll('bodyweights')}
export async function saveBodyweight(b:BodyweightEntry){const d=await dbp();await d.put('bodyweights',b)}
export async function delBodyweight(id:string){const d=await dbp();await d.delete('bodyweights',id)}
export async function getKV(key:string){const d=await dbp();const v=await d.get('kv',key);return v?.value??null}
export async function setKV(key:string,value:any){const d=await dbp();await d.put('kv',{key,value})}
export async function clearAll(){const d=await dbp();await d.clear('routines');await d.clear('workouts');await d.clear('bodyweights');await d.clear('kv')}
