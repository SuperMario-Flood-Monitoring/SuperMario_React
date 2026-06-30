const SELECTED_SWMM_SCENARIO_ID_STORAGE_KEY = 'swmm-selected-scenario-id-v1'

function canUseLocalStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage)
}

export function loadSelectedSwmmScenarioId() {
  if (!canUseLocalStorage()) {
    return null
  }

  const rawValue = window.localStorage.getItem(SELECTED_SWMM_SCENARIO_ID_STORAGE_KEY)
  const scenarioId = Number(rawValue)

  return Number.isSafeInteger(scenarioId) && scenarioId > 0 ? scenarioId : null
}

export function saveSelectedSwmmScenarioId(scenarioId: number) {
  if (!canUseLocalStorage() || !Number.isSafeInteger(scenarioId) || scenarioId <= 0) {
    return
  }

  window.localStorage.setItem(SELECTED_SWMM_SCENARIO_ID_STORAGE_KEY, String(scenarioId))
}

export function clearSelectedSwmmScenarioId() {
  if (!canUseLocalStorage()) {
    return
  }

  window.localStorage.removeItem(SELECTED_SWMM_SCENARIO_ID_STORAGE_KEY)
}
