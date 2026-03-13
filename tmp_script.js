const fs = require('fs');

['cricket.html', 'kabaddi.html', 'athletics.html'].forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  // Since we know the exact HTML structure we just generated, 
  // we can use a regex to insert the schedule button right after the YT link.
  
  const sport = file.replace('.html', '');
  
  // We want to replace:
  // <a href="https://www.youtube.com/results?search_query=..." target="_blank" class="drill-yt-link" ...>▶ Watch on YouTube 📺</a>
  // With the same thing PLUS the schedule button.

  // Using a regex to match the drill title from the <h3> inside the card, 
  // but wait, regex across multiple lines is tricky. 
  // Let me just re-run full_drills_generator.js but with the new button logic, since I already have full_drills_generator.js ... Oh wait, I deleted it? 
  // Ah, let me check if it's still there.
});
