// Builds a shareable "ticket stub" image for a film — used by the
// Share button in FilmModal to hand off to the Web Share API (which lets
// the person pick Instagram, or any other app, from their OS share sheet).

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

export async function buildShareCard(film) {
  const W = 1080
  const H = 1920
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')

  // Background
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#2a0a10')
  bg.addColorStop(1, '#141110')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // Gold film-perforation border top/bottom
  ctx.fillStyle = 'rgba(212, 175, 55, 0.55)'
  for (let x = 20; x < W - 20; x += 34) {
    ctx.fillRect(x, 28, 18, 8)
    ctx.fillRect(x, H - 36, 18, 8)
  }

  // Eyebrow + brand
  ctx.textAlign = 'center'
  ctx.fillStyle = '#d4af37'
  ctx.font = '600 28px "Segoe UI", sans-serif'
  ctx.fillText('NOW SHOWING · CINEFILM ARCHIVE', W / 2, 110)

  // Poster (best-effort — falls back gracefully if it can't be loaded/CORS-blocked)
  let posterOk = false
  if (film.poster) {
    try {
      const img = await loadImage(film.poster)
      const pw = 760
      const ph = pw * 1.5
      const px = (W - pw) / 2
      const py = 170
      ctx.save()
      roundRect(ctx, px, py, pw, ph, 18)
      ctx.clip()
      ctx.drawImage(img, px, py, pw, ph)
      ctx.restore()
      ctx.strokeStyle = 'rgba(212, 175, 55, 0.6)'
      ctx.lineWidth = 4
      roundRect(ctx, px, py, pw, ph, 18)
      ctx.stroke()
      posterOk = true
    } catch {
      // پوستر لود نشد (احتمالاً CORS)؛ بدون پوستر ادامه می‌دیم
    }
  }

  const afterPosterY = posterOk ? 170 + 760 * 1.5 + 70 : 260

  // Title
  ctx.fillStyle = '#f3ede0'
  ctx.font = '700 56px Georgia, "Playfair Display", serif'
  wrapText(ctx, film.title, W / 2, afterPosterY, W - 140, 62)

  // Year / genre / runtime
  ctx.fillStyle = '#8a8375'
  ctx.font = '500 32px "Segoe UI", sans-serif'
  const metaLine = [film.year, (film.genre || [])[0], film.runtime ? `${film.runtime} min` : null].filter(Boolean).join('   ·   ')
  ctx.fillText(metaLine, W / 2, afterPosterY + 74)

  // My rating (stars) if present
  let y = afterPosterY + 140
  if (film.myRating > 0) {
    const stars = '★★★★★'.slice(0, film.myRating) + '☆☆☆☆☆'.slice(0, 5 - film.myRating)
    ctx.fillStyle = '#d4af37'
    ctx.font = '600 48px "Segoe UI", sans-serif'
    ctx.fillText(stars, W / 2, y)
    y += 70
  }
  if (typeof film.rating === 'number') {
    ctx.fillStyle = '#8a8375'
    ctx.font = '500 28px "Segoe UI", sans-serif'
    ctx.fillText(`IMDb ${film.rating.toFixed(1)}/10`, W / 2, y)
  }

  ctx.fillStyle = '#5c574e'
  ctx.font = '500 24px "Segoe UI", sans-serif'
  ctx.fillText('ADMIT ONE · MY PERSONAL ARCHIVE', W / 2, H - 70)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('toBlob failed'))
    }, 'image/png')
  })
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = (text || '').split(' ')
  let line = ''
  const lines = []
  words.forEach((word) => {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = test
    }
  })
  if (line) lines.push(line)
  const startY = y - ((lines.length - 1) * lineHeight) / 2
  lines.slice(0, 3).forEach((l, i) => ctx.fillText(l, x, startY + i * lineHeight))
}

// Tries the Web Share API (mobile) with the image file so the person can
// pick Instagram (Stories/feed) or any other app from the OS share sheet.
// Falls back to downloading the image if sharing files isn't supported.
export async function shareFilmCard(film) {
  const blob = await buildShareCard(film)
  const file = new File([blob], `${film.title.replace(/[^a-z0-9]+/gi, '-')}.png`, { type: 'image/png' })

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({
      files: [file],
      title: film.title,
      text: `${film.title} — from my Cinefilm Archive`,
    })
    return 'shared'
  }

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  link.click()
  URL.revokeObjectURL(url)
  return 'downloaded'
}
