import type { Exercise, ExerciseMedia, Routine } from './types'
import * as db from './db'

export const EXERCISE_DB_BASE = 'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0'
const CATALOG_URL = `${EXERCISE_DB_BASE}/api/es/exercises.json`

export type ExternalExercise = {
  id: string
  slug: string
  name: string
  muscle: string
  bodyPart: string
  equipment: string
  category: string
  secondaryMuscles: string[]
  file: string
  gifUrl: string
  thumbUrl?: string
}

export type ExerciseContent = {
  localExerciseId: string
  externalId?: string
  name: string
  status: 'pending' | 'downloaded' | 'unavailable' | 'error'
  resourceKey?: string
  media?: ExerciseMedia
  error?: string
  syncedAt: number
}

export type SyncProgress = { state: 'idle' | 'syncing' | 'ready' | 'error'; completed: number; total: number; message?: string }
export type WgerExercise = { id: number; uuid?: string; name?: string; images?: { image: string; is_main?: boolean }[]; translations?: { name?: string; language?: number }[] }
const WGER_URL = 'https://wger.de/api/v2/exerciseinfo/'

const aliases: Record<string, string[]> = {
  'press banca plano': ['barbell-bench-press'],
  'press inclinado con mancuernas': ['dumbbell-incline-bench-press', 'dumbbell-incline-press'],
  'maquina press de pecho': ['lever-chest-press'],
  'press militar': ['lever-military-press'],
  'elevaciones laterales en polea': ['cable-lateral-raise'],
  'hombro posterior inclinado en banco': ['dumbbell-rear-lateral-raise'],
  'rompe craneos': ['barbell-lying-triceps-extension-skull-crusher'],
  'triceps en polea barra recta corta': ['cable-pushdown'],
  'dominadas': ['pull-up'],
  'jalon': ['cable-lat-pulldown-full-range-of-motion'],
  'remo pecho apoyado en maquina': ['lever-seated-row'],
  'pullover con mancuerna': ['dumbbell-pullover'],
  'reverse fly en maquina': ['lever-seated-reverse-fly'],
  'curl inclinado': ['dumbbell-incline-curl'],
  'curl predicador en maquina': ['lever-preacher-curl'],
  'hack squat': ['sled-hack-squat'],
  'leg extension': ['lever-leg-extension'],
  'bulgarian split squat': [],
  'leg press': ['sled-45-leg-press'],
  'seated leg curl': ['lever-seated-leg-curl'],
  'press inclinado': ['barbell-incline-bench-press'],
  'remo unilateral': ['lever-unilateral-row'],
  'elevaciones laterales': ['dumbbell-lateral-raise'],
  'reverse fly': ['dumbbell-rear-lateral-raise'],
  'extension de triceps': ['cable-overhead-triceps-extension-rope-attachment'],
  'curl biceps': ['barbell-curl'],
  'hiperextensiones de espalda': ['hyperextension'],
  'hip thrust': [],
  'leg press pies altos': ['sled-45-leg-press'],
  'seated calf raise': ['lever-seated-calf-raise'],
  'tibialis raise rusa': [],
  'cable crunch': ['cable-kneeling-crunch'],
  'cable crunch unilateral': [],
  'plancha': [],
  'dead bug': ['dead-bug'],
  'pallof press': ['band-horizontal-pallof-press'],
  'reverse crunch': ['reverse-crunch'],
  'curl martillo': ['dumbbell-hammer-curl'],
  'reverse curl con barra w': [],
  'reverse curl': ['barbell-reverse-curl'],
  'reverse wrist curl': ['barbell-reverse-wrist-curl'],
  'wrist curl': ['barbell-wrist-curl'],
}

export function normalizeExerciseName(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[()/,.-]/g, ' ').replace(/\s+/g, ' ').trim()
}

export function matchExercise(localName: string, catalog: ExternalExercise[]): ExternalExercise | null {
  const normalized = normalizeExerciseName(localName)
  const requestedSlugs = aliases[normalized] || []
  const aliasMatches = catalog.filter(item => requestedSlugs.includes(item.slug))
  if (aliasMatches.length === 1) return aliasMatches[0]

  const exact = catalog.filter(item => normalizeExerciseName(item.name) === normalized || normalizeExerciseName(item.slug) === normalized)
  if (exact.length === 1) return exact[0]
  if (exact.length > 1) return null

  const tokens = normalized.split(' ').filter(token => token.length > 2)
  if (tokens.length < 2) return null
  const scored = catalog.map(item => {
    const haystack = `${normalizeExerciseName(item.name)} ${normalizeExerciseName(item.slug)}`
    return { item, score: tokens.filter(token => haystack.includes(token)).length / tokens.length }
  }).filter(candidate => candidate.score >= 0.75).sort((a, b) => b.score - a.score)
  return scored.length === 1 || (scored.length > 1 && scored[0].score > scored[1].score) ? scored[0].item : null
}

