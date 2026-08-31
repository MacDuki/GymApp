import { useEffect, useState, useRef } from 'react'
import type { Routine, Workout, BodyweightEntry, WorkoutExercise } from './types'
import * as db from './db'
import { seedRoutines } from './data/seed'
import { uid } from './utils/id'
import { workoutVolume } from './utils/volume'
import { suggestion, previousSets } from './utils/progression'

type Tab = 'home'|'routines'|'history'|'progress'|'settings'
type View = { tab: Tab, routineId?: string, workoutId?: string }

export default function App(){
  const [view,setView]=useState<View>({tab:'home'})
  const [routines,setRoutines]=useState<Routine[]>([])
  const [workouts,setWorkouts]=useState<Workout[]>([])
  const [bws,setBws]=useState<BodyweightEntry[]>([])
  const [active,setActive]=useState<Workout|null>(null)
  const [resumePrompt,setResumePrompt]=useState(false)
  const loaded=useRef(false)

  useEffect(()=>{
    (async()=>{
      const [r,w,b,aw]=await Promise.all([db.getRoutines(),db.getWorkouts(),db.getBodyweights(),db.getKV('activeWorkout')])
      if(!r.length){ const seed=seedRoutines(); for(const s of seed) await db.saveRoutine(s); setRoutines(seed) } else setRoutines(r.sort((a,b)=>a.createdAt-b.createdAt))
      setWorkouts(w.sort((a,b)=>(b.completedAt||b.startedAt)-(a.completedAt||a.startedAt)))
      setBws(b.sort((a,b)=>a.date.localeCompare(b.date)))
      if(aw){ setActive(aw); setResumePrompt(true) }
      loaded.current=true
    })()
  },[])
  useEffect(()=>{ if(loaded.current) db.setKV('activeWorkout', active) },[active])

  const saveRoutines=async(n:Routine[])=>{ setRoutines(n); for(const r of n) await db.saveRoutine(r) }
  const refreshWorkouts=async()=>{ const w=await db.getWorkouts(); setWorkouts(w.sort((a,b)=>(b.completedAt||b.startedAt)-(a.completedAt||a.startedAt))) }

  if(active && !resumePrompt){
    return <ActiveWorkout workout={active} workouts={workouts} onChange={setActive} onFinish={async()=>{
      const done={...active, completedAt:Date.now()}
      await db.saveWorkout(done); await db.setKV('activeWorkout',null); setActive(null); refreshWorkouts(); setView({tab:'history'})
    }} onDiscard={async()=>{ await db.setKV('activeWorkout',null); setActive(null)}} onSave={async(u)=>{ setActive(u); await db.setKV('activeWorkout',u)}} />
  }

  return (
    <div className="min-h-screen pb-[84px] max-w-[480px] mx-auto" style={{paddingBottom:'calc(84px + env(safe-area-inset-bottom))'}}>
      {resumePrompt && active && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur flex items-center justify-center p-6">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm">
            <h3 className="font-semibold text-lg">Active workout found</h3>
            <p className="text-sm text-muted mt-1">Unfinished {active.routineName} workout</p>
            <div className="flex gap-3 mt-5">
              <button onClick={async()=>{ await db.setKV('activeWorkout',null); setActive(null); setResumePrompt(false)}} className="flex-1 py-3 rounded-xl bg-card2 border border-border">Discard</button>
              <button onClick={()=>setResumePrompt(false)} className="flex-1 py-3 rounded-xl bg-accent text-black font-semibold">Resume</button>
            </div>
          </div>
        </div>
      )}
      <div className="px-4 pt-[calc(12px+env(safe-area-inset-top))]">
        {view.tab==='home' && <Home routines={routines} workouts={workouts} onStart={(r)=>{
          const exs:WorkoutExercise[]=[]
          r.blocks.sort((a,b)=>a.order-b.order).forEach(b=>b.exercises.sort((a,b)=>a.order-b.order).forEach(e=>exs.push({exerciseId:e.id, exerciseName:e.name, blockName:b.name, targetSets:e.sets, targetReps:e.targetReps, restSeconds:e.restSeconds, sets:Array.from({length:e.sets},()=>({weight:0,reps:0,completed:false}))})))
          const w:Workout={id:uid(), routineId:r.id, routineName:r.name, snapshot:r, startedAt:Date.now(), exercises:exs}
          setActive(w); setResumePrompt(false)
        }} onNav={setView} />}
        {view.tab==='routines' && <RoutinesView routines={routines} onChange={saveRoutines} onDelete={async(id)=>{ await db.delRoutine(id); setRoutines(v=>v.filter(x=>x.id!==id))}} onStart={r=>{
          const exs:WorkoutExercise[]=[]
          r.blocks.sort((a,b)=>a.order-b.order).forEach(b=>b.exercises.sort((a,b)=>a.order-b.order).forEach(e=>exs.push({exerciseId:e.id, exerciseName:e.name, blockName:b.name, targetSets:e.sets, targetReps:e.targetReps, restSeconds:e.restSeconds, sets:Array.from({length:e.sets},()=>({weight:0,reps:0,completed:false}))})))
          const w:Workout={id:uid(), routineId:r.id, routineName:r.name, snapshot:r, startedAt:Date.now(), exercises:exs}
          setActive(w); setResumePrompt(false)
        }} detailId={view.routineId} setView={setView} />}
        {view.tab==='history' && <HistoryView workouts={workouts} onSelect={id=>setView({tab:'history', workoutId:id})} selected={view.workoutId} onDelete={async(id)=>{await db.delWorkout(id); refreshWorkouts(); setView({tab:'history'})}} />}
        {view.tab==='progress' && <ProgressView workouts={workouts} bws={bws} onAddBw={async(w)=>{
          const e:BodyweightEntry={id:uid(), date:new Date().toISOString().slice(0,10), weight:w}; await db.saveBodyweight(e); setBws(v=>[...v,e].sort((a,b)=>a.date.localeCompare(b.date)))
        }} onDelBw={async(id)=>{await db.delBodyweight(id); setBws(v=>v.filter(x=>x.id!==id))}} />}
        {view.tab==='settings' && <Settings routines={routines} workouts={workouts} bws={bws} active={active} onImport={async(data)=>{
          await db.clearAll()
          for(const r of data.routines) await db.saveRoutine(r)
          for(const w of data.workouts) await db.saveWorkout(w)
          for(const b of data.bodyweights) await db.saveBodyweight(b)
          if(data.activeWorkout) await db.setKV('activeWorkout',data.activeWorkout)
          location.reload()
        }} onClear={async()=>{await db.clearAll(); location.reload()}} />}
      </div>
      <Nav tab={view.tab} onChange={t=>setView({tab:t})} />
    </div>
  )
}

