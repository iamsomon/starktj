<?php
// Stark Calendar server-side renderer (PNG)
// Requires PHP with GD extension. Uses a system TTF if available.

function clamp($value, $min, $max) {
  return min(max($value, $min), $max);
}

function parse_color($value, $fallback) {
  if (!is_string($value)) return $fallback;
  $value = trim($value);
  if (!preg_match('/^#([0-9a-fA-F]{6})$/', $value)) return $fallback;
  return strtolower($value);
}

function hex_to_rgb($hex) {
  $hex = ltrim($hex, '#');
  return [
    hexdec(substr($hex, 0, 2)),
    hexdec(substr($hex, 2, 2)),
    hexdec(substr($hex, 4, 2))
  ];
}

function mix_hex($hexA, $hexB, $ratio) {
  $a = hex_to_rgb($hexA);
  $b = hex_to_rgb($hexB);
  $mix = function($v1, $v2) use ($ratio) {
    return (int) round($v1 + ($v2 - $v1) * clamp($ratio, 0, 1));
  };
  $r = $mix($a[0], $b[0]);
  $g = $mix($a[1], $b[1]);
  $b2 = $mix($a[2], $b[2]);
  return sprintf('#%02x%02x%02x', $r, $g, $b2);
}

function resolve_font_path() {
  $candidates = [
    __DIR__ . '/Manrope-Regular.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/Library/Fonts/Arial.ttf',
    '/System/Library/Fonts/Supplemental/Arial.ttf'
  ];
  foreach ($candidates as $path) {
    if (file_exists($path)) {
      return $path;
    }
  }
  return null;
}

function weekday_labels($lang) {
  if ($lang === 'ru') {
    return ['ВС','ПН','ВТ','СР','ЧТ','ПТ','СБ'];
  }
  return ['SUN','MON','TUE','WED','THU','FRI','SAT'];
}

function month_name($monthIndex, $lang) {
  $months = [
    'en' => ['January','February','March','April','May','June','July','August','September','October','November','December'],
    'ru' => ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
  ];
  $list = $months[$lang] ?? $months['en'];
  return mb_strtoupper($list[$monthIndex], 'UTF-8');
}

function build_calendar($year, $month) {
  $first = mktime(0, 0, 0, $month + 1, 1, $year);
  $offset = (int) date('w', $first); // 0 Sunday
  $daysInMonth = (int) date('t', $first);
  $cells = [];
  for ($i = 0; $i < $offset; $i += 1) $cells[] = null;
  for ($d = 1; $d <= $daysInMonth; $d += 1) $cells[] = $d;
  while (count($cells) % 7 !== 0) $cells[] = null;
  $rows = [];
  for ($i = 0; $i < count($cells); $i += 7) {
    $rows[] = array_slice($cells, $i, 7);
  }
  return $rows;
}

function build_month_sequence($year, $month, $mode) {
  $count = $mode === '12' ? 12 : ($mode === '6' ? 6 : 1);
  $months = [];
  if ($mode === '12') {
    for ($i = 0; $i < 12; $i += 1) {
      $months[] = [$year, $i];
    }
  } else {
    for ($i = 0; $i < $count; $i += 1) {
      $m = $month + $i;
      $y = $year + (int) floor($m / 12);
      $mm = $m % 12;
      $months[] = [$y, $mm];
    }
  }
  return $months;
}

function allocate_color($im, $hex) {
  $rgb = hex_to_rgb($hex);
  return imagecolorallocate($im, $rgb[0], $rgb[1], $rgb[2]);
}

function draw_gradient($im, $width, $height, $stops) {
  $count = count($stops);
  for ($y = 0; $y < $height; $y += 1) {
    $t = $height <= 1 ? 0 : $y / ($height - 1);
    $pos = $t * ($count - 1);
    $idx = (int) floor($pos);
    $idx = min(max($idx, 0), $count - 2);
    $local = $pos - $idx;
    $colorHex = mix_hex($stops[$idx], $stops[$idx + 1], $local);
    $color = allocate_color($im, $colorHex);
    imageline($im, 0, $y, $width, $y, $color);
  }
}

