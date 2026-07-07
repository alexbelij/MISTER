/**
 * MISTER — Data Augmentation Engine
 * 
 * Generates additional SFT pairs from existing club data.
 * Techniques:
 * 1. Paraphrasing prompts (same answer, different question phrasing)
 * 2. Perspective shifts (coach → player → analyst voice)
 * 3. Scenario variations (home/away, rain/heat, leading/trailing)
 * 4. Terminology injection (ensure every term appears in multiple contexts)
 * 
 * Usage: node src/pipeline/augment.js [--input data/sft_pairs.json] [--output data/sft_pairs_augmented.json] [--multiplier 2]
 */

const fs = require('fs');
const path = require('path');
const log = require('../utils/logger');
const { readJSON, writeJSON, shuffle, generateId } = require('../utils/helpers');

// Paraphrase templates for prompts
const PROMPT_PARAPHRASES = {
  'game plan': ['How should we approach', 'What\'s our strategy against', 'Give me the game plan for', 'How do we play against', 'What\'s the plan vs'],
  'evaluate': ['Assess', 'How is', 'What do you think of', 'Break down', 'Analyze'],
  'weakness': ['What are their weaknesses', 'Where are they vulnerable', 'How can we exploit them', 'What are their soft spots', 'Where do we attack them'],
  'training': ['What should we work on in training', 'What do we practice this week', 'Training plan for', 'What drills do we need', 'How do we prepare in training'],
  'explain': ['Explain', 'Walk me through', 'How does', 'What is', 'Describe'],
  'fix': ['How do we fix', 'What\'s the solution for', 'How do we address', 'How do we handle', 'What do we do about'],
};

// Scenario modifiers for completions
const SCENARIO_MODIFIERS = [
  { tag: 'home', prefix: 'At home, ', suffix: ' The crowd will be behind us — set the tone early.' },
  { tag: 'away', prefix: 'Away from home, ', suffix: ' More discipline, same identity. Compact block is even more important.' },
  { tag: 'rain', prefix: 'In heavy rain, ', suffix: ' Shorter passes, careful first touches. Same principles, adjusted execution.' },
  { tag: 'heat', prefix: 'In extreme heat, ', suffix: ' Manage the pressing intensity. Press in waves, hydrate, sub earlier.' },
  { tag: 'leading', prefix: 'If we\'re 1-0 up, ', suffix: ' Compact block, see it out. Don\'t concede cheap fouls.' },
  { tag: 'trailing', prefix: 'If we\'re 1-0 down, ', suffix: ' Don\'t panic. Verticality. Channel runs. Trust the structure.' },
];

// Perspective shifts
const PERSPECTIVES = [
  { tag: 'coach', systemPrefix: 'As the coach, ', voiceAdjust: (text) => text },
  { tag: 'player', systemPrefix: 'From a player\'s perspective, ', voiceAdjust: (text) => text.replace(/we should/g, 'I should').replace(/our/g, 'my') },
  { tag: 'analyst', systemPrefix: 'From an analyst\'s view, ', voiceAdjust: (text) => 'Analysis: ' + text.replace(/!/g, '.').replace(/\n/g, '\n') },
];