function Nav({tab,onChange}:{tab:Tab,onChange:(t:Tab)=>void}){
  const items:{k:Tab,l:string,ico:string}[]=[{k:'home',l:'Home',ico:'◍'},{k:'routines',l:'Routines',ico:'≡'},{k:'history',l:'History',ico:'◷'},{k:'progress',l:'Progress',ico:'⟁'},{k:'settings',l:'Settings',ico:'⚙'}]
  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-card/95 backdrop-blur border-t border-border flex" style={{paddingBottom:'env(safe-area-inset-bottom)'}}>
      {items.map(i=>(
        <button key={i.k} onClick={()=>onChange(i.k)} className={`flex-1 py-3 flex flex-col items-center gap-0.5 ${tab===i.k?'text-accent2':'text-dim'}`}>
          <span className="text-[18px] leading-none">{i.ico}</span><span className="text-[10px] tracking-wide">{i.l}</span>
        </button>
      ))}
    </div>
  )
}

function Home({routines,workouts,onStart,onNav}:{routines:Routine[],workouts:Workout[],onStart:(r:Routine)=>void,onNav:(v:View)=>void}){
  const recent=workouts.slice(0,3)
  return (
    <div className="space-y-5 pt-4">
      <h1 className="text-2xl font-bold tracking-tight">MY GYM</h1>
      <div className="space-y-3">
        {routines.map(r=>(
          <div key={r.id} className="bg-card border border-border rounded-2xl p-4">
            <div className="font-semibold">{r.name}</div>
            <div className="text-xs text-muted mt-1">{r.blocks.length} blocks · {r.blocks.reduce((a,b)=>a+b.exercises.length,0)} exercises</div>
            <button onClick={()=>onStart(r)} className="mt-3 w-full py-3 rounded-xl bg-accent text-black font-semibold">START WORKOUT</button>
          </div>
        ))}
        {routines.length===0 && <div className="text-sm text-muted text-center py-8">No routines yet — go to Routines to create one</div>}
      </div>
      <div>
        <div className="text-xs tracking-widest text-dim mb-2">RECENT ACTIVITY</div>
        {recent.length? recent.map(w=>(
          <div key={w.id} className="bg-card border border-border rounded-xl p-3 mb-2 flex justify-between">
            <div><div className="font-medium text-sm">{w.routineName}</div><div className="text-xs text-muted">{new Date(w.completedAt||w.startedAt).toLocaleDateString()}</div></div>
            <div className="text-xs text-muted self-center">{workoutVolume(w.exercises).toLocaleString()} kg</div>
          </div>
        )): <div className="text-xs text-muted">No workouts yet</div>}
      </div>
      <button onClick={()=>onNav({tab:'routines'})} className="w-full py-3 rounded-xl bg-card2 border border-border text-sm">Manage Routines</button>
    </div>
  )
}