function searchByName<T extends { name?: string }>(localName: string, items: T[]): T[] {
  const query = normalizeExerciseName(localName)
  const tokens = query.split(' ').filter(token => token.length > 2)
  return items.filter(item => {
    const name = normalizeExerciseName(item.name || '')
    return name === query || (tokens.length > 1 && tokens.filter(token => name.includes(token)).length / tokens.length >= 0.75)
  })
}

export async function searchExerciseGymGifs(localName: string): Promise<ExternalExercise[]> {
  const catalog = await db.getExerciseCatalog()
  if (!catalog.length) {
    const response = await fetch(CATALOG_URL)
    if (!response.ok) throw new Error(`Catálogo HTTP ${response.status}`)
    const body = await response.json() as { exercises?: ExternalExercise[] }
    if (!Array.isArray(body.exercises)) throw new Error('El catálogo no contiene ejercicios')
    await db.saveExerciseCatalog(body.exercises)
    return searchByName(localName, body.exercises)
  }
  const alias = aliases[normalizeExerciseName(localName)] || []
  const aliasResults = catalog.filter(item => alias.includes(item.slug))
  return aliasResults.length ? aliasResults : searchByName(localName, catalog)
}

export async function searchWger(localName: string): Promise<WgerExercise[]> {
  const response = await fetch(`${WGER_URL}?language=2&status=2&limit=100&name=${encodeURIComponent(localName)}`)
  if (!response.ok) throw new Error(`wger HTTP ${response.status}`)
  const body = await response.json() as { results?: WgerExercise[] }
  if (!Array.isArray(body.results)) return []
  const candidates = body.results.map(item => ({
    item,
    names: (item.translations || []).map(translation => translation.name || '').filter(Boolean),
  }))
  const query = normalizeExerciseName(localName)
  const tokens = query.split(' ').filter(token => token.length > 2)
  return candidates.filter(candidate => candidate.names.some(name => {
    const normalized = normalizeExerciseName(name)
    return normalized === query || (tokens.length > 1 && tokens.filter(token => normalized.includes(token)).length / tokens.length >= 0.75)
  })).map(candidate => {
    const name = candidate.names[0]
    return { ...candidate.item, name }
  }).filter(item => item.images?.length)
}

export async function downloadMedia(media: { source: ExerciseMedia['source']; url: string; externalId?: string }, key: string) {
  const response = await fetch(media.url)
  if (!response.ok) throw new Error(`Recurso HTTP ${response.status}`)
  const blob = await response.blob()
  if (!blob.size || !blob.type.startsWith('image/')) throw new Error('La URL no contiene una imagen válida')
  await db.saveExerciseResource({ key, blob, externalId: media.externalId || media.url })
  return { ...media, resourceKey: key }
}

async function fallbackMatch(name: string): Promise<{ source: ExerciseMedia['source']; url: string; externalId?: string } | null> {
  const wger = await searchWger(name)
  if (wger.length !== 1 || !wger[0].images?.[0]?.image) return null
  return { source: 'wger', url: wger[0].images[0].image, externalId: `wger:${wger[0].id}` }
}

async function saveRoutineMedia(routines: Routine[], exerciseId: string, media: ExerciseMedia) {
  const routine = routines.find(item => item.blocks.some(block => block.exercises.some(exercise => exercise.id === exerciseId)))
  if (!routine) return
  const updated: Routine = {
    ...routine,
    blocks: routine.blocks.map(block => ({
      ...block,
      exercises: block.exercises.map(exercise => exercise.id === exerciseId ? { ...exercise, media } : exercise),
    })),
  }
  Object.assign(routine, updated)
  await db.saveRoutine(updated)
}

function routineExercises(routines: Routine[]): Exercise[] {
  return routines.flatMap(r => r.blocks.flatMap(b => b.exercises))
}

