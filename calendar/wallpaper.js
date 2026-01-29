(() => {
  const BASE_PALETTES = {
    dark: {
      gradientStops: ['#0d1b2a', '#192841', '#0f172a'],
      textPrimary: '#f4f7ff',
      textSecondary: '#9fb0d8',
      accent: '#ff7847',
      accentOn: '#050608',
      grid: 'rgba(244, 247, 255, 0.12)'
    },
    light: {
      gradientStops: ['#ffffff', '#dbe6ff', '#c9d8ff'],
      textPrimary: '#0b1633',
      textSecondary: '#5c678a',
      accent: '#1c45ff',
      accentOn: '#f6f8ff',
      grid: 'rgba(11, 22, 51, 0.12)'
    }
  };

  const MONTH_MODE_COUNTS = {
    '1': 1,
    '6': 6,
    '12': 12
  };

  const PLATFORM_LAYOUTS = {
    iOS: {
      safeTop: 0.22,
      safeBottom: 0.08,
      columns: { '1': 1, '6': 2, '12': 3 }
    },
    Android: {
      safeTop: 0.2,
      safeBottom: 0.09,
      columns: { '1': 1, '6': 2, '12': 3 }
    },
    Desktop: {
      safeTop: 0.12,
      safeBottom: 0.12,
      columns: { '1': 1, '6': 3, '12': 4 }
    }
  };

  const HEX_PATTERN = /^#([0-9a-fA-F]{6})$/;

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  const sanitizeHex = (value) => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return HEX_PATTERN.test(trimmed) ? trimmed : null;
  };

  const hexToRgb = (hex) => {
    const clean = hex.replace('#', '');
    const bigint = parseInt(clean, 16);
    return {
      r: (bigint >> 16) & 255,
      g: (bigint >> 8) & 255,
      b: bigint & 255
    };
  };

  const rgbToHex = (r, g, b) => {
    const toHex = (value) => value.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };

  const mixHex = (hexA, hexB, ratio = 0.5) => {
    const a = hexToRgb(hexA);
    const b = hexToRgb(hexB);
    const mix = (v1, v2) => Math.round(v1 + (v2 - v1) * clamp(ratio, 0, 1));
    return rgbToHex(mix(a.r, b.r), mix(a.g, b.g), mix(a.b, b.b));
  };

  const contrastColor = (hex) => {
    const { r, g, b } = hexToRgb(hex);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6 ? '#050608' : '#f8fbff';
  };

  const buildCalendar = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const offset = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < offset; i += 1) cells.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);
    while (cells.length % 7 !== 0) cells.push(null);
    const rows = [];
    for (let i = 0; i < cells.length; i += 7) {
      rows.push(cells.slice(i, i + 7));
    }
    return rows;
  };

  const buildMonthSequence = (date, mode) => {
    if (mode === '12') {
      const yearStart = new Date(date.getFullYear(), 0, 1);
      return Array.from({ length: 12 }, (_, idx) => new Date(yearStart.getFullYear(), idx, 1));
    }
    const count = MONTH_MODE_COUNTS[mode] || 1;
    return Array.from({ length: count }, (_, idx) => new Date(date.getFullYear(), date.getMonth() + idx, 1));
  };

  const resolvePalette = (theme, overrides = {}) => {
    const base = BASE_PALETTES[theme] || BASE_PALETTES.dark;
    const accent = sanitizeHex(overrides.accent) || base.accent;
    const gradientStart = sanitizeHex(overrides.gradientStart);
    const gradientEnd = sanitizeHex(overrides.gradientEnd);
    const gradientStops = gradientStart && gradientEnd
      ? [gradientStart, mixHex(gradientStart, gradientEnd, 0.5), gradientEnd]
      : base.gradientStops;
    const textPrimary = sanitizeHex(overrides.textPrimary) || base.textPrimary;
    const textSecondary = sanitizeHex(overrides.textSecondary) || base.textSecondary;
    const accentOn = sanitizeHex(overrides.accentOn) || contrastColor(accent);
    const grid = sanitizeHex(overrides.grid) || base.grid;

    return {
      ...base,
      gradientStops,
      textPrimary,
      textSecondary,
      accent,
      accentOn,
      grid
    };
  };

  const drawRoundedRect = (ctx, x, y, width, height, radius) => {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  };

  const uppercaseLabel = (value, locale) => value.toLocaleUpperCase(locale || undefined);

  const getWeekdayLabels = (locale) => {
    const labels = [];
    const reference = new Date(Date.UTC(2023, 0, 1)); // Sunday
    for (let i = 0; i < 7; i += 1) {
      const date = new Date(reference.getTime() + i * 24 * 60 * 60 * 1000);
      const label = new Intl.DateTimeFormat(locale || undefined, { weekday: 'short' }).format(date);
      labels.push(uppercaseLabel(label, locale));
    }
    return labels;
  };

  const drawMonthBlock = (ctx, params) => {
    const {
      x,
      y,
      width,
      height,
      date,
      palette,
      locale,
      highlightDay,
      weekdayLabels
    } = params;

    const calendarRows = buildCalendar(date);
    const innerPadding = Math.min(width, height) * 0.08;
    const innerWidth = width - innerPadding * 2;
    const innerHeight = height - innerPadding * 2;
    const titleFont = Math.round(height * 0.08);
    const weekdayFont = Math.round(height * 0.045);
    const dayFont = Math.round(height * 0.06 / Math.max(calendarRows.length / 5, 1));
    const headerBlock = titleFont + weekdayFont + innerPadding * 0.8;
    const gridHeight = innerHeight - headerBlock;
    const rowHeight = gridHeight / calendarRows.length;
    const colWidth = innerWidth / 7;
    const monthLabel = uppercaseLabel(
      new Intl.DateTimeFormat(locale || undefined, { month: 'long' }).format(date),
      locale
    );

    // No block background to let the wallpaper gradient shine through.

    ctx.fillStyle = palette.textPrimary;
    ctx.font = `600 ${titleFont}px "Manrope", "Avenir Next", sans-serif`;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText(monthLabel, x + innerPadding, y + innerPadding);

    ctx.fillStyle = palette.textSecondary;
    ctx.font = `600 ${weekdayFont}px "Manrope", "Avenir Next", sans-serif`;
    ctx.textAlign = 'center';
    weekdayLabels.forEach((label, index) => {
      const labelX = x + innerPadding + colWidth * index + colWidth / 2;
      const labelY = y + innerPadding + titleFont + innerPadding * 0.4;
      ctx.fillText(label, labelX, labelY);
    });

    // Intentionally no grid lines for a cleaner, modern look.

    ctx.font = `600 ${dayFont}px "Manrope", "Avenir Next", sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    calendarRows.forEach((week, rowIdx) => {
      week.forEach((dayNumber, colIdx) => {
        if (!dayNumber) return;
        const centerX = x + innerPadding + colWidth * colIdx + colWidth / 2;
        const centerY = y + innerPadding + headerBlock + rowHeight * rowIdx + rowHeight / 2;
        const textYOffset = dayFont * 0.08;
        if (dayNumber === highlightDay) {
          const radius = Math.min(colWidth, rowHeight) * 0.4;
          const strokeOuter = Math.max(2, radius * 0.28);
          const strokeInner = Math.max(1, strokeOuter * 0.45);
          ctx.save();
          ctx.lineCap = 'round';
          ctx.shadowColor = mixHex(palette.accent, palette.textPrimary, 0.35);
          ctx.shadowBlur = strokeOuter * 1.2;
          ctx.strokeStyle = palette.accent;
          ctx.lineWidth = strokeOuter;
          ctx.beginPath();
          ctx.ellipse(centerX, centerY, radius, radius, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.strokeStyle = palette.textSecondary;
          ctx.lineWidth = strokeInner;
          ctx.beginPath();
          ctx.ellipse(centerX, centerY, radius - strokeOuter * 0.35, radius - strokeOuter * 0.35, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
          ctx.fillStyle = palette.textPrimary;
          ctx.font = `700 ${dayFont}px "Manrope", "Avenir Next", sans-serif`;
        } else {
          ctx.fillStyle = palette.textPrimary;
          ctx.font = `600 ${dayFont}px "Manrope", "Avenir Next", sans-serif`;
        }
        ctx.fillText(dayNumber, centerX, centerY + textYOffset);
      });
    });
  };

  const drawWallpaper = (canvas, config = {}) => {
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new Error('A canvas element is required to draw the wallpaper.');
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const theme = config.theme === 'light' ? 'light' : 'dark';
    const palette = resolvePalette(theme, config.colors);
    const date = config.date instanceof Date ? config.date : new Date();
    const lang = config.lang === 'ru' ? 'ru-RU' : 'en-US';
    const platform = config.platform === 'Desktop' ? 'Desktop' : config.platform === 'Android' ? 'Android' : 'iOS';
    const monthsMode = ['6', '12'].includes(config.monthsMode) ? config.monthsMode : '1';
    const monthsCount = MONTH_MODE_COUNTS[monthsMode] || 1;
    const layout = PLATFORM_LAYOUTS[platform] || PLATFORM_LAYOUTS.iOS;

    const { width, height } = canvas;
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    palette.gradientStops.forEach((stop, index) => {
      const ratio = palette.gradientStops.length === 1 ? 0 : index / (palette.gradientStops.length - 1);
      gradient.addColorStop(ratio, stop);
    });
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    const paddingX = Math.max(width * 0.04, 48);
    const safeTop = height * layout.safeTop;
    const safeBottom = height * layout.safeBottom;
    const contentWidth = width - paddingX * 2;
    const contentHeight = height - safeTop - safeBottom;
    const columns = layout.columns[monthsMode] || 1;
    const gap = clamp(contentWidth * 0.02, 16, 48);
    const rowsNeeded = Math.ceil(monthsCount / columns);
    const cellWidth = (contentWidth - gap * (columns - 1)) / columns;
    const cellHeight = (contentHeight - gap * (rowsNeeded - 1)) / rowsNeeded;
    const targetAspect = 0.78; // width / height ratio for a consistent month block shape
    let blockWidth = cellWidth;
    let blockHeight = blockWidth / targetAspect;
    if (blockHeight > cellHeight) {
      blockHeight = cellHeight;
      blockWidth = blockHeight * targetAspect;
    }
    const months = buildMonthSequence(date, monthsMode);
    const weekdayLabels = getWeekdayLabels(lang);
    const todayDay = date.getDate();

    months.forEach((monthDate, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const cellX = paddingX + col * (cellWidth + gap);
      const cellY = safeTop + row * (cellHeight + gap);
      const blockX = cellX + (cellWidth - blockWidth) / 2;
      const blockY = cellY + (cellHeight - blockHeight) / 2;
      const isCurrentMonth = monthDate.getMonth() === date.getMonth() && monthDate.getFullYear() === date.getFullYear();
      drawMonthBlock(ctx, {
        x: blockX,
        y: blockY,
        width: blockWidth,
        height: blockHeight,
        date: monthDate,
        palette,
        locale: lang,
        highlightDay: isCurrentMonth ? todayDay : null,
        weekdayLabels
      });
    });
  };

  window.StarkWallpaper = {
    drawWallpaper,
    resolvePalette
  };
})();