function RoutinesView({routines,onChange,onDelete,onStart,detailId,setView}:{routines:Routine[],onChange:(n:Routine[])=>void,onDelete:(id:string)=>void,onStart:(r:Routine)=>void,detailId?:string,setView:(v:View)=>void}){
  const [editing,setEditing]=useState<Routine|null>(routines.find(r=>r.id===detailId)||null)
  useEffect(()=>{ if(detailId) setEditing(routines.find(r=>r.id===detailId)||null)},[detailId])
  if(editing) return <RoutineEditor routine={editing} onSave={r=>{ const n=routines.map(x=>x.id===r.id?r:x); onChange(n); setEditing(null); setView({tab:'routines'})}} onBack={()=>{setEditing(null); setView({tab:'routines'})}} />
  return (
    <div className="pt-4 space-y-4">
      <div className="flex justify-between items-center"><h2 className="text-xl font-bold">Routines</h2>
        <button onClick={()=>{
          const r:Routine={id:uid(), name:"New Routine", createdAt:Date.now(), blocks:[]}
          onChange([...routines,r]); setEditing(r)
        }} className="px-4 py-2 rounded-xl bg-accent text-black text-sm font-semibold">+ Create</button>
      </div>
      {routines.map(r=>(
        <div key={r.id} className="bg-card border border-border rounded-2xl p-4">
          <div className="flex justify-between">
            <div className="font-semibold">{r.name}</div>
            <button onClick={()=>{ if(confirm('Delete routine?')) onDelete(r.id)}} className="text-xs text-red-400">Delete</button>
          </div>
          <div className="text-xs text-muted mt-1">{r.blocks.map(b=>b.name).join(' · ')||'No blocks'}</div>
          <div className="flex gap-2 mt-3">
            <button onClick={()=>setEditing(r)} className="flex-1 py-2.5 rounded-xl bg-card2 border border-border text-sm">Edit</button>
            <button onClick={()=>{
              const dup:Routine={...r, id:uid(), name:r.name+" Copy", blocks:r.blocks.map(b=>({...b, id:uid(), routineId:uid(), exercises:b.exercises.map(e=>({...e, id:uid(), blockId:uid()}))}))}
              const nid=uid(); dup.id=nid; dup.blocks.forEach(b=>{b.routineId=nid; const bid=uid(); const old=b.id; b.id=bid; b.exercises.forEach(e=>{e.blockId=bid; e.id=uid()})})
              onChange([...routines,dup])
            }} className="px-4 py-2.5 rounded-xl bg-card2 border border-border text-sm">Dup</button>
            <button onClick={()=>onStart(r)} className="flex-1 py-2.5 rounded-xl bg-accent text-black font-semibold text-sm">Start</button>
          </div>
        </div>
      ))}
    </div>
  )
}

