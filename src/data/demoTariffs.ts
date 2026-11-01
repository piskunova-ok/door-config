// Условные тарифы для демонстрации. Отдельный файл позволяет заменить их данными админ-панели.
// Подтверждённые цены производителя здесь не представлены: прайс-лист не был предоставлен.
export const demoTariffs = {
  accessories: [
    { id: 'closer', name: 'Доводчик', price: 4800 },
    { id: 'smartLock', name: 'Умный замок', price: 18900 },
    { id: 'threshold', name: 'Усиленный порог', price: 3500 },
  ],
  delivery: 3900,
  installation: 8500,
} as const