function draw_text($im, $fontPath, $size, $x, $y, $color, $text, $align = 'left') {
  if ($fontPath) {
    $bbox = imagettfbbox($size, 0, $fontPath, $text);
    $textWidth = abs($bbox[2] - $bbox[0]);
    $textHeight = abs($bbox[7] - $bbox[1]);
    $drawX = $x;
    if ($align === 'center') $drawX = (int) round($x - $textWidth / 2);
    imagettftext($im, $size, 0, $drawX, (int) round($y + $textHeight), $color, $fontPath, $text);
  } else {
    $font = 5;
    $textWidth = imagefontwidth($font) * strlen($text);
    $textHeight = imagefontheight($font);
    $drawX = $x;
    if ($align === 'center') $drawX = (int) round($x - $textWidth / 2);
    imagestring($im, $font, $drawX, $y, $text, $color);
  }
}

$theme = $_GET['theme'] === 'light' ? 'light' : 'dark';
$lang = $_GET['lang'] === 'ru' ? 'ru' : 'en';
$monthsMode = in_array($_GET['months'] ?? '1', ['1','6','12'], true) ? $_GET['months'] : '1';
$platform = $_GET['platform'] ?? 'iOS';
$platform = $platform === 'Android' ? 'Android' : ($platform === 'Desktop' ? 'Desktop' : 'iOS');

$width = (int) ($_GET['width'] ?? 1170);
$height = (int) ($_GET['height'] ?? 2532);
$width = (int) clamp($width, 320, 8000);
$height = (int) clamp($height, 320, 8000);

$basePalettes = [
  'dark' => [
    'gradientStops' => ['#0d1b2a', '#192841', '#0f172a'],
    'textPrimary' => '#f4f7ff',
    'textSecondary' => '#9fb0d8',
    'accent' => '#ff7847'
  ],
  'light' => [
    'gradientStops' => ['#ffffff', '#dbe6ff', '#c9d8ff'],
    'textPrimary' => '#0b1633',
    'textSecondary' => '#5c678a',
    'accent' => '#1c45ff'
  ]
];

$palette = $basePalettes[$theme];
$accent = parse_color($_GET['accent'] ?? null, $palette['accent']);
$gradStart = parse_color($_GET['gradStart'] ?? null, $palette['gradientStops'][0]);
$gradEnd = parse_color($_GET['gradEnd'] ?? null, $palette['gradientStops'][2]);
$palette['gradientStops'] = [$gradStart, mix_hex($gradStart, $gradEnd, 0.5), $gradEnd];
$palette['textPrimary'] = parse_color($_GET['textPrimary'] ?? null, $palette['textPrimary']);
$palette['textSecondary'] = parse_color($_GET['textSecondary'] ?? null, $palette['textSecondary']);
$palette['accent'] = $accent;

$layouts = [
  'iOS' => ['safeTop' => 0.26, 'safeBottom' => 0.12, 'columns' => ['1' => 1, '6' => 2, '12' => 3]],
  'Android' => ['safeTop' => 0.22, 'safeBottom' => 0.11, 'columns' => ['1' => 1, '6' => 2, '12' => 3]],
  'Desktop' => ['safeTop' => 0.12, 'safeBottom' => 0.12, 'columns' => ['1' => 1, '6' => 3, '12' => 4]]
];

$layout = $layouts[$platform];

$im = imagecreatetruecolor($width, $height);
imagealphablending($im, true);
imagesavealpha($im, true);

header('Content-Type: image/png');
header('Cache-Control: public, max-age=3600');

$fontPath = resolve_font_path();

// Background gradient
$gradientStops = $palette['gradientStops'];
draw_gradient($im, $width, $height, $gradientStops);

