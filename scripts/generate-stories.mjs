import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env.local manually
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

const prompts = [
  {
    name: "story-1-chamada-principal",
    prompt: `Design a premium Instagram Story (1080x1920, vertical 9:16) for a mental health app called "Suporte Bipolar".

BRAND: The logo is a minimalist brain made of connected nodes/dots in teal green (#527a6e). The app name is "Suporte Bipolar" in bold dark text. Tagline: "Seu painel de estabilidade".

CONTENT: This is a call for BETA TESTERS. The text should be in Brazilian Portuguese:
- Top: "PROCURAMOS VOCÊ" in large bold text
- Middle: Show the brain logo icon in teal (#527a6e)
- Below logo: "Suporte Bipolar" brand name
- Main message: "Você tem diagnóstico de Transtorno Bipolar?"
- Secondary: "Estamos buscando pessoas para testar nosso app gratuitamente"
- Bottom CTA: "Mande DM para participar 👋"
- Small footer: "100% gratuito · Dados protegidos (LGPD)"

STYLE: Clean, modern, warm beige/cream background (#f5f0eb), teal accents (#527a6e), professional but approachable. No clinical/cold feel. Typography-focused, minimal illustrations. Feels like a premium wellness brand, not a medical pamphlet.`
  },
  {
    name: "story-2-funcionalidades",
    prompt: `Design a premium Instagram Story (1080x1920, vertical 9:16) for a mental health app called "Suporte Bipolar".

BRAND: Teal green (#527a6e) accent color, warm beige background (#f5f0eb).

CONTENT: Showcase what the app does. Text in Brazilian Portuguese:
- Top: "Suporte Bipolar" with the brain nodes logo in teal
- Subtitle: "O que o app faz por você:"
- Feature list with simple icons:
  ✓ Acompanha seu humor e energia diariamente
  ✓ Monitora seu sono via Apple Watch
  ✓ Score de Estabilidade personalizado
  ✓ Alertas inteligentes de episódios
  ✓ Relatórios para seu psiquiatra
- Bottom: "Vagas limitadas para beta testers"
- CTA: "Mande DM → @julioyamada"

STYLE: Clean card-based layout, each feature in a subtle card/row. Modern, premium, warm. The overall feel should be empowering and hopeful, not clinical. Use teal (#527a6e) for checkmarks and accents.`
  },
  {
    name: "story-3-quem-pode",
    prompt: `Design a premium Instagram Story (1080x1920, vertical 9:16) for a mental health app called "Suporte Bipolar".

BRAND: Teal green (#527a6e), warm beige/cream background (#f5f0eb). Brain nodes logo.

CONTENT: Explain who can participate. Text in Brazilian Portuguese:
- Top: Small "Suporte Bipolar" logo + name
- Main heading: "Quem pode participar?"
- Three criteria cards/sections:
  1. "Tem diagnóstico de Transtorno Bipolar" (with a subtle checkmark)
  2. "Usa iPhone no dia a dia" (with phone icon hint)
  3. "Quer ajudar a construir algo que faz diferença" (with heart icon hint)
- Divider
- "O app NÃO substitui seu tratamento. É uma ferramenta de apoio ao acompanhamento."
- Bottom CTA: "Interessado(a)? Mande um DM 💬"
- Footer: "@julioyamada"

STYLE: Friendly, warm, inviting. Each criterion in a rounded card with soft shadow. Premium wellness aesthetic. Empathetic and careful tone reflected in the design.`
  },
];

async function generateStory(config) {
  console.log(`\n🎨 Gerando: ${config.name}...`);
  try {
    const response = await openai.images.generate({
      model: "gpt-image-1",
      prompt: config.prompt,
      n: 1,
      size: "1024x1536",
      quality: "high",
    });

    const imageData = response.data[0];

    if (imageData.b64_json) {
      const buffer = Buffer.from(imageData.b64_json, "base64");
      const filePath = path.join(outputDir, `${config.name}.png`);
      fs.writeFileSync(filePath, buffer);
      console.log(`✅ Salvo: ${filePath}`);
    } else if (imageData.url) {
      console.log(`🔗 URL: ${imageData.url}`);
      // Download the image
      const res = await fetch(imageData.url);
      const buffer = Buffer.from(await res.arrayBuffer());
      const filePath = path.join(outputDir, `${config.name}.png`);
      fs.writeFileSync(filePath, buffer);
      console.log(`✅ Salvo: ${filePath}`);
    }
  } catch (err) {
    console.error(`❌ Erro em ${config.name}:`, err.message);
    if (err.error) console.error("  Detalhes:", JSON.stringify(err.error, null, 2));
  }
}

console.log("🚀 Gerando 3 Stories para beta testers...\n");
console.log("Output:", outputDir);

for (const p of prompts) {
  await generateStory(p);
}

console.log("\n✅ Concluído! Verifique a pasta stories-output/");
