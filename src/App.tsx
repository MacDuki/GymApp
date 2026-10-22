import { useEffect, useState, useRef } from 'react'
import type { Routine, Workout, BodyweightEntry, WorkoutExercise, Unit, DiscardedWorkout, Exercise, ExerciseMedia } from './types'
import * as db from './db'
import { seedRoutines } from './data/seed'
import { uid } from './utils/id'
import { workoutVolume } from './utils/volume'
import { suggestion, exerciseHistory, bestPreviousSets } from './utils/progression'
import { UNIT_LABEL, UNIT_NAME, resolveUnit } from './utils/units'
import { downloadMedia, EXERCISE_DB_BASE, searchExerciseGymGifs, searchWger, syncExerciseLibrary, type ExerciseContent, type SyncProgress } from './exerciseLibrary'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts'
import { FiActivity, FiArchive, FiArrowLeft, FiArrowRight, FiArrowUp, FiArrowDown, FiBarChart2, FiCheck, FiChevronDown, FiChevronUp, FiClock, FiEdit3, FiEye, FiHome, FiPlus, FiRefreshCw, FiSettings, FiTrash2, FiX, FiPlay, FiPause, FiSkipForward } from 'react-icons/fi'

type Tab = 'home'|'routines'|'history'|'progress'|'settings'
type View = { tab: Tab, routineId?: string, workoutId?: string }

function buildWorkout(r:Routine):Workout{
  const exs:WorkoutExercise[]=[]
  r.blocks.slice().sort((a,b)=>a.order-b.order).forEach(b=>b.exercises.slice().sort((a,b)=>a.order-b.order).forEach(e=>exs.push({exerciseId:e.id, exerciseName:e.name, blockName:b.name, targetSets:e.sets, targetReps:e.targetReps, restSeconds:e.restSeconds, unit:resolveUnit(e), media:e.media, sets:Array.from({length:e.sets},()=>({weight:0,reps:0,completed:false}))})))
  return {id:uid(), routineId:r.id, routineName:r.name, snapshot:r, startedAt:Date.now(), exercises:exs}
}