$paddingX = max((int) round($width * 0.045), 52);
$extraInset = max((int) round($height * 0.02), 24);
$safeTop = (int) round($height * $layout['safeTop']) + $extraInset;
$safeBottom = (int) round($height * $layout['safeBottom']) + $extraInset;
$contentWidth = $width - $paddingX * 2;
$contentHeight = $height - $safeTop - $safeBottom;
$columns = $layout['columns'][$monthsMode] ?? 1;
$gap = clamp($contentWidth * 0.02, 16, 48);
$rowsNeeded = (int) ceil((int) ($monthsMode === '12' ? 12 : ($monthsMode === '6' ? 6 : 1)) / $columns);
$cellWidth = ($contentWidth - $gap * ($columns - 1)) / $columns;
$cellHeight = ($contentHeight - $gap * ($rowsNeeded - 1)) / $rowsNeeded;
$targetAspect = 0.78;
$blockWidth = $cellWidth;
$blockHeight = $blockWidth / $targetAspect;
if ($blockHeight > $cellHeight) {
  $blockHeight = $cellHeight;
  $blockWidth = $blockHeight * $targetAspect;
}

$today = getdate();
$todayDay = $today['mday'];

$months = build_month_sequence($today['year'], $today['mon'] - 1, $monthsMode);
$weekdayLabels = weekday_labels($lang);

$textPrimary = allocate_color($im, $palette['textPrimary']);
$textSecondary = allocate_color($im, $palette['textSecondary']);
$accentColor = allocate_color($im, $palette['accent']);

foreach ($months as $index => $tuple) {
  [$year, $month] = $tuple;
  $col = $index % $columns;
  $row = (int) floor($index / $columns);
  $cellX = $paddingX + $col * ($cellWidth + $gap);
  $cellY = $safeTop + $row * ($cellHeight + $gap);
  $blockX = $cellX + ($cellWidth - $blockWidth) / 2;
  $blockY = $cellY + ($cellHeight - $blockHeight) / 2;

  $innerPadding = min($blockWidth, $blockHeight) * 0.08;
  $innerWidth = $blockWidth - $innerPadding * 2;
  $innerHeight = $blockHeight - $innerPadding * 2;
  $titleFont = (int) round($blockHeight * 0.072);
  $weekdayFont = (int) round($blockHeight * 0.04);
  $dayFont = (int) round($blockHeight * 0.05);
  $headerBlock = $titleFont + $weekdayFont + $innerPadding * 0.8;
  $gridHeight = $innerHeight - $headerBlock;
  $calendarRows = build_calendar($year, $month);
  $rowHeight = $gridHeight / count($calendarRows);
  $colWidth = $innerWidth / 7;

  $monthLabel = month_name($month, $lang);
  draw_text($im, $fontPath, $titleFont, (int) ($blockX + $innerPadding), (int) ($blockY + $innerPadding), $textPrimary, $monthLabel, 'left');

  foreach ($weekdayLabels as $idx => $label) {
    $labelX = $blockX + $innerPadding + $colWidth * $idx + $colWidth / 2;
    $labelY = $blockY + $innerPadding + $titleFont + $innerPadding * 0.4;
    draw_text($im, $fontPath, $weekdayFont, (int) $labelX, (int) $labelY, $textSecondary, $label, 'center');
  }

  foreach ($calendarRows as $rowIdx => $week) {
    foreach ($week as $colIdx => $dayNumber) {
      if (!$dayNumber) continue;
      $centerX = $blockX + $innerPadding + $colWidth * $colIdx + $colWidth / 2;
      $centerY = $blockY + $innerPadding + $headerBlock + $rowHeight * $rowIdx + $rowHeight / 2;
      $textYOffset = $dayFont * 0.08;
      $isCurrentMonth = ($month === $today['mon'] - 1) && ($year === $today['year']);
      if ($isCurrentMonth && $dayNumber === $todayDay) {
        $radius = min($colWidth, $rowHeight) * 0.4;
        imagesetthickness($im, max(2, (int) round($radius * 0.28)));
        imageellipse($im, (int) $centerX, (int) $centerY, (int) ($radius * 2), (int) ($radius * 2), $accentColor);
        imagesetthickness($im, max(1, (int) round($radius * 0.12)));
        imageellipse($im, (int) $centerX, (int) $centerY, (int) ($radius * 1.6), (int) ($radius * 1.6), $textSecondary);
      }
      draw_text($im, $fontPath, $dayFont, (int) $centerX, (int) ($centerY - $dayFont / 2 + $textYOffset), $textPrimary, (string) $dayNumber, 'center');
    }
  }
}

imagepng($im);
imagedestroy($im);
?>
