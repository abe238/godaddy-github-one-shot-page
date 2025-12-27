#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyAGS_J1VZiJM4SU0KptMIHp2oqUgKP9T2Y';
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent';

const PROMPT = 'Place this screenshot on a MacBook Pro screen. Front-facing view, straight on, screen fills most of the frame. The text on screen must be sharp and clearly readable. Simple white or light gray background. No angle, no tilt, looking directly at the screen.';

const screenshots = [
  { input: 'img/cli-help.png', output: 'img/mockup-cli-help.png', prompt: PROMPT },
  { input: 'img/cli-plan.png', output: 'img/mockup-cli-plan.png', prompt: PROMPT },
  { input: 'img/desktop-main.png', output: 'img/mockup-desktop-main.png', prompt: PROMPT },
  { input: 'img/desktop-settings.png', output: 'img/mockup-desktop-settings.png', prompt: PROMPT },
  { input: 'img/webui-main.png', output: 'img/mockup-webui-main.png', prompt: PROMPT },
  { input: 'img/webui-settings.png', output: 'img/mockup-webui-settings.png', prompt: PROMPT }
];

async function generateMockup(inputPath, outputPath, prompt) {
  console.log(`\n📸 Processing: ${inputPath}`);

  const fullInputPath = path.join(process.cwd(), inputPath);
  const imageBuffer = fs.readFileSync(fullInputPath);
  const base64Image = imageBuffer.toString('base64');
  const mimeType = 'image/png';

  const requestBody = {
    contents: [{
      parts: [
        { text: prompt },
        {
          inline_data: {
            mime_type: mimeType,
            data: base64Image
          }
        }
      ]
    }],
    generationConfig: {
      responseModalities: ["IMAGE", "TEXT"]
    }
  };

  console.log(`   Sending to Gemini...`);

  const response = await fetch(`${API_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error ${response.status}: ${error}`);
  }

  const result = await response.json();

  // Extract image from response
  const candidates = result.candidates || [];
  if (candidates.length === 0) {
    throw new Error('No candidates in response');
  }

  const parts = candidates[0].content?.parts || [];
  const imagePart = parts.find(p => p.inlineData || p.inline_data);

  if (!imagePart) {
    console.log('   Response:', JSON.stringify(result, null, 2));
    throw new Error('No image in response');
  }

  const imageData = imagePart.inlineData || imagePart.inline_data;
  const outputBuffer = Buffer.from(imageData.data, 'base64');

  const fullOutputPath = path.join(process.cwd(), outputPath);
  fs.writeFileSync(fullOutputPath, outputBuffer);

  console.log(`   ✅ Saved: ${outputPath}`);
  return outputPath;
}

async function main() {
  console.log('🎨 Generating MacBook mockups with Gemini...\n');

  const results = [];

  for (const screenshot of screenshots) {
    try {
      await generateMockup(screenshot.input, screenshot.output, screenshot.prompt);
      results.push({ ...screenshot, success: true });
      // Rate limit delay
      await new Promise(r => setTimeout(r, 2000));
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
      results.push({ ...screenshot, success: false, error: error.message });
    }
  }

  console.log('\n📊 Summary:');
  const successful = results.filter(r => r.success).length;
  console.log(`   ${successful}/${results.length} mockups generated`);

  if (successful < results.length) {
    console.log('\n   Failed:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`   - ${r.input}: ${r.error}`);
    });
  }
}

main().catch(console.error);
