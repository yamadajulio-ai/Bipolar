import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const envPath = path.join(__dirname, "..", ".env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    let val = match[2].trim().replace(/^"|"$/g, "").replace(/\\n$/, "");
    process.env[key] = val;
  }
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const outputDir = path.join(__dirname, "..", "stories-output");
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

const prompt = `Design an Instagram Story (vertical, 1024x1536) that EXACTLY matches this carousel slide style:

DESIGN SYSTEM TO MATCH PRECISELY:
- Background: warm cream/off-white (#f5f0eb)
- All icons and text in dark teal (#527a6e)
- Layout: large bold title at top, then vertical list of items
- Each list item: a teal OUTLINE icon on the left (stroke style, not filled, like line icons) + bold dark teal text on the right
- Icons are large (~60px), simple outline/stroke style, centered vertically with text
- Text is bold, ~24-28pt equivalent, dark teal color
- Generous vertical spacing between items (about 60-80px between each row)
- Clean, minimal, NO cards, NO boxes, NO shadows — just icon + text rows on plain cream background
- The overall feel is: premium, clinical but warm, very clean

CONTENT FOR THIS STORY — recruiting beta testers:

Title at top (large bold, centered): "Beta Testers"

Then 4 icon+text rows, each with an outline teal icon on left and bold teal text on right:

1. Icon: magnifying glass with person (search people icon, outline) — Text: "Estamos procurando você"
2. Icon: brain outline (neural nodes style) — Text: "Tem diagnóstico de Transtorno Bipolar?"
3. Icon: smartphone outline — Text: "Utiliza iPhone no dia a dia?"
4. Icon: heart outline — Text: "100% gratuito e sem anúncios"

Then a prominent CTA section at the bottom — a rounded rectangle button shape in solid teal (#527a6e) with white bold text inside: "Arraste para cima ou envie uma DM"

Below the button, smaller muted teal text centered: "Vagas limitadas · @julioyamada"

CRITICAL: The icons MUST be outline/stroke style (not filled), matching the exact aesthetic of: lock outline, cross/plus outline, heart outline, shield-check outline — all in teal #527a6e on cream background. This must look like it's from the same Instagram carousel.`;

console.log("🎨 Gerando Story final (estilo do post original)...\n");

try {
  const response = await openai.images.generate({
    model: "gpt-image-1",
    prompt,
    n: 1,
    size: "1024x1536",
    quality: "high",
  });

  const imageData = response.data[0];
  const filePath = path.join(outputDir, "story-final-beta-testers.png");

  if (imageData.b64_json) {
    fs.writeFileSync(filePath, Buffer.from(imageData.b64_json, "base64"));
  } else if (imageData.url) {
    const res = await fetch(imageData.url);
    fs.writeFileSync(filePath, Buffer.from(await res.arrayBuffer()));
  }

  console.log(`✅ Salvo: ${filePath}`);
} catch (err) {
  console.error("❌ Erro:", err.message);
  if (err.error) console.error("Detalhes:", JSON.stringify(err.error, null, 2));
}