export async function syncExerciseLibrary(routines: Routine[], onProgress?: (progress: SyncProgress) => void): Promise<SyncProgress> {
  const exercises = routineExercises(routines)
  const total = exercises.length
  if (!total) return { state: 'ready', completed: 0, total: 0 }
  onProgress?.({ state: 'syncing', completed: 0, total })
  try {
    let catalog = await db.getExerciseCatalog()
    if (!catalog.length) {
      const response = await fetch(CATALOG_URL)
      if (!response.ok) throw new Error(`Catálogo HTTP ${response.status}`)
      const body = await response.json() as { exercises?: ExternalExercise[] }
      catalog = Array.isArray(body.exercises) ? body.exercises : []
      if (!catalog.length) throw new Error('El catálogo no contiene ejercicios')
      await db.saveExerciseCatalog(catalog)
    }

    let completed = 0
    for (const exercise of exercises) {
      const existing = await db.getExerciseContent(exercise.id)
      if (existing?.name === exercise.name && (existing.status === 'downloaded' || existing.status === 'unavailable')) {
        if (existing.status === 'downloaded' && existing.resourceKey && !exercise.media && existing.media) {
          await saveRoutineMedia(routines, exercise.id, existing.media)
        } else if (existing.status === 'downloaded' && existing.resourceKey && !exercise.media) {
          const previousMatch = catalog.find(item => item.id === existing.resourceKey)
          if (previousMatch) {
            const storedMedia: ExerciseMedia = { source: 'exercise-gym-gifs', url: `${EXERCISE_DB_BASE}/${previousMatch.file}`, externalId: previousMatch.id, label: previousMatch.name, resourceKey: existing.resourceKey }
            await db.saveExerciseContent({ ...existing, media: storedMedia })
            await saveRoutineMedia(routines, exercise.id, storedMedia)
          }
        }
        completed++
        onProgress?.({ state: 'syncing', completed, total })
        continue
      }
      await db.saveExerciseContent({ localExerciseId: exercise.id, name: exercise.name, status: 'pending', syncedAt: Date.now() })
      const match = matchExercise(exercise.name, catalog)
      if (!match) {
        const fallback = await fallbackMatch(exercise.name).catch(() => null)
        if (fallback) {
          try {
            const media = await downloadMedia(fallback, `exercise:${exercise.id}`)
            const storedMedia = { ...fallback, resourceKey: media.resourceKey }
            await db.saveExerciseContent({ localExerciseId: exercise.id, externalId: fallback.externalId, name: exercise.name, status: 'downloaded', resourceKey: media.resourceKey, media: storedMedia, syncedAt: Date.now() })
            await saveRoutineMedia(routines, exercise.id, storedMedia)
            completed++
            onProgress?.({ state: 'syncing', completed, total })
            continue
          } catch { /* preserve the unavailable state below */ }
        }
        await db.saveExerciseContent({ localExerciseId: exercise.id, name: exercise.name, status: 'unavailable', syncedAt: Date.now() })
        completed++
        onProgress?.({ state: 'syncing', completed, total })
        continue
      }
      try {
        const resourceKey = match.id
        let resource = await db.getExerciseResource(resourceKey)
        if (!resource) {
          const response = await fetch(`${EXERCISE_DB_BASE}/${match.file}`)
          if (!response.ok) throw new Error(`GIF HTTP ${response.status}`)
          const blob = await response.blob()
          if (!blob.size || !blob.type.includes('image')) throw new Error('Recurso visual inválido')
          resource = { key: resourceKey, blob, externalId: match.id }
          await db.saveExerciseResource(resource)
        }
        const storedMedia: ExerciseMedia = { source: 'exercise-gym-gifs', url: `${EXERCISE_DB_BASE}/${match.file}`, externalId: match.id, label: match.name, resourceKey }
        await db.saveExerciseContent({
          localExerciseId: exercise.id, externalId: match.id, name: exercise.name,
          status: 'downloaded', resourceKey, media: storedMedia, syncedAt: Date.now(),
        })
        if (!exercise.media) await saveRoutineMedia(routines, exercise.id, storedMedia)
      } catch (error) {
        await db.saveExerciseContent({
          localExerciseId: exercise.id, externalId: match.id, name: exercise.name, status: 'error',
          error: error instanceof Error ? error.message : 'Error de descarga', syncedAt: Date.now(),
        })
      }
      completed++
      onProgress?.({ state: 'syncing', completed, total })
    }
    const result = { state: 'ready' as const, completed, total }
    onProgress?.(result)
    return result
  } catch (error) {
    const result = { state: 'error' as const, completed: 0, total, message: error instanceof Error ? error.message : 'No se pudo sincronizar' }
    onProgress?.(result)
    return result
  }
}