function RoutineEditor({routine,onSave,onBack}:{routine:Routine,onSave:(r:Routine)=>void,onBack:()=>void}){
  const [r,setR]=useState<Routine>(JSON.parse(JSON.stringify(routine)))
  const addBlock=()=> setR(v=>({...v, blocks:[...v.blocks, {id:uid(), routineId:v.id, name:"New Block", order:v.blocks.length, exercises:[]}]}))
  const updateBlock=(id:string, name:string)=> setR(v=>({...v, blocks: v.blocks.map(b=>b.id===id?{...b,name}:b)}))
  const delBlock=(id:string)=> setR(v=>({...v, blocks: v.blocks.filter(b=>b.id!==id)}))
  const moveBlock=(idx:number,dir:number)=> setR(v=>{ const a=[...v.blocks]; const n=idx+dir; if(n<0||n>=a.length) return v; [a[idx],a[n]]=[a[n],a[idx]]; return {...v, blocks:a.map((b,i)=>({...b,order:i}))}})
  const addEx=(bid:string)=> setR(v=>({...v, blocks: v.blocks.map(b=>b.id===bid?{...b, exercises:[...b.exercises, {id:uid(), blockId:bid, name:"New Exercise", order:b.exercises.length, sets:3, targetReps:"8", restSeconds:90}]}:b)}))
  const updEx=(bid:string, eid:string, patch:Partial<any>)=> setR(v=>({...v, blocks: v.blocks.map(b=>b.id===bid?{...b, exercises:b.exercises.map(e=>e.id===eid?{...e,...patch}:e)}:b)}))
  const delEx=(bid:string,eid:string)=> setR(v=>({...v, blocks: v.blocks.map(b=>b.id===bid?{...b, exercises:b.exercises.filter(e=>e.id!==eid)}:b)}))
  const moveEx=(bid:string,idx:number,dir:number)=> setR(v=>({...v, blocks: v.blocks.map(b=>{
    if(b.id!==bid) return b
    const a=[...b.exercises]; const n=idx+dir; if(n<0||n>=a.length) return b; [a[idx],a[n]]=[a[n],a[idx]]; return {...b, exercises:a.map((e,i)=>({...e,order:i}))}
  })}))
  return (
    <div className="pt-4 space-y-4">
      <button onClick={onBack} className="text-sm text-accent2">← Back</button>
      <input value={r.name} onChange={e=>setR({...r,name:e.target.value})} className="w-full bg-card border border-border rounded-xl px-4 py-3 font-semibold" placeholder="Routine name" />
      {r.blocks.map((b,bi)=>(
        <div key={b.id} className="bg-card border border-border rounded-2xl p-3 space-y-3">
          <div className="flex gap-2">
            <input value={b.name} onChange={e=>updateBlock(b.id,e.target.value)} className="flex-1 bg-card2 border border-border rounded-xl px-3 py-2 text-sm font-medium" />
            <button onClick={()=>moveBlock(bi,-1)} className="px-2 bg-card2 border border-border rounded-lg">↑</button>
            <button onClick={()=>moveBlock(bi,1)} className="px-2 bg-card2 border border-border rounded-lg">↓</button>
            <button onClick={()=>delBlock(b.id)} className="px-2 text-red-400">✕</button>
          </div>
          {b.exercises.map((e,ei)=>(
            <div key={e.id} className="bg-bg border border-border rounded-xl p-3 space-y-2">
              <div className="flex gap-2">
                <input value={e.name} onChange={ev=>updEx(b.id,e.id,{name:ev.target.value})} className="flex-1 bg-card border border-border rounded-lg px-2 py-2 text-sm" />
                <button onClick={()=>moveEx(b.id,ei,-1)} className="px-1.5 text-xs border border-border rounded">↑</button>
                <button onClick={()=>moveEx(b.id,ei,1)} className="px-1.5 text-xs border border-border rounded">↓</button>
                <button onClick={()=>delEx(b.id,e.id)} className="text-red-400 px-1">✕</button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <label className="text-xs text-muted">Sets <input type="number" value={e.sets} onChange={ev=>updEx(b.id,e.id,{sets:parseInt(ev.target.value)||1})} className="w-full mt-1 bg-card border border-border rounded-lg px-2 py-2" /></label>
                <label className="text-xs text-muted">Reps <input value={e.targetReps} onChange={ev=>updEx(b.id,e.id,{targetReps:ev.target.value})} className="w-full mt-1 bg-card border border-border rounded-lg px-2 py-2" /></label>
                <label className="text-xs text-muted">Rest(s) <input type="number" value={e.restSeconds} onChange={ev=>updEx(b.id,e.id,{restSeconds:parseInt(ev.target.value)||0})} className="w-full mt-1 bg-card border border-border rounded-lg px-2 py-2" /></label>
              </div>
              <input value={e.notes||''} onChange={ev=>updEx(b.id,e.id,{notes:ev.target.value})} placeholder="Notes" className="w-full bg-card border border-border rounded-lg px-2 py-1.5 text-xs" />
            </div>
          ))}
          <button onClick={()=>addEx(b.id)} className="w-full py-2 rounded-xl bg-card2 border border-dashed border-border text-sm">+ Add Exercise</button>
        </div>
      ))}
      <button onClick={addBlock} className="w-full py-3 rounded-xl border border-dashed border-border text-sm">+ Add Block</button>
      <button onClick={()=>onSave(r)} className="w-full py-3 rounded-xl bg-accent text-black font-semibold">Save Routine</button>
    </div>
  )
}