export default function App(){
  const [view,setView]=useState<View>({tab:'home'})
  const [routines,setRoutines]=useState<Routine[]>([])
  const [workouts,setWorkouts]=useState<Workout[]>([])
  const [discarded,setDiscarded]=useState<DiscardedWorkout[]>([])
  const [bws,setBws]=useState<BodyweightEntry[]>([])
  const [active,setActive]=useState<Workout|null>(null)
  const [resumePrompt,setResumePrompt]=useState(false)
  const [libraryProgress,setLibraryProgress]=useState<SyncProgress>({state:'idle',completed:0,total:0})
  const [libraryContent,setLibraryContent]=useState<ExerciseContent[]>([])
  const loaded=useRef(false)

  useEffect(()=>{
    (async()=>{
      const [r,w,b,aw,trash,content]=await Promise.all([db.getRoutines(),db.getWorkouts(),db.getBodyweights(),db.getKV('activeWorkout'),db.getDiscardedWorkouts(),db.getAllExerciseContent()])
      const loadedRoutines=!r.length ? seedRoutines() : r.sort((a,b)=>a.createdAt-b.createdAt)
      if(!r.length) for(const s of loadedRoutines) await db.saveRoutine(s)
      setRoutines(loadedRoutines)
      setWorkouts(w.sort((a,b)=>(b.completedAt||b.startedAt)-(a.completedAt||a.startedAt)))
      const now=Date.now()
      for(const item of trash) if(item.expiresAt<=now) await db.delDiscardedWorkout(item.workout.id)
      setDiscarded(trash.filter(item=>item.expiresAt>now).sort((a,b)=>b.discardedAt-a.discardedAt))
      setBws(b.sort((a,b)=>a.date.localeCompare(b.date)))
      setLibraryContent(content)
      if(aw){ setActive(aw); setResumePrompt(true) }
      loaded.current=true
    })()
  },[])
  useEffect(()=>{
    if(!routines.length) return
    const sync=()=>{ if(navigator.onLine) void syncExerciseLibrary(routines,setLibraryProgress).then(async()=>{ setRoutines(await db.getRoutines()); setLibraryContent(await db.getAllExerciseContent()) }) }
    sync()
    window.addEventListener('online',sync)
    return ()=>window.removeEventListener('online',sync)
  },[routines])
  useEffect(()=>{ if(loaded.current) db.setKV('activeWorkout', active) },[active])

  const saveRoutines=async(n:Routine[])=>{ setRoutines(n); for(const r of n) await db.saveRoutine(r) }
  const refreshWorkouts=async()=>{ const w=await db.getWorkouts(); setWorkouts(w.sort((a,b)=>(b.completedAt||b.startedAt)-(a.completedAt||a.startedAt))) }
  const discardWorkout=async(w:Workout)=>{
    const item:DiscardedWorkout={workout:w,discardedAt:Date.now(),expiresAt:Date.now()+7*24*60*60*1000}
    await db.saveDiscardedWorkout(item); setDiscarded(v=>[item,...v.filter(x=>x.workout.id!==w.id)])
  }

  if(active && !resumePrompt){
    return <ActiveWorkout workout={active} workouts={workouts} onChange={setActive} onFinish={async()=>{
      const done={...active, completedAt:Date.now()}
      await db.saveWorkout(done); await db.setKV('activeWorkout',null); setActive(null); refreshWorkouts(); setView({tab:'history'})
    }} onDiscard={async()=>{ await discardWorkout(active); await db.setKV('activeWorkout',null); setActive(null)}} onSave={async(u)=>{ setActive(u); await db.setKV('activeWorkout',u)}} />
  }

  return (
    <div className="min-h-screen pb-[84px] max-w-[480px] mx-auto" style={{paddingBottom:'calc(84px + env(safe-area-inset-bottom))'}}>
      {resumePrompt && active && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur flex items-center justify-center p-6">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm animate-modal-in">
            <h3 className="font-semibold text-lg">Active workout found</h3>
            <p className="text-sm text-muted mt-1">Unfinished {active.routineName} workout</p>
            <div className="flex gap-3 mt-5">
              <button onClick={async()=>{ await discardWorkout(active); await db.setKV('activeWorkout',null); setActive(null); setResumePrompt(false)}} className="flex-1 py-3 rounded-xl bg-card2 border border-border">Discard</button>
              <button onClick={()=>setResumePrompt(false)} className="flex-1 py-3 rounded-xl bg-accent text-black font-semibold">Resume</button>
            </div>
          </div>
        </div>
      )}
      <div className="px-4 pt-[calc(12px+env(safe-area-inset-top))]">
        {view.tab==='home' && <Home routines={routines} workouts={workouts} onStart={(r)=>{
          const w=buildWorkout(r)
          setActive(w); setResumePrompt(false)
        }} onNav={setView} />}
        {view.tab==='routines' && <RoutinesView routines={routines} onChange={saveRoutines} onDelete={async(id)=>{ await db.delRoutine(id); setRoutines(v=>v.filter(x=>x.id!==id))}} onStart={r=>{
          const w=buildWorkout(r)
          setActive(w); setResumePrompt(false)
        }} detailId={view.routineId} setView={setView} />}
        {view.tab==='history' && <HistoryView workouts={workouts} discarded={discarded} onSelect={id=>setView({tab:'history', workoutId:id})} selected={view.workoutId} onDelete={async(id)=>{await db.delWorkout(id); refreshWorkouts(); setView({tab:'history'})}} onRestore={async(id)=>{const item=discarded.find(x=>x.workout.id===id); if(item){await db.saveWorkout(item.workout);await db.delDiscardedWorkout(id);setDiscarded(v=>v.filter(x=>x.workout.id!==id));refreshWorkouts()}}} onPermanentDelete={async(id)=>{await db.delDiscardedWorkout(id);setDiscarded(v=>v.filter(x=>x.workout.id!==id))}} />}
        {view.tab==='progress' && <ProgressView routines={routines} workouts={workouts} bws={bws} onAddBw={async(w)=>{
          const e:BodyweightEntry={id:uid(), date:new Date().toISOString().slice(0,10), weight:w}; await db.saveBodyweight(e); setBws(v=>[...v,e].sort((a,b)=>a.date.localeCompare(b.date)))
        }} onDelBw={async(id)=>{await db.delBodyweight(id); setBws(v=>v.filter(x=>x.id!==id))}} />}
        {view.tab==='settings' && <Settings routines={routines} workouts={workouts} discarded={discarded} bws={bws} active={active} libraryContent={libraryContent} libraryProgress={libraryProgress} onSync={()=>void syncExerciseLibrary(routines,setLibraryProgress).then(async()=>{ setRoutines(await db.getRoutines()); setLibraryContent(await db.getAllExerciseContent()) })} onImport={async(data)=>{
          await db.clearAll()
          for(const r of data.routines) await db.saveRoutine(r)
          for(const w of data.workouts) await db.saveWorkout(w)
          for(const item of data.discardedWorkouts||[]) await db.saveDiscardedWorkout(item)
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
  const items:{k:Tab,l:string,ico:React.ReactNode}[]=[{k:'home',l:'Home',ico:<FiHome/>},{k:'routines',l:'Routines',ico:<FiActivity/>},{k:'history',l:'History',ico:<FiClock/>},{k:'progress',l:'Progress',ico:<FiBarChart2/>},{k:'settings',l:'Settings',ico:<FiSettings/>}]
  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-card/95 backdrop-blur border-t border-border flex" style={{paddingBottom:'env(safe-area-inset-bottom)'}}>
      {items.map(i=>(
        <button key={i.k} onClick={()=>onChange(i.k)} className={`flex-1 py-3 flex flex-col items-center gap-0.5 transition-colors ${tab===i.k?'text-accent2':'text-dim'}`}>
          <span className={`text-[18px] leading-none transition-transform ${tab===i.k?'scale-110':''}`}>{i.ico}</span><span className="text-[10px] tracking-wide">{i.l}</span>
        </button>
      ))}
    </div>
  )
}

function Home({routines,workouts,onStart,onNav}:{routines:Routine[],workouts:Workout[],onStart:(r:Routine)=>void,onNav:(v:View)=>void}){
  const recent=workouts.slice(0,3)
  const dayNames=['DOMINGO','LUNES','MARTES','MIÉRCOLES','JUEVES','VIERNES','SÁBADO']
  const today=dayNames[new Date().getDay()]
  const recommended=routines.find(r=>r.name.toUpperCase().startsWith(today))
  return (
    <div className="space-y-5 pt-4">
      <h1 className="text-2xl font-bold tracking-tight">MY GYM</h1>
      {recommended && <div className="bg-accent/15 border-2 border-accent rounded-2xl p-4 shadow-[0_0_24px_rgba(250,204,21,.18)]">
        <div className="text-[11px] tracking-widest text-accent2 font-bold">RECOMMENDED TODAY · {today}</div>
        <div className="text-xl font-bold mt-1">{recommended.name}</div>
        <button onClick={()=>onStart(recommended)} className="mt-3 w-full py-3 rounded-xl bg-accent text-black font-bold button-lift"><FiPlay className="inline mr-2" />START TODAY'S WORKOUT</button>
      </div>}
      <div className="space-y-3">
        {routines.map(r=>(
          <div key={r.id} className="bg-card border border-border rounded-2xl p-4 card-enter">
            <div className="font-semibold">{r.name}</div>
            <div className="text-xs text-muted mt-1">{r.blocks.length} blocks · {r.blocks.reduce((a,b)=>a+b.exercises.length,0)} exercises</div>
            <button onClick={()=>onStart(r)} className="mt-3 w-full py-3 rounded-xl bg-accent text-black font-semibold button-lift"><FiPlay className="inline mr-2" />START WORKOUT</button>
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
      <button onClick={()=>onNav({tab:'routines'})} className="w-full py-3 rounded-xl bg-card2 border border-border text-sm button-lift"><FiEdit3 className="inline mr-2" />Manage Routines</button>
    </div>
  )
}

function RoutinesView({routines,onChange,onDelete,onStart,detailId,setView}:{routines:Routine[],onChange:(n:Routine[])=>void,onDelete:(id:string)=>void,onStart:(r:Routine)=>void,detailId?:string,setView:(v:View)=>void}){
  const [editing,setEditing]=useState<Routine|null>(routines.find(r=>r.id===detailId)||null)
  const [viewing,setViewing]=useState<Routine|null>(null)
  useEffect(()=>{ if(detailId) setEditing(routines.find(r=>r.id===detailId)||null)},[detailId])
  if(editing) return <RoutineEditor routine={editing} onSave={r=>{ const n=routines.map(x=>x.id===r.id?r:x); onChange(n); setEditing(null); setView({tab:'routines'})}} onBack={()=>{setEditing(null); setView({tab:'routines'})}} />
  if(viewing) return <RoutineViewer routine={viewing} onBack={()=>setViewing(null)} />
  return (
    <div className="pt-4 space-y-4">
      <div className="flex justify-between items-center"><h2 className="text-xl font-bold">Routines</h2>
        <button onClick={()=>{
          const r:Routine={id:uid(), name:"New Routine", createdAt:Date.now(), blocks:[]}
          onChange([...routines,r]); setEditing(r)
        }} className="px-4 py-2 rounded-xl bg-accent text-black text-sm font-semibold button-lift"><FiPlus className="inline mr-1" /> Create</button>
      </div>
      {routines.map(r=>(
        <div key={r.id} className="bg-card border border-border rounded-2xl p-4">
          <div className="flex justify-between">
            <div className="font-semibold">{r.name}</div>
            <button aria-label={`Delete ${r.name}`} title="Delete routine" onClick={()=>{ if(confirm('Delete routine?')) onDelete(r.id)}} className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 button-lift"><FiTrash2 size={19} strokeWidth={2.5}/></button>
          </div>
          <div className="text-xs text-muted mt-1">{r.blocks.map(b=>b.name).join(' · ')||'No blocks'}</div>
          <div className="flex gap-2 mt-3">
            <button aria-label={`View ${r.name}`} title="View routine" onClick={()=>setViewing(r)} className="flex-1 py-3 rounded-xl bg-card2 border border-border flex items-center justify-center button-lift"><FiEye size={22} strokeWidth={2.5}/></button>
            <button aria-label={`Edit ${r.name}`} title="Edit routine" onClick={()=>setEditing(r)} className="flex-1 py-3 rounded-xl bg-card2 border border-border flex items-center justify-center button-lift"><FiEdit3 size={22} strokeWidth={2.5}/></button>
            <button aria-label={`Start ${r.name}`} title="Start workout" onClick={()=>onStart(r)} className="flex-1 py-3 rounded-xl bg-accent text-black flex items-center justify-center button-lift"><FiPlay size={23} strokeWidth={2.8}/></button>
          </div>
        </div>
      ))}
    </div>
  )
}

function RoutineViewer({routine,onBack}:{routine:Routine,onBack:()=>void}){
  return <div className="pt-4 space-y-4">
    <button onClick={onBack} className="text-sm text-accent2 button-lift"><FiArrowLeft className="inline mr-1" />Routines</button>
    <div><h2 className="text-xl font-bold">{routine.name}</h2><div className="text-xs text-muted mt-1">Read-only routine overview</div></div>
    {routine.blocks.slice().sort((a,b)=>a.order-b.order).map(block=><div key={block.id} className="bg-card border border-border rounded-2xl p-4">
      <div className="font-semibold">{block.name}</div>
      <div className="mt-3 space-y-2">{block.exercises.slice().sort((a,b)=>a.order-b.order).map(e=><div key={e.id} className="border-b border-border/50 pb-2 last:border-0 last:pb-0">
        <div className="flex justify-between gap-3 text-sm"><span>{e.name}</span><span className="text-muted whitespace-nowrap">{e.sets} × {e.targetReps}</span></div>
        <ExerciseMediaImage exerciseId={e.id} media={e.media} className="mt-2 h-28" />
      </div>)}</div>
    </div>)}
  </div>
}

function RoutineEditor({routine,onSave,onBack}:{routine:Routine,onSave:(r:Routine)=>void,onBack:()=>void}){
  const [r,setR]=useState<Routine>(JSON.parse(JSON.stringify(routine)))
  const [saved,setSaved]=useState(false)
  const flash=()=>{ setSaved(true); window.setTimeout(()=>setSaved(false),1200) }
  const addBlock=()=> { setR(v=>({...v, blocks:[...v.blocks, {id:uid(), routineId:v.id, name:"New Block", order:v.blocks.length, exercises:[]}]})); flash() }
  const updateBlock=(id:string, name:string)=> { setR(v=>({...v, blocks: v.blocks.map(b=>b.id===id?{...b,name}:b)})); flash() }
  const delBlock=(id:string)=> { setR(v=>({...v, blocks: v.blocks.filter(b=>b.id!==id)})); flash() }
  const moveBlock=(idx:number,dir:number)=> { setR(v=>{ const a=[...v.blocks]; const n=idx+dir; if(n<0||n>=a.length) return v; [a[idx],a[n]]=[a[n],a[idx]]; return {...v, blocks:a.map((b,i)=>({...b,order:i}))}}); flash() }
  const addEx=(bid:string)=> { setR(v=>({...v, blocks: v.blocks.map(b=>b.id===bid?{...b, exercises:[...b.exercises, {id:uid(), blockId:bid, name:"New Exercise", order:b.exercises.length, sets:3, targetReps:"8", restSeconds:90}]}:b)})); flash() }
  const updEx=(bid:string, eid:string, patch:Partial<Exercise>)=> { setR(v=>({...v, blocks: v.blocks.map(b=>b.id===bid?{...b, exercises:b.exercises.map(e=>e.id===eid?{...e,...patch}:e)}:b)})); flash() }
  const delEx=(bid:string,eid:string)=> { setR(v=>({...v, blocks: v.blocks.map(b=>b.id===bid?{...b, exercises:b.exercises.filter(e=>e.id!==eid)}:b)})); flash() }
  const moveEx=(bid:string,idx:number,dir:number)=> { setR(v=>({...v, blocks: v.blocks.map(b=>{
    if(b.id!==bid) return b
    const a=[...b.exercises]; const n=idx+dir; if(n<0||n>=a.length) return b; [a[idx],a[n]]=[a[n],a[idx]]; return {...b, exercises:a.map((e,i)=>({...e,order:i}))}
  })})); flash() }
  return (
    <div className="pt-4 space-y-4">
      {saved && <SaveConfirmation />}
      <button onClick={onBack} className="text-sm text-accent2 button-lift"><FiArrowLeft className="inline mr-1" />Back</button>
      <input value={r.name} onChange={e=>{setR({...r,name:e.target.value});flash()}} className="w-full bg-card border border-border rounded-xl px-4 py-3 font-semibold" placeholder="Routine name" />
      {r.blocks.map((b,bi)=>(
        <div key={b.id} className="bg-card border border-border rounded-2xl p-3 space-y-3">
          <div className="flex gap-2">
            <input value={b.name} onChange={e=>updateBlock(b.id,e.target.value)} className="flex-1 bg-card2 border border-border rounded-xl px-3 py-2 text-sm font-medium" />
            <button aria-label="Move block up" onClick={()=>moveBlock(bi,-1)} className="px-2 bg-card2 border border-border rounded-lg button-lift"><FiArrowUp/></button>
            <button aria-label="Move block down" onClick={()=>moveBlock(bi,1)} className="px-2 bg-card2 border border-border rounded-lg button-lift"><FiArrowDown/></button>
            <button aria-label="Delete block" onClick={()=>delBlock(b.id)} className="px-2 text-red-400 button-lift"><FiX/></button>
          </div>
          {b.exercises.map((e,ei)=>(
            <div key={e.id} className="bg-bg border border-border rounded-xl p-3 space-y-2">
              <div className="flex gap-2">
                <input value={e.name} onChange={ev=>updEx(b.id,e.id,{name:ev.target.value})} className="flex-1 bg-card border border-border rounded-lg px-2 py-2 text-sm" />
                <button aria-label="Move exercise up" onClick={()=>moveEx(b.id,ei,-1)} className="px-1.5 text-xs border border-border rounded button-lift"><FiArrowUp/></button>
                <button aria-label="Move exercise down" onClick={()=>moveEx(b.id,ei,1)} className="px-1.5 text-xs border border-border rounded button-lift"><FiArrowDown/></button>
                <button aria-label="Delete exercise" onClick={()=>delEx(b.id,e.id)} className="text-red-400 px-1 button-lift"><FiX/></button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <label className="text-xs text-muted">Sets <input type="number" value={e.sets} onChange={ev=>updEx(b.id,e.id,{sets:parseInt(ev.target.value)||1})} className="w-full mt-1 bg-card border border-border rounded-lg px-2 py-2" /></label>
                <label className="text-xs text-muted">Reps <input value={e.targetReps} onChange={ev=>updEx(b.id,e.id,{targetReps:ev.target.value})} className="w-full mt-1 bg-card border border-border rounded-lg px-2 py-2" /></label>
                <label className="text-xs text-muted">Rest(s) <input type="number" value={e.restSeconds} onChange={ev=>updEx(b.id,e.id,{restSeconds:parseInt(ev.target.value)||0})} className="w-full mt-1 bg-card border border-border rounded-lg px-2 py-2" /></label>
              </div>
              <label className="text-xs text-muted">Unidad de medida
                <select value={e.unit||''} onChange={ev=>updEx(b.id,e.id,{unit:(ev.target.value||undefined) as Unit|undefined})} className="w-full mt-1 bg-card border border-border rounded-lg px-2 py-2 text-sm">
                  <option value="">Auto ({UNIT_NAME[resolveUnit(e)]})</option>
                  <option value="weight">Peso (kg)</option>
                  <option value="reps">Repeticiones</option>
                  <option value="time">Tiempo (segundos)</option>
                </select>
              </label>
              <input value={e.notes||''} onChange={ev=>updEx(b.id,e.id,{notes:ev.target.value})} placeholder="Notes" className="w-full bg-card border border-border rounded-lg px-2 py-1.5 text-xs" />
              <ExerciseMediaImage exerciseId={e.id} media={e.media} className="h-24" />
              <ExerciseMediaPicker exercise={e} onChange={media=>updEx(b.id,e.id,{media})} onSaved={flash} />
            </div>
          ))}
          <button onClick={()=>addEx(b.id)} className="w-full py-2 rounded-xl bg-card2 border border-dashed border-border text-sm button-lift"><FiPlus className="inline mr-1" />Add Exercise</button>
        </div>
      ))}
      <button onClick={addBlock} className="w-full py-3 rounded-xl border border-dashed border-border text-sm button-lift"><FiPlus className="inline mr-1" />Add Block</button>
      <button onClick={()=>{onSave(r); flash()}} className="w-full py-3 rounded-xl bg-accent text-black font-semibold button-lift"><FiCheck className="inline mr-1" />Save Routine</button>
    </div>
  )
}

function SaveConfirmation(){
  return <div className="fixed inset-0 z-[70] pointer-events-none flex items-center justify-center">
    <div className="animate-modal-in rounded-full bg-emerald-500 text-white p-5 shadow-2xl shadow-emerald-500/40"><FiCheck className="text-4xl"/></div>
  </div>
}

type MediaCandidate = { source: ExerciseMedia['source']; url: string; externalId?: string; label: string }

function ExerciseMediaPicker({exercise,onChange,onSaved}:{exercise:Exercise,onChange:(media:ExerciseMedia|undefined)=>void,onSaved:()=>void}){
  const [open,setOpen]=useState(false)
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState('')
  const [candidates,setCandidates]=useState<MediaCandidate[]>([])
  const [index,setIndex]=useState(0)
  const [url,setUrl]=useState('')
  const choose=async(candidate:MediaCandidate)=>{
    setLoading(true); setError('')
    try {
      const media=await downloadMedia(candidate,`exercise:${exercise.id}`)
      await db.saveExerciseContent({localExerciseId:exercise.id,externalId:media.externalId,name:exercise.name,status:'downloaded',resourceKey:media.resourceKey,syncedAt:Date.now()})
      onChange({source:candidate.source,url:candidate.url,externalId:candidate.externalId,label:candidate.label,resourceKey:media.resourceKey})
      setOpen(false); onSaved()
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar el recurso local') }
    finally { setLoading(false) }
  }
  const search=async()=>{
    setLoading(true); setError(''); setIndex(0)
    try {
      let results=await searchExerciseGymGifs(exercise.name)
      if(results.length) {
        const found=results.map(item=>({source:'exercise-gym-gifs' as const,url:`${EXERCISE_DB_BASE}/${item.file}`,externalId:item.id,label:item.name}))
        setCandidates(found)
      } else {
        const wger=await searchWger(exercise.name)
        const found=wger.flatMap(item=>(item.images||[]).map(image=>({source:'wger' as const,url:image.image,externalId:`wger:${item.id}`,label:item.name||exercise.name})))
        setCandidates(found)
        if(!found.length) setError('No se encontraron demostraciones. Puedes guardar una URL manual.')
      }
    } catch (e) { setCandidates([]); setError(e instanceof Error ? e.message : 'No se pudo buscar') }
    finally { setLoading(false) }
  }
  const saveUrl=()=>{ const value=url.trim(); if(!/^https?:\/\/.+/i.test(value)){setError('Introduce una URL http(s) válida');return}; void choose({source:'url',url:value,label:'URL personalizada'}) }
  return <div className="pt-2 border-t border-border/50">
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-muted">{exercise.media ? `Recurso: ${exercise.media.label||exercise.media.source}` : 'Sin demostración personalizada'}</span>
      <button onClick={()=>{setOpen(true);setCandidates([]);setError('');void search()}} className="text-xs px-3 py-2 rounded-lg bg-card2 border border-border button-lift">{exercise.media?'Cambiar GIF / imagen':'Agregar GIF / imagen'}</button>
    </div>
    {open && <div className="fixed inset-0 z-[60] bg-black/75 backdrop-blur flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl p-4 w-full max-w-sm space-y-3 animate-modal-in">
        <div className="flex justify-between items-center"><h3 className="font-semibold">Demostración de {exercise.name}</h3><button onClick={()=>setOpen(false)}><FiX/></button></div>
        {loading && <div className="text-sm text-muted">Buscando y guardando opciones…</div>}
        {!loading && candidates.length>0 && <div className="space-y-2">
          <div className="relative bg-bg rounded-xl overflow-hidden"><img src={candidates[index].url} alt={candidates[index].label} className="w-full h-48 object-contain"/><div className="absolute bottom-2 left-2 right-2 text-xs bg-black/70 rounded p-2">{candidates[index].label} · {candidates[index].source}</div></div>
          <div className="flex items-center justify-between"><button disabled={index===0} onClick={()=>setIndex(value=>value-1)} className="px-3 py-2 rounded-lg bg-card2 disabled:opacity-30"><FiArrowLeft/></button><span className="text-xs text-muted">{index+1}/{candidates.length}</span><button disabled={index===candidates.length-1} onClick={()=>setIndex(value=>value+1)} className="px-3 py-2 rounded-lg bg-card2 disabled:opacity-30"><FiArrowRight/></button></div>
          <button disabled={loading} onClick={()=>void choose(candidates[index])} className="w-full py-3 rounded-xl bg-accent text-black font-semibold">Guardar esta opción offline</button>
        </div>}
        {!loading && <div className="space-y-2"><div className="text-xs tracking-widest text-dim">URL MANUAL</div><div className="flex gap-2"><input value={url} onChange={event=>setUrl(event.target.value)} placeholder="https://..." className="min-w-0 flex-1 bg-bg border border-border rounded-lg px-3 py-2 text-sm"/><button onClick={saveUrl} className="px-3 rounded-lg bg-card2 border border-border">Guardar</button></div></div>}
        {error && <div className="text-xs text-amber-300">{error}</div>}
      </div>
    </div>}
  </div>
}

function ActiveWorkout({workout,workouts,onChange,onFinish,onDiscard,onSave}:{workout:Workout,workouts:Workout[],onChange:(w:Workout)=>void,onFinish:()=>void,onDiscard:()=>void,onSave:(w:Workout)=>void}){
  const [idx,setIdx]=useState(()=>Math.max(0,workout.exercises.findIndex(e=>!e.skipped)))
  const [timer,setTimer]=useState(0)
  const [run,setRun]=useState(false)
  const [previousOpen,setPreviousOpen]=useState(false)
  const [previousIndex,setPreviousIndex]=useState(0)
  const ex=workout.exercises[idx]
  const unit=resolveUnit(ex)
  const history=exerciseHistory(ex.exerciseName, workouts)
  const prev=previousOpen ? history[previousIndex]?.sets : bestPreviousSets(ex.exerciseName, workouts)
  const sug=suggestion(ex.exerciseName, ex.targetSets, ex.targetReps, workouts)
  const curSetIdx=ex.sets.findIndex(s=>!s.completed)
  const doneCount=ex.sets.filter(s=>s.completed).length
  const activeExercises=workout.exercises.filter(e=>!e.skipped)
  useEffect(()=>{
    if(workout.exercises[idx]?.skipped){
      const next=workout.exercises.findIndex(e=>!e.skipped)
      if(next>=0) setIdx(next)
    }
  },[idx,workout.exercises])
  useEffect(()=>{ if(!run) return; const id=setInterval(()=>setTimer(t=>unit==='time'?Math.max(0,t-1):t+1),1000); return ()=>clearInterval(id)},[run,unit])
  useEffect(()=>{ if(unit==='time' && timer===0) setRun(false)},[timer,unit])
  useEffect(()=>{ if(unit==='time') setTimer(parseInt(ex.targetReps)||0); else setTimer(0); setRun(false); setPreviousIndex(0); setPreviousOpen(false) },[idx,unit,ex.targetReps])
  const updSet=(si:number, patch:Partial<any>)=>{
    const n={...workout, exercises: workout.exercises.map((e,i)=> i!==idx?e:{...e, sets:e.sets.map((s,j)=> j===si?{...s,...patch}:s)})}
    onChange(n); onSave(n)
  }
  const addSet=()=>{
    const n={...workout, exercises: workout.exercises.map((e,i)=> i!==idx?e:{...e, sets:[...e.sets,{weight:0,reps:0,completed:false}]})}
    onChange(n); onSave(n)
  }
  const skipExercise=()=>{
    const n={...workout, exercises:workout.exercises.map((e,i)=>i===idx?{...e,skipped:true}:e)}
    onChange(n); onSave(n)
    setRun(false)
    const next=n.exercises.findIndex((e,i)=>i>idx&&!e.skipped)
    const first=n.exercises.findIndex(e=>!e.skipped)
    setIdx(next>=0?next:first>=0?first:idx)
  }
  const fmtSet=(s:typeof ex.sets[number]):string=> unit==='time'? `${s.weight||0}${UNIT_LABEL[unit]}` : unit==='reps'? `${s.reps||0} reps` : `${s.weight||0} kg × ${s.reps||0}`
  const pct=activeExercises.length?Math.round((activeExercises.filter(e=>e.sets.every(s=>s.completed)).length/activeExercises.length)*100):100
  if(!activeExercises.length) return (
    <div className="min-h-screen bg-bg p-4 flex flex-col justify-center gap-4">
      <div className="bg-card border border-border rounded-2xl p-5 text-center">
        <FiSkipForward className="mx-auto text-accent2 text-3xl mb-3"/>
        <div className="font-bold text-lg">All exercises skipped</div>
        <div className="text-sm text-muted mt-1">You can finish this workout without changing the routine.</div>
      </div>
      <button onClick={onFinish} className="w-full py-4 rounded-2xl bg-emerald-600 font-bold text-lg button-lift"><FiCheck className="inline mr-2"/>FINISH WORKOUT</button>
    </div>
  )
  return (
    <div className="min-h-screen bg-bg pb-6">
      <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex justify-between items-center" style={{paddingTop:'calc(12px + env(safe-area-inset-top))'}}>
        <div><div className="font-bold text-sm">{workout.routineName}</div><div className="text-xs text-muted">{pct}% · {ex.blockName} · {idx+1}/{workout.exercises.length}</div></div>
        <button onClick={()=>{ if(confirm('Discard workout?')) onDiscard()}} className="text-xs px-3 py-1.5 rounded-lg bg-card2 border border-border button-lift"><FiX className="inline mr-1" />Exit</button>
      </div>
      <div className="px-4 pt-4 space-y-4">
        <div className="h-1 bg-card2 rounded-full overflow-hidden"><div className="h-full bg-accent" style={{width: `${Math.min(1,(idx+1)/workout.exercises.length)*100}%`}} /></div>
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="text-xs tracking-widest text-dim">{ex.blockName.toUpperCase()}</div>
          <div className="text-xl font-bold mt-1">{ex.exerciseName}</div>
          <div className="text-xs text-muted mt-1">{ex.targetSets} × {ex.targetReps} · rest {ex.restSeconds}s</div>
          <div className="text-xs text-emerald-400 mt-1">{doneCount}/{ex.targetSets} sets done</div>
          <button onClick={skipExercise} className="mt-3 w-full py-2.5 rounded-xl bg-card2 border border-border text-xs text-muted button-lift"><FiSkipForward className="inline mr-2"/>Skip exercise for this workout</button>
          <ExerciseEducation exerciseId={ex.exerciseId} media={ex.media} />
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 space-y-2">
          <button onClick={()=>setPreviousOpen(v=>!v)} className="w-full text-left text-xs font-semibold tracking-widest text-dim">PREVIOUS {previousOpen?<FiChevronUp className="inline"/>:<FiChevronDown className="inline"/>} <span className="float-right text-accent2 normal-case tracking-normal">{previousOpen?'All records':'Best performance'}</span></button>
          {prev? prev.map((s,i)=><div key={i} className="text-sm">{fmtSet(s)} {s.completed?'✓':''}</div>): <div className="text-sm text-muted">No previous workout</div>}
          {previousOpen && history.length>1 && <div className="flex items-center justify-between pt-2"><button aria-label="Previous record" onClick={()=>setPreviousIndex(i=>Math.max(0,i-1))} disabled={previousIndex===0} className="px-3 py-1 rounded-lg bg-card2 border border-border disabled:opacity-30 button-lift"><FiArrowLeft/></button><span className="text-xs text-muted">{previousIndex+1}/{history.length} · {new Date(history[previousIndex].workout.completedAt!).toLocaleDateString()}</span><button aria-label="Next record" onClick={()=>setPreviousIndex(i=>Math.min(history.length-1,i+1))} disabled={previousIndex===history.length-1} className="px-3 py-1 rounded-lg bg-card2 border border-border disabled:opacity-30 button-lift"><FiArrowRight/></button></div>}
          {unit==='weight' && sug && <div className="mt-2 bg-accent/10 border border-accent/20 rounded-xl p-3"><div className="text-xs text-accent2">Suggested: {sug.text}</div><div className="text-[11px] text-muted">{sug.reason}</div></div>}
        </div>

        <div className="space-y-3">
          {ex.sets.map((s,si)=>(
            <div key={si} className={`rounded-2xl p-4 border ${s.completed?'bg-emerald-500/10 border-emerald-500/30':'bg-card border-border'}`}>
              <div className="flex justify-between items-center mb-3"><span className="font-semibold text-sm">SET {si+1} {si===curSetIdx && !s.completed && <span className="text-accent2 text-xs ml-2">● current</span>}</span><span className={`text-xs px-2 py-1 rounded-full ${s.completed?'bg-emerald-500 text-white':'bg-card2 border border-border'}`}>{s.completed?'Done':'Pending'}</span></div>
              {unit==='time' ? (
                <label className="text-xs text-muted block">Tiempo (segundos)<input type="number" inputMode="decimal" value={s.weight||''} onChange={e=>updSet(si,{weight:parseFloat(e.target.value)||0})} className="w-full mt-1 bg-bg border border-border rounded-xl px-3 py-3 text-lg font-semibold" placeholder="0" /></label>
              ) : unit==='reps' ? (
                <label className="text-xs text-muted block">Repeticiones<input type="number" inputMode="numeric" value={s.reps||''} onChange={e=>updSet(si,{reps:parseInt(e.target.value)||0})} className="w-full mt-1 bg-bg border border-border rounded-xl px-3 py-3 text-lg font-semibold" placeholder="0" /></label>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs text-muted">Weight (kg)<input type="number" inputMode="decimal" value={s.weight||''} onChange={e=>updSet(si,{weight:parseFloat(e.target.value)||0})} className="w-full mt-1 bg-bg border border-border rounded-xl px-3 py-3 text-lg font-semibold" placeholder="0" /></label>
                  <label className="text-xs text-muted">Reps<input type="number" inputMode="numeric" value={s.reps||''} onChange={e=>updSet(si,{reps:parseInt(e.target.value)||0})} className="w-full mt-1 bg-bg border border-border rounded-xl px-3 py-3 text-lg font-semibold" placeholder="0" /></label>
                </div>
              )}
              <button onClick={()=>updSet(si,{completed:!s.completed})} className={`w-full mt-3 py-3.5 rounded-xl font-semibold text-lg button-lift ${s.completed?'bg-card2 text-white border border-border':'bg-accent text-black'}`}>{s.completed?<><FiRefreshCw className="inline mr-2"/>Undo</>:<><FiCheck className="inline mr-2"/>COMPLETE SET</>}</button>
            </div>
          ))}
          <button onClick={addSet} className="w-full py-3 rounded-xl bg-card2 border border-dashed border-border text-sm">+ Add extra set (currently {ex.sets.length}/{ex.targetSets})</button>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 flex flex-col items-center gap-3">
          <div className="relative w-36 h-36">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120"><circle cx="60" cy="60" r="52" fill="none" stroke="#ffffff18" strokeWidth="8"/><circle cx="60" cy="60" r="52" fill="none" stroke="#facc15" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${2*Math.PI*52}`} strokeDashoffset={`${2*Math.PI*52*(unit==='time' ? 1-Math.min(1,timer/Math.max(parseInt(ex.targetReps)||1,1)) : 1-(timer%60)/60)}`}/></svg>
            <div className="absolute inset-0 flex items-center justify-center text-2xl font-mono font-bold">{String(Math.floor(timer/60)).padStart(2,'0')}:{String(timer%60).padStart(2,'0')}</div>
          </div>
          <div className="flex gap-2 w-full">
            <button onClick={()=>setRun(true)} className="flex-1 py-3 rounded-xl bg-accent text-black font-semibold button-lift">{run?<><FiActivity className="inline mr-2"/>RUNNING</>:<><FiPlay className="inline mr-2"/>START TIMER</>}</button>
            <button onClick={()=>setRun(false)} className="px-6 py-3 rounded-xl bg-card2 border border-border button-lift"><FiPause className="inline mr-1"/>Pause</button>
          </div>
          <div className="flex gap-2">
            {unit==='time' &&             <button onClick={()=>setTimer(t=>t+10)} className="px-3 py-1.5 rounded-lg bg-card2 border border-border text-xs button-lift"><FiPlus className="inline mr-1"/>10s</button>}
            <button onClick={()=>{setTimer(unit==='time'?parseInt(ex.targetReps)||0:0);setRun(false)}} className="px-3 py-1.5 rounded-lg bg-card2 border border-border text-xs button-lift"><FiRefreshCw className="inline mr-1"/>RESET</button>
          </div>
        </div>

        <div className="flex gap-3">
          <button disabled={idx===0} onClick={()=>setIdx(i=>i-1)} className="flex-1 py-4 rounded-xl bg-card border border-border disabled:opacity-30 font-semibold button-lift"><FiArrowLeft className="inline mr-2"/>PREVIOUS</button>
          <button disabled={idx===workout.exercises.length-1} onClick={()=>setIdx(i=>i+1)} className="flex-1 py-4 rounded-xl bg-card border border-border disabled:opacity-30 font-semibold button-lift">NEXT<FiArrowRight className="inline ml-2"/></button>
        </div>

        <div className="space-y-1">
          <div className="text-xs tracking-widest text-dim">ALL EXERCISES</div>
          {workout.exercises.map((e,i)=>{
            const done=e.sets.every(s=>s.completed)
            return <button key={i} disabled={e.skipped} onClick={()=>setIdx(i)} className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm flex justify-between ${i===idx?'bg-accent border-accent text-black':'bg-card text-white border-border'} ${done||e.skipped?'opacity-60':''}`}><span>{e.blockName} · {e.exerciseName}{e.skipped&&<span className="ml-2 text-xs"><FiSkipForward className="inline"/> skipped</span>}</span><span>{e.skipped?'—':`${e.sets.filter(s=>s.completed).length}/${e.targetSets}`}</span></button>
          })}
        </div>

        <button onClick={()=>{ if(confirm(`Finish workout? ${activeExercises.filter(e=>e.sets.some(s=>s.completed)).length}/${activeExercises.length} exercises touched`)) onFinish()}} className="w-full py-4 rounded-2xl bg-emerald-600 font-bold text-lg">FINISH WORKOUT</button>
        <div className="h-6" />
      </div>
    </div>
  )
}

function HistoryView({workouts,discarded,onSelect,selected,onDelete,onRestore,onPermanentDelete}:{workouts:Workout[],discarded:DiscardedWorkout[],onSelect:(id:string)=>void,selected?:string,onDelete:(id:string)=>void,onRestore:(id:string)=>void,onPermanentDelete:(id:string)=>void}){
  const [expandedDiscarded,setExpandedDiscarded]=useState<string|null>(null)
  const sel=workouts.find(w=>w.id===selected)
  if(sel) return (
    <div className="pt-4 space-y-4">
      <button onClick={()=>onSelect('')} className="text-sm text-accent2 button-lift"><FiArrowLeft className="inline mr-1"/>History</button>
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="font-bold">{sel.routineName}</div>
        <div className="text-xs text-muted">{new Date(sel.completedAt||sel.startedAt).toLocaleString()} · {workoutVolume(sel.exercises).toLocaleString()} kg volume</div>
      </div>
      {sel.exercises.map((e,i)=>(
        <div key={i} className="bg-card border border-border rounded-xl p-3">
          <ExerciseMediaImage exerciseId={e.exerciseId} media={e.media} className="mb-2 h-28" />
          <div className="text-xs text-dim">{e.blockName}</div><div className="font-medium text-sm">{e.exerciseName}</div>
          <div className="mt-2 space-y-1">{e.sets.map((s,j)=>{ const u=resolveUnit(e); return <div key={j} className="text-sm flex justify-between"><span>{u==='time'? `${s.weight||0}s` : u==='reps'? `${s.reps||0} reps` : `${s.weight} × ${s.reps}`}</span><span className={s.completed?'text-emerald-400':'text-dim'}>{s.completed?'✓':''}</span></div>})}</div>
        </div>
      ))}
      <button onClick={()=>{ if(confirm('Delete workout?')) onDelete(sel.id)}} className="w-full py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">Delete Workout</button>
    </div>
  )
  return (
    <div className="pt-4 space-y-3">
      <h2 className="text-xl font-bold">History</h2>
      {workouts.filter(w=>w.completedAt).length? workouts.filter(w=>w.completedAt).map(w=>(
        <button key={w.id} onClick={()=>onSelect(w.id)} className="w-full text-left bg-card border border-border rounded-2xl p-4 card-enter button-lift">
          <div className="font-semibold text-sm">{w.routineName}</div>
          <div className="text-xs text-muted">{new Date(w.completedAt!).toLocaleDateString()} · Volume: {workoutVolume(w.exercises).toLocaleString()} kg</div>
        </button>
      )): <div className="text-sm text-muted text-center py-8">No history yet</div>}
      <div className="pt-4 space-y-2">
        <div className="text-xs tracking-widest text-dim">RECYCLE BIN · 7 DAYS</div>
        {discarded.length ? discarded.map(item=><div key={item.workout.id} className="bg-card border border-red-400/20 rounded-xl p-3">
          <button onClick={()=>setExpandedDiscarded(id=>id===item.workout.id?null:item.workout.id)} className="w-full text-left">
            <div className="flex justify-between items-start gap-3"><div className="font-medium text-sm"><FiArchive className="inline mr-1 text-red-300"/>{item.workout.routineName}</div><span className="text-xs text-accent2">{expandedDiscarded===item.workout.id?<><FiChevronUp className="inline mr-1"/>Hide</>:<><FiChevronDown className="inline mr-1"/>View</>}</span></div>
            <div className="text-xs text-muted mt-1">Expires {new Date(item.expiresAt).toLocaleDateString()} · {item.workout.exercises.length} exercises · {workoutVolume(item.workout.exercises).toLocaleString()} kg volume</div>
          </button>
          {expandedDiscarded===item.workout.id && <div className="mt-3 pt-3 border-t border-border/60 space-y-2">
            {item.workout.exercises.map((e,i)=><div key={i} className="bg-bg border border-border rounded-lg p-2.5">
              <ExerciseMediaImage exerciseId={e.exerciseId} media={e.media} className="mb-2 h-20" />
              <div className="text-xs text-dim">{e.blockName}</div><div className="font-medium text-sm">{e.exerciseName}</div>
              <div className="mt-1 space-y-0.5">{e.sets.map((s,j)=>{ const u=resolveUnit(e); return <div key={j} className="text-xs flex justify-between"><span>{u==='time'?`${s.weight||0}s`:u==='reps'?`${s.reps||0} reps`:`${s.weight||0} kg × ${s.reps||0}`}</span><span className={s.completed?'text-emerald-400':'text-dim'}>{s.completed?'✓':'—'}</span></div>})}</div>
            </div>)}
          </div>}
          <div className="flex gap-2 mt-2"><button onClick={()=>onRestore(item.workout.id)} className="flex-1 py-2 rounded-lg bg-accent text-black text-xs font-semibold button-lift"><FiRefreshCw className="inline mr-1"/>Restore</button><button onClick={()=>{if(confirm('Delete permanently?')) onPermanentDelete(item.workout.id)}} className="flex-1 py-2 rounded-lg bg-card2 border border-border text-xs text-red-400 button-lift"><FiTrash2 className="inline mr-1"/>Delete forever</button></div>
        </div>) : <div className="text-xs text-muted">No discarded workouts.</div>}
      </div>
    </div>
  )
}

const ROUTINE_PRINCIPAL = /principal/i

function ProgressView({routines,workouts,bws,onAddBw,onDelBw}:{routines:Routine[],workouts:Workout[],bws:BodyweightEntry[],onAddBw:(w:number)=>void,onDelBw:(id:string)=>void}){
  const done=workouts.filter(w=>w.completedAt)
  const sortedRoutines=[...routines].sort((a,b)=>a.createdAt-b.createdAt)
  const [routineId,setRoutineId]=useState<string>(sortedRoutines[0]?.id||'')
  useEffect(()=>{ if(sortedRoutines.length && !routineId) setRoutineId(sortedRoutines[0].id) },[sortedRoutines,routineId])
  const routine=sortedRoutines.find(r=>r.id===routineId)

  const mainBlocks = routine? routine.blocks
    .filter(b=>ROUTINE_PRINCIPAL.test(b.name))
    .sort((a,b)=>a.order-b.order) : []
  const mainBlock = mainBlocks[0]
  const mainExercises = mainBlock? [...mainBlock.exercises].sort((a,b)=>a.order-b.order) : []

  const [bw,setBw]=useState('')
  const [bwShow,setBwShow]=useState(true)

  const bwData=bws.map(b=>({date:fmtDate(b.date), body: b.weight}))

  return (
    <div className="pt-4 space-y-5">
      <h2 className="text-xl font-bold">Progression</h2>

      <label className="block">
        <span className="text-xs tracking-widest text-dim">ROUTINE</span>
        <select value={routineId} onChange={e=>setRoutineId(e.target.value)} className="w-full mt-1.5 bg-card border border-border rounded-xl px-3 py-3 text-sm font-medium">
          {sortedRoutines.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </label>

      {!routine && <div className="text-sm text-muted text-center py-8">No routines available.</div>}

      {routine && <>
        {mainBlock && <>
          <div className="text-xs tracking-widest text-dim">{mainBlock.name.toUpperCase()} · {mainExercises.length} ejercicios</div>
          {mainExercises.map(ex=> <ExerciseChart key={ex.id} name={ex.name} exerciseId={ex.id} media={ex.media} unit={resolveUnit(ex)} workouts={done} />)}
        </>}
        {!mainBlock && <div className="text-sm text-muted bg-card border border-border rounded-2xl p-4">Esta rutina no tiene un bloque «Rutina principal».</div>}
      </>}

      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <div className="flex justify-between items-center">
          <div className="font-semibold text-sm">Peso corporal</div>
          <button onClick={()=>setBwShow(v=>!v)} className="text-xs px-2.5 py-1 rounded-lg bg-card2 border border-border button-lift">{bwShow?<><FiEye className="inline mr-1"/>Hide</>:<><FiEye className="inline mr-1"/>Show</>}</button>
        </div>
        <div className="flex gap-2">
          <input value={bw} onChange={e=>setBw(e.target.value)} placeholder="kg" type="number" inputMode="decimal" step="0.1" className="flex-1 bg-bg border border-border rounded-xl px-3 py-3" />
          <button onClick={()=>{ const v=parseFloat(bw); if(v>0){onAddBw(v); setBw('')}}} className="px-6 py-3 rounded-xl bg-accent text-black font-semibold button-lift"><FiPlus className="inline mr-1"/>Add</button>
        </div>
        {bwShow && (
          bwData.length>1
            ? <div className="h-32 w-full"><ResponsiveContainer width="100%" height="100%"><LineChart data={bwData} margin={{top:6,right:8,left:8,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff14" />
                <XAxis dataKey="date" tick={{fill:'#9ca3af',fontSize:10}} tickLine={false} axisLine={{stroke:'#ffffff22'}} minTickGap={24} />
                <YAxis domain={['auto','auto']} tick={{fill:'#9ca3af',fontSize:10}} tickLine={false} axisLine={false} width={34} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabel} itemStyle={tooltipItem} />
                <Line type="monotone" dataKey="body" name="Peso" stroke="#10b981" strokeWidth={2.5} dot={{r:3,fill:'#10b981'}} activeDot={{r:5}} connectNulls />
              </LineChart></ResponsiveContainer></div>
            : <div className="text-xs text-muted">Añade al menos 2 mediciones para ver la línea.</div>
        )}
        <div className="space-y-1">
          {bws.slice().reverse().map(b=>(
            <div key={b.id} className="flex justify-between text-sm py-1.5 border-b border-border/50 last:border-0"><span>{b.date}</span><span className="flex gap-3">{b.weight} kg <button onClick={()=>onDelBw(b.id)} className="text-red-400 text-xs">✕</button></span></div>
          ))}
          {!bws.length && <div className="text-xs text-muted">No hay mediciones todavía.</div>}
        </div>
      </div>
    </div>
  )
}

const tooltipStyle={ background:'#16161d', border:'1px solid #ffffff22', borderRadius:12, padding:'8px 10px', fontSize:12, boxShadow:'0 8px 24px rgba(0,0,0,.4)' }
const tooltipLabel={ color:'#9ca3af', fontSize:11, fontWeight:600, marginBottom:4 }
const tooltipItem={ color:'#fff', fontSize:13 }
function formatMetric(value:number){
  return Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined,{maximumFractionDigits:2})
}

function ExerciseChart({name,exerciseId,media,unit,workouts}:{name:string,exerciseId:string,media?:ExerciseMedia,unit:Unit,workouts:Workout[]}){
  const history=workouts
    .filter(w=>w.exercises.some(e=>e.exerciseName===name))
    .sort((a,b)=>a.completedAt!-b.completedAt!)
  const data=history.map(w=>{
    const e=w.exercises.find(x=>x.exerciseName===name)!
    const u=resolveUnit(e)
    const c=e.skipped ? [] : e.sets.filter(s=>s.completed && (u==='time' ? s.weight>0 : u==='reps' ? s.reps>0 : s.weight>0 && s.reps>0))
    const load=c.map(s=> u==='time'? s.weight : u==='reps'? s.reps : s.weight)
    const reps=c.map(s=>s.reps)
    const maxL=c.length?Math.max(...load):0
    const meanL=c.length?load.reduce((a,b)=>a+b,0)/c.length:0
    const vol= u==='time'? c.reduce((a,s)=>a+s.weight,0) : u==='reps'? c.reduce((a,s)=>a+s.reps,0) : c.reduce((a,s)=>a+s.weight*s.reps,0)
    const maxReps=reps.length?Math.max(...reps):0
    return c.length ? {date:new Date(w.completedAt!).toLocaleDateString(), maxW:maxL, meanW:meanL, vol, maxReps, sets:c.length} : null
  }).filter((entry):entry is {date:string,maxW:number,meanW:number,vol:number,maxReps:number,sets:number}=>entry!==null)
  const isReps=unit==='reps'
  const isTime=unit==='time'
  const [metric,setMetric]=useState<'maxW'|'meanW'|'vol'|'maxReps'>(isTime||isReps?'maxW':'maxW')
  const opts:{k:typeof metric,l:string,unit:string,color:string}[]= isTime? [
    {k:'maxW',l:'Máximo',unit:' s',color:'#fbbf24'},
    {k:'meanW',l:'Promedio',unit:' s',color:'#60a5fa'},
    {k:'vol',l:'Total',unit:' s',color:'#a78bfa'},
  ] : isReps? [
    {k:'maxW',l:'Máximo',unit:'',color:'#fbbf24'},
    {k:'meanW',l:'Promedio',unit:'',color:'#60a5fa'},
  ] : [
    {k:'maxW',l:'Max Peso',unit:' kg',color:'#fbbf24'},
    {k:'meanW',l:'Promedio',unit:' kg',color:'#60a5fa'},
    {k:'vol',l:'Volumen',unit:'',color:'#a78bfa'},
    {k:'maxReps',l:'Max Reps',unit:'',color:'#34d399'},
  ]
  const o=opts.find(x=>x.k===metric) || opts[0]
  const pr=data.length?Math.max(...data.map(d=>d[metric])):0
  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
      <ExerciseMediaImage exerciseId={exerciseId} media={media} className="h-32" />
      <div className="flex items-start justify-between gap-2">
        <div className="font-semibold text-sm leading-tight">{name}</div>
        <div className="text-xs text-accent2 whitespace-nowrap">{data.length>0?`PR ${formatMetric(pr)}${o.unit}`:'—'}</div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {opts.map(x=>(
          <button key={x.k} onClick={()=>setMetric(x.k)} className={`text-[11px] px-2.5 py-1 rounded-lg border ${metric===x.k?'bg-accent border-accent text-black font-semibold':'bg-card2 border-border text-muted'}`}>{x.l}</button>
        ))}
      </div>
      {data.length>1 ? (
        <div className="h-40 w-full"><ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{top:6,right:8,left:8,bottom:0}}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff14" />
          <XAxis dataKey="date" tick={{fill:'#9ca3af',fontSize:10}} tickLine={false} axisLine={{stroke:'#ffffff22'}} minTickGap={24} />
          <YAxis domain={['auto','auto']} tick={{fill:'#9ca3af',fontSize:10}} tickLine={false} axisLine={false} width={34} />
          <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabel} itemStyle={tooltipItem} formatter={(v:any)=>[`${formatMetric(Number(v))}${o.unit}`,o.l]} />
          <Line type="monotone" dataKey={metric} name={o.l} stroke={o.color} strokeWidth={2.5} dot={{r:3,fill:o.color}} activeDot={{r:5}} connectNulls />
        </LineChart></ResponsiveContainer></div>
      ): data.length===1 ? (
        <div className="text-xs text-muted py-4 text-center">Solo hay 1 registro. Completa más sesiones del ejercicio «{name}» (actual: {data[0][metric]}{o.unit}).</div>
      ): (
        <div className="text-xs text-muted py-4 text-center">Sin datos. Haz {name} en una sesión para ver su progresión.</div>
      )}
      {data.length>1 && <div className="text-[11px] text-muted">{data.length} sesiones · línea de evolución</div>}
    </div>
  )
}

function ExerciseMediaImage({exerciseId,media,className}:{exerciseId:string,media?:ExerciseMedia,className?:string}){
  const [content,setContent]=useState<ExerciseContent|null>(null)
  const [url,setUrl]=useState<string|null>(null)
  useEffect(()=>{
    let disposed=false
    let objectUrl:string|undefined
    const load=async()=>{
      const item=await db.getExerciseContent(exerciseId)
      if(disposed) return
      setContent(item||null)
      setUrl(null)
      const resourceKey=media?.resourceKey || (item?.status==='downloaded' ? item.resourceKey : undefined)
      if(resourceKey){
        const resource=await db.getExerciseResource(resourceKey)
        if(resource && !disposed){ objectUrl=URL.createObjectURL(resource.blob); setUrl(objectUrl) }
      }
      if(!disposed && (!item || item.status==='error')) window.setTimeout(load,1500)
    }
    void load()
    return ()=>{ disposed=true; if(objectUrl) URL.revokeObjectURL(objectUrl) }
  },[exerciseId,media?.resourceKey])
  if(!url) return null
  return <img src={url} alt={`Demostración de ${media?.label||content?.name||'ejercicio'}`} className={`w-full object-contain rounded-xl bg-bg ${className||'max-h-64'}`} />
}

function ExerciseEducation({exerciseId,media}:{exerciseId:string,media?:ExerciseMedia}){
  return <div className="mt-3 border-t border-border/60 pt-3"><ExerciseMediaImage exerciseId={exerciseId} media={media} className="max-h-64" /></div>
}

function Settings({routines,workouts,discarded,bws,active,libraryContent,libraryProgress,onSync,onImport,onClear}:{routines:Routine[],workouts:Workout[],discarded:DiscardedWorkout[],bws:BodyweightEntry[],active:Workout|null,libraryContent:ExerciseContent[],libraryProgress:SyncProgress,onSync:()=>void,onImport:(d:any)=>void,onClear:()=>void}){
  const exercises=routines.flatMap(r=>r.blocks.flatMap(b=>b.exercises))
  const visualCount=exercises.filter(ex=>ex.media?.resourceKey || libraryContent.some(content=>content.localExerciseId===ex.id && content.status==='downloaded' && content.resourceKey)).length
  const exp=()=>{
    const data={routines,workouts,discardedWorkouts:discarded,bodyweights:bws,activeWorkout:active, exportedAt:Date.now()}
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`gym-backup-${new Date().toISOString().slice(0,10)}.json`; a.click()
  }
  const imp=(e:any)=>{
    const f=e.target.files?.[0]; if(!f) return; const r=new FileReader(); r.onload=()=>{ try{ const d=JSON.parse(r.result as string); if(!d.routines||!d.workouts) throw new Error('invalid'); if(confirm('Import will overwrite current data. Continue?')) onImport(d)}catch{alert('Invalid file')}}; r.readAsText(f)
  }
  return (
    <div className="pt-4 space-y-4">
      <h2 className="text-xl font-bold"><FiSettings className="inline mr-2 text-accent2"/>Settings</h2>
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <div className="text-sm font-semibold">Exercise demonstrations</div>
        <div className="text-xs text-muted">{exercises.length}/{visualCount} ejercicios con imagen</div>
        <div className="text-xs text-muted">
          {libraryProgress.state==='syncing' ? `Synchronizing ${libraryProgress.completed}/${libraryProgress.total} exercises…` :
            libraryProgress.state==='ready' ? `${libraryProgress.completed}/${libraryProgress.total} exercises checked and stored locally.` :
            libraryProgress.state==='error' ? `Synchronization failed: ${libraryProgress.message}` : 'Not synchronized yet.'}
        </div>
        <button onClick={onSync} disabled={libraryProgress.state==='syncing'} className="w-full py-3 rounded-xl bg-card2 border border-border disabled:opacity-50 button-lift"><FiRefreshCw className="inline mr-2"/>Retry synchronization</button>
        <div className="text-[11px] text-muted">GIFs are stored in IndexedDB and are not requested during workouts. Source: Exercise Gym GIFs DB; GIF rights belong to their respective authors.</div>
      </div>
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <div className="text-sm font-semibold">Data</div>
        <button onClick={exp} className="w-full py-3 rounded-xl bg-card2 border border-border button-lift"><FiArchive className="inline mr-2"/>Export Data (JSON)</button>
        <label className="block w-full py-3 rounded-xl bg-card2 border border-border text-center cursor-pointer">Import Data<input type="file" accept=".json" className="hidden" onChange={imp} /></label>
        <button onClick={()=>{ if(confirm('Delete all data? This will permanently remove all routines, workout history and bodyweight data.')) onClear()}} className="w-full py-3 rounded-xl bg-red-500 text-white font-semibold button-lift"><FiTrash2 className="inline mr-2"/>Delete All Data</button>
      </div>
      <div className="text-xs text-muted text-center">Offline PWA · Data stored locally in IndexedDB<br/>Install via Share → Add to Home Screen</div>
    </div>
  )
}

function fmtDate(iso:string){
  const d=new Date(iso.length===10? iso+'T00:00:00' : iso)
  if(isNaN(d.getTime())) return iso
  return d.toLocaleDateString()
}
