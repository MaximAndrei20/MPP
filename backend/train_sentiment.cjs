const fs = require('fs');
const path = require('path');

// Training dataset (Positive, Negative, Neutral comments)
const trainingData = [
  // ROMANIAN - POSITIVE
  { text: "Acesta este un articol excelent si foarte bine structurat.", label: "positive" },
  { text: "Foarte bun, felicitari autorilor pentru munca depusa!", label: "positive" },
  { text: "O analiza grozava despre teoria transpiratiei. Recomand cu caldura.", label: "positive" },
  { text: "Studiul este foarte interesant si util pentru cercetarea noastra.", label: "positive" },
  { text: "Un text clar, bine scris, cu concluzii deosebit de valoroase.", label: "positive" },
  { text: "Ador modul in care a fost prezentata aceasta ipoteza. Excelenta treaba!", label: "positive" },
  { text: "Este perfect corect din punct de vedere stiintific. Bravo!", label: "positive" },
  { text: "Multumesc pentru aceste explicatii clare. Da, sunt de acord.", label: "positive" },
  { text: "Super rezultat, foarte multumit de calitatea analizei.", label: "positive" },
  { text: "Un articol de nota 10, deosebit de educativ.", label: "positive" },
  { text: "Cercetarea este uimitoare, rezultate foarte bune.", label: "positive" },
  { text: "Imi place foarte mult stilul academic si claritatea argumentelor.", label: "positive" },
  { text: "Excelent redactat, foarte placut si usor de parcurs.", label: "positive" },
  { text: "O idee stralucita, excelent exemplificata.", label: "positive" },
  { text: "Grozav, extrem de multumit de rezultate.", label: "positive" },
  { text: "Foarte bine realizat, felicitari intregii echipe.", label: "positive" },
  
  // ROMANIAN - NEGATIVE
  { text: "Acest studiu este destul de slab si plin de greseli.", label: "negative" },
  { text: "O lucrare prost redactata, nu recomand deloc citirea ei.", label: "negative" },
  { text: "Exista o mare eroare de logica in primul paragraf. Foarte incorect.", label: "negative" },
  { text: "Explicatiile sunt inutile si neclare. Nu aduce nicio valoare.", label: "negative" },
  { text: "Sunt extrem de dezamagit de modul in care a fost formulata concluzia.", label: "negative" },
  { text: "O mare greseala metodologica. Rezultatele sunt false.", label: "negative" },
  { text: "Textul este urat structurat si foarte greu de urmarit. Slab.", label: "negative" },
  { text: "Nu este corect, lipsesc date esentiale din experiment.", label: "negative" },
  { text: "O analiza critica arata ca ipotezele sunt complet gresite.", label: "negative" },
  { text: "Probleme grave in colectarea datelor. O eroare monumentala.", label: "negative" },
  { text: "Nu imi place deloc abordarea autorului. Lipsa de profesionalism.", label: "negative" },
  { text: "Foarte plictisitor, inutil si incomplet.", label: "negative" },
  { text: "Slab redactat, plin de erori si concluzii gresite.", label: "negative" },
  { text: "Nu recomand deloc, o pierdere totala de timp.", label: "negative" },
  { text: "Datele sunt masluite sau complet incorecte.", label: "negative" },
  { text: "Foarte prost argumentat, nu are baze stiintifice.", label: "negative" },

  // ROMANIAN - NEUTRAL
  { text: "Articolul prezinta datele culese in timpul experimentului.", label: "neutral" },
  { text: "Rezumatul se refera la teoria transpiratiei si a epidermei.", label: "neutral" },
  { text: "A fost depus un raport la departamentul de biologie.", label: "neutral" },
  { text: "Urmatoarele observatii au fost facute la temperatura camerei.", label: "neutral" },
  { text: "Aceasta este o fraza simpla despre stadiul actual al lucrarii.", label: "neutral" },
  { text: "Nu s-au inregistrat modificari semnificative in timpul testelor.", label: "neutral" },
  { text: "Rezultatele sunt listate in tabelul de mai jos.", label: "neutral" },
  { text: "Fiecare participant a completat un chestionar simplu.", label: "neutral" },
  { text: "Cercetatorii au analizat mostrele pe parcursul a trei saptamani.", label: "neutral" },
  { text: "Datele statistice au fost incluse in anexa documentului.", label: "neutral" },
  { text: "Autorul a adaugat referinte la sfarsitul paginii.", label: "neutral" },
  { text: "Acesta este un proiect de cercetare colaborativ.", label: "neutral" },

  // ENGLISH - POSITIVE
  { text: "This is a great article, very well structured and clear.", label: "positive" },
  { text: "Excellent work, I highly recommend reading this study.", label: "positive" },
  { text: "Very interesting findings, positive results overall. Awesome!", label: "positive" },
  { text: "I love the methodology used here. Perfect and correct.", label: "positive" },
  { text: "Thanks to the authors for this useful analysis. Great job!", label: "positive" },
  { text: "Highly educative and positive review. Bravo!", label: "positive" },
  { text: "Everything matches the initial hypothesis. Good and clear.", label: "positive" },
  { text: "Super details, very interesting and highly recommended.", label: "positive" },

  // ENGLISH - NEGATIVE
  { text: "This is a very poor study with many critical errors.", label: "negative" },
  { text: "Wrong methodology, useless data, and wrong conclusions. Bad.", label: "negative" },
  { text: "I am disappointed by the lack of clarity. Very unclear and poor.", label: "negative" },
  { text: "A huge mistake was made in calculations. Incorrect.", label: "negative" },
  { text: "This approach is completely useless and not recommended.", label: "negative" },
  { text: "No evidence found to support the claims. Unclear and bad.", label: "negative" },
  { text: "Poor performance, full of errors and problems.", label: "negative" },

  // ENGLISH - NEUTRAL
  { text: "The researchers gathered samples from different locations.", label: "neutral" },
  { text: "The study was conducted over a period of two months.", label: "neutral" },
  { text: "This paper describes the current state of biological research.", label: "neutral" },
  { text: "Results are detailed in the appendix of the document.", label: "neutral" }
];

