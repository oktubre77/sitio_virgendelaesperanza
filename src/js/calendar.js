(function () {
  const MONTHS = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const EDITABLE_DAYS = new Set([0, 3, 5]);
  const YEAR = 2026;

  function formatKey(month, day) {
    return `${YEAR}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  window.CalendarConfig = {
    MONTHS,
    WEEKDAYS,
    EDITABLE_DAYS,
    YEAR,
    formatKey
  };
})();