function ActiveWorkout({workout,workouts,onChange,onFinish,onDiscard,onSave}:{workout:Workout,workouts:Workout[],onChange:(w:Workout)=>void,onFinish:()=>void,onDiscard:()=>void,onSave:(w:Workout)=>void}){
  const [idx,setIdx]=useState(0)
  const [timer,setTimer]=useState(0)
  const [run,setRun]=useState(false)
  const ex=workout.exercises[idx]
  const prev=previousSets(ex.exerciseName, workouts)
  const sug=suggestion(ex.exerciseName, ex.targetSets, ex.targetReps, workouts)
  const curSetIdx=ex.sets.findIndex(s=>!s.completed)
  useEffect(()=>{ if(!run) return; const id=setInterval(()=>setTimer(t=>t>0? t-1:0),1000); return ()=>clearInterval(id)},[run])
  useEffect(()=>{ if(timer===0) setRun(false)},[timer])
  const updSet=(si:number, patch:Partial<any>)=>{
    const n={...workout, exercises: workout.exercises.map((e,i)=> i!==idx?e:{...e, sets:e.sets.map((s,j)=> j===si?{...s,...patch}:s)})}
    onChange(n); onSave(n)
  }
  const pct=Math.round((workout.exercises.filter(e=>e.sets.every(s=>s.completed)).length/workout.exercises.length)*100)
  return (
    <div className="min-h-screen bg-bg pb-6">
      <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex justify-between items-center" style={{paddingTop:'calc(12px + env(safe-area-inset-top))'}}>
        <div><div className="font-bold text-sm">{workout.routineName}</div><div className="text-xs text-muted">{pct}% · {ex.blockName} · {idx+1}/{workout.exercises.length}</div></div>
        <button onClick={()=>{ if(confirm('Discard workout?')) onDiscard()}} className="text-xs px-3 py-1.5 rounded-lg bg-card2 border border-border">Exit</button>
      </div>
      <div className="px-4 pt-4 space-y-4">
        <div className="h-1 bg-card2 rounded-full overflow-hidden"><div className="h-full bg-accent" style={{width: `${(idx+1)/workout.exercises.length*100}%`}} /></div>
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="text-xs tracking-widest text-dim">{ex.blockName.toUpperCase()}</div>
          <div className="text-xl font-bold mt-1">{ex.exerciseName}</div>
          <div className="text-xs text-muted mt-1">{ex.targetSets} × {ex.targetReps} · rest {ex.restSeconds}s</div>
          {ex.sets.some(s=>s.completed) && <div className="text-xs text-emerald-400 mt-1">{ex.sets.filter(s=>s.completed).length}/{ex.sets.length} sets done</div>}
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 space-y-2">
          <div className="text-xs font-semibold tracking-widest text-dim">PREVIOUS</div>
          {prev? prev.map((s,i)=><div key={i} className="text-sm">{s.weight} kg × {s.reps} {s.completed?'✓':''}</div>): <div className="text-sm text-muted">No previous workout</div>}
          {sug && <div className="mt-2 bg-accent/10 border border-accent/20 rounded-xl p-3"><div className="text-xs text-accent2">Suggested: {sug.text}</div><div className="text-[11px] text-muted">{sug.reason}</div></div>}
        </div>

        <div className="space-y-3">
          {ex.sets.map((s,si)=>(
            <div key={si} className={`rounded-2xl p-4 border ${s.completed?'bg-emerald-500/10 border-emerald-500/30':'bg-card border-border'}`}>
              <div className="flex justify-between items-center mb-3"><span className="font-semibold text-sm">SET {si+1} {si===curSetIdx && !s.completed && <span className="text-accent2 text-xs ml-2">● current</span>}</span><span className={`text-xs px-2 py-1 rounded-full ${s.completed?'bg-emerald-500 text-white':'bg-card2 border border-border'}`}>{s.completed?'Done':'Pending'}</span></div>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs text-muted">Weight (kg)<input type="number" inputMode="decimal" value={s.weight||''} onChange={e=>updSet(si,{weight:parseFloat(e.target.value)||0})} className="w-full mt-1 bg-bg border border-border rounded-xl px-3 py-3 text-lg font-semibold" placeholder="0" /></label>
                <label className="text-xs text-muted">Reps<input type="number" inputMode="numeric" value={s.reps||''} onChange={e=>updSet(si,{reps:parseInt(e.target.value)||0})} className="w-full mt-1 bg-bg border border-border rounded-xl px-3 py-3 text-lg font-semibold" placeholder="0" /></label>
              </div>
              <button onClick={()=>{ updSet(si,{completed:!s.completed}); if(!s.completed && ex.restSeconds>0){ setTimer(ex.restSeconds); setRun(true)}}} className={`w-full mt-3 py-3.5 rounded-xl font-semibold text-lg ${s.completed?'bg-card2 text-white border border-border':'bg-accent text-black'}`}>{s.completed?'↩ Undo':'✓ COMPLETE SET'}</button>
            </div>
          ))}
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 flex flex-col items-center gap-3">
          <div className="text-3xl font-mono font-bold">{String(Math.floor(timer/60)).padStart(2,'0')}:{String(timer%60).padStart(2,'0')}</div>
          <div className="flex gap-2 w-full">
            <button onClick={()=>{setTimer(ex.restSeconds); setRun(true)}} className="flex-1 py-3 rounded-xl bg-accent text-black font-semibold">START REST</button>
            <button onClick={()=>setRun(!run)} className="px-6 py-3 rounded-xl bg-card2 border border-border">{run?'Pause':'Resume'}</button>
          </div>
          <div className="flex gap-2">
            <button onClick={()=>setTimer(t=>t+15)} className="px-3 py-1.5 rounded-lg bg-card2 border border-border text-xs">+15s</button>
            <button onClick={()=>setTimer(t=>Math.max(0,t-15))} className="px-3 py-1.5 rounded-lg bg-card2 border border-border text-xs">-15s</button>
            <button onClick={()=>{setTimer(0);setRun(false)}} className="px-3 py-1.5 rounded-lg bg-card2 border border-border text-xs">SKIP</button>
          </div>
        </div>

        <div className="flex gap-3">
          <button disabled={idx===0} onClick={()=>setIdx(i=>i-1)} className="flex-1 py-4 rounded-xl bg-card border border-border disabled:opacity-30 font-semibold">PREVIOUS</button>
          <button disabled={idx===workout.exercises.length-1} onClick={()=>setIdx(i=>i+1)} className="flex-1 py-4 rounded-xl bg-card border border-border disabled:opacity-30 font-semibold">NEXT</button>
        </div>

        <div className="space-y-1">
          <div className="text-xs tracking-widest text-dim">ALL EXERCISES</div>
          {workout.exercises.map((e,i)=>{
            const done=e.sets.every(s=>s.completed)
            return <button key={i} onClick={()=>setIdx(i)} className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm flex justify-between ${i===idx?'bg-accent border-accent text-black':'bg-card text-white border-border'} ${done?'opacity-60':''}`}><span>{e.blockName} · {e.exerciseName}</span><span>{e.sets.filter(s=>s.completed).length}/{e.sets.length}</span></button>
          })}
        </div>

        <button onClick={()=>{ if(confirm(`Finish workout? ${workout.exercises.filter(e=>e.sets.some(s=>s.completed)).length}/${workout.exercises.length} exercises touched`)) onFinish()}} className="w-full py-4 rounded-2xl bg-emerald-600 font-bold text-lg">FINISH WORKOUT</button>
        <div className="h-6" />
      </div>
    </div>
  )
}

function HistoryView({workouts,onSelect,selected,onDelete}:{workouts:Workout[],onSelect:(id:string)=>void,selected?:string,onDelete:(id:string)=>void}){
  const sel=workouts.find(w=>w.id===selected)
  if(sel) return (
    <div className="pt-4 space-y-4">
      <button onClick={()=>onSelect('')} className="text-sm text-accent2">← History</button>
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="font-bold">{sel.routineName}</div>
        <div className="text-xs text-muted">{new Date(sel.completedAt||sel.startedAt).toLocaleString()} · {workoutVolume(sel.exercises).toLocaleString()} kg volume</div>
      </div>
      {sel.exercises.map((e,i)=>(
        <div key={i} className="bg-card border border-border rounded-xl p-3">
          <div className="text-xs text-dim">{e.blockName}</div><div className="font-medium text-sm">{e.exerciseName}</div>
          <div className="mt-2 space-y-1">{e.sets.map((s,j)=><div key={j} className="text-sm flex justify-between"><span>{s.weight} × {s.reps}</span><span className={s.completed?'text-emerald-400':'text-dim'}>{s.completed?'✓':''}</span></div>)}</div>
        </div>
      ))}
      <button onClick={()=>{ if(confirm('Delete workout?')) onDelete(sel.id)}} className="w-full py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">Delete Workout</button>
    </div>
  )
  return (
    <div className="pt-4 space-y-3">
      <h2 className="text-xl font-bold">History</h2>
      {workouts.filter(w=>w.completedAt).length? workouts.filter(w=>w.completedAt).map(w=>(
        <button key={w.id} onClick={()=>onSelect(w.id)} className="w-full text-left bg-card border border-border rounded-2xl p-4">
          <div className="font-semibold text-sm">{w.routineName}</div>
          <div className="text-xs text-muted">{new Date(w.completedAt!).toLocaleDateString()} · Volume: {workoutVolume(w.exercises).toLocaleString()} kg</div>
        </button>
      )): <div className="text-sm text-muted text-center py-8">No history yet</div>}
    </div>
  )
}

function ProgressView({workouts,bws,onAddBw,onDelBw}:{workouts:Workout[],bws:BodyweightEntry[],onAddBw:(w:number)=>void,onDelBw:(id:string)=>void}){
  const [ex,setEx]=useState<string>('')
  const names=[...new Set(workouts.flatMap(w=>w.exercises.map(e=>e.exerciseName)))].sort()
  useEffect(()=>{ if(!ex && names[0]) setEx(names[0])},[names,ex])
  const data=workouts.filter(w=>w.exercises.some(e=>e.exerciseName===ex)).sort((a,b)=>a.completedAt!-b.completedAt!).map(w=>{
    const e=w.exercises.find(x=>x.exerciseName===ex)!; const vol=e.sets.filter(s=>s.completed).reduce((a,s)=>a+s.weight*s.reps,0); const maxW=Math.max(...e.sets.map(s=>s.weight),0); return {date:new Date(w.completedAt!).toLocaleDateString(), vol, maxW, reps: e.sets.map(s=>s.reps).join('/')}
  })
  const pr = data.length? {max: Math.max(...data.map(d=>d.maxW)), vol: Math.max(...data.map(d=>d.vol))}:null
  const [bw,setBw]=useState('')
  return (
    <div className="pt-4 space-y-5">
      <h2 className="text-xl font-bold">Progress</h2>
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <select value={ex} onChange={e=>setEx(e.target.value)} className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm">
          {names.map(n=><option key={n} value={n}>{n}</option>)}
        </select>
        {data.length? <>
          <div className="text-xs text-muted">{data.length} workouts</div>
          <div className="flex gap-6 text-sm"><span>PR weight: <b>{pr!.max} kg</b></span><span>PR vol: <b>{pr!.vol} kg</b></span></div>
          <div className="h-24 flex items-end gap-1">
            {data.map((d,i)=>{
              const h = pr!.max? (d.maxW/pr!.max*80+8):8
              return <div key={i} className="flex-1 bg-accent rounded-t" style={{height: h}} title={`${d.date} ${d.maxW}kg`} />
            })}
          </div>
          <div className="space-y-1 max-h-48 overflow-auto">
            {data.map((d,i)=><div key={i} className="flex justify-between text-xs border-b border-border/50 py-1"><span>{d.date}</span><span>{d.maxW} kg · {d.vol} vol</span></div>)}
          </div>
        </>: <div className="text-sm text-muted">No data for selected exercise</div>}
      </div>

      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <div className="font-semibold text-sm">Bodyweight</div>
        <div className="flex gap-2">
          <input value={bw} onChange={e=>setBw(e.target.value)} placeholder="kg" type="number" inputMode="decimal" className="flex-1 bg-bg border border-border rounded-xl px-3 py-2.5" />
          <button onClick={()=>{ const v=parseFloat(bw); if(v>0){onAddBw(v); setBw('')}}} className="px-6 py-2.5 rounded-xl bg-accent text-black font-semibold">Add</button>
        </div>
        {bws.length>1 && (
          <div className="h-20 flex items-end gap-1">
            {(() => {
              const min=Math.min(...bws.map(b=>b.weight)), max=Math.max(...bws.map(b=>b.weight)), range=max-min||1
              return bws.map(b=> <div key={b.id} className="flex-1 bg-emerald-500 rounded-t" style={{height: ((b.weight-min)/range*60+12)}} title={`${b.date} ${b.weight}`} />)
            })()}
          </div>
        )}
        <div className="space-y-1">
          {bws.slice().reverse().map(b=>(
            <div key={b.id} className="flex justify-between text-sm py-1 border-b border-border/50"><span>{b.date}</span><span className="flex gap-3">{b.weight} kg <button onClick={()=>onDelBw(b.id)} className="text-red-400 text-xs">✕</button></span></div>
          ))}
          {!bws.length && <div className="text-xs text-muted">No entries</div>}
        </div>
      </div>
    </div>
  )
}

function Settings({routines,workouts,bws,active,onImport,onClear}:{routines:Routine[],workouts:Workout[],bws:BodyweightEntry[],active:Workout|null,onImport:(d:any)=>void,onClear:()=>void}){
  const exp=()=>{
    const data={routines,workouts,bodyweights:bws,activeWorkout:active, exportedAt:Date.now()}
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`gym-backup-${new Date().toISOString().slice(0,10)}.json`; a.click()
  }
  const imp=(e:any)=>{
    const f=e.target.files?.[0]; if(!f) return; const r=new FileReader(); r.onload=()=>{ try{ const d=JSON.parse(r.result as string); if(!d.routines||!d.workouts) throw new Error('invalid'); if(confirm('Import will overwrite current data. Continue?')) onImport(d)}catch{alert('Invalid file')}}; r.readAsText(f)
  }
  return (
    <div className="pt-4 space-y-4">
      <h2 className="text-xl font-bold">Settings</h2>
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <div className="text-sm font-semibold">Data</div>
        <button onClick={exp} className="w-full py-3 rounded-xl bg-card2 border border-border">Export Data (JSON)</button>
        <label className="block w-full py-3 rounded-xl bg-card2 border border-border text-center cursor-pointer">Import Data<input type="file" accept=".json" className="hidden" onChange={imp} /></label>
        <button onClick={()=>{ if(confirm('Delete all data? This will permanently remove all routines, workout history and bodyweight data.')) onClear()}} className="w-full py-3 rounded-xl bg-red-500 text-white font-semibold">Delete All Data</button>
      </div>
      <div className="text-xs text-muted text-center">Offline PWA · Data stored locally in IndexedDB<br/>Install via Share → Add to Home Screen</div>
    </div>
  )
}


