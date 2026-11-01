import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'
import { models } from '../data/catalog.ts'
import { localDemoCatalog } from '../data/catalogData.ts'
import { imageManifest, interiorImageManifest } from '../data/imageManifest.ts'
import { marketReferences } from '../data/marketReferences.ts'
import { calculateEstimate, emptyConfiguration } from './pricing.ts'

const complete = {
  modelId: 'axis', finishId: 'natural-oak', sizeId: '960×2050',
  accessoryIds: ['closer'], delivery: true, installation: false,
}

test('empty configuration has no total', () => {
  const result = calculateEstimate(emptyConfiguration)
  assert.equal(result.valid, false)
  assert.equal(result.total, null)
})

test('each selected option contributes to the total', () => {
  const result = calculateEstimate(complete)
  assert.equal(result.valid, true)
  assert.equal(result.total, 42900 + 4200 + 3200 + 4800 + 3900)
  assert.equal(result.lines.length, 6)
})

test('duplicate accessories are charged once', () => {
  const result = calculateEstimate({ ...complete, accessoryIds: ['closer', 'closer'] })
  assert.equal(result.total, calculateEstimate(complete).total)
})

test('incompatible model and size cannot be estimated', () => {
  const result = calculateEstimate({ ...complete, sizeId: '1000×2100' })
  assert.equal(result.valid, false)
  assert.equal(result.total, null)
})

test('unknown option and unanswered service block calculation', () => {
  assert.equal(calculateEstimate({ ...complete, accessoryIds: ['unknown'] }).valid, false)
  assert.equal(calculateEstimate({ ...complete, delivery: null }).valid, false)
})

test('changed catalog tariffs immediately change the estimate', () => {
  const updated = {
    ...localDemoCatalog,
    models: localDemoCatalog.models.map(model => model.id === 'axis' ? { ...model, demoBasePrice: 45000 } : model),
    accessories: localDemoCatalog.accessories.map(item => item.id === 'closer' ? { ...item, price: 6000 } : item),
    delivery: 5000,
  }
  assert.equal(calculateEstimate(complete, updated).total, 45000 + 4200 + 3200 + 6000 + 5000)
})

test('finish from another model is incompatible', () => {
  assert.equal(calculateEstimate({ ...complete, modelId: 'forma', finishId: 'graphite' }).valid, false)
})

test('five models have four distinct available images and separate market references', () => {
  assert.equal(models.length, 5)
  for (const model of models) {
    assert.equal(model.finishes.length, 4)
    assert.equal(new Set(model.finishes.map(finish => finish.image)).size, 4)
    assert.ok(marketReferences[model.id]?.sourceUrl.startsWith('https://torex.ru/'))
    for (const finish of model.finishes) {
      assert.ok(existsSync(`public${finish.image}`), finish.image)
    }
  }
})

test('all 25 catalog images match model and finish mappings, with old images retained', () => {
  const images = new Set<string>()
  for (const model of models) {
    const exterior = imageManifest[model.assetModelId] as Record<string, string>
    assert.equal(model.finishes.length, 4)
    for (const finish of model.finishes) {
      assert.equal(finish.image, exterior[finish.id])
      images.add(finish.image)
      assert.ok(existsSync(`public/images/doors/${model.assetModelId}__${finish.id}.webp`))
    }
    images.add(interiorImageManifest[model.assetModelId])
  }
  assert.equal(images.size, 25)
  for (const image of images) {
    const header = readFileSync(`public${image}`).subarray(0, 12)
    assert.equal(header.toString('ascii', 0, 4), 'RIFF', image)
    assert.equal(header.toString('ascii', 8, 12), 'WEBP', image)
  }
})
