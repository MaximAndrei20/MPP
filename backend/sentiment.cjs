const https = require('https');

// Local Lexicon Dictionary for fallback
// Contains common positive and negative words in English and Romanian
const positiveWords = new Set([
  // Romanian
  'bun', 'bine', 'excelent', 'grozav', 'recomand', 'interesant', 'util', 'clar', 'deosebit',
  'placut', 'frumos', 'ador', 'perfect', 'bravo', 'corect', 'multumesc', 'da', 'ok', 'pozitiv',
  'super',
  // English
  'good', 'well', 'excellent', 'great', 'awesome', 'recommend', 'interesting', 'useful', 'clear',
  'nice', 'love', 'perfect', 'correct', 'thanks', 'thank', 'yes', 'positive'
]);

const negativeWords = new Set([
  // Romanian
  'rau', 'prost', 'slab', 'gresit', 'incorect', 'inutil', 'neclar', 'urat', 'dezamagit', 'eroare',
  'problema', 'lipseste', 'sarcasm', 'nu', 'deloc', 'greseala', 'critic', 'negativ', 'dificil',
  // English
  'bad', 'poor', 'wrong', 'incorrect', 'useless', 'unclear', 'ugly', 'disappointed', 'error',
  'problem', 'missing', 'no', 'not', 'mistake', 'critical', 'negative', 'difficult'
]);

function localAnalyze(text) {
  if (!text) return { score: 0, label: 'neutral' };
  
  const words = text.toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "")
    .split(/\s+/);
  
  let scoreSum = 0;
  let wordCount = 0;
  
  words.forEach(word => {
    if (positiveWords.has(word)) {
      scoreSum += 1;
      wordCount++;
    } else if (negativeWords.has(word)) {
      scoreSum -= 1;
      wordCount++;
    }
  });
  
  const score = wordCount > 0 ? parseFloat((scoreSum / wordCount).toFixed(2)) : 0.0;
  
  let label = 'neutral';
  if (score > 0.2) label = 'positive';
  else if (score < -0.2) label = 'negative';
  
  return { score, label };
}

function googleAnalyze(text, apiKey) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      document: {
        type: 'PLAIN_TEXT',
        content: text
      },
      encodingType: 'UTF8'
    });

    const options = {
      hostname: 'language.googleapis.com',
      port: 443,
      path: `/v1/documents:analyzeSentiment?key=${apiKey}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': postData.length
      }
    };

    const req = https.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseBody);
          if (parsed.error) {
            reject(new Error(parsed.error.message || 'Google NLP error'));
          } else if (parsed.documentSentiment) {
            const score = parseFloat(parsed.documentSentiment.score.toFixed(2));
            let label = 'neutral';
            if (score > 0.25) label = 'positive';
            else if (score < -0.25) label = 'negative';
            resolve({ score, label });
          } else {
            reject(new Error('Unexpected response format'));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', (e) => { reject(e); });
    req.write(postData);
    req.end();
  });
}

async function analyzeSentiment(text) {
  const apiKey = process.env.GOOGLE_NLP_KEY;
  if (apiKey) {
    try {
      console.log('Using Google Cloud NLP API for sentiment analysis...');
      return await googleAnalyze(text, apiKey);
    } catch (e) {
      console.error('Google Cloud NLP failed, falling back to local analysis:', e.message);
      return localAnalyze(text);
    }
  } else {
    console.log('No Google Cloud NLP key configured, using local lexicon analysis...');
    return localAnalyze(text);
  }
}

module.exports = {
  analyzeSentiment,
  localAnalyze
};
