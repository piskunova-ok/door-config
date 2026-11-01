import { useCallback, useEffect, useState } from 'react'
import App from './App.tsx'
import { localDemoCatalog } from './data/catalogData.ts'
import type { CatalogData } from './data/catalogData.ts'
import { loadPublicCatalog } from './lib/catalogApi.ts'
import { supabaseConfigured, supabaseConfigurationError, supabaseConfigurationIncomplete } from './lib/supabase.ts'

type CatalogState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; catalog: CatalogData; source: 'demo' | 'live' }

export default function PublicRoute() {
  const [state, setState] = useState<CatalogState>(() => {
    if (supabaseConfigurationIncomplete || supabaseConfigurationError) return { status: 'error', message: supabaseConfigurationError ?? 'Настройки Supabase заполнены не полностью.' }
    if (!supabaseConfigured) return { status: 'ready', catalog: localDemoCatalog, source: 'demo' }
    return { status: 'loading' }
  })
  const [refreshing, setRefreshing] = useState(false)

  const refresh = useCallback(async () => {
    if (!supabaseConfigured) return
    setRefreshing(true)
    try {
      const catalog = await loadPublicCatalog()
      setState({ status: 'ready', catalog, source: 'live' })
    } catch (error) {
      setState({ status: 'error', message: error instanceof Error ? error.message : 'Не удалось загрузить каталог.' })
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (!supabaseConfigured) return
    void refresh()
    const onFocus = () => { void refresh() }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refresh])

  if (state.status !== 'ready') {
    return <div className="catalog-state"><a className="brand" href="/"><span className="brand-mark">D<span>.</span></span><span>DOOR <b>CONFIG</b></span></a><h1>{state.status === 'loading' ? 'Загружаем каталог' : 'Каталог временно недоступен'}</h1><p>{state.status === 'error' ? state.message : 'Проверяем модели и актуальные тарифы.'}</p>{state.status === 'error' && supabaseConfigured && <button className="primary-button" onClick={() => void refresh()}>Повторить загрузку ↗</button>}<p className="catalog-state-note">Актуальные цены не заменяются локальными данными при ошибке подключения.</p></div>
  }
  return <>{refreshing && <div className="catalog-refreshing" role="status">Проверяем актуальность каталога…</div>}<App catalog={state.catalog} source={state.source} /></>
}
