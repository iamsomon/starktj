const field = document.querySelector('.orbit-field');
const toggle = document.querySelector('.motion-toggle');
const context = field.getContext('2d');

if (context) {
  const backdrop = document.createElement('canvas');
  const background = backdrop.getContext('2d');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const fullTurn = 2 * Math.PI;
  const counterclockwise = -1;
  const tracks = [
    { radius: 0.35, period: 13, start: 0.8, color: '134, 229, 207' },
    { radius: 0.61, period: 22, start: 2.4, color: '153, 199, 238' },
    { radius: 0.85, period: 30, start: 5.1, color: '197, 232, 218' },
    { radius: 1.13, period: 43, start: 3.65, color: '112, 210, 205' },
  ];
  let width = 0;
  let height = 0;
  let originX = 0;
  let originY = 0;
  let scale = 0;
  let elapsed = 0;
  let previous = 0;
  let frame = 0;
  let paused = false;
  let visible = true;

  function point(x, y) {
    const cosine = 0.96;
    const sine = 0.28;
    const well = Math.exp(-4.5 * (x * x + y * y)) * 0.28;
    return [
      originX + (cosine * x + sine * y) * scale,
      originY + (-sine * x + cosine * y) * scale * 0.56 + well * scale,
    ];
  }

  function orbit(radius, angle) {
    return point(radius * Math.cos(angle), radius * Math.sin(angle));
  }

  function path(target, samples, position) {
    target.beginPath();
    for (let index = 0; index <= samples; index += 1) {
      const [x, y] = position(index / samples);
      if (index === 0) target.moveTo(x, y);
      else target.lineTo(x, y);
    }
    target.stroke();
  }

  function dot(target, x, y, radius, color) {
    target.fillStyle = color;
    target.beginPath();
    target.arc(x, y, radius, 0, fullTurn);
    target.fill();
  }

  function drawBackdrop() {
    background.clearRect(0, 0, width, height);
    for (let i = 0; i < 90; i += 1) {
      const x = ((i * 137.508) % 360) / 360 * width;
      const y = ((i * 97.039) % 360) / 360 * height;
      dot(background, x, y, i % 9 === 0 ? 1.2 : 0.55, i % 9 === 0 ? '#b4e5d999' : '#c8efed45');
    }

    background.lineWidth = 0.8;
    for (let line = -8; line <= 8; line += 1) {
      const offset = line / 5.6;
      background.strokeStyle = line % 4 === 0 ? '#9bd0c63e' : '#88b9b12b';
      path(background, 55, (t) => point(offset, -1.5 + 3 * t));
      path(background, 55, (t) => point(-1.5 + 3 * t, offset));
    }

    for (const track of tracks) {
      background.strokeStyle = `rgba(${track.color}, .32)`;
      background.lineWidth = 1.1;
      path(background, 100, (t) => orbit(track.radius, t * fullTurn));
    }

    const [x, y] = point(0, 0);
    const halo = background.createRadialGradient(x, y, 0, x, y, 29);
    halo.addColorStop(0, '#b5ffeb99');
    halo.addColorStop(1, '#a5fce800');
    dot(background, x, y, 29, halo);
    background.strokeStyle = '#b2efdf95';
    background.lineWidth = 1;
    background.strokeRect(x - 7, y - 7, 14, 14);
    dot(background, x, y, 2.4, '#e0fff6');
  }

  function render() {
    context.clearRect(0, 0, width, height);
    context.drawImage(backdrop, 0, 0, width, height);
    for (const track of tracks) {
      const angle = track.start + counterclockwise * elapsed / track.period * fullTurn;
      for (let i = 1; i <= 8; i += 1) {
        context.strokeStyle = `rgba(${track.color}, ${0.75 * (i / 8) ** 2})`;
        context.lineWidth = 1.8;
        path(context, 5, (t) => orbit(track.radius, angle - counterclockwise * (9 - i - t) * 0.068));
      }
      const [x, y] = orbit(track.radius, angle);
      const halo = context.createRadialGradient(x, y, 0, x, y, 14);
      halo.addColorStop(0, `rgba(${track.color}, .6)`);
      halo.addColorStop(1, `rgba(${track.color}, 0)`);
      dot(context, x, y, 14, halo);
      dot(context, x, y, 3.2, `rgb(${track.color})`);
    }
  }

  function animate(now) {
    if (!previous || now - previous >= 30) {
      if (previous) elapsed += Math.min(now - previous, 80) / 1000;
      previous = now;
      render();
    }
    frame = requestAnimationFrame(animate);
  }

  function syncPlayback() {
    cancelAnimationFrame(frame);
    previous = 0;
    toggle.hidden = reduceMotion.matches;
    document.documentElement.classList.toggle('motion-paused', paused);
    toggle.classList.toggle('is-paused', paused);
    toggle.setAttribute('aria-label', paused ? 'Play background motion' : 'Pause background motion');
    if (visible && !document.hidden && !reduceMotion.matches && !paused) {
      frame = requestAnimationFrame(animate);
    }
  }

  function resize() {
    const bounds = field.getBoundingClientRect();
    width = Math.max(1, Math.round(bounds.width));
    height = Math.max(1, Math.round(bounds.height));
    const ratio = Math.min(window.devicePixelRatio || 1, 1.75);
    field.width = backdrop.width = Math.round(width * ratio);
    field.height = backdrop.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    background.setTransform(ratio, 0, 0, ratio, 0, 0);
    const narrow = width <= 700;
    originX = width * (narrow ? 0.56 : 0.77);
    originY = height * (narrow ? 0.74 : 0.51);
    scale = narrow ? width * 0.44 : Math.min(width * 0.26, height * 0.65);
    drawBackdrop();
    render();
  }

  toggle.addEventListener('click', () => {
    paused = !paused;
    syncPlayback();
  });
  reduceMotion.addEventListener('change', syncPlayback);
  document.addEventListener('visibilitychange', syncPlayback);
  new ResizeObserver(resize).observe(field);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    syncPlayback();
  }).observe(field);
  resize();
  syncPlayback();
}
