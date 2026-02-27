(function () {
  const STORAGE_KEY = 'recorridas_2026_participantes';

  const monthSelect = document.getElementById('month-select');
  const calendarTitle = document.getElementById('calendar-title');
  const weekdaysContainer = document.getElementById('weekdays');
  const calendarGrid = document.getElementById('calendar-grid');

  const {
    MONTHS,
    WEEKDAYS,
    EDITABLE_DAYS,
    YEAR,
    formatKey
  } = window.CalendarConfig;

  function loadData() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  function saveData(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function buildMonthOptions() {
    MONTHS.forEach((monthName, index) => {
      const option = document.createElement('option');
      option.value = String(index);
      option.textContent = `${monthName} ${YEAR}`;
      monthSelect.appendChild(option);
    });

    monthSelect.value = '2';
  }

  function renderWeekdays() {
    weekdaysContainer.innerHTML = '';
    WEEKDAYS.forEach((dayName) => {
      const cell = document.createElement('div');
      cell.className = 'weekday';
      cell.textContent = dayName;
      weekdaysContainer.appendChild(cell);
    });
  }

  function createEmptyCell() {
    const cell = document.createElement('div');
    cell.className = 'day-cell empty';
    return cell;
  }

  function createDayCell(monthIndex, dayNumber, savedData) {
    const date = new Date(YEAR, monthIndex, dayNumber);
    const dayOfWeek = date.getDay();
    const isEditable = EDITABLE_DAYS.has(dayOfWeek);
    const key = formatKey(monthIndex, dayNumber);

    const cell = document.createElement('div');
    cell.className = `day-cell${isEditable ? ' editable' : ''}`;

    const dayNumberEl = document.createElement('div');
    dayNumberEl.className = 'day-number';
    dayNumberEl.textContent = String(dayNumber);

    const dayNameEl = document.createElement('div');
    dayNameEl.className = 'day-name';
    dayNameEl.textContent = WEEKDAYS[dayOfWeek];

    cell.appendChild(dayNumberEl);
    cell.appendChild(dayNameEl);

    if (isEditable) {
      const textarea = document.createElement('textarea');
      textarea.className = 'names-input';
      textarea.placeholder = 'Nombres (separados por coma)';
      textarea.value = savedData[key] || '';

      const saveButton = document.createElement('button');
      saveButton.className = 'save-btn';
      saveButton.type = 'button';
      saveButton.textContent = 'Guardar';

      saveButton.addEventListener('click', () => {
        const updated = loadData();
        updated[key] = textarea.value.trim();
        saveData(updated);
        saveButton.textContent = 'Guardado ✓';
        setTimeout(() => {
          saveButton.textContent = 'Guardar';
        }, 1200);
      });

      cell.appendChild(textarea);
      cell.appendChild(saveButton);
    } else {
      const readonlyText = document.createElement('div');
      readonlyText.className = 'readonly-text';
      readonlyText.textContent = 'Sin carga';
      cell.appendChild(readonlyText);
    }

    return cell;
  }

  function renderMonth(monthIndex) {
    const savedData = loadData();
    calendarTitle.textContent = `${MONTHS[monthIndex]} ${YEAR}`;
    calendarGrid.innerHTML = '';

    const firstDay = new Date(YEAR, monthIndex, 1).getDay();
    const daysInMonth = new Date(YEAR, monthIndex + 1, 0).getDate();

    for (let i = 0; i < firstDay; i += 1) {
      calendarGrid.appendChild(createEmptyCell());
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      calendarGrid.appendChild(createDayCell(monthIndex, day, savedData));
    }
  }

  function init() {
    buildMonthOptions();
    renderWeekdays();
    renderMonth(Number(monthSelect.value));

    monthSelect.addEventListener('change', (event) => {
      renderMonth(Number(event.target.value));
    });
  }

  init();
})();
