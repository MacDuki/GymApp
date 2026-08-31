import type { Routine } from '../types'
import { uid } from '../utils/id'

export function seedRoutines(): Routine[] {
  const make = (name:string, blocks:{name:string,exs:{name:string,sets:number,reps:string,rest:number}[]}[]) : Routine => {
    const rid=uid()
    return { id:rid, name, createdAt: Date.now(), blocks: blocks.map((b,bi)=>{ const bid=uid(); return { id:bid, routineId:rid, name:b.name, order:bi, exercises: b.exs.map((e,ei)=>({ id:uid(), blockId:bid, name:e.name, order:ei, sets:e.sets, targetReps:e.reps, restSeconds:e.rest })) }})}
  }

  const mobility = [
    {name:"90/90 Hip Switches",sets:1,reps:"10/lado",rest:30},
    {name:"Rotaciones Torácicas",sets:1,reps:"10/lado",rest:30},
    {name:"Shoulder Dislocations",sets:1,reps:"12",rest:30},
    {name:"Ankle Rocks",sets:1,reps:"15/lado",rest:30},
    {name:"Deep Squat Hold",sets:1,reps:"30 s",rest:30},
  ]

  return [
    make("LUNES — PUSH",[
      {name:"Movilidad",exs:mobility},
      {name:"Core",exs:[
        {name:"Plancha",sets:3,reps:"90 s",rest:60},
        {name:"Cable Crunch Unilateral",sets:3,reps:"12/lado",rest:60},
      ]},
      {name:"Gemelos",exs:[
        {name:"Gemelo Extendido en Smith",sets:4,reps:"8-12",rest:60},
        {name:"Tibialis Raise (Rusa)",sets:2,reps:"15-25",rest:60},
      ]},
      {name:"Rutina principal",exs:[
        {name:"Press Banca Plano",sets:3,reps:"6-10",rest:90},
        {name:"Press Inclinado con Mancuernas",sets:3,reps:"8-12",rest:90},
        {name:"Máquina Press de Pecho",sets:3,reps:"8-12",rest:90},
        {name:"Press Militar",sets:3,reps:"6-10",rest:90},
        {name:"Elevaciones Laterales en Polea",sets:3,reps:"12-20",rest:60},
        {name:"Hombro Posterior Inclinado en Banco",sets:3,reps:"12",rest:60},
        {name:"Rompe Cráneos",sets:3,reps:"10-15",rest:60},
        {name:"Tríceps en Polea (Barra Recta Corta)",sets:3,reps:"12-15",rest:60},
      ]},
    ]),
    make("MARTES — PULL",[
      {name:"Movilidad",exs:mobility},
      {name:"Antebrazos",exs:[
        {name:"Curl Martillo",sets:3,reps:"8-12",rest:60},
        {name:"Reverse Curl con Barra W",sets:3,reps:"10-15",rest:60},
        {name:"Reverse Wrist Curl",sets:2,reps:"15-20",rest:45},
      ]},
      {name:"Rutina principal",exs:[
        {name:"Dominadas / Jalón",sets:4,reps:"6-12",rest:90},
        {name:"Remo Pecho Apoyado en Máquina",sets:3,reps:"8-12",rest:90},
        {name:"Jalón Unilateral hacia la Cadera",sets:3,reps:"10-15",rest:60},
        {name:"Pullover con Mancuerna",sets:2,reps:"12-15",rest:60},
        {name:"Reverse Fly en Máquina",sets:3,reps:"12-20",rest:60},
        {name:"Curl Inclinado",sets:3,reps:"8-12",rest:60},
        {name:"Curl Predicador en Máquina",sets:2,reps:"10-15",rest:60},
      ]},
    ]),
    make("MIÉRCOLES — LEGS A",[
      {name:"Movilidad",exs:mobility},
      {name:"Core",exs:[
        {name:"Side Plank",sets:3,reps:"30-45 s/lado",rest:45},
        {name:"Dead Bug",sets:3,reps:"10/lado",rest:45},
      ]},
      {name:"Gemelos",exs:[
        {name:"Gemelo Extendido en Smith",sets:4,reps:"8-12",rest:60},
        {name:"Tibialis Raise (Rusa)",sets:2,reps:"15-25",rest:60},
      ]},
      {name:"Rutina principal",exs:[
        {name:"Hack Squat",sets:4,reps:"6-10",rest:120},
        {name:"Leg Extension",sets:3,reps:"10-15",rest:90},
        {name:"Bulgarian Split Squat",sets:3,reps:"8-12/lado",rest:90},
        {name:"Leg Press",sets:3,reps:"10-15",rest:90},
        {name:"Seated Leg Curl",sets:3,reps:"10-15",rest:90},
      ]},
    ]),
    make("JUEVES — UPPER",[
      {name:"Movilidad",exs:mobility},
      {name:"Antebrazos",exs:[
        {name:"Curl Martillo",sets:3,reps:"10-12",rest:60},
        {name:"Wrist Curl",sets:2,reps:"15-20",rest:45},
        {name:"Reverse Wrist Curl",sets:2,reps:"15-20",rest:45},
      ]},
      {name:"Rutina principal",exs:[
        {name:"Press Inclinado",sets:3,reps:"8-12",rest:90},
        {name:"Dominadas / Jalón",sets:3,reps:"8-12",rest:90},
        {name:"Remo Unilateral",sets:3,reps:"8-12",rest:90},
        {name:"Elevaciones Laterales",sets:4,reps:"12-20",rest:60},
        {name:"Reverse Fly",sets:3,reps:"12-20",rest:60},
        {name:"Extensión de Tríceps",sets:3,reps:"10-15",rest:60},
        {name:"Curl Bíceps",sets:3,reps:"10-15",rest:60},
      ]},
    ]),
    make("VIERNES — LEGS B",[
      {name:"Movilidad",exs:mobility},
      {name:"Core",exs:[
        {name:"Pallof Press",sets:3,reps:"12/lado",rest:45},
        {name:"Reverse Crunch",sets:3,reps:"12-15",rest:45},
      ]},
      {name:"Gemelos",exs:[
        {name:"Seated Calf Raise",sets:4,reps:"10-20",rest:60},
        {name:"Tibialis Raise (Rusa)",sets:2,reps:"15-25",rest:60},
      ]},
      {name:"Rutina principal",exs:[
        {name:"Hiperextensiones de Espalda",sets:4,reps:"6-10",rest:90},
        {name:"Seated Leg Curl",sets:4,reps:"8-15",rest:90},
        {name:"Hip Thrust",sets:3,reps:"8-12",rest:90},
        {name:"Leg Press Pies Altos",sets:3,reps:"10-15",rest:90},
        {name:"Leg Extension",sets:2,reps:"12-15",rest:60},
      ]},
    ]),
    make("SÁBADO — FULL BODY",[
      {name:"Movilidad",exs:mobility},
      {name:"Core",exs:[
        {name:"Side Plank",sets:3,reps:"30-45 s/lado",rest:45},
        {name:"Cable Crunch",sets:3,reps:"12-15",rest:45},
      ]},
      {name:"Antebrazos",exs:[
        {name:"Reverse Curl",sets:3,reps:"10-15",rest:60},
        {name:"Wrist Curl",sets:2,reps:"15-20",rest:45},
      ]},
      {name:"Rutina principal",exs:[
        {name:"Hack Squat",sets:3,reps:"6-10",rest:120},
        {name:"Dominadas",sets:3,reps:"8-12",rest:90},
        {name:"Press Inclinado",sets:3,reps:"8-12",rest:90},
        {name:"Bulgarian Split Squat",sets:3,reps:"10/lado",rest:90},
        {name:"Seated Leg Curl",sets:3,reps:"10-15",rest:90},
        {name:"Elevaciones Laterales (Polea)",sets:3,reps:"15-20",rest:60},
        {name:"Seated Calf Raise",sets:3,reps:"12-20",rest:60},
        {name:"Tibialis Raise (Rusa)",sets:2,reps:"20-25",rest:60},
      ]},
    ]),
  ]
}

