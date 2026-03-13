const fs = require('fs');
const cheerio = require('cheerio');

const files = ['cricket.html', 'kabaddi.html', 'athletics.html'];

files.forEach(file => {
  const sport = file.replace('.html', '');
  const html = fs.readFileSync(file, 'utf8');
  const $ = cheerio.load(html);

  $('.drill-card').each((i, el) => {
    const card = $(el);
    const title = card.find('h3').first().text().replace(/'/g, "\\\\'");
    const sportName = sport;
    const category = card.attr('data-category');

    // Make sure we only add it once
    if (card.find('.schedule-btn').length === 0) {
      const scheduleBtnHTML = `
      <button class="schedule-btn" style="background: rgba(0,212,255,0.1); border: 1px solid rgba(0,212,255,0.3); color: #00d4ff; padding: 0.4rem 0.8rem; border-radius: 6px; cursor: pointer; font-size: 0.85rem; margin-top: 0.5rem; transition: all 0.2s;" onclick="scheduleDrill(this, '${sportName}', '${title}')">
        🕒 Schedule Drill
      </button>`;
      
      card.find('.drill-yt-link').after(scheduleBtnHTML);
    }
  });

  fs.writeFileSync(file, $.html());
  console.log(`Added schedule buttons to ${file}`);
});
