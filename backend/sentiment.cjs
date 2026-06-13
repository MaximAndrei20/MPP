const https = require('https');
const fs = require('fs');
const path = require('path');

// Load Naive Bayes weights
let model = null;
try {
  const weightsPath = path.join(__dirname, 'sentiment_weights.json');
  if (fs.existsSync(weightsPath)) {
    model = JSON.parse(fs.readFileSync(weightsPath, 'utf-8'));
  }
} catch (e) {
  console.error('Failed to load sentiment_weights.json:', e);
}

function tokenize(text) {
  return text.toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "")
    .split(/\s+/)
    .filter(w => w.length > 1);
}

function localAnalyze(text) {
  if (!model) {
    console.warn("Sentiment weights model not loaded. Returning neutral.");
    return { score: 0, label: 'neutral' };
  }

  const tokens = tokenize(text || "");
  if (tokens.length === 0 || !tokens.some(t => model.vocab[t])) {
    return { score: 0.0, label: 'neutral' };
  }
  const classes = ["positive", "negative", "neutral"];
  
  // Calculate log likelihood for each class
  const logLikelihoods = {};
  classes.forEach(c => {
    logLikelihoods[c] = model.priors[c];
    tokens.forEach(token => {
      if (model.vocab[token]) {
        logLikelihoods[c] += model.vocab[token][c];
      } else {
        logLikelihoods[c] += model.defaultProbs[c];
      }
    });
  });

  // Find class with maximum log probability
  let bestClass = "neutral";
  let maxLogProb = -Infinity;
  classes.forEach(c => {
    if (logLikelihoods[c] > maxLogProb) {
      maxLogProb = logLikelihoods[c];
      bestClass = c;
    }
  });

  // Calculate score between -1.0 and 1.0
  // Score = P(positive) - P(negative) using softmax/exp normalize
  // Subtracting maxLogProb to avoid overflow during exponentiation (log-sum-exp trick)
  const shift = Math.max(logLikelihoods.positive, logLikelihoods.negative, logLikelihoods.neutral);
  const expPos = Math.exp(logLikelihoods.positive - shift);
  const expNeg = Math.exp(logLikelihoods.negative - shift);
  const expNeu = Math.exp(logLikelihoods.neutral - shift);
  const sumExp = expPos + expNeg + expNeu;
  
  const probPos = expPos / sumExp;
  const probNeg = expNeg / sumExp;
  
  let score = parseFloat((probPos - probNeg).toFixed(2));
  if (bestClass === 'neutral') {
    score = 0.0;
  }
  
  return {
    score,
    label: bestClass
  };
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
    console.log('No Google Cloud NLP key configured, using local Naive Bayes analysis...');
    return localAnalyze(text);
  }
}

module.exports = {
  analyzeSentiment,
  localAnalyze
};