async function main() {
  const inputPath = process.argv.find(a => a.startsWith('--input='))?.split('=')[1] || 'data/sft_pairs.json';
  const outputPath = process.argv.find(a => a.startsWith('--output='))?.split('=')[1] || 'data/sft_pairs_augmented.json';
  const multiplier = parseInt(process.argv.find(a => a.startsWith('--multiplier='))?.split('=')[1] || '2');

  if (!fs.existsSync(inputPath)) {
    log.error('augment', 'Input file not found', { path: inputPath });
    process.exit(1);
  }

  const original = readJSON(inputPath);
  log.info('augment', 'Loaded original pairs', { count: original.length });

  let augmented = [...original];

  // 1. Paraphrase prompts
  for (const pair of original) {
    const paraphrased = paraphrasePrompt(pair);
    if (paraphrased) {
      augmented.push(paraphrased);
    }
  }
  log.info('augment', 'Paraphrased prompts added', { newCount: augmented.length - original.length });

  // 2. Scenario variations
  const beforeScenario = augmented.length;
  for (const pair of original) {
    // Add 2-3 scenario variants per pair
    const scenarios = shuffle(SCENARIO_MODIFIERS).slice(0, 2);
    for (const scenario of scenarios) {
      augmented.push({
        prompt: pair.prompt + ` (context: ${scenario.tag})`,
        completion: scenario.prefix + pair.completion + scenario.suffix,
        _augmented: true,
        _augmentationType: 'scenario',
        _scenario: scenario.tag,
      });
    }
  }
  log.info('augment', 'Scenario variants added', { newCount: augmented.length - beforeScenario });

  // 3. Terminology injection — ensure key terms appear in multiple contexts
  const KEY_TERMS = ['pressing trigger', 'channel run', 'flank overload', 'compact block', 'transition lock', 'rest-defence', 'verticality', 'build patience'];
  const beforeTerm = augmented.length;

  for (const term of KEY_TERMS) {
    // Check if term appears in enough pairs
    const pairsWithTerm = augmented.filter(p => p.completion.toLowerCase().includes(term));
    if (pairsWithTerm.length < 5) {
      // Generate a pair specifically for this term
      augmented.push({
        prompt: `Explain the concept of "${term}" in our system.`,
        completion: generateTerminologyExplanation(term),
        _augmented: true,
        _augmentationType: 'terminology_injection',
        _term: term,
      });
    }
  }
  log.info('augment', 'Terminology injections added', { newCount: augmented.length - beforeTerm });

  // 4. Perspective shifts (for a subset)
  const beforePerspective = augmented.length;
  const perspectiveSubset = shuffle(original).slice(0, Math.floor(original.length / 3));
  for (const pair of perspectiveSubset) {
    const perspective = PERSPECTIVES[Math.floor(Math.random() * PERSPECTIVES.length)];
    augmented.push({
      prompt: perspective.systemPrefix + pair.prompt.toLowerCase(),
      completion: perspective.voiceAdjust(pair.completion),
      _augmented: true,
      _augmentationType: 'perspective',
      _perspective: perspective.tag,
    });
  }
  log.info('augment', 'Perspective shifts added', { newCount: augmented.length - beforePerspective });

  // Cap at multiplier * original
  const maxCount = original.length * multiplier;
  if (augmented.length > maxCount) {
    // Keep all original + random subset of augmented
    const originalIds = new Set(original.map((_, i) => i));
    const augmentedOnly = augmented.filter(p => p._augmented);
    const kept = shuffle(augmentedOnly).slice(0, maxCount - original.length);
    augmented = [...original, ...kept];
  }

  // Deduplicate by prompt
  const seen = new Set();
  augmented = augmented.filter(p => {
    const key = p.prompt.toLowerCase().substring(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  writeJSON(outputPath, augmented);
  log.info('augment', 'Augmentation complete', {
    original: original.length,
    augmented: augmented.length,
    multiplier: (augmented.length / original.length).toFixed(1) + 'x',
    path: outputPath
  });

  console.log(`\n✓ Augmentation complete:`);
  console.log(`  Original: ${original.length} pairs`);
  console.log(`  Augmented: ${augmented.length} pairs`);
  console.log(`  Multiplier: ${(augmented.length / original.length).toFixed(1)}x`);
  console.log(`  Output: ${outputPath}`);
}

function paraphrasePrompt(pair) {
  const prompt = pair.prompt.toLowerCase();

  for (const [keyword, templates] of Object.entries(PROMPT_PARAPHRASES)) {
    if (prompt.includes(keyword)) {
      // Find the subject (text after the keyword)
      const idx = prompt.indexOf(keyword);
      const subject = pair.prompt.substring(idx + keyword.length).trim();

      // Pick a random template
      const template = templates[Math.floor(Math.random() * templates.length)];
      const newPrompt = template + ' ' + subject;

      return {
        prompt: newPrompt,
        completion: pair.completion,
        _augmented: true,
        _augmentationType: 'paraphrase',
      };
    }
  }
  return null;
}

function generateTerminologyExplanation(term) {
  const explanations = {
    'pressing trigger': 'The pressing trigger is our green light. When the ball-side CB receives facing his own goal, the ball-side winger collapses on him. That\'s the trigger — read the body shape, go. The 9 cuts the passing lane to the other CB. The 6 marks their 6. Everyone has a role. If the CB is facing forward, hold — don\'t trigger. Read the body shape. Facing his own goal: green light. Facing forward: hold. That\'s the pressing trigger.',
    'channel run': 'The channel run is our 9 peeling into the channel between the CB and FB. Hartmann does this — left foot, drags the marker, opens the pocket for the 10. When the 9 peels, the CB has to choose: follow him or stay. If he follows, the pocket opens for Wendt. If he stays, the 9 has space. Either way, we win. The ball has to be early — if it\'s late, the CB recovers. Channel run: peel, drag, open. That\'s the pattern.',
    'flank overload': 'The flank overload is our right-side pattern. Krüger pins the LB. Wendt drifts wide to create the 2v1. Heil underlaps. That\'s three players on the ball side. The left side stays narrow as an outlet. When the 10 drifts, their FB has to choose: follow the 10 or stay on the winger. Either way, we have the advantage. Flank overload: winger pins, 10 drifts, fullback underlaps. Create the 2v1. That\'s our pattern.',
    'compact block': 'The compact block is our defensive structure when we lose the ball. Everyone within 30m of the ball. No one jogs back — sprint to position. Back four plus the 6, 18-20m between lines. No chasing shadows. The 6 marks their 6. The 8 presses their 8. The 10 covers the pocket. Everyone has a role. Discipline over chasing. We press with structure, not with everyone. Compact block: 30m, 18-20m, sprint to position. That\'s our shield.',
    'transition lock': 'Transition lock is our rule when we win the ball high: two touches max. Shot or cross. No recycling. When we win it in their half, their defense is disorganized — that\'s the window. Three touches and the window closes. First touch: control. Second touch: shot or cross. If the shot isn\'t on, cross. If the cross isn\'t on, find the 9 in the channel. But don\'t hold it. Transition lock: two touches, shot or cross, no recycling. That\'s where our goals come from.',
    'rest-defence': 'Rest-defence is our structure when we have the ball in the opponent\'s half. Back four plus the 6 — five players, compact, 18-20m between lines. No one from the rest-defence chases the ball. If we lose it, compact block immediately. The 6 stays central, screens the back four. The CBs hold the line. Fullbacks: if they overlap, the 6 covers. If they don\'t, they stay in the line. Rest-defence: compact, connected, ready to press. That\'s how we win it back quickly.',
    'verticality': 'Verticality means: forward first, sideways only as a last resort. If the 6 receives between lines, the first look is forward to the 10 or into the channel for the 9. Don\'t go sideways — that\'s what the opponent wants. It gives them time to reset. Vertical doesn\'t mean long ball. It means: can we play forward? If yes, play forward. If no, circulate — but with purpose. The opposite of verticality is recycling — passing sideways without intent. That\'s not us. Verticality: forward first, always.',
    'build patience': 'Build patience is our approach against a mid-block or low block. Don\'t force it. Circulate at the back, wait for their 6 to step, then play through. If they sit deep, don\'t shoot from distance. Work it into the box. Switch the point of attack. Pull their block apart. Build patience doesn\'t mean slow — it means purposeful. Every pass has intent. Wait for the trigger, then vertical. Build patience: circulate with purpose, wait for the trigger, then strike.',
  };

  return explanations[term] || `"${term}" is a key concept in our game model. It defines how we play and how we think about the game. Every player needs to understand it and execute it.`;
}

main().catch(err => {
  log.error('augment', 'Augmentation error', { error: err.message });
  process.exit(1);
});
