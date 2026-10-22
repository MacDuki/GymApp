import assert from 'node:assert/strict'
import { build } from 'esbuild'

const result = await build({
  entryPoints: ['src/exerciseLibrary.ts'],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  write: false,
})
const moduleUrl = `data:text/javascript,${encodeURIComponent(result.outputFiles[0].text)}`
const { matchExercise, normalizeExerciseName } = await import(moduleUrl)
const item = (id, name, slug = id.split('/')[1]) => ({
  id, name, slug, muscle: 'pectorals', bodyPart: 'chest', equipment: 'barbell',
  category: 'strength', secondaryMuscles: [], instructions: [], file: `${id}.gif`, gifUrl: '',
})

assert.equal(normalizeExerciseName('  Press BÁNCA (Plano) '), 'press banca plano')
assert.equal(matchExercise('Press Banca Plano', [item('pectorals/barbell-bench-press', 'Press de banca con barra')]).id, 'pectorals/barbell-bench-press')
assert.equal(matchExercise('Press Banca Plano', [
  item('pectorals/barbell-bench-press', 'Press de banca con barra'),
  item('pectorals/dumbbell-bench-press', 'Press de banca con mancuernas'),
]).id, 'pectorals/barbell-bench-press')
assert.equal(matchExercise('Ejercicio sin coincidencia', [item('abs/unknown', 'Ejercicio parecido')]), null)
console.log('exercise library matching tests passed')