function tokenize(text) {
  return text.toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "")
    .split(/\s+/)
    .filter(w => w.length > 1);
}

function train() {
  const classes = ["positive", "negative", "neutral"];
  
  // Count docs and words
  const classDocs = { positive: 0, negative: 0, neutral: 0 };
  const classWordCounts = { positive: 0, negative: 0, neutral: 0 };
  const wordFrequencies = {}; // { word: { positive: 0, negative: 0, neutral: 0 } }
  const totalDocs = trainingData.length;
  const vocab = new Set();

  trainingData.forEach(doc => {
    classDocs[doc.label]++;
    const tokens = tokenize(doc.text);
    tokens.forEach(token => {
      vocab.add(token);
      classWordCounts[doc.label]++;
      if (!wordFrequencies[token]) {
        wordFrequencies[token] = { positive: 0, negative: 0, neutral: 0 };
      }
      wordFrequencies[token][doc.label]++;
    });
  });

  const vocabSize = vocab.size;

  // Priors
  const priors = {};
  classes.forEach(c => {
    priors[c] = Math.log(classDocs[c] / totalDocs);
  });

  // Calculate Laplace smoothed conditional probabilities
  const conditionalProbs = {};
  vocab.forEach(word => {
    conditionalProbs[word] = {};
    classes.forEach(c => {
      const wordCountInClass = wordFrequencies[word][c];
      const totalWordsInClass = classWordCounts[c];
      const prob = (wordCountInClass + 1) / (totalWordsInClass + vocabSize);
      conditionalProbs[word][c] = Math.log(prob);
    });
  });

  // Default probability for unseen words
  const defaultProbs = {};
  classes.forEach(c => {
    const totalWordsInClass = classWordCounts[c];
    const defaultProb = 1 / (totalWordsInClass + vocabSize);
    defaultProbs[c] = Math.log(defaultProb);
  });

  const model = {
    priors,
    vocab: conditionalProbs,
    defaultProbs
  };

  const outputPath = path.join(__dirname, 'sentiment_weights.json');
  fs.writeFileSync(outputPath, JSON.stringify(model, null, 2), 'utf-8');
  console.log('Successfully trained Naive Bayes classifier. Saved weights to:', outputPath);
  console.log('Vocabulary Size:', vocabSize);
  console.log('Class Documents:', classDocs);
}

train();
